import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { OpenInTargetPreferences } from "../src/lib/api/openInTypes";

/** One Host-owned global-state value; ordinary open never calls write. */
export class FileTargetPreferences {
  readonly #filePath: string;
  #pending: Promise<unknown> = Promise.resolve();

  constructor(appDataRoot: string) {
    this.#filePath = path.join(appDataRoot, "open-in-target-preferences.json");
  }

  async read(): Promise<OpenInTargetPreferences> {
    await this.#pending;
    return this.#read();
  }

  write(target: string, cwd: string | null): Promise<void> {
    const next = this.#pending.then(async () => {
      const previous = await this.#read();
      const value: OpenInTargetPreferences = { ...previous, global: target };
      if (cwd != null) value.perPath = { ...previous.perPath, [cwd]: target };
      await mkdir(path.dirname(this.#filePath), { recursive: true });
      const temporary = `${this.#filePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(value)}\n`, {
          mode: 0o600,
        });
        await rename(temporary, this.#filePath);
      } finally {
        await rm(temporary, { force: true });
      }
    });
    this.#pending = next.catch(() => undefined);
    return next;
  }

  async #read(): Promise<OpenInTargetPreferences> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.#filePath, "utf8"));
    } catch (error) {
      if ((error as { code?: unknown }).code === "ENOENT") return {};
      throw error;
    }
    if (!isRecord(raw)) throw new Error("Invalid open-in target preferences");
    const result: OpenInTargetPreferences = {};
    if (isTargetId(raw.global)) result.global = raw.global;
    if (isRecord(raw.perPath)) {
      const entries = Object.entries(raw.perPath).filter(
        (entry): entry is [string, string] =>
          path.isAbsolute(entry[0]) && isTargetId(entry[1]),
      );
      if (entries.length) result.perPath = Object.fromEntries(entries);
    }
    return result;
  }
}

function isTargetId(value: unknown): value is string {
  return (
    value === "systemDefault" ||
    value === "fileManager" ||
    (typeof value === "string" &&
      value.startsWith("app:") &&
      path.isAbsolute(value.slice(4)) &&
      value.endsWith(".app"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
