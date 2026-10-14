import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ensureElectronFixtureBuild } from "../../lib/electron-fixture-build.mjs";
import { resolveElectronAppServerRuntimeEnv } from "../../lib/electron-app-server-assets.mjs";
import { resolveDevAppServerBinary } from "../../lib/electron-dev-sidecar.mjs";
import {
  appServerCallFromPage,
  closeElectronFixture,
  createTempRuntimeEnv,
  launchElectronFixture,
  waitForPageCondition,
} from "../mcp-config-fixture-smoke.mjs";
import { parseJsonRpcRequestsFromInvokeTrace } from "./mcp-config-fixture-evidence.mjs";

const TITLE = "Canonical thread settings Gate B";
const PROVIDER_NAME = "Thread settings fixture";
const MODEL_A = "settings-fixture-model-a";
const MODEL_B = "settings-fixture-model-b";
const LOG_PREFIX = "[smoke:thread-settings-gate-b]";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertThreadSettingsGateEvidence(evidence) {
  for (const field of [
    "electronPreload",
    "guiUpdateRequest",
    "canonicalModel",
    "canonicalProvider",
    "canonicalCwd",
    "modelVisible",
    "directoryVisible",
    "sameThread",
    "drainObserved",
    "canonicalNotification",
    "noNewTurns",
    "noTranscriptNotification",
    "noFallback",
  ]) {
    assert(
      evidence[field] === true,
      `thread/settings/updated Gate B 缺少 ${field}`,
    );
  }
  assert(
    evidence.pageErrorCount === 0 &&
      evidence.consoleErrorCount === 0 &&
      evidence.invokeErrorCount === 0,
    "thread/settings/updated Gate B 出现 runtime error",
  );
}

async function seedProvider(page) {
  const created = await appServerCallFromPage(page, "modelProvider/create", {
    name: PROVIDER_NAME,
    providerType: "openai",
    apiHost: "http://127.0.0.1:9/v1",
  });
  const providerId = created.result?.provider?.id;
  assert(
    typeof providerId === "string",
    "settings fixture provider identity 缺失",
  );
  await appServerCallFromPage(page, "modelProvider/update", {
    providerId,
    enabled: true,
    models: [MODEL_A, MODEL_B].map((id) => ({
      id,
      capability: {
        taskFamilies: ["chat"],
        inputModalities: ["text"],
        outputModalities: ["text"],
        runtimeFeatures: ["tool_calling"],
      },
    })),
  });
  await appServerCallFromPage(page, "modelProviderKey/create", {
    providerId,
    apiKey: "thread-settings-test-only-key",
    alias: "thread-settings-test-only",
    replaceExisting: true,
  });
  return providerId;
}

async function selectModelFromGui(page) {
  const selector = page.locator('[data-testid="model-selector"]').first();
  await selector.click();
  const popover = page.locator('[data-model-selector-popover="true"]');
  await popover
    .locator("button")
    .filter({ hasText: PROVIDER_NAME })
    .first()
    .click();
  await popover.locator("button").filter({ hasText: MODEL_B }).first().click();
  await popover.waitFor({ state: "hidden" });
}

