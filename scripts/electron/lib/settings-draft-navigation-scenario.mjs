import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  appServerCallFromPage,
  openMcpConfigSettings,
  readConfigFromPage,
  updateConfigFromPage,
  waitForPageCondition,
} from "../mcp-config-fixture-smoke.mjs";
import { isObservedPreloadAppServerResponse } from "./mcp-config-fixture-evidence.mjs";

export const SETTINGS_DRAFT_FIXTURE_SOURCES = [
  "scripts/electron/settings-developer-fixture-smoke.mjs",
  "scripts/electron/settings-mcp-lifecycle-fixture-smoke.mjs",
  "scripts/electron/mcp-config-fixture-smoke.mjs",
  "scripts/electron/lib/settings-draft-navigation-scenario.mjs",
  "scripts/electron/lib/settings-developer-fixture-evidence.mjs",
  "scripts/electron/lib/settings-mcp-lifecycle-fixture-evidence.mjs",
  "scripts/electron/lib/mcp-config-fixture-evidence.mjs",
  "scripts/electron/lib/persisted-atom-fixture-driver.mjs",
  "scripts/agent-runtime/claw-chat-current-fixture-teardown.mjs",
  "scripts/lib/electron-fixture-build.mjs",
  "src/components/mcp/useMcpPageEditorState.ts",
  "src/components/mcp/McpPage.tsx",
  "src/components/mcp/McpPageEditor.tsx",
  "src/components/mcp/McpPanel.tsx",
  "src/components/settings-v2/system/experimental/index.tsx",
  "src/components/settings-v2/system/experimental/useExperimentalSettingsState.ts",
  "src/components/settings-v2/system/developer-lab/index.tsx",
  "src/components/settings-v2/_layout/SettingsUnsavedChangesDialog.tsx",
  "src/components/settings-v2/_layout/useSettingsDraft.ts",
  "src/lib/api/appConfig.ts",
  "src/lib/crashReporting.ts",
];

export function captureSettingsDraftFixtureSources(rootDir) {
  return SETTINGS_DRAFT_FIXTURE_SOURCES.map((file) => ({
    file,
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(rootDir, file)))
      .digest("hex"),
  }));
}

export function observeSettingsDraftReadback(response, method) {
  assert.equal(
    isObservedPreloadAppServerResponse(response?.ipcObservation, method),
    true,
    "draft readback requires current preload IPC and matching JSON-RPC identity",
  );
  // Do not retain params, request IDs, configuration, or server data.
  return {
    method,
    transport: "electron-ipc",
    matchingRequestResponse: true,
    currentPreload: true,
  };
}

export function settingsDraftNavigationChecks(kind, proof) {
  assert.ok(["experimental", "mcp"].includes(kind), "known draft scenario");
  const required = [
    "sameNodeAcrossTabs",
    "tabDraftRetained",
    "sectionKeep",
    "sectionDiscard",
    "keepDefaultFocus",
    "unpersistedDraft",
  ];
  required.push(
    ...(kind === "experimental"
      ? [
          "safeCrashPreflight",
          "guiSaveReadback",
          "reopenedValue",
          "untouchedConfigPreserved",
          "configurationRestored",
        ]
      : ["sameServerIdentity", "cancelKeep", "cancelDiscard"]),
  );
  const method = kind === "experimental" ? "config/read" : "mcpServer/list";
  return [
    ...required.map((key) => [`${kind}Draft.${key}`, proof?.[key] === true]),
    [
      `${kind}Draft.currentReadbackIdentity`,
      Array.isArray(proof?.readbacks) &&
        proof.readbacks.length >= 3 &&
        proof.readbacks.every(
          (value) =>
            value?.method === method &&
            value.transport === "electron-ipc" &&
            value.currentPreload === true &&
            value.matchingRequestResponse === true,
        ),
    ],
  ];
}

export function summarizeSettingsDraftProof(kind, proof) {
  const values = Object.fromEntries(
    settingsDraftNavigationChecks(kind, proof)
      .filter(([key]) => !key.endsWith(".currentReadbackIdentity"))
      .map(([key, passed]) => [key.slice(key.indexOf(".") + 1), passed]),
  );
  const method = kind === "experimental" ? "config/read" : "mcpServer/list";
  return {
    ...values,
    readbacks: Array.isArray(proof?.readbacks)
      ? proof.readbacks.map((item) => ({
          method: item?.method === method ? method : null,
          transport: item?.transport === "electron-ipc" ? "electron-ipc" : null,
          currentPreload: item?.currentPreload === true,
          matchingRequestResponse: item?.matchingRequestResponse === true,
        }))
      : [],
  };
}

