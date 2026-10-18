import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEVELOPER_REQUIRED_APP_SERVER_METHODS,
  DEVELOPER_REQUIRED_CONFIG_METHODS,
  DEVELOPER_DRAFT_REQUIRED_CONFIG_METHODS,
  applyPassingSettingsDeveloperEvidence,
  createSettingsDeveloperEvidence,
  parseSettingsDeveloperFixtureArgs,
  summarizeSettingsDeveloperTrace,
} from "./settings-developer-fixture-evidence.mjs";
import { SETTINGS_DRAFT_FIXTURE_SOURCES } from "./settings-draft-navigation-scenario.mjs";

const RUN_ID = "standalone-settings-b-test";

function traceRaw(transport = "electron-ipc", methods = undefined) {
  return JSON.stringify([
    ...[
      ...DEVELOPER_REQUIRED_CONFIG_METHODS,
      ...DEVELOPER_DRAFT_REQUIRED_CONFIG_METHODS,
    ].map((method) => ({
      command: "app_server_handle_json_lines",
      transport,
      status: "success",
      args_preview: {
        request: { lines: [JSON.stringify({ method })] },
      },
    })),
    ...(methods ?? DEVELOPER_REQUIRED_APP_SERVER_METHODS).map((method) => ({
      command: "app_server_handle_json_lines",
      transport,
      status: "success",
      args_preview: {
        request: {
          lines: [
            JSON.stringify({ jsonrpc: "2.0", id: method, method, params: {} }),
          ],
        },
      },
    })),
  ]);
}

function payloadShape() {
  return {
    generatedAt: true,
    desktopRuntime: true,
    persistedLogTail: true,
    serverDiagnostics: true,
    logStorageDiagnostics: true,
    currentLogPathAtAgentRoot: true,
    windowsStartupDiagnostics: true,
    runtimeSnapshot: true,
    configSummary: true,
    providerSummary: true,
    mcpSummary: true,
  };
}

function passingFacts() {
  const sources = SETTINGS_DRAFT_FIXTURE_SOURCES.map((file) => ({
    file,
    sha256: "a".repeat(64),
  }));
  return {
    completedAt: "2026-07-17T00:03:00.000Z",
    electronRenderer: true,
    preloadInvoke: true,
    isolatedUserData: true,
    developerTabActive: true,
    developerLabActive: true,
    copyJsonActionReady: true,
    diagnosticSuccess: true,
    clipboardSinkInstalled: true,
    clipboard: {
      writeCount: 1,
      textLength: 2048,
      jsonObject: true,
      payloadShape: payloadShape(),
    },
    loadingVisible: false,
    errorVisible: false,
    trace: summarizeSettingsDeveloperTrace(traceRaw()),
    consoleErrors: [],
    pageErrors: [],
    invokeErrorCount: 0,
    screenshotWritten: true,
    normalMainExits: [
      {
        exited: true,
        exitCode: 0,
        signal: null,
        mode: "normal",
        forcedCleanup: false,
      },
    ],
    buildFreshness: { before: { ready: true }, after: { ready: true } },
    sourceManifest: { before: sources, after: structuredClone(sources) },
    experimentalDraft: {
      sameNodeAcrossTabs: true,
      tabDraftRetained: true,
      sectionKeep: true,
      sectionDiscard: true,
      keepDefaultFocus: true,
      unpersistedDraft: true,
      safeCrashPreflight: true,
      guiSaveReadback: true,
      reopenedValue: true,
      untouchedConfigPreserved: true,
      configurationRestored: true,
      readbacks: Array.from({ length: 3 }, () => ({
        method: "config/read",
        transport: "electron-ipc",
        currentPreload: true,
        matchingRequestResponse: true,
      })),
    },
  };
}

