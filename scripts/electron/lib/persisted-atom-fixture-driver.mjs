import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{64}$/;
const POLICY_CASES = [
  "allows existing renderer events and rejects Main persistence notifications",
  "does not coerce malformed IPC names or execute their getters",
  "rejects forged saved acknowledgements at the Main IPC handler",
];

export function assertDriver(condition, phase) {
  if (!condition)
    throw new Error(`persisted atom Electron driver failed: ${phase}`);
}

export const hashBytes = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export async function assertSourceFile(record, phase) {
  assertDriver(
    path.isAbsolute(record?.path ?? "") && SHA.test(record?.sha256 ?? ""),
    phase,
  );
  let bytes;
  try {
    bytes = await fs.readFile(record.path);
  } catch {
    assertDriver(false, phase);
  }
  assertDriver(hashBytes(bytes) === record.sha256, phase);
  return bytes;
}

/** Static source/test evidence supplements native listen; it is never a live spoof test. */
export async function verifyPersistedAtomEventGuard({ repoRoot, packet }) {
  const source = {
    path: path.join(repoRoot, "electron/rendererEventPolicy.ts"),
    sha256: packet.sourceSha256,
  };
  await assertSourceFile(source, "current Main renderer event policy source");
  await assertSourceFile(
    { path: packet.testPath, sha256: packet.testSha256 },
    "frozen event policy test source",
  );
  const runtimeTestPath = path.join(
    repoRoot,
    "electron/rendererEventPolicy.test.ts",
  );
  await assertSourceFile(
    { path: runtimeTestPath, sha256: packet.testSha256 },
    "same formal and frozen event policy test source",
  );
  const bytes = await assertSourceFile(
    { path: packet.receiptPath, sha256: packet.receiptSha256 },
    "frozen event policy test receipt",
  );
  let report;
  try {
    report = JSON.parse(bytes.toString("utf8"));
  } catch {
    assertDriver(false, "event policy test JSON receipt");
  }
  const testPath = await fs.realpath(packet.testPath);
  const suites = [];
  for (const suite of report.testResults ?? []) {
    try {
      if ((await fs.realpath(suite.name)) === testPath) suites.push(suite);
    } catch {
      /* Unrelated suites are not policy evidence. */
    }
  }
  assertDriver(
    report.numFailedTests === 0 && suites.length === 1,
    "unambiguous passing event policy test suite",
  );
  const tests = suites[0].assertionResults;
  assertDriver(
    Array.isArray(tests) &&
      tests.length === POLICY_CASES.length &&
      POLICY_CASES.every((title) =>
        tests.some((test) => test.title === title && test.status === "passed"),
      ),
    "all required Main IPC authority cases passed",
  );
  return {
    validated: true,
    sourceSha256: source.sha256,
    proofClass: "static-main-ipc-policy",
    sourcePath: source.path,
    testPath,
    runtimeTestPath,
    testSha256: packet.testSha256,
    receiptPath: packet.receiptPath,
    receiptSha256: packet.receiptSha256,
    passedCases: POLICY_CASES.length,
    liveRendererSpoofAttempted: false,
  };
}

function bounded(promise, timeoutMs, phase) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error(`persisted atom Electron driver failed: ${phase}`)),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Capture the actual child exit from launch; do not infer it from window closure. */
export function captureMainProcessExit(child) {
  assertDriver(
    Number.isSafeInteger(child?.pid) &&
      child.pid > 0 &&
      child.exitCode === null &&
      child.signalCode === null,
    "live public Main child process",
  );
  const pid = child.pid;
  let exitRecord = null;
  const exitPromise = new Promise((resolve) => {
    child.once("exit", (exitCode, signal) => {
      exitRecord = { pid, exited: true, exitCode, signal };
      resolve(exitRecord);
    });
  });
  return { pid, exitPromise, getExitRecord: () => exitRecord };
}

