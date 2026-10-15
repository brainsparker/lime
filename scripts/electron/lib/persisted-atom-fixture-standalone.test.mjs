// @vitest-environment node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashBytes } from "./persisted-atom-fixture-driver.mjs";
import {
  bundlePersistedAtomOwners,
  parsePersistedAtomStandaloneArgs,
  runPersistedAtomStandalone,
} from "./persisted-atom-fixture-standalone.mjs";

const ownedTestRoots = new Set();
async function createTestRoot(prefix) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  ownedTestRoots.add(root);
  return root;
}
afterEach(async () => {
  for (const root of ownedTestRoots) {
    await fs.rm(root, { recursive: true, force: true });
    ownedTestRoots.delete(root);
  }
});
const relativeSources = {
  protocol: "src/lib/api/persistedAtomProtocol.ts",
  types: "src/lib/api/persistedAtomTypes.ts",
  records: "electron/persistedAtomRecords.ts",
  appDataPaths: "electron/appDataPaths.ts",
};

async function sourceProject() {
  const repoRoot = await createTestRoot("lime-persisted-atom-standalone-unit-");
  const ownerSha256 = {};
  for (const [label, relative] of Object.entries(relativeSources)) {
    const filePath = path.join(repoRoot, relative);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const content = `explicit fake ${label} owner source; unit orchestration only`;
    await fs.writeFile(filePath, content);
    ownerSha256[label] = hashBytes(Buffer.from(content));
  }
  const packet = { ownerSha256 };
  const build = vi.fn(async ({ outfile }) => {
    // This is a fake compiler result, not a copied production validator schema.
    await fs.writeFile(
      outfile,
      `
export function parsePersistedAtomReadRequest(value) { return value; }
export function parsePersistedAtomReadResult(value) { return value; }
export function parsePersistedAtomUpdateResult(value) { return value; }
export function parsePersistedAtomUpdateEvent(value) { return value; }
export function parseEnvelope(value) { return value; }
export function resolveDesktopStorageRoots() { return {}; }
export const PERSISTED_ATOM_LIMITS = { maxFileBytes: 1000 };
`,
    );
    return {
      metafile: {
        inputs: Object.fromEntries(
          [
            "persisted-atom-owner-entry.mjs",
            ...Object.values(relativeSources),
          ].map((name) => [name, {}]),
        ),
      },
    };
  });
  return { repoRoot, workDir: repoRoot, packet, build };
}

describe("standalone pure-owner compiler orchestration (fake compiler, no product build)", () => {
  it("points esbuild to only the unique current source owners and records their hashes", async () => {
    const p = await sourceProject();
    const bundle = await bundlePersistedAtomOwners(p);
    const options = p.build.mock.calls[0][0];
    expect(options).toMatchObject({
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node24",
      metafile: true,
      logLevel: "silent",
    });
    for (const label of ["protocol", "records", "appDataPaths"])
      expect(options.stdin.contents).toContain(
        JSON.stringify(path.join(p.repoRoot, relativeSources[label])),
      );
    expect(options.stdin.contents).not.toContain("PersistedAtomStore");
    expect(options.stdin.contents).toContain("parsePersistedAtomReadRequest");
    expect(typeof bundle.protocol.parseReadRequest).toBe("function");
    expect(bundle.receipt.sources.protocol.sha256).toBe(
      p.packet.ownerSha256.protocol,
    );
    expect(Object.keys(bundle.receipt.dependencies)).toContain(
      path.join(p.repoRoot, relativeSources.protocol),
    );
    expect(bundle.receipt.compilationScope).toContain("no product build");
  });

  it.each(["protocol", "types", "records", "appDataPaths"])(
    "rejects %s source drift before compilation",
    async (label) => {
      const p = await sourceProject();
      await fs.appendFile(
        path.join(p.repoRoot, relativeSources[label]),
        "drift",
      );
      await expect(bundlePersistedAtomOwners(p)).rejects.toThrow(
        /current pure owner/,
      );
      expect(p.build).not.toHaveBeenCalled();
    },
  );

  it("rejects source mutation while the isolated compiler is running", async () => {
    const p = await sourceProject();
    const original = p.build.getMockImplementation();
    p.build.mockImplementation(async (options) => {
      const result = await original(options);
      await fs.appendFile(
        path.join(p.repoRoot, relativeSources.protocol),
        "drift",
      );
      return result;
    });
    await expect(bundlePersistedAtomOwners(p)).rejects.toThrow(
      /unchanged pure owner/,
    );
  });

  it("cannot treat a module built from a different schema input as current owner evidence", async () => {
    const p = await sourceProject();
    const original = p.build.getMockImplementation();
    p.build.mockImplementation(async (options) => {
      const result = await original(options);
      delete result.metafile.inputs[relativeSources.protocol];
      return result;
    });
    await expect(bundlePersistedAtomOwners(p)).rejects.toThrow(
      /unique current owner inputs/,
    );
  });
});

