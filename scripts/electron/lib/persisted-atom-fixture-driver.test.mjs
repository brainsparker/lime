import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnvelope } from "../../../electron/persistedAtomRecords";
import { PERSISTED_ATOM_LIMITS } from "../../../src/lib/api/persistedAtomProtocol";
import {
  captureMainProcessExit,
  createPersistedAtomElectronDriver,
  hashBytes,
  quitMainProcessNormally,
  verifyPersistedAtomEventGuard,
} from "./persisted-atom-fixture-driver.mjs";

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
const cases = [
  "allows existing renderer events and rejects Main persistence notifications",
  "does not coerce malformed IPC names or execute their getters",
  "rejects forged saved acknowledgements at the Main IPC handler",
];

async function project({ reportMutator } = {}) {
  const repoRoot = await createTestRoot("lime-persisted-atom-driver-unit-");
  const write = async (relative, text) => {
    const filePath = path.join(repoRoot, relative);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, text);
    return { path: filePath, sha256: hashBytes(Buffer.from(text)) };
  };
  const policy = await write(
    "electron/rendererEventPolicy.ts",
    "explicit fake policy for unit testing",
  );
  const formalTest = await write(
    "electron/rendererEventPolicy.test.ts",
    "explicit fake test source for unit testing",
  );
  const test = await write(
    "frozen/rendererEventPolicy.test.ts",
    "explicit fake test source for unit testing",
  );
  const report = {
    numFailedTests: 0,
    testResults: [
      {
        name: test.path,
        assertionResults: cases.map((title) => ({ title, status: "passed" })),
      },
    ],
  };
  reportMutator?.(report);
  const receipt = await write("policy-test.json", JSON.stringify(report));
  const freshness = await write(
    "scripts/lib/electron-fixture-build.mjs",
    "unit freshness inspector marker",
  );
  await write("dist-electron/main/main.js", "unit host artifact marker");
  await write(
    "dist-electron/preload/preload.cjs",
    "unit preload artifact marker",
  );
  const source = await write(
    "src/lib/api/persistedAtomProtocol.ts",
    "unit frozen source marker",
  );
  const appDataRoot = path.join(repoRoot, "profile");
  await fs.mkdir(appDataRoot);
  const packet = {
    freshnessInspectorSha256: freshness.sha256,
    eventGuard: {
      sourceSha256: policy.sha256,
      testPath: test.path,
      testSha256: test.sha256,
      receiptPath: receipt.path,
      receiptSha256: receipt.sha256,
    },
  };
  const parseEnvelope = vi.fn((value) => {
    if (value.format !== "electron-persisted-atom-state")
      throw new Error("private body rejected");
    return value;
  });
  const ownerBundle = {
    receipt: { sources: { protocol: source } },
    resolveDesktopStorageRoots: vi.fn(({ e2eUserDataDir }) => ({
      appDataRoot: e2eUserDataDir,
      agentRoot: path.join(e2eUserDataDir, "app-server"),
      hostSessionData: e2eUserDataDir,
    })),
    parseEnvelope,
    limits: { maxFileBytes: 1000 },
  };
  return {
    repoRoot,
    appDataRoot,
    packet,
    ownerBundle,
    write,
    policy,
    test,
    formalTest,
    receipt,
  };
}

function fakeMain(
  pid,
  { exitCode = 0, signal = null, noExit = false, quitRejects = false } = {},
) {
  const child = Object.assign(new EventEmitter(), {
    pid,
    exitCode: null,
    signalCode: null,
    kill: vi.fn(),
  });
  const quit = vi.fn(() => {
    if (!noExit)
      setTimeout(() => {
        child.exitCode = exitCode;
        child.signalCode = signal;
        child.emit("exit", exitCode, signal);
      }, 1);
  });
  const app = {
    process: vi.fn(() => child),
    close: vi.fn(async () => {
      quit();
      if (quitRejects) throw new Error("Target closed private body");
    }),
    evaluate: vi.fn(async (callback) => {
      callback({ app: { quit } });
      if (quitRejects) throw new Error("Target closed private body");
    }),
  };
  return { app, child, quit };
}

