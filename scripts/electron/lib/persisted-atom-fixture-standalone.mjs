#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  assertDriver,
  assertSourceFile,
  createPersistedAtomElectronDriver,
  hashBytes,
} from "./persisted-atom-fixture-driver.mjs";

const OWNER_PATHS = {
  protocol: "src/lib/api/persistedAtomProtocol.ts",
  types: "src/lib/api/persistedAtomTypes.ts",
  records: "electron/persistedAtomRecords.ts",
  appDataPaths: "electron/appDataPaths.ts",
};

/** Compile only the unique pure owners into an isolated diagnostic module. */
export async function bundlePersistedAtomOwners({
  repoRoot,
  workDir,
  packet,
  build,
}) {
  const sources = Object.fromEntries(
    Object.entries(OWNER_PATHS).map(([label, relative]) => [
      label,
      {
        path: path.join(repoRoot, relative),
        sha256: packet.ownerSha256[label],
      },
    ]),
  );
  for (const [label, record] of Object.entries(sources))
    await assertSourceFile(record, `current pure owner ${label}`);
  const outfile = path.join(workDir, "persisted-atom-pure-owners.mjs");
  const builder =
    build ??
    createRequire(path.join(repoRoot, "package.json"))("esbuild").build;
  const exportFrom = (names, source) =>
    `export { ${names} } from ${JSON.stringify(source)};`;
  const contents = [
    exportFrom(
      "parsePersistedAtomReadRequest, parsePersistedAtomReadResult, parsePersistedAtomUpdateResult, parsePersistedAtomUpdateEvent, PERSISTED_ATOM_LIMITS",
      sources.protocol.path,
    ),
    exportFrom("parseEnvelope", sources.records.path),
    exportFrom("resolveDesktopStorageRoots", sources.appDataPaths.path),
  ].join("\n");
  const result = await builder({
    stdin: {
      contents,
      sourcefile: "persisted-atom-owner-entry.mjs",
      resolveDir: repoRoot,
    },
    absWorkingDir: repoRoot,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    outfile,
    write: true,
    metafile: true,
    logLevel: "silent",
  });
  for (const [label, record] of Object.entries(sources))
    await assertSourceFile(record, `unchanged pure owner ${label}`);
  const dependencies = {};
  for (const input of Object.keys(result.metafile.inputs)) {
    if (input === "persisted-atom-owner-entry.mjs") continue;
    const inputPath = path.resolve(repoRoot, input);
    dependencies[inputPath] = hashBytes(await fs.readFile(inputPath));
  }
  assertDriver(
    Object.keys(dependencies).includes(sources.protocol.path) &&
      Object.keys(dependencies).includes(sources.records.path) &&
      Object.keys(dependencies).includes(sources.appDataPaths.path),
    "bundle contains the unique current owner inputs",
  );
  const bytes = await fs.readFile(outfile);
  const module = await import(
    `${pathToFileURL(outfile).href}?sha256=${hashBytes(bytes)}`
  );
  for (const name of [
    "parsePersistedAtomReadRequest",
    "parsePersistedAtomReadResult",
    "parsePersistedAtomUpdateResult",
    "parsePersistedAtomUpdateEvent",
    "parseEnvelope",
    "resolveDesktopStorageRoots",
  ])
    assertDriver(
      typeof module[name] === "function",
      "pure owner module exports",
    );
  assertDriver(
    Number.isSafeInteger(module.PERSISTED_ATOM_LIMITS?.maxFileBytes),
    "single owner file budget",
  );
  return {
    protocol: {
      parseReadRequest: module.parsePersistedAtomReadRequest,
      parseReadResult: module.parsePersistedAtomReadResult,
      parseUpdateResult: module.parsePersistedAtomUpdateResult,
      parseUpdateEvent: module.parsePersistedAtomUpdateEvent,
    },
    parseEnvelope: module.parseEnvelope,
    resolveDesktopStorageRoots: module.resolveDesktopStorageRoots,
    limits: module.PERSISTED_ATOM_LIMITS,
    receipt: {
      sources,
      dependencies,
      bundlePath: outfile,
      bundleSha256: hashBytes(bytes),
      compilationScope:
        "pure protocol + records + appDataPaths only; no product build",
    },
  };
}

