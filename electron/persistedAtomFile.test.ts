import { Buffer } from "node:buffer";
import process from "node:process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedAtomEnvelope } from "../src/lib/api/persistedAtomTypes";
import {
  PersistedAtomFile,
  persistedAtomFileIO,
  type PersistedAtomFileIO,
} from "./persistedAtomFile";
import { scopeKey } from "./persistedAtomRecords";

const roots: string[] = [];
const limits = {
  maxDraftBytes: 2_048,
  maxFileBytes: 8_192,
  maxEntries: 10,
  maxBindings: 10,
};
async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "atom-file-"));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
function data(text = "original", revision = 1): PersistedAtomEnvelope {
  const originScopeKey = scopeKey({
    workspaceId: null,
    kind: "home",
    id: "new-conversation",
  });
  return {
    format: "electron-persisted-atom-state",
    version: 1,
    storeRevision: revision,
    atoms: {
      "composer-drafts-v1": {
        bindings: { [originScopeKey]: "d" },
        entries: {
          d: {
            draftId: "d",
            scopeVersion: `v${revision}`,
            originScopeKey,
            updatedAt: revision,
            state: "draft",
            draft: { text },
          },
        },
      },
    },
  };
}
function failure(code: string): Error {
  return Object.assign(
    new Error("secret user content and attachment data must never escape"),
    { code },
  );
}