describe("static event authority companion (unit receipt validation only)", () => {
  it("pins current source, test source, report SHA and all Main IPC authority cases", async () => {
    const p = await project();
    const guard = await verifyPersistedAtomEventGuard({
      repoRoot: p.repoRoot,
      packet: p.packet.eventGuard,
    });
    expect(guard).toMatchObject({
      validated: true,
      sourceSha256: p.policy.sha256,
      proofClass: "static-main-ipc-policy",
      passedCases: 3,
      liveRendererSpoofAttempted: false,
    });
  });

  it.each(["source", "test", "receipt"])("rejects %s drift", async (fault) => {
    const p = await project();
    await fs.appendFile(p[fault === "source" ? "policy" : fault].path, "drift");
    await expect(
      verifyPersistedAtomEventGuard({
        repoRoot: p.repoRoot,
        packet: p.packet.eventGuard,
      }),
    ).rejects.toThrow(/driver failed/);
  });

  it("requires the formal test to match the frozen candidate receipt's exact test source", async () => {
    const p = await project();
    await fs.appendFile(p.formalTest.path, "drift");
    await expect(
      verifyPersistedAtomEventGuard({
        repoRoot: p.repoRoot,
        packet: p.packet.eventGuard,
      }),
    ).rejects.toThrow(/same formal and frozen/);
  });

  it.each(["failed", "missing", "ambiguous", "unrelated"])(
    "cannot declare validated for a %s policy receipt",
    async (fault) => {
      const p = await project({
        reportMutator: (report) => {
          if (fault === "failed")
            report.testResults[0].assertionResults[2].status = "failed";
          if (fault === "missing") report.testResults[0].assertionResults.pop();
          if (fault === "ambiguous")
            report.testResults.push(report.testResults[0]);
          if (fault === "unrelated")
            report.testResults[0].name = "/unrelated.test.ts";
        },
      });
      await expect(
        verifyPersistedAtomEventGuard({
          repoRoot: p.repoRoot,
          packet: p.packet.eventGuard,
        }),
      ).rejects.toThrow(/suite|cases/);
    },
  );
});