export function settingsDraftNativeChecks(facts, launchCount) {
  return [
    [
      "normalMainExits",
      Array.isArray(facts.normalMainExits) &&
        facts.normalMainExits.length === launchCount &&
        facts.normalMainExits.every(
          (exit) =>
            exit?.exited === true &&
            exit.exitCode === 0 &&
            exit.signal === null &&
            exit.mode === "normal" &&
            exit.forcedCleanup === false,
        ),
    ],
    [
      "buildFreshnessBeforeAfter",
      facts.buildFreshness?.before?.ready === true &&
        facts.buildFreshness?.after?.ready === true,
    ],
    [
      "declaredSourcesStable",
      Array.isArray(facts.sourceManifest?.before) &&
        facts.sourceManifest.before.length ===
          SETTINGS_DRAFT_FIXTURE_SOURCES.length &&
        facts.sourceManifest.before.every(
          (item, index) =>
            item.file === SETTINGS_DRAFT_FIXTURE_SOURCES[index] &&
            /^[a-f0-9]{64}$/.test(item.sha256),
        ) &&
        isDeepStrictEqual(
          facts.sourceManifest.before,
          facts.sourceManifest.after,
        ),
    ],
  ];
}

function unsavedDialog(page) {
  const dialog = page.getByTestId("settings-unsaved-changes-dialog");
  return {
    dialog,
    keep: dialog.getByRole("button", { name: "继续编辑", exact: true }),
    discard: dialog.getByRole("button", { name: "放弃更改", exact: true }),
  };
}

async function keepThenDiscard({
  page,
  field,
  trigger,
  changed,
  verifyUnchanged,
}) {
  const { dialog, keep, discard } = unsavedDialog(page);
  await trigger.click();
  await dialog.waitFor({ state: "visible" });
  assert.equal(
    await keep.evaluate((element) => element === document.activeElement),
    true,
  );
  await keep.click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(await field.inputValue(), changed);
  await verifyUnchanged();
  await trigger.click();
  await dialog.waitFor({ state: "visible" });
  await discard.click();
  await dialog.waitFor({ state: "detached" });
  await verifyUnchanged();
}

async function assertAbout(page, options) {
  await waitForPageCondition(
    page,
    options,
    () =>
      document
        .querySelector('[data-testid="settings-sidebar-tab-about"]')
        ?.getAttribute("aria-current") === "page" &&
      !document.querySelector('[data-testid="settings-page-loading"]'),
    "draft discard committed the real About navigation",
  );
}

