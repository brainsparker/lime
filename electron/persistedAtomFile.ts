import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { TextDecoder } from "node:util";
import * as fs from "node:fs/promises";
import path from "node:path";
import type {
  PersistedAtomDiagnostic,
  PersistedAtomEnvelope,
} from "../src/lib/api/persistedAtomTypes";
import { parseEnvelope } from "./persistedAtomRecords";
import type { PersistedAtomLimits } from "../src/lib/api/persistedAtomProtocol";

export interface PersistedAtomFileIO {
  readFile(file: string, maxBytes: number): Promise<Buffer>;
  mkdir(directory: string): Promise<void>;
  writeFile(file: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  removeTemporary(file: string): Promise<void>;
}

export const persistedAtomFileIO: PersistedAtomFileIO = {
  readFile: async (file, maxBytes) => {
    const handle = await fs.open(file, "r");
    try {
      if ((await handle.stat()).size > maxBytes)
        throw new PersistedAtomFileError("load", "CAPACITY_EXCEEDED");
      const chunks: Buffer[] = [];
      let total = 0;
      for (;;) {
        const chunk = Buffer.allocUnsafe(
          Math.min(64 * 1024, maxBytes - total + 1),
        );
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
        if (!bytesRead) break;
        total += bytesRead;
        if (total > maxBytes)
          throw new PersistedAtomFileError("load", "CAPACITY_EXCEEDED");
        chunks.push(chunk.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks, total);
    } finally {
      await handle.close();
    }
  },
  mkdir: async (directory) => {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  },
  writeFile: (file, data) =>
    fs.writeFile(file, data, { encoding: "utf8", mode: 0o600, flag: "wx" }),
  rename: (from, to) => fs.rename(from, to),
  removeTemporary: (file) => fs.rm(file, { force: true }),
};

const SAFE_IO_CODES = new Set([
  "ENOENT",
  "EACCES",
  "EPERM",
  "EBUSY",
  "ENOSPC",
  "EIO",
  "EEXIST",
  "ETIMEDOUT",
]);

export class PersistedAtomFileError extends Error {
  readonly diagnostic: PersistedAtomDiagnostic;
  constructor(phase: PersistedAtomDiagnostic["phase"], code: string) {
    super("persisted atom file operation failed");
    this.diagnostic = { phase, code };
  }
}

function ioCode(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  return typeof code === "string" && SAFE_IO_CODES.has(code)
    ? code
    : "IO_ERROR";
}

export interface PersistedAtomFileOptions {
  readonly io?: PersistedAtomFileIO;
  readonly platform?: typeof process.platform;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

type FileRead =
  | { state: "valid"; envelope: PersistedAtomEnvelope }
  | { state: "missing" }
  | { state: "invalid"; code: string };

export class PersistedAtomFile {
  readonly #root: string;
  readonly #io: PersistedAtomFileIO;
  readonly #platform: typeof process.platform;
  readonly #wait: (milliseconds: number) => Promise<void>;
  readonly #limits: PersistedAtomLimits;

  constructor(
    appDataRoot: string,
    limits: PersistedAtomLimits,
    options: PersistedAtomFileOptions = {},
  ) {
    if (!appDataRoot.trim() || !path.isAbsolute(appDataRoot))
      throw new Error("persisted atom requires the resolved AppDataRoot");
    this.#root = path.resolve(appDataRoot);
    this.#io = options.io ?? persistedAtomFileIO;
    this.#platform = options.platform ?? process.platform;
    this.#wait =
      options.wait ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#limits = limits;
  }

  async load(): Promise<{
    envelope: PersistedAtomEnvelope | null;
    recovered: boolean;
  }> {
    const primary = await this.#read(path.join(this.#root, "host-state.json"));
    if (primary.state === "valid")
      return { envelope: primary.envelope, recovered: false };
    const backup = await this.#read(
      path.join(this.#root, "host-state.json.bak"),
    );
    if (backup.state === "valid")
      return { envelope: backup.envelope, recovered: true };
    if (primary.state === "missing" && backup.state === "missing")
      return { envelope: null, recovered: false };
    throw new PersistedAtomFileError(
      "load",
      primary.state === "invalid"
        ? primary.code
        : backup.state === "invalid"
          ? backup.code
          : "INVALID_STATE",
    );
  }

  async save(envelope: PersistedAtomEnvelope): Promise<void> {
    let data: string;
    try {
      data = JSON.stringify(envelope);
      if (Buffer.byteLength(data, "utf8") > this.#limits.maxFileBytes)
        throw new PersistedAtomFileError("serialize", "CAPACITY_EXCEEDED");
    } catch (error) {
      if (error instanceof PersistedAtomFileError) throw error;
      throw new PersistedAtomFileError("serialize", "INVALID_JSON");
    }
    try {
      await this.#io.mkdir(this.#root);
    } catch (error) {
      throw new PersistedAtomFileError("primary", ioCode(error));
    }
    await this.#replace(
      path.join(this.#root, "host-state.json"),
      data,
      "primary",
    );
    await this.#replace(
      path.join(this.#root, "host-state.json.bak"),
      data,
      "backup",
    );
  }

  async #read(file: string): Promise<FileRead> {
    let buffer: Buffer;
    try {
      buffer = await this.#io.readFile(file, this.#limits.maxFileBytes);
    } catch (error) {
      const code =
        error instanceof PersistedAtomFileError &&
        error.diagnostic.code === "CAPACITY_EXCEEDED"
          ? "CAPACITY_EXCEEDED"
          : ioCode(error);
      return code === "ENOENT"
        ? { state: "missing" }
        : { state: "invalid", code };
    }
    if (buffer.byteLength > this.#limits.maxFileBytes)
      return { state: "invalid", code: "CAPACITY_EXCEEDED" };
    try {
      return {
        state: "valid",
        envelope: parseEnvelope(
          JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)),
          this.#limits,
        ),
      };
    } catch {
      return { state: "invalid", code: "INVALID_STATE" };
    }
  }

  async #replace(
    file: string,
    data: string,
    phase: "primary" | "backup",
  ): Promise<void> {
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
    let renamed = false;
    try {
      await this.#io.writeFile(temporary, data);
      for (let attempt = 0; ; attempt += 1) {
        try {
          await this.#io.rename(temporary, file);
          break;
        } catch (error) {
          if (
            this.#platform !== "win32" ||
            !["EPERM", "EACCES", "EBUSY"].includes(ioCode(error)) ||
            attempt >= 3
          )
            throw error;
          await this.#wait(100 * 2 ** attempt);
        }
      }
      renamed = true;
    } catch (error) {
      throw new PersistedAtomFileError(phase, ioCode(error));
    } finally {
      if (!renamed)
        await this.#io.removeTemporary(temporary).catch(() => undefined);
    }
  }
}
