#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { captureMainProcessExit } from "./lib/persisted-atom-fixture-driver.mjs";
import { settleFixtureResources } from "../agent-runtime/claw-chat-current-fixture-teardown.mjs";
import { invokeAppServerFromPage } from "../agent-runtime/claw-chat-current-fixture-rpc.mjs";
import { inspectElectronFixtureBuildFreshness } from "../lib/electron-fixture-build.mjs";
import { seedProfileFixture } from "./lib/settings-profile-fixture-driver.mjs";

import { resolveElectronAppServerRuntimeEnv } from "../lib/electron-app-server-assets.mjs";
import { resolveDevAppServerBinary } from "../lib/electron-dev-sidecar.mjs";
import { writeJsonFile } from "../mcp/lib/current-smoke-transport.mjs";
import {
  createTempRuntimeEnv,
  launchElectronFixture,
  openSettings,
  parseInvokeTraceRaw,
  sanitizeText,
  waitForPageCondition,
} from "./mcp-config-fixture-smoke.mjs";
import {
  applyFailedSettingsProfileEvidence,
  applyPassingSettingsProfileEvidence,
  createSettingsProfileEvidence,
  parseSettingsProfileFixtureArgs,
  summarizeSettingsProfileTrace,
} from "./lib/settings-profile-fixture-evidence.mjs";

const DEFAULTS = {
  runId: process.env.LIME_GATE_RUN_ID?.trim() || null,
  evidenceDir: null,
  prefix: "settings-profile-fixture",
  timeoutMs: 120_000,
  intervalMs: 250,
  keepTemp: false,
};

function printHelp() {
  console.log(`
Settings Profile Electron Fixture

Usage:
  node scripts/electron/settings-profile-fixture-smoke.mjs --run-id <id>

Options:
  --run-id <id> --evidence-dir <path> --prefix <name>
  --timeout-ms <ms> --interval-ms <ms> --keep-temp -h|--help
`);
}

async function openProfileSettings(page, options) {
  await page.evaluate(() => {
    window.__LIME_OEM_CLOUD__ = { enabled: false };
  });
  await openSettings(page, options);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "lime.app-config.changed-at",
      `settings-profile-fixture-${Date.now()}`,
    );
  });
  await page.locator('[data-testid="settings-sidebar-tab-profile"]').click();
}

async function readProfileState(page, options, { requireSave = false } = {}) {
  return await waitForPageCondition(
    page,
    options,
    ({ requireSave }) => {
      const bodyText = document.body?.innerText ?? "";
      const active =
        document
          .querySelector('[data-testid="settings-sidebar-tab-profile"]')
          ?.getAttribute("aria-current") === "page";
      const editButton = document.querySelector('[aria-label="编辑显示名称"]');
      const loadingVisible =
        document.querySelectorAll(".animate-pulse").length > 0;
      const errorVisible = Boolean(
        document.querySelector(
          '[data-testid="settings-profile-page"] [role="alert"]',
        ),
      );
      const saveConfirmed = bodyText.includes("资料已保存");
      const traceRaw = window.localStorage.getItem(
        "lime_invoke_trace_buffer_v1",
      );
      let appServerMethods = [];
      try {
        const entries = JSON.parse(traceRaw || "[]");
        const safeEntries = Array.isArray(entries) ? entries : [];
        appServerMethods = safeEntries.flatMap((entry) => {
          if (
            entry?.command !== "app_server_handle_json_lines" ||
            entry?.transport !== "electron-ipc"
          ) {
            return [];
          }
          return Array.isArray(entry?.args_preview?.request?.lines)
            ? entry.args_preview.request.lines.flatMap((line) => {
                try {
                  const request = JSON.parse(String(line));
                  return typeof request?.method === "string"
                    ? [request.method]
                    : [];
                } catch {
                  return [];
                }
              })
            : [];
        });
      } catch {
        appServerMethods = [];
      }
      if (
        !active ||
        !bodyText.includes("个人资料") ||
        !(editButton instanceof HTMLButtonElement) ||
        loadingVisible ||
        errorVisible ||
        !appServerMethods.includes("config/read") ||
        (requireSave &&
          (!saveConfirmed || !appServerMethods.includes("config/batchWrite")))
      ) {
        return null;
      }
      return {
        profileTabActive: true,
        profileEditorReady: true,
        loadingVisible,
        errorVisible,
        saveConfirmed,
        traceRaw,
        errorRaw: window.localStorage.getItem("lime_invoke_error_buffer_v1"),
      };
    },
    "Profile Settings did not reach the required current state",
    { requireSave },
  );
}