describe("Settings Developer Gate B evidence", () => {
  it("uses the same project Gate run root", () => {
    const options = parseSettingsDeveloperFixtureArgs(["--run-id", RUN_ID], {
      defaults: {
        runId: null,
        evidenceDir: null,
        prefix: "settings-developer-fixture",
        timeoutMs: 120_000,
        intervalMs: 250,
        keepTemp: false,
      },
      cwd: "/repo",
    });
    expect(options.evidenceDir).toBe(
      path.join(
        "/repo",
        ".lime",
        "qc",
        "project-gates",
        RUN_ID,
        "settings-developer-current-diagnostics",
      ),
    );
  });

  it("requires every current diagnostic method and Host config read", () => {
    expect(summarizeSettingsDeveloperTrace(traceRaw())).toMatchObject({
      appServerIpcHitCount:
        DEVELOPER_REQUIRED_APP_SERVER_METHODS.length +
        DEVELOPER_REQUIRED_CONFIG_METHODS.length +
        DEVELOPER_DRAFT_REQUIRED_CONFIG_METHODS.length,
      methods: [
        ...DEVELOPER_REQUIRED_CONFIG_METHODS,
        ...DEVELOPER_DRAFT_REQUIRED_CONFIG_METHODS,
        ...DEVELOPER_REQUIRED_APP_SERVER_METHODS,
      ],
      missingMethods: [],
      missingConfigMethods: [],
      missingDraftConfigMethods: [],
      legacyCommands: [],
      mockFallbackHitCount: 0,
    });
  });

  it("completes only with real collection and privacy-minimal sink shape", () => {
    const summary = createSettingsDeveloperEvidence({
      candidateRunId: RUN_ID,
      startedAt: "2026-07-17T00:00:00.000Z",
      prefix: "settings-developer-fixture",
    });
    applyPassingSettingsDeveloperEvidence(summary, passingFacts());
    expect(summary.result).toBe("pass");
    expect(summary.settingsScenarioProof).toEqual({
      scenarioId: "developer-current-diagnostics",
      complete: true,
    });
    expect(summary.clipboardSink).not.toHaveProperty("text");
  });

  it("rejects mock transport, missing method and incomplete payload shape", () => {
    const summary = createSettingsDeveloperEvidence({
      candidateRunId: RUN_ID,
      startedAt: "2026-07-17T00:00:00.000Z",
      prefix: "settings-developer-fixture",
    });
    expect(() =>
      applyPassingSettingsDeveloperEvidence(summary, {
        ...passingFacts(),
        clipboard: {
          ...passingFacts().clipboard,
          payloadShape: {
            ...payloadShape(),
            currentLogPathAtAgentRoot: false,
          },
        },
        trace: summarizeSettingsDeveloperTrace(
          traceRaw("renderer-mock", ["log/list"]),
        ),
      }),
    ).toThrow(
      /appServerElectronIpc.*allCurrentDiagnosticMethods.*configCurrentRead.*diagnosticPayloadShape.*mockFallbackZero/,
    );
  });

  it.each([
    "sameNodeAcrossTabs",
    "tabDraftRetained",
    "sectionKeep",
    "sectionDiscard",
    "keepDefaultFocus",
    "unpersistedDraft",
    "safeCrashPreflight",
    "guiSaveReadback",
    "reopenedValue",
    "untouchedConfigPreserved",
    "configurationRestored",
  ])("rejects absent Experimental draft evidence: %s", (key) => {
    const facts = passingFacts();
    delete facts.experimentalDraft[key];
    expect(() =>
      applyPassingSettingsDeveloperEvidence(
        createSettingsDeveloperEvidence({
          candidateRunId: RUN_ID,
          startedAt: "2026-10-18",
          prefix: "fixture",
        }),
        facts,
      ),
    ).toThrow(`experimentalDraft.${key}`);
  });

  it("rejects exit, freshness, source drift and missing readback identity", () => {
    const facts = passingFacts();
    facts.normalMainExits[0].forcedCleanup = true;
    facts.buildFreshness.after.ready = false;
    facts.sourceManifest.after.pop();
    facts.experimentalDraft.readbacks[0].matchingRequestResponse = false;
    expect(() =>
      applyPassingSettingsDeveloperEvidence(
        createSettingsDeveloperEvidence({
          candidateRunId: RUN_ID,
          startedAt: "2026-10-18",
          prefix: "fixture",
        }),
        facts,
      ),
    ).toThrow(
      /currentReadbackIdentity.*normalMainExits.*buildFreshnessBeforeAfter.*declaredSourcesStable/,
    );
  });

  it("keeps the diagnostic read contract and additionally requires draft writes", () => {
    const facts = passingFacts();
    facts.trace = summarizeSettingsDeveloperTrace(
      traceRaw(
        "electron-ipc",
        DEVELOPER_REQUIRED_APP_SERVER_METHODS,
      ).replaceAll("config/batchWrite", "config/read"),
    );
    expect(facts.trace.missingConfigMethods).toEqual([]);
    expect(facts.trace.missingDraftConfigMethods).toEqual([
      "config/batchWrite",
    ]);
    expect(() =>
      applyPassingSettingsDeveloperEvidence(
        createSettingsDeveloperEvidence({
          candidateRunId: RUN_ID,
          startedAt: "2026-10-18",
          prefix: "fixture",
        }),
        facts,
      ),
    ).toThrow(/configDraftWrite/);
  });
});