export async function runThreadSettingsGate() {
  const evidenceDir = path.join(
    process.cwd(),
    ".lime/qc/gui-evidence/thread-settings-electron-gate-b",
  );
  const prefix = "codex-gui-alignment-settings-final";
  const options = { timeoutMs: 120_000, intervalMs: 250, evidenceDir, prefix };
  fs.mkdirSync(evidenceDir, { recursive: true });
  const summaryPath = path.join(evidenceDir, `${prefix}-summary.json`);
  const runtimeEnv = createTempRuntimeEnv();
  const workspaceRoot = path.join(runtimeEnv.tempRoot, "settings-workspace-a");
  const updatedRoot = path.join(runtimeEnv.tempRoot, "settings-workspace-b");
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.mkdirSync(updatedRoot, { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  const summary = {
    schemaVersion: 1,
    proofLevel: "Gate B controlled fixture",
    scenarioId: "CODEX-ALIGN-thread-settings-consumer",
    claimBoundary:
      "Real Electron GUI model selection and out-of-band cwd settings notification on one idle canonical Thread, with canonical resume/readback. It does not prove active-turn/future-turn execution, live provider, Windows or packaged behavior.",
    backendMode: "unavailable",
    ok: false,
    checkedAt: new Date().toISOString(),
  };
  let handle = null;
  try {
    ensureElectronFixtureBuild({
      rootDir: process.cwd(),
      logPrefix: LOG_PREFIX,
    });
    const appServerBinary = resolveDevAppServerBinary({
      env: runtimeEnv.env,
      repoRoot: process.cwd(),
      forceBuild: false,
    });
    summary.appServerBinary = {
      path: appServerBinary,
      sha256: createHash("sha256")
        .update(fs.readFileSync(appServerBinary))
        .digest("hex"),
      sourceEquivalence: "not established for the current dirty Rust tree",
    };
    const appServerEnv = resolveElectronAppServerRuntimeEnv({
      env: { ...runtimeEnv.env, APP_SERVER_BIN: appServerBinary },
    });
    handle = await launchElectronFixture({
      options,
      runtimeEnv,
      appServerEnv,
      pageErrors,
      consoleErrors,
    });
    const page = handle.page;
    const providerId = await seedProvider(page);
    const started = await appServerCallFromPage(page, "thread/start", {
      model: MODEL_A,
      modelProvider: providerId,
      cwd: workspaceRoot,
      serviceName: TITLE,
      historyMode: "legacy",
      threadSource: "fixture",
    });
    const threadId = started.result?.thread?.id;
    assert(
      typeof threadId === "string",
      "settings fixture thread identity 缺失",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForPageCondition(
      page,
      options,
      (title) => {
        const button = Array.from(
          document.querySelectorAll(
            '[data-testid="app-sidebar-conversation-open"]',
          ),
        ).find(
          (node) =>
            node.getAttribute("title") === title ||
            node.textContent?.includes(title),
        );
        return button !== undefined;
      },
      "settings fixture 侧栏 Thread 不可见",
      TITLE,
    );
    await page
      .locator('[data-testid="app-sidebar-conversation-open"]')
      .filter({ hasText: TITLE })
      .click();
    await page
      .locator('[data-testid="thread-workspace-header-directory"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => {
      window.localStorage.removeItem("lime_invoke_trace_buffer_v1");
      window.localStorage.removeItem("lime_invoke_error_buffer_v1");
    });
    await handle.app.evaluate(({ ipcMain }) => {
      const handlers = ipcMain._invokeHandlers;
      const original = handlers?.get("app:invoke");
      if (!(handlers instanceof Map) || typeof original !== "function") {
        throw new Error("Electron IPC observation handler unavailable");
      }
      const observation = { original, notifications: [] };
      globalThis.__threadSettingsGateObservation = observation;
      handlers.set("app:invoke", async (...args) => {
        const reply = await original(...args);
        if (args[1] === "app_server_drain_events" && reply?.ok === true) {
          for (const line of reply.result?.lines ?? []) {
            const message = JSON.parse(line);
            if (message.method === "thread/settings/updated") {
              const { threadId, threadSettings } = message.params;
              observation.notifications.push({
                threadId,
                model: threadSettings.model,
                modelProvider: threadSettings.modelProvider,
                cwd: threadSettings.cwd,
              });
            }
          }
        }
        return reply;
      });
    });
    console.log(`${LOG_PREFIX} stage=select-model-through-gui`);
    await selectModelFromGui(page);
    await waitForPageCondition(
      page,
      options,
      (model) =>
        document
          .querySelector('[data-testid="model-selector"]')
          ?.textContent?.includes(model),
      "GUI 未显示 canonical 新模型",
      MODEL_B,
    );

    console.log(`${LOG_PREFIX} stage=out-of-band-cwd-update`);
    await appServerCallFromPage(page, "thread/settings/update", {
      threadId,
      cwd: updatedRoot,
    });
    // Only the production drain path can deliver this raw call to the GUI.
    // Do not publish its response through a test-side consumer.
    await waitForPageCondition(
      page,
      options,
      (cwd) =>
        document
          .querySelector('[data-testid="thread-workspace-header-directory"]')
          ?.getAttribute("title") === cwd,
      "真实 settings drain 未更新 GUI cwd",
      updatedRoot,
    );

    const read = await appServerCallFromPage(page, "thread/read", {
      threadId,
      includeTurns: true,
    });
    const resumed = await appServerCallFromPage(page, "thread/resume", {
      threadId,
      excludeTurns: true,
    });
    const dom = await page.evaluate(
      ({ threadId, model, cwd }) => {
        const traceRaw = window.localStorage.getItem(
          "lime_invoke_trace_buffer_v1",
        );
        const errorRaw = window.localStorage.getItem(
          "lime_invoke_error_buffer_v1",
        );
        const header = document.querySelector(
          '[data-testid="thread-workspace-header"]',
        );
        const selector = document.querySelector(
          '[data-testid="model-selector"]',
        );
        const directory = document.querySelector(
          '[data-testid="thread-workspace-header-directory"]',
        );
        const trace = JSON.parse(traceRaw || "[]");
        return {
          traceRaw,
          errorRaw,
          electronPreload:
            window.__LIME_ELECTRON__ === true &&
            typeof window.electronAPI?.invoke === "function",
          modelVisible:
            selector?.textContent?.includes(model) === true &&
            selector.getBoundingClientRect().width > 0,
          directoryVisible:
            directory?.getAttribute("title") === cwd &&
            directory.getBoundingClientRect().width > 0,
          sameThread: header?.getAttribute("data-session-id") === threadId,
          drainObserved: trace.some(
            (entry) =>
              entry.command === "app_server_drain_events" &&
              entry.transport === "electron-ipc" &&
              entry.status === "success",
          ),
          noTranscriptNotification: !document
            .querySelector('[data-testid="message-list-column"]')
            ?.textContent?.includes("thread/settings/updated"),
        };
      },
      { threadId, model: MODEL_B, cwd: updatedRoot },
    );
    const updates = parseJsonRpcRequestsFromInvokeTrace(dom.traceRaw).filter(
      (request) => request.method === "thread/settings/update",
    );
    const notifications = await handle.app.evaluate(
      () => globalThis.__threadSettingsGateObservation.notifications,
    );
    const evidence = {
      ...Object.fromEntries(
        Object.entries(dom).filter(
          ([key]) => !["traceRaw", "errorRaw"].includes(key),
        ),
      ),
      guiUpdateRequest: updates.some(
        (request) =>
          request.command === "app_server_handle_json_lines" &&
          request.transport === "electron-ipc" &&
          request.status === "success" &&
          request.params?.threadId === threadId &&
          request.params?.model === MODEL_B &&
          request.params?.modelProvider === providerId,
      ),
      canonicalModel: resumed.result?.model === MODEL_B,
      canonicalProvider: resumed.result?.modelProvider === providerId,
      canonicalNotification:
        notifications.some(
          (message) =>
            message.threadId === threadId &&
            message.model === MODEL_B &&
            message.modelProvider === providerId,
        ) &&
        notifications.some(
          (message) =>
            message.threadId === threadId &&
            message.model === MODEL_B &&
            message.modelProvider === providerId &&
            message.cwd === updatedRoot,
        ),
      canonicalCwd:
        resumed.result?.cwd === updatedRoot &&
        read.result?.thread?.cwd === updatedRoot,
      noNewTurns:
        Array.isArray(read.result?.thread?.turns) &&
        read.result.thread.turns.length === 0,
      noFallback:
        updates.length > 0 &&
        updates.every((request) => request.transport === "electron-ipc"),
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      invokeErrorCount: JSON.parse(dom.errorRaw || "[]").length,
    };
    summary.assertions = evidence;
    assertThreadSettingsGateEvidence(evidence);
    await page.screenshot({
      path: path.join(evidenceDir, `${prefix}.png`),
      fullPage: true,
    });
    summary.ok = true;
    summary.screenshot = `${prefix}.png`;
    console.log(`${LOG_PREFIX} summary=${summaryPath}`);
  } catch (error) {
    summary.failure = error instanceof Error ? error.message : String(error);
    if (handle?.page)
      await handle.page
        .screenshot({
          path: path.join(evidenceDir, `${prefix}-failure.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    throw error;
  } finally {
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    if (handle?.app) {
      await handle.app
        .evaluate(({ ipcMain }) => {
          const observation = globalThis.__threadSettingsGateObservation;
          if (observation) {
            ipcMain._invokeHandlers.set("app:invoke", observation.original);
            delete globalThis.__threadSettingsGateObservation;
          }
        })
        .catch(() => undefined);
    }
    await closeElectronFixture(handle);
    fs.rmSync(runtimeEnv.tempRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  runThreadSettingsGate().catch((error) => {
    console.error(
      `${LOG_PREFIX} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