export async function quitMainProcessNormally(handle, timeoutMs) {
  assertDriver(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60_000,
    "bounded normal quit timeout",
  );
  assertDriver(
    handle.exit.getExitRecord() === null,
    "Main did not exit before requested normal quit",
  );
  // Playwright's public close calls app.quit and releases its Node debugger.
  // Exit evidence still requires the actual Main child to return code 0, no signal.
  void handle.app.close().catch(() => undefined);
  const receipt = await bounded(
    handle.exit.exitPromise,
    timeoutMs,
    "normal Main exit timeout; no kill fallback",
  );
  assertDriver(
    receipt.exitCode === 0 && receipt.signal === null,
    "normal Main exit status",
  );
  return { ...receipt, mode: "normal" };
}

async function defaultLauncher(repoRoot) {
  assertDriver(
    path.resolve(process.cwd()) === path.resolve(repoRoot),
    "standalone must run with repository cwd",
  );
  const module = await import(
    pathToFileURL(
      path.join(repoRoot, "scripts/electron/mcp-config-fixture-smoke.mjs"),
    ).href
  );
  return module.launchElectronFixture;
}

async function defaultFreshnessInspector(repoRoot) {
  const module = await import(
    pathToFileURL(path.join(repoRoot, "scripts/lib/electron-fixture-build.mjs"))
      .href
  );
  // Read-only inspection only; never ensureElectronFixtureBuild or rebuild.
  return module.inspectElectronFixtureBuildFreshness({ rootDir: repoRoot });
}