export function parsePersistedAtomStandaloneArgs(argv, cwd = process.cwd()) {
  const options = {
    repoRoot: cwd,
    evidenceDir: null,
    packetPath: null,
    runId: null,
    timeoutMs: 10_000,
    quitTimeoutMs: 15_000,
    help: false,
  };
  const names = {
    "--repo": "repoRoot",
    "--evidence-dir": "evidenceDir",
    "--verification-packet": "packetPath",
    "--run-id": "runId",
    "--timeout-ms": "timeoutMs",
    "--quit-timeout-ms": "quitTimeoutMs",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const field = names[arg];
    assertDriver(
      field && argv[index + 1],
      "known standalone argument with value",
    );
    options[field] = argv[++index];
  }
  if (options.help) return options;
  assertDriver(
    options.evidenceDir &&
      options.packetPath &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(options.runId ?? ""),
    "explicit evidence directory, verification packet and run id",
  );
  for (const name of ["repoRoot", "evidenceDir", "packetPath"])
    options[name] = path.resolve(cwd, options[name]);
  for (const name of ["timeoutMs", "quitTimeoutMs"]) {
    options[name] = Number(options[name]);
    assertDriver(
      Number.isSafeInteger(options[name]) &&
        options[name] > 0 &&
        options[name] <= 60_000,
      "bounded standalone timeout",
    );
  }
  return options;
}

export async function runPersistedAtomStandalone(
  options,
  { build, makeDriver = createPersistedAtomElectronDriver } = {},
) {
  assertDriver(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(options.runId ?? "") &&
      [options.repoRoot, options.evidenceDir, options.packetPath].every(
        (value) => typeof value === "string" && path.isAbsolute(value),
      ),
    "standalone absolute paths and safe run identity",
  );
  let phase = "verification-packet";
  let driver;
  const runRoot = path.join(options.evidenceDir, options.runId);
  await fs.mkdir(options.evidenceDir, { recursive: true });
  // A fresh directory is mandatory; do not overwrite a profile from another run.
  await fs.mkdir(runRoot);
  const summaryPath = path.join(
    runRoot,
    "persisted-atom-desktop-persistence.json",
  );
  try {
    const packetBytes = await fs.readFile(options.packetPath);
    const packetSha256 = hashBytes(packetBytes);
    const packet = JSON.parse(packetBytes.toString("utf8"));
    phase = "current-pure-owners";
    const ownerBundle = await bundlePersistedAtomOwners({
      repoRoot: options.repoRoot,
      workDir: runRoot,
      packet,
      build,
    });
    phase = "current-fixture-source";
    const fixtureRecord = {
      path: path.join(
        options.repoRoot,
        "scripts/electron/lib/persisted-atom-fixture.mjs",
      ),
      sha256: packet.fixtureSha256,
    };
    await assertSourceFile(fixtureRecord, "frozen current IPC fixture helper");
    const fixture = await import(
      `${pathToFileURL(fixtureRecord.path).href}?sha256=${fixtureRecord.sha256}`
    );
    phase = "guarded-driver";
    const appDataRoot = path.join(runRoot, "electron-user-data");
    await fs.mkdir(appDataRoot);
    driver = await makeDriver({
      repoRoot: options.repoRoot,
      appDataRoot,
      ownerBundle,
      packet,
      quitTimeoutMs: options.quitTimeoutMs,
    });
    phase = "real-ipc-and-restart";
    const evidence = await fixture.runPersistedAtomFixture({
      driver,
      protocol: ownerBundle.protocol,
      appDataRoot,
      runId: options.runId,
      timeoutMs: options.timeoutMs,
    });
    const driverEvidence = driver.getEvidence();
    assertDriver(
      driverEvidence.outstandingMainPids.length === 0,
      "no Main process remains after successful fixture",
    );
    assertDriver(
      hashBytes(await fs.readFile(options.packetPath)) === packetSha256,
      "verification packet unchanged during the scenario",
    );
    const summary = {
      ...evidence,
      driverEvidence,
      verificationPacketPath: options.packetPath,
      verificationPacketSha256: packetSha256,
      fixtureSource: fixtureRecord,
      strongClaimBoundary:
        "Desktop Host IPC/CAS/persistence with normal restart; no GUI hydrate or App Server acceptance Gate",
    };
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");
    return { summaryPath, summary };
  } catch {
    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          result: "fail",
          phase,
          runtimeGate: false,
          guiDraftRestoration: false,
          driverEvidence: driver?.getEvidence() ?? null,
          verificationPacketPath: options.packetPath,
          normalExitMustNotBeReplacedByKill: true,
        },
        null,
        2,
      ) + "\n",
    );
    throw new Error(
      `Desktop persistence standalone failed; see ${summaryPath}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const options = parsePersistedAtomStandaloneArgs(process.argv.slice(2));
    if (options.help) {
      console.log(
        "Usage: node scripts/electron/lib/persisted-atom-fixture-standalone.mjs --run-id <id> --evidence-dir <isolated-dir> --verification-packet <frozen-json> [--timeout-ms 10000] [--quit-timeout-ms 15000]",
      );
    } else {
      const result = await runPersistedAtomStandalone(options);
      console.log(
        JSON.stringify({
          result: "pass",
          proofLevel: "Desktop persistence",
          runtimeGate: false,
          summaryPath: result.summaryPath,
        }),
      );
    }
  } catch {
    console.error(
      "Desktop persistence standalone failed; inspect the content-free evidence receipt.",
    );
    process.exitCode = 1;
  }
}