describe("persisted atom fixed-file atomic IO", () => {
  it("uses fixed names, private file mode, valid backup and no retained temporary file", async () => {
    const root = await createRoot(),
      file = new PersistedAtomFile(root, limits);
    await file.save(data());
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8")),
    ).toEqual(data());
    expect(await readFile(path.join(root, "host-state.json.bak"), "utf8")).toBe(
      await readFile(path.join(root, "host-state.json"), "utf8"),
    );
    expect((await file.load()).envelope).toEqual(data());
    expect((await readdir(root)).sort()).toEqual([
      "host-state.json",
      "host-state.json.bak",
    ]);
    if (process.platform !== "win32")
      expect(
        (await stat(path.join(root, "host-state.json"))).mode & 0o777,
      ).toBe(0o600);
  });

  it.each(["corrupt", "missing"])(
    "recovers backup when primary is %s",
    async (mode) => {
      const root = await createRoot(),
        file = new PersistedAtomFile(root, limits);
      await file.save(data());
      if (mode === "corrupt")
        await writeFile(path.join(root, "host-state.json"), "{broken");
      else await rm(path.join(root, "host-state.json"));
      expect(await file.load()).toEqual({ envelope: data(), recovered: true });
    },
  );

  it("treats only two missing files as an empty initial profile", async () => {
    const root = await createRoot(),
      file = new PersistedAtomFile(root, limits);
    expect(await file.load()).toEqual({ envelope: null, recovered: false });
    await writeFile(path.join(root, "host-state.json"), "bad");
    await expect(file.load()).rejects.toMatchObject({
      diagnostic: { phase: "load", code: "INVALID_STATE" },
    });
    expect(await readFile(path.join(root, "host-state.json"), "utf8")).toBe(
      "bad",
    );
    expect(await readdir(root)).toEqual(["host-state.json"]);
  });

  it("both corrupt files remain unchanged after a rejected load", async () => {
    const root = await createRoot();
    await writeFile(path.join(root, "host-state.json"), "bad-main");
    await writeFile(path.join(root, "host-state.json.bak"), "bad-backup");
    await expect(
      new PersistedAtomFile(root, limits).load(),
    ).rejects.toMatchObject({
      diagnostic: { phase: "load", code: "INVALID_STATE" },
    });
    expect(await readFile(path.join(root, "host-state.json"), "utf8")).toBe(
      "bad-main",
    );
    expect(await readFile(path.join(root, "host-state.json.bak"), "utf8")).toBe(
      "bad-backup",
    );
  });

  it.each(["write", "rename"])(
    "preserves old primary/backup on %s failure and cleans only the new temporary",
    async (stage) => {
      const root = await createRoot();
      await new PersistedAtomFile(root, limits).save(data());
      const removeTemporary = vi.fn(persistedAtomFileIO.removeTemporary);
      const io: PersistedAtomFileIO = {
        ...persistedAtomFileIO,
        removeTemporary,
        ...(stage === "write"
          ? {
              writeFile: async () => {
                throw failure("ENOSPC");
              },
            }
          : {
              rename: async () => {
                throw failure("EIO");
              },
            }),
      };
      await expect(
        new PersistedAtomFile(root, limits, { io }).save(data("new", 2)),
      ).rejects.toMatchObject({
        diagnostic: {
          phase: "primary",
          code: stage === "write" ? "ENOSPC" : "EIO",
        },
      });
      expect(
        JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8")),
      ).toEqual(data());
      expect(
        JSON.parse(
          await readFile(path.join(root, "host-state.json.bak"), "utf8"),
        ),
      ).toEqual(data());
      expect(removeTemporary).toHaveBeenCalledTimes(1);
      expect(
        removeTemporary.mock.calls.every(([file]) => file.endsWith(".tmp")),
      ).toBe(true);
      expect((await readdir(root)).sort()).toEqual([
        "host-state.json",
        "host-state.json.bak",
      ]);
    },
  );

  it.each(["EPERM", "EACCES", "EBUSY"])(
    "retries Windows %s without deleting the destination",
    async (code) => {
      const root = await createRoot();
      await new PersistedAtomFile(root, limits).save(data());
      let attempts = 0;
      const rename = vi.fn(async (from: string, to: string) => {
        attempts += 1;
        if (attempts <= 3) throw failure(code);
        await persistedAtomFileIO.rename(from, to);
      });
      const removeTemporary = vi.fn(persistedAtomFileIO.removeTemporary),
        wait = vi.fn(async () => undefined);
      await new PersistedAtomFile(root, limits, {
        platform: "win32",
        wait,
        io: { ...persistedAtomFileIO, rename, removeTemporary },
      }).save(data("new", 2));
      expect(wait.mock.calls).toEqual([[100], [200], [400]]);
      expect(rename).toHaveBeenCalledTimes(5);
      expect(removeTemporary).not.toHaveBeenCalled();
      expect(
        JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8")),
      ).toEqual(data("new", 2));
    },
  );

  it("limits Windows retries and leaves the old durable snapshot intact", async () => {
    const root = await createRoot();
    await new PersistedAtomFile(root, limits).save(data());
    const rename = vi.fn(async () => {
        throw failure("EPERM");
      }),
      wait = vi.fn(async () => undefined);
    await expect(
      new PersistedAtomFile(root, limits, {
        platform: "win32",
        wait,
        io: { ...persistedAtomFileIO, rename },
      }).save(data("new", 2)),
    ).rejects.toMatchObject({
      diagnostic: { phase: "primary", code: "EPERM" },
    });
    expect(rename).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
    expect((await new PersistedAtomFile(root, limits).load()).envelope).toEqual(
      data(),
    );
  });

  it.each([
    { platform: "darwin" as const, code: "EPERM" },
    { platform: "win32" as const, code: "EEXIST" },
  ])(
    "does not retry an unsupported replacement error",
    async ({ platform, code }) => {
      const root = await createRoot(),
        rename = vi.fn(async () => {
          throw failure(code);
        }),
        wait = vi.fn(async () => undefined);
      await expect(
        new PersistedAtomFile(root, limits, {
          platform,
          wait,
          io: { ...persistedAtomFileIO, rename },
        }).save(data()),
      ).rejects.toMatchObject({ diagnostic: { code } });
      expect(rename).toHaveBeenCalledTimes(1);
      expect(wait).not.toHaveBeenCalled();
    },
  );

  it("backup replacement failure preserves old backup and reports partial persistence", async () => {
    const root = await createRoot();
    await new PersistedAtomFile(root, limits).save(data());
    const io = {
      ...persistedAtomFileIO,
      rename: async (from: string, to: string) => {
        if (to.endsWith(".bak")) throw failure("EIO");
        await persistedAtomFileIO.rename(from, to);
      },
    };
    await expect(
      new PersistedAtomFile(root, limits, { io }).save(data("new", 2)),
    ).rejects.toMatchObject({ diagnostic: { phase: "backup", code: "EIO" } });
    expect(
      JSON.parse(await readFile(path.join(root, "host-state.json"), "utf8")),
    ).toEqual(data("new", 2));
    expect(
      JSON.parse(
        await readFile(path.join(root, "host-state.json.bak"), "utf8"),
      ),
    ).toEqual(data());
  });

  it("rejects oversize UTF8 file without truncation or any write", async () => {
    const root = await createRoot();
    const bytes = Buffer.byteLength(JSON.stringify(data("中文")), "utf8");
    const exact = new PersistedAtomFile(root, {
      ...limits,
      maxFileBytes: bytes,
    });
    await exact.save(data("中文"));
    await expect(
      new PersistedAtomFile(root, { ...limits, maxFileBytes: bytes - 1 }).save(
        data("中文"),
      ),
    ).rejects.toMatchObject({
      diagnostic: { phase: "serialize", code: "CAPACITY_EXCEEDED" },
    });
    await expect(
      new PersistedAtomFile(root, {
        ...limits,
        maxFileBytes: bytes - 1,
      }).load(),
    ).rejects.toMatchObject({
      diagnostic: { phase: "load", code: "CAPACITY_EXCEEDED" },
    });
    expect((await exact.load()).envelope).toEqual(data("中文"));
  });

  it("filters unknown IO codes and never exposes exception messages", async () => {
    const root = await createRoot();
    const file = new PersistedAtomFile(root, limits, {
      io: {
        ...persistedAtomFileIO,
        readFile: async () => {
          throw failure("private payload");
        },
      },
    });
    const error = await file.load().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      message: "persisted atom file operation failed",
      diagnostic: { phase: "load", code: "IO_ERROR" },
    });
    expect(JSON.stringify(error)).not.toContain("private payload");
    expect(JSON.stringify(error)).not.toContain("secret user content");
  });

  it("bounds native file reads and accepts exactly the declared byte budget", async () => {
    const root = await createRoot(),
      file = path.join(root, "large.json");
    const bytes = Buffer.alloc(1_024, 0x61);
    await writeFile(file, bytes);
    await expect(persistedAtomFileIO.readFile(file, 1_024)).resolves.toEqual(
      bytes,
    );
    await expect(
      persistedAtomFileIO.readFile(file, 1_023),
    ).rejects.toMatchObject({
      diagnostic: { phase: "load", code: "CAPACITY_EXCEEDED" },
    });
    expect(await readFile(file)).toEqual(bytes);
  });

  it("rejects relative/empty roots rather than choosing an arbitrary transport path", () => {
    expect(() => new PersistedAtomFile("relative", limits)).toThrow(
      "resolved AppDataRoot",
    );
    expect(() => new PersistedAtomFile(" ", limits)).toThrow(
      "resolved AppDataRoot",
    );
  });
});