export async function runExperimentalDraftNavigationScenario({
  page,
  options,
}) {
  const readbacks = [];
  const read = async () => {
    const result = await readConfigFromPage(page);
    readbacks.push(
      observeSettingsDraftReadback(result.response, "config/read"),
    );
    return result.config;
  };
  const original = await read();
  assert.equal(
    Boolean(original.crash_reporting?.dsn),
    false,
    "isolated fixture has no crash DSN",
  );
  const prepared = await updateConfigFromPage(page, (latest) => ({
    ...latest,
    crash_reporting: { ...latest.crash_reporting, enabled: false, dsn: null },
  }));
  if (prepared.write)
    observeSettingsDraftReadback(prepared.write, "config/batchWrite");
  try {
    // External fixture setup must invalidate the renderer's canonical config cache.
    await page.evaluate(() => {
      window.localStorage.setItem(
        "lime.app-config.changed-at",
        `settings-experimental-fixture-${Date.now()}`,
      );
    });
    const initial = await read();
    assert.equal(initial.crash_reporting?.enabled, false);
    assert.equal(Boolean(initial.crash_reporting?.dsn), false);
    const baseline = initial.crash_reporting.environment;
    assert.equal(typeof baseline, "string");
    const changed =
      baseline === "settings-draft-fixture"
        ? "settings-draft-fixture-2"
        : "settings-draft-fixture";
    const field = page.locator("#experimental-crash-environment");
    const save = page.getByTestId("experimental-crash-save");
    const waitSaved = () =>
      waitForPageCondition(
        page,
        options,
        () => {
          const button = document.querySelector(
            '[data-testid="experimental-crash-save"]',
          );
          return (
            Array.from(document.querySelectorAll('[role="status"]')).some(
              (status) => status.textContent?.includes("崩溃上报配置已更新"),
            ) &&
            button instanceof HTMLButtonElement &&
            !button.disabled
          );
        },
        "experimental GUI save acknowledged",
      );
    const open = async () => {
      await page.getByTestId("settings-sidebar-tab-developer").click();
      await page.getByTestId("developer-lab-tab-experimental").click();
      const group = page.locator(
        '[data-settings-search-target="experimental-crash-reporting"]',
      );
      const details = group.locator("details");
      await details.waitFor({ state: "attached" });
      if (!(await details.evaluate((element) => element.open)))
        await details.locator("summary").click();
      await field.waitFor({ state: "visible" });
      await waitForPageCondition(
        page,
        options,
        () => {
          const input = document.querySelector(
            "#experimental-crash-environment",
          );
          return input instanceof HTMLInputElement && !input.disabled;
        },
        "experimental draft ready",
      );
    };
    const unchanged = async () =>
      assert.equal(
        isDeepStrictEqual(await read(), initial),
        true,
        "unsaved Experimental draft never persists",
      );
    await open();
    assert.equal(await field.inputValue(), baseline);
    await field.fill(changed);
    const originalNode = await field.elementHandle();
    await page.getByTestId("developer-lab-tab-developer").click();
    assert.equal(await field.isVisible(), false);
    assert.equal(
      await originalNode.evaluate((element) => element.isConnected),
      true,
    );
    await page.getByTestId("developer-lab-tab-experimental").click();
    assert.equal(
      await field.evaluate(
        (element, previous) => element === previous,
        originalNode,
      ),
      true,
    );
    await originalNode.dispose();
    assert.equal(await field.inputValue(), changed);
    await keepThenDiscard({
      page,
      field,
      changed,
      trigger: page.getByTestId("settings-sidebar-tab-about"),
      verifyUnchanged: unchanged,
    });
    await assertAbout(page, options);
    await open();
    assert.equal(await field.inputValue(), baseline);
    await field.fill(changed);
    await save.click();
    const expected = structuredClone(initial);
    expected.crash_reporting.environment = changed;
    await waitSaved();
    assert.equal(
      isDeepStrictEqual(await read(), expected),
      true,
      "GUI save preserves untouched config",
    );
    await page.getByTestId("settings-sidebar-tab-about").click();
    await assertAbout(page, options);
    assert.equal(await unsavedDialog(page).dialog.count(), 0);
    await open();
    assert.equal(await field.inputValue(), changed);
    await field.fill(baseline);
    await save.click();
    await waitSaved();
    assert.equal(
      isDeepStrictEqual(await read(), initial),
      true,
      "GUI restored the original environment",
    );
    await page.getByTestId("settings-sidebar-tab-about").click();
    await assertAbout(page, options);
    return {
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
      readbacks,
    };
  } finally {
    const restored = await updateConfigFromPage(page, (latest) => ({
      ...latest,
      crash_reporting: original.crash_reporting,
    }));
    if (restored.write)
      observeSettingsDraftReadback(restored.write, "config/batchWrite");
    assert.equal(
      isDeepStrictEqual(await read(), original),
      true,
      "isolated original configuration restored",
    );
  }
}

export async function runMcpDraftNavigationScenario({
  page,
  options,
  server,
  selectServer,
}) {
  assert.equal(typeof server?.id, "string");
  assert.ok(server.id);
  const readbacks = [];
  const verifyUnchanged = async () => {
    const response = await appServerCallFromPage(page, "mcpServer/list", {});
    readbacks.push(observeSettingsDraftReadback(response, "mcpServer/list"));
    const current = response.result?.servers?.find(
      (item) => item.id === server.id,
    );
    assert.equal(
      isDeepStrictEqual(current, server),
      true,
      "same MCP server remains unchanged before GUI save",
    );
  };
  const field = page.getByTestId("mcp-config-description");
  const changed = "settings-mcp-unsaved-fixture";
  await selectServer();
  await field.fill(changed);
  const originalNode = await field.elementHandle();
  await page.getByTestId("mcp-panel-tab-runtime").click();
  assert.equal(await field.isVisible(), false);
  assert.equal(
    await originalNode.evaluate((element) => element.isConnected),
    true,
  );
  await page.getByTestId("mcp-panel-tab-config").click();
  assert.equal(
    await field.evaluate(
      (element, previous) => element === previous,
      originalNode,
    ),
    true,
  );
  await originalNode.dispose();
  assert.equal(await field.inputValue(), changed);
  await keepThenDiscard({
    page,
    field,
    changed,
    trigger: page.getByTestId("mcp-config-cancel"),
    verifyUnchanged,
  });
  await field.waitFor({ state: "detached" });
  await selectServer();
  assert.equal(await field.inputValue(), server.description ?? "");
  await field.fill(changed);
  await keepThenDiscard({
    page,
    field,
    changed,
    trigger: page.getByTestId("settings-sidebar-tab-about"),
    verifyUnchanged,
  });
  await assertAbout(page, options);
  await openMcpConfigSettings(page, options);
  await selectServer();
  assert.equal(await field.inputValue(), server.description ?? "");
  return {
    sameNodeAcrossTabs: true,
    tabDraftRetained: true,
    sectionKeep: true,
    sectionDiscard: true,
    keepDefaultFocus: true,
    unpersistedDraft: true,
    sameServerIdentity: true,
    cancelKeep: true,
    cancelDiscard: true,
    readbacks,
  };
}