/** Uses an existing launcher; all business mutations stay in the frozen public IPC fixture. */
export async function createPersistedAtomElectronDriver({
  repoRoot,
  appDataRoot,
  ownerBundle,
  packet,
  launchFixture,
  inspectFreshness = defaultFreshnessInspector,
  env = process.env,
  launchTimeoutMs = 60_000,
  quitTimeoutMs = 15_000,
}) {
  const root = path.resolve(repoRoot);
  assertDriver(path.isAbsolute(appDataRoot), "isolated absolute profile");
  assertDriver(
    launchTimeoutMs > 0 && launchTimeoutMs <= 60_000,
    "bounded launch timeout",
  );
  const roots = ownerBundle.resolveDesktopStorageRoots({
    platform: process.platform,
    hostUserData: appDataRoot,
    e2eMode: true,
    e2eUserDataDir: appDataRoot,
    localAppData: env.LOCALAPPDATA,
  });
  assertDriver(
    roots.appDataRoot === appDataRoot &&
      roots.agentRoot === path.join(appDataRoot, "app-server"),
    "real appDataPaths E2E mapping",
  );
  const policy = await verifyPersistedAtomEventGuard({
    repoRoot: root,
    packet: packet.eventGuard,
  });
  let active = null;
  let generation = 0;
  const lifecycle = [];
  const consoleErrors = [];
  const pageErrors = [];
  const currentFingerprints = async () => {
    for (const [label, record] of Object.entries(ownerBundle.receipt.sources))
      await assertSourceFile(record, `frozen owner source ${label}`);
    await assertSourceFile(
      {
        path: path.join(root, "scripts/lib/electron-fixture-build.mjs"),
        sha256: packet.freshnessInspectorSha256,
      },
      "current build freshness owner",
    );
    const freshness = await inspectFreshness(root);
    assertDriver(
      freshness.ready === true && freshness.segments?.host?.ready === true,
      "current renderer/Host/sidecar build freshness",
    );
    const guard = await verifyPersistedAtomEventGuard({
      repoRoot: root,
      packet: packet.eventGuard,
    });
    const mainPath = path.join(root, "dist-electron/main/main.js");
    const preloadPath = path.join(root, "dist-electron/preload/preload.cjs");
    const [main, preload] = await Promise.all([
      fs.readFile(mainPath),
      fs.readFile(preloadPath),
    ]);
    assertDriver(
      main.length > 0 && preload.length > 0,
      "current nonempty Host/preload artifacts",
    );
    return {
      hostSha256: hashBytes(main),
      preloadSha256: hashBytes(preload),
      eventEmissionGuard: guard,
      freshness: {
        reason: freshness.reason,
        host: freshness.segments.host.reason,
      },
    };
  };
  return {
    async launch({
      appDataRoot: requestedRoot,
      generation: requestedGeneration,
    }) {
      assertDriver(
        active === null &&
          requestedRoot === appDataRoot &&
          requestedGeneration === generation + 1,
        "same profile and sequential generation after complete exit",
      );
      const fingerprints = await currentFingerprints();
      const launcher = launchFixture ?? (await defaultLauncher(root));
      let launched;
      try {
        launched = await launcher({
          options: { timeoutMs: launchTimeoutMs, intervalMs: 100 },
          runtimeEnv: {
            electronUserDataDir: appDataRoot,
            appServerDataDir: roots.agentRoot,
            env: {
              ...env,
              LIME_ALLOW_LIVE_PROVIDER_SMOKE: "0",
              LIME_REAL_API_TEST: "0",
            },
          },
          appServerEnv: env.APP_SERVER_BIN
            ? { APP_SERVER_BIN: env.APP_SERVER_BIN }
            : {},
          consoleErrors,
          pageErrors,
          backendMode: "unavailable",
        });
      } catch {
        throw new Error(
          "persisted atom Electron driver failed: existing launcher unavailable",
        );
      }
      const child = launched.app.process();
      const exit = captureMainProcessExit(child);
      generation = requestedGeneration;
      active = {
        app: launched.app,
        page: launched.page,
        child,
        exit,
        identity: { pid: exit.pid, appDataRoot, ...fingerprints },
        closePromise: null,
      };
      lifecycle.push({
        phase: "launch",
        pid: exit.pid,
        generation,
        appDataRoot,
      });
      return active;
    },
    async close(handle) {
      assertDriver(
        handle === active,
        "close only the current owned Main process",
      );
      handle.closePromise ??= quitMainProcessNormally(handle, quitTimeoutMs);
      const receipt = await handle.closePromise;
      lifecycle.push({ phase: "normal-exit", ...receipt });
      active = null;
      return receipt;
    },
    async inspectFiles({ appDataRoot: requestedRoot }) {
      assertDriver(
        requestedRoot === appDataRoot,
        "inspect isolated profile only",
      );
      const receipts = {};
      for (const [kind, name] of [
        ["primary", "host-state.json"],
        ["backup", "host-state.json.bak"],
      ]) {
        const filePath = path.join(appDataRoot, name);
        try {
          const stat = await fs.stat(filePath);
          assertDriver(
            stat.isFile() && stat.size <= ownerBundle.limits.maxFileBytes,
            "bounded persisted atom file",
          );
          const bytes = await fs.readFile(filePath);
          const envelope = ownerBundle.parseEnvelope(
            JSON.parse(bytes.toString("utf8")),
            ownerBundle.limits,
          );
          receipts[kind] = {
            path: filePath,
            validatedBy: "persistedAtomRecords.parseEnvelope",
            storeRevision: envelope.storeRevision,
            sha256: hashBytes(bytes),
          };
        } catch {
          throw new Error(
            `persisted atom Electron driver failed: invalid saved ${kind} file`,
          );
        }
      }
      return receipts;
    },
    getEvidence() {
      return {
        staticEventAuthorityCompanion: policy,
        ownerBundle: ownerBundle.receipt,
        appDataRoots: roots,
        lifecycle: structuredClone(lifecycle),
        outstandingMainPids:
          active && active.exit.getExitRecord() === null
            ? [active.identity.pid]
            : [],
        // Existing launcher errors can contain content; report counts only.
        consoleErrorCount: consoleErrors.length,
        pageErrorCount: pageErrors.length,
        backendMode: "unavailable",
        productionProviderUsed: false,
        normalQuitUses:
          "public Electron app.quit + public app.process child exit",
        forcedKillFallback: false,
      };
    },
  };
}