describe("standalone argument and failure boundary", () => {
  const argv = [
    "--run-id",
    "persistence-test",
    "--evidence-dir",
    "./evidence",
    "--verification-packet",
    "./packet.json",
  ];

  it("requires explicit packet/evidence identity and bounded timeouts", () => {
    expect(parsePersistedAtomStandaloneArgs(argv, "/repo")).toMatchObject({
      repoRoot: "/repo",
      evidenceDir: "/repo/evidence",
      packetPath: "/repo/packet.json",
      runId: "persistence-test",
      timeoutMs: 10000,
      quitTimeoutMs: 15000,
    });
    expect(parsePersistedAtomStandaloneArgs(["--help"], "/repo").help).toBe(
      true,
    );
  });

  it.each(
    [
      [],
      ["--unknown", "true"],
      [...argv, "--timeout-ms", "Infinity"],
      [...argv, "--quit-timeout-ms", "60001"],
      [...argv, "--run-id", "../other-profile"],
    ].map((input) => ({ input })),
  )("rejects invalid or unbounded standalone input", ({ input }) => {
    expect(() => parsePersistedAtomStandaloneArgs(input, "/repo")).toThrow(
      /driver failed/,
    );
  });

  it("fails before launching when the unique current fixture source is unavailable", async () => {
    const p = await sourceProject();
    const packetPath = path.join(p.repoRoot, "packet.json");
    await fs.writeFile(
      packetPath,
      JSON.stringify({ ...p.packet, fixtureSha256: "a".repeat(64) }),
    );
    const makeDriver = vi.fn();
    const options = {
      repoRoot: p.repoRoot,
      evidenceDir: path.join(p.repoRoot, "evidence"),
      packetPath,
      runId: "missing-fixture",
      timeoutMs: 100,
      quitTimeoutMs: 100,
    };
    await expect(
      runPersistedAtomStandalone(options, { build: p.build, makeDriver }),
    ).rejects.toThrow(/standalone failed/);
    expect(makeDriver).not.toHaveBeenCalled();
    const summary = JSON.parse(
      await fs.readFile(
        path.join(
          options.evidenceDir,
          options.runId,
          "persisted-atom-desktop-persistence.json",
        ),
        "utf8",
      ),
    );
    expect(summary).toMatchObject({
      result: "fail",
      phase: "current-fixture-source",
      runtimeGate: false,
      guiDraftRestoration: false,
      normalExitMustNotBeReplacedByKill: true,
    });
  });

  it("does not overwrite a previous run profile", async () => {
    const p = await sourceProject();
    const options = {
      repoRoot: p.repoRoot,
      evidenceDir: path.join(p.repoRoot, "evidence"),
      packetPath: path.join(p.repoRoot, "packet.json"),
      runId: "existing-run",
    };
    await fs.mkdir(path.join(options.evidenceDir, options.runId), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(options.evidenceDir, options.runId, "keep.json"),
      "retain",
    );
    await expect(
      runPersistedAtomStandalone(options, { build: p.build }),
    ).rejects.toThrow();
    expect(
      await fs.readFile(
        path.join(options.evidenceDir, options.runId, "keep.json"),
        "utf8",
      ),
    ).toBe("retain");
    expect(p.build).not.toHaveBeenCalled();
  });
});