async function openNicknameEditor(page) {
  await page.getByRole("button", { name: "编辑显示名称", exact: true }).click();
  const input = page.locator("#profile-field-displayName");
  await input.waitFor({ state: "visible" });
  return { input, value: await input.inputValue() };
}

async function saveNickname(page, value) {
  const editor = await openNicknameEditor(page);
  await editor.input.fill(value);
  await page.getByRole("button", { name: "保存显示名称", exact: true }).click();
}

async function readNicknameViaEditor(page) {
  const editor = await openNicknameEditor(page);
  const value = editor.value;
  await page
    .getByRole("button", { name: "取消编辑显示名称", exact: true })
    .click();
  return value;
}

async function run() {
  const options = parseSettingsProfileFixtureArgs(process.argv.slice(2), {
    defaults: DEFAULTS,
  });
  if (options.help) {
    printHelp();
    return;
  }
  fs.mkdirSync(options.evidenceDir, { recursive: true });
  const file = (suffix) =>
    path.join(options.evidenceDir, `${options.prefix}${suffix}`);
  const summaryPath = file("-summary.json");
  const summary = createSettingsProfileEvidence({
    candidateRunId: options.runId,
    startedAt: new Date().toISOString(),
    prefix: options.prefix,
  });
  const runtimeEnv = createTempRuntimeEnv();
  const binary = resolveDevAppServerBinary({
    env: runtimeEnv.env,
    repoRoot: process.cwd(),
    forceBuild: false,
  });
  const appServerEnv = resolveElectronAppServerRuntimeEnv({
    env: { ...runtimeEnv.env, APP_SERVER_BIN: binary },
  });
  const consoleErrors = [],
    pageErrors = [],
    traceRaws = [],
    errorRaws = [],
    snapshots = [],
    teardowns = [];
  let handle = null,
    page = null,
    mainExit = null,
    collision = null;
  const fresh = () => {
    const value = inspectElectronFixtureBuildFreshness({
      rootDir: process.cwd(),
    });
    assert.equal(value.ready, true, "current Electron build must be fresh");
    return value;
  };
  const launch = async (seed = false) => {
    handle = await launchElectronFixture({
      options,
      runtimeEnv,
      appServerEnv,
      consoleErrors,
      pageErrors,
    });
    mainExit = captureMainProcessExit(handle.app.process());
    snapshots.push(handle.rendererSnapshot);
    page = handle.page;
    if (seed) await seedProfileFixture(page);
    await openProfileSettings(page, options);
    await readProfileState(page, options);
  };
  const capture = async (requireSave = false) => {
    const state = await readProfileState(page, options, { requireSave });
    traceRaws.push(state.traceRaw);
    errorRaws.push(state.errorRaw);
    return state;
  };
  const readConfig = async () => {
    const response = await invokeAppServerFromPage(page, "config/read", {
      includeLayers: true,
    });
    assert.ok(response.result?.config);
    return response.result;
  };
  const close = async () => {
    const teardown = await settleFixtureResources({
      app: handle?.app,
      mainExit,
    });
    teardowns.push(teardown);
    summary.teardowns = teardowns;
    handle = null;
    page = null;
    mainExit = null;
    assert.equal(
      teardown.ok,
      true,
      "normal Main exit is required within 15 seconds",
    );
  };
  const createCollision = () => {
    const configPath = path.join(runtimeEnv.electronUserDataDir, "config.yaml");
    const backupPath = configPath + ".profile-backup";
    assert.equal(fs.statSync(configPath).isFile(), true);
    assert.equal(fs.existsSync(backupPath), false);
    fs.renameSync(configPath, backupPath);
    fs.mkdirSync(configPath);
    collision = { configPath, backupPath };
  };
  const restoreCollision = () => {
    if (!collision) return;
    if (fs.existsSync(collision.configPath)) fs.rmdirSync(collision.configPath);
    fs.renameSync(collision.backupPath, collision.configPath);
    collision = null;
  };
  try {
    summary.buildFreshness = { before: fresh() };
    await launch(true);
    const initial = (await readConfig()).config;
    const original = await readNicknameViaEditor(page);
    const changed = "GateProfile" + Date.now();
    await saveNickname(page, changed);
    const saved = await capture(true);
    const expected = structuredClone(initial);
    expected.user_profile = { ...expected.user_profile, nickname: changed };
    assert.equal(
      isDeepStrictEqual((await readConfig()).config, expected),
      true,
      "untouched config preserved",
    );
    await page.screenshot({ path: file("-saved.png"), fullPage: true });
    await close();

    await launch();
    const restarted = await readNicknameViaEditor(page);
    await capture();
    assert.equal(restarted, changed);
    await page.screenshot({ path: file("-restart.png"), fullPage: true });
    const baseline = await readConfig();
    createCollision();
    // This separate same-boundary IO probe is not a capture of the GUI response.
    const rpcErrorProof = await page.evaluate(
      async ({ profile, version }) => {
        const id = "profile-io-proof";
        const response = await window.electronAPI.invoke(
          "app_server_handle_json_lines",
          {
            request: {
              lines: [
                JSON.stringify({
                  jsonrpc: "2.0",
                  id,
                  method: "config/batchWrite",
                  params: {
                    edits: [
                      {
                        keyPath: "user_profile",
                        value: profile,
                        mergeStrategy: "replace",
                      },
                    ],
                    expectedVersion: version,
                    reloadUserConfig: true,
                  },
                }),
              ],
            },
          },
        );
        const error = response.lines
          .map((line) => JSON.parse(line))
          .find((message) => message.id === id)?.error;
        return {
          method: "config/batchWrite",
          errorCode: error?.code ?? null,
          ioCauseVerified:
            /EISDIR|is a directory|illegal operation on a directory/i.test(
              String(error?.message ?? "") + JSON.stringify(error?.data ?? {}),
            ),
        };
      },
      {
        profile: {
          ...baseline.config.user_profile,
          nickname: changed + "-retry",
        },
        version: baseline.layers[0].version,
      },
    );
    assert.equal(rpcErrorProof.ioCauseVerified, true);
    summary.expectedFailure = {
      rpcErrorProof,
      ioProbeIsGuiResponseCapture: false,
    };
    const failedNickname = changed + "-retry";
    await saveNickname(page, failedNickname);
    const failVisible = async () =>
      waitForPageCondition(
        page,
        options,
        () => {
          const alert = document.querySelector(
            '[data-testid="settings-profile-page"] [role="alert"]',
          );
          if (alert?.textContent !== "保存资料失败") return null;
          const body = document.body.innerText;
          if (/EISDIR|illegal operation on a directory|config\.yaml/.test(body))
            throw new Error("raw backend details leaked into Profile");
          return true;
        },
        "safe Profile save failure visible",
      );
    await failVisible();
    assert.equal(
      await page.locator("#profile-field-displayName").inputValue(),
      failedNickname,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "保存显示名称", exact: true })
        .isEnabled(),
      true,
    );
    await page.screenshot({ path: file("-inline-error.png"), fullPage: true });
    // Retry name first, then exercise the same failure contract for bio.
    restoreCollision();
    await page
      .getByRole("button", { name: "保存显示名称", exact: true })
      .click();
    await page
      .locator("#profile-field-displayName")
      .waitFor({ state: "detached" });
    await capture(true);
    await page
      .getByRole("button", { name: "编辑个人简介", exact: true })
      .click();
    const failedBio = "fixture profile bio retry";
    await page.locator("#profile-field-bio").fill(failedBio);
    createCollision();
    await page
      .getByRole("button", { name: "保存个人简介", exact: true })
      .click();
    await failVisible();
    assert.equal(
      await page.locator("#profile-field-bio").inputValue(),
      failedBio,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "保存个人简介", exact: true })
        .isEnabled(),
      true,
    );
    await page.screenshot({ path: file("-bio-error.png"), fullPage: true });
    restoreCollision();
    await page
      .getByRole("button", { name: "保存个人简介", exact: true })
      .click();
    await page.locator("#profile-field-bio").waitFor({ state: "detached" });
    await capture(true);
    assert.equal((await readConfig()).config.user_profile.bio, failedBio);
    await page
      .getByRole("button", { name: "编辑个人简介", exact: true })
      .click();
    await page.locator("#profile-field-bio").fill(initial.user_profile.bio);
    await page
      .getByRole("button", { name: "保存个人简介", exact: true })
      .click();
    await page.locator("#profile-field-bio").waitFor({ state: "detached" });
    await capture(true);
    await saveNickname(page, original);
    const restored = await capture(true);
    assert.equal(
      isDeepStrictEqual((await readConfig()).config, initial),
      true,
      "original full config restored",
    );
    await close();

    await launch();
    const final = await capture();
    const finalNickname = await readNicknameViaEditor(page);
    assert.equal(isDeepStrictEqual((await readConfig()).config, initial), true);
    await page.screenshot({ path: file("-restored.png"), fullPage: true });
    await close();
    summary.buildFreshness.after = fresh();
    const trace = summarizeSettingsProfileTrace(traceRaws);
    applyPassingSettingsProfileEvidence(summary, {
      completedAt: new Date().toISOString(),
      electronLaunchCount: snapshots.filter((value) => value.electron).length,
      preloadLaunchCount: snapshots.filter((value) => value.hasInvokeBridge)
        .length,
      normalMainExits: teardowns.map((value) => ({
        ...value.normalMainExit,
        forcedCleanup: value.forcedCleanup !== null,
      })),
      isolatedUserData: runtimeEnv.electronUserDataDir.startsWith(
        runtimeEnv.tempRoot,
      ),
      localProfileMode: true,
      profileTabActive: final.profileTabActive,
      profileEditorReady: final.profileEditorReady,
      profileChanged: changed !== original,
      saveConfirmed: saved.saveConfirmed,
      restartReadback: restarted === changed,
      restorationSaveConfirmed: restored.saveConfirmed,
      restorationReadback: finalNickname === original,
      displayNameFailureRetained: true,
      bioFailureRetained: true,
      saveRetriesAccepted: true,
      fullConfigPreserved: true,
      rpcErrorProof,
      loadingVisible: final.loadingVisible,
      errorVisible: final.errorVisible,
      trace,
      consoleErrors,
      pageErrors,
      invokeErrorCount: errorRaws.reduce(
        (count, raw) => count + parseInvokeTraceRaw(raw).length,
        0,
      ),
      savedScreenshotWritten: fs.existsSync(file("-saved.png")),
      restartScreenshotWritten: fs.existsSync(file("-restart.png")),
      restoredScreenshotWritten: fs.existsSync(file("-restored.png")),
    });
    writeJsonFile(file("-raw.json"), {
      lifecycle: summary.lifecycle,
      methods: trace.methods,
      expectedFailure: summary.expectedFailure,
      normalMainExits: summary.normalMainExits,
    });
  } catch (error) {
    applyFailedSettingsProfileEvidence(summary, error);
    summary.consoleErrors = consoleErrors.map(sanitizeText);
    summary.pageErrors = pageErrors.map(sanitizeText);
    if (page)
      await page
        .screenshot({ path: file("-failure.png"), fullPage: true })
        .catch(() => undefined);
    throw error;
  } finally {
    try {
      restoreCollision();
      if (handle) await close();
      if (!options.keepTemp)
        fs.rmSync(runtimeEnv.tempRoot, { recursive: true, force: true });
    } catch (error) {
      applyFailedSettingsProfileEvidence(summary, error);
      throw error;
    } finally {
      writeJsonFile(summaryPath, summary);
    }
  }
  console.log(`[smoke:settings-profile-fixture] summary=${summaryPath}`);
}

run().catch((error) => {
  console.error(
    `[smoke:settings-profile-fixture] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