describe("normal process exit receipt (fake child process, no Electron)", () => {
  it("uses public application close to release the debugger before Main exit", async () => {
    const { app, child } = fakeMain(505, { noExit: true });
    app.close.mockImplementation(async () => {
      child.exitCode = 0;
      child.emit("exit", 0, null);
    });
    await expect(
      quitMainProcessNormally({ app, exit: captureMainProcessExit(child) }, 5),
    ).resolves.toMatchObject({ exitCode: 0, signal: null, mode: "normal" });
    expect(app.close).toHaveBeenCalledOnce();
    expect(child.kill).not.toHaveBeenCalled();
  });
  it("captures the public Main exit and tolerates app.quit evaluation closing its connection", async () => {
    const { app, child, quit } = fakeMain(501, { quitRejects: true });
    const exit = captureMainProcessExit(child);
    await expect(quitMainProcessNormally({ app, exit }, 100)).resolves.toEqual({
      pid: 501,
      exited: true,
      exitCode: 0,
      signal: null,
      mode: "normal",
    });
    expect(quit).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it.each([
    { exitCode: 1 },
    { exitCode: null, signal: "SIGKILL" },
    { exitCode: 0, signal: "SIGTERM" },
  ])("rejects a non-normal exit", async (options) => {
    const { app, child } = fakeMain(502, options);
    await expect(
      quitMainProcessNormally(
        { app, exit: captureMainProcessExit(child) },
        100,
      ),
    ).rejects.toThrow(/normal Main exit status/);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("fails a bounded timeout without killing or inventing a normal exit", async () => {
    const { app, child } = fakeMain(503, { noExit: true });
    await expect(
      quitMainProcessNormally({ app, exit: captureMainProcessExit(child) }, 2),
    ).rejects.toThrow(/timeout; no kill/);
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("cannot count an already exited Main as requested normal Quit", async () => {
    const { app, child } = fakeMain(504);
    const exit = captureMainProcessExit(child);
    child.emit("exit", 0, null);
    await expect(quitMainProcessNormally({ app, exit }, 100)).rejects.toThrow(
      /before requested normal quit/,
    );
    expect(app.evaluate).not.toHaveBeenCalled();
    expect(app.close).not.toHaveBeenCalled();
  });
});

describe("real-driver orchestration with explicit fake launcher", () => {
  async function configured({ mainOptions, freshness, roots } = {}) {
    const p = await project();
    const apps = [];
    const launch = vi.fn(async (options) => {
      const main = fakeMain(700 + apps.length, mainOptions);
      apps.push(main);
      options.consoleErrors.push("private draft error");
      return { app: main.app, page: { evaluate: vi.fn() } };
    });
    if (roots) p.ownerBundle.resolveDesktopStorageRoots.mockReturnValue(roots);
    const inspect = vi.fn(
      async () =>
        freshness ?? {
          ready: true,
          reason: "fresh-artifacts",
          segments: { host: { ready: true, reason: "fresh-artifacts" } },
        },
    );
    const driver = await createPersistedAtomElectronDriver({
      ...p,
      ownerBundle: p.ownerBundle,
      packet: p.packet,
      launchFixture: launch,
      inspectFreshness: inspect,
      env: { LOCALAPPDATA: "/local" },
      quitTimeoutMs: 100,
    });
    return { ...p, driver, launch, inspect, apps };
  }

  it("reuses the current launcher in isolated unavailable mode and starts generation 2 only after exit", async () => {
    const p = await configured();
    const first = await p.driver.launch({
      appDataRoot: p.appDataRoot,
      generation: 1,
    });
    await expect(
      p.driver.launch({ appDataRoot: p.appDataRoot, generation: 2 }),
    ).rejects.toThrow(/complete exit/);
    const receipt = await p.driver.close(first);
    expect(receipt.mode).toBe("normal");
    const second = await p.driver.launch({
      appDataRoot: p.appDataRoot,
      generation: 2,
    });
    expect(second.identity.pid).not.toBe(first.identity.pid);
    expect(second.identity.hostSha256).toBe(first.identity.hostSha256);
    await p.driver.close(second);
    const args = p.launch.mock.calls[0][0];
    expect(args).toMatchObject({
      backendMode: "unavailable",
      runtimeEnv: {
        electronUserDataDir: p.appDataRoot,
        appServerDataDir: path.join(p.appDataRoot, "app-server"),
        env: { LIME_ALLOW_LIVE_PROVIDER_SMOKE: "0", LIME_REAL_API_TEST: "0" },
      },
    });
    expect(args.runtimeEnv.env).not.toHaveProperty("HOME");
    const evidence = p.driver.getEvidence();
    expect(evidence.outstandingMainPids).toEqual([]);
    expect(evidence.lifecycle.map((record) => record.phase)).toEqual([
      "launch",
      "normal-exit",
      "launch",
      "normal-exit",
    ]);
    expect(evidence.consoleErrorCount).toBe(2);
    expect(JSON.stringify(evidence)).not.toContain("private draft error");
    expect(p.inspect).toHaveBeenCalledTimes(2);
  });

  it("does not launch stale source artifacts or implicitly build them", async () => {
    const p = await configured({
      freshness: { ready: false, segments: { host: { ready: false } } },
    });
    await expect(
      p.driver.launch({ appDataRoot: p.appDataRoot, generation: 1 }),
    ).rejects.toThrow(/build freshness/);
    expect(p.launch).not.toHaveBeenCalled();
  });

  it("rejects a freshness-owner source drift before launching", async () => {
    const p = await configured();
    await p.write("scripts/lib/electron-fixture-build.mjs", "drift");
    await expect(
      p.driver.launch({ appDataRoot: p.appDataRoot, generation: 1 }),
    ).rejects.toThrow(/freshness owner/);
    expect(p.launch).not.toHaveBeenCalled();
  });

  it("does not read persisted atoms through a second file validator", async () => {
    const p = await configured();
    const bytes = JSON.stringify({
      format: "electron-persisted-atom-state",
      storeRevision: 9,
      privateDraft: "not in receipt",
    });
    for (const name of ["host-state.json", "host-state.json.bak"])
      await fs.writeFile(path.join(p.appDataRoot, name), bytes);
    const files = await p.driver.inspectFiles({ appDataRoot: p.appDataRoot });
    expect(p.ownerBundle.parseEnvelope).toHaveBeenCalledTimes(2);
    expect(files.primary).toMatchObject({
      storeRevision: 9,
      validatedBy: "persistedAtomRecords.parseEnvelope",
      sha256: hashBytes(Buffer.from(bytes)),
    });
    expect(JSON.stringify(files)).not.toContain("not in receipt");
    await expect(
      p.driver.inspectFiles({ appDataRoot: "/other" }),
    ).rejects.toThrow(/isolated profile/);
  });

  it("validates saved files with the real owner and its declared limits", async () => {
    const p = await configured();
    p.ownerBundle.parseEnvelope = parseEnvelope;
    p.ownerBundle.limits = PERSISTED_ATOM_LIMITS;
    const bytes = JSON.stringify({
      format: "electron-persisted-atom-state",
      version: 1,
      storeRevision: 9,
      atoms: { "composer-drafts-v1": { entries: {}, bindings: {} } },
    });
    for (const name of ["host-state.json", "host-state.json.bak"])
      await fs.writeFile(path.join(p.appDataRoot, name), bytes);
    const files = await p.driver.inspectFiles({ appDataRoot: p.appDataRoot });
    expect(files.primary.storeRevision).toBe(9);
    expect(files.backup.sha256).toBe(files.primary.sha256);
  });

  it("redacts parse rejection text and cannot produce a file receipt", async () => {
    const p = await configured();
    await fs.writeFile(
      path.join(p.appDataRoot, "host-state.json"),
      JSON.stringify({ privateDraft: "private body rejected" }),
    );
    await expect(
      p.driver.inspectFiles({ appDataRoot: p.appDataRoot }),
    ).rejects.toThrow("invalid saved primary file");
  });
});
