import assert from "node:assert/strict";
import path from "node:path";
import {
  openSettings,
  waitForPageCondition,
} from "../mcp-config-fixture-smoke.mjs";
import { invokeAppServerFromPage } from "../../agent-runtime/claw-chat-current-fixture-rpc.mjs";

export async function runSettingsWebSearchNavigationScenario({
  page,
  options,
  evidenceDir,
  sessionId,
  stage,
  waitForSession,
  waitForHome,
}) {
  const read = async () => {
    const response = await invokeAppServerFromPage(page, "config/read", {
      includeLayers: true,
    });
    assert.ok(response.result?.config);
    return response.result.config;
  };
  const initial = await read();
  const engine = initial.web_search?.engine ?? "google";
  const changedEngine = engine === "google" ? "xiaohongshu" : "google";
  const timeout = String(initial.web_search?.multi_search?.timeout_ms ?? 4000);
  const changedTimeout = timeout === "2500" ? "3000" : "2500";
  const priority = (initial.web_search?.provider_priority ?? []).join(", ");
  const changedPriority = priority === "tavily" ? "bing_search_api" : "tavily";
  const select = page.locator("#web-search-engine");
  const save = page.getByTestId("web-search-save");
  const cancel = page.getByTestId("web-search-cancel");
  const dialog = page.getByTestId("settings-unsaved-changes-dialog");
  const keep = dialog.getByRole("button", { name: "继续编辑", exact: true });
  const discard = dialog.getByRole("button", { name: "放弃更改", exact: true });
  const open = async () => {
    await openSettings(page, options);
    await page.getByTestId("settings-sidebar-tab-web-search").click();
    await select.waitFor({ state: "visible" });
    assert.equal(await select.inputValue(), engine);
  };
  const about = () =>
    waitForPageCondition(
      page,
      options,
      () =>
        document
          .querySelector('[data-testid="settings-sidebar-tab-about"]')
          ?.getAttribute("aria-current") === "page" &&
        !document.querySelector('[data-testid="settings-page-loading"]'),
      "Web Search committed About",
    );
  const reopenSession = async () => {
    await page
      .locator(
        '[data-testid="app-sidebar-conversation-open"][data-session-id="' +
          sessionId +
          '"]',
      )
      .click();
    await waitForSession();
  };
  const sameConfig = async (expected, message) => {
    const actual = await read();
    // Compare in memory without putting credential-bearing config in assertion output.
    assert.equal(
      JSON.stringify(actual) === JSON.stringify(expected),
      true,
      message,
    );
  };
  const observations = [];
  for (const target of ["section", "back", "home", "root"]) {
    stage("unsaved-web-search-" + target);
    await open();
    await select.selectOption(changedEngine);
    const trigger = {
      section: page.getByTestId("settings-sidebar-tab-about"),
      back: page.getByTestId("settings-back-button"),
      home: page.getByTestId("app-sidebar-nav-home-general"),
      root: page.getByTestId("app-sidebar-nav-scheduled-tasks"),
    }[target];
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    await keep.click();
    assert.equal(await select.inputValue(), changedEngine);
    await sameConfig(initial, "opening confirmation never persists Web Search");
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    if (target === "section")
      await page.screenshot({
        path: path.join(evidenceDir, "web-search-unsaved-dialog.png"),
      });
    await discard.click();
    await dialog.waitFor({ state: "detached" });
    if (target === "section") {
      await about();
      await page.getByTestId("settings-back-button").click();
      await waitForSession();
    } else if (target === "back") await waitForSession();
    else {
      if (target === "root") {
        await select.waitFor({ state: "detached" });
        assert.equal(
          await page
            .getByTestId("app-sidebar-nav-scheduled-tasks")
            .getAttribute("aria-current"),
          "page",
        );
        await page.getByTestId("app-sidebar-nav-home-general").click();
      }
      await waitForHome();
      await reopenSession();
    }
    await sameConfig(initial, "discard never persists Web Search");
    observations.push({
      target,
      keptInput: true,
      discardedWithoutSave: true,
      sameSessionReturn: true,
    });
  }

  stage("web-search-local-tabs-and-cancel");
  await open();
  await page.locator("#web-search-provider-priority").fill(changedPriority);
  for (const tab of ["providers", "mse", "images"]) {
    await page.getByTestId("web-search-tab-" + tab).click();
    await page.getByTestId("settings-sidebar-tab-about").click();
    await dialog.waitFor({ state: "visible" });
    await keep.click();
    await page.getByTestId("web-search-tab-search").click();
    assert.equal(
      await page.locator("#web-search-provider-priority").inputValue(),
      changedPriority,
    );
  }
  await cancel.click();
  assert.equal(
    await page.locator("#web-search-provider-priority").inputValue(),
    priority,
  );
  await sameConfig(initial, "Cancel never writes configuration");

  const clean = () =>
    waitForPageCondition(
      page,
      options,
      () => {
        const save = document.querySelector('[data-testid="web-search-save"]');
        const cancel = document.querySelector(
          '[data-testid="web-search-cancel"]',
        );
        return (
          save?.disabled === true &&
          cancel?.disabled === true &&
          save.textContent.trim() === "保存"
        );
      },
      "Web Search save acknowledged with a clean draft",
    );
  const stableFields = (config) => {
    const value = structuredClone(config);
    if (value.web_search) {
      delete value.web_search.engine;
      if (value.web_search.multi_search)
        delete value.web_search.multi_search.timeout_ms;
    }
    return JSON.stringify(value);
  };
  stage("web-search-save-read-and-reopen");
  await select.selectOption(changedEngine);
  await page.getByTestId("web-search-tab-mse").click();
  await page.locator("#web-search-mse-timeout").fill(changedTimeout);
  await save.click();
  await clean();
  const saved = await read();
  assert.equal(saved.web_search?.engine, changedEngine);
  assert.equal(
    String(saved.web_search?.multi_search?.timeout_ms),
    changedTimeout,
  );
  assert.equal(
    stableFields(saved) === stableFields(initial),
    true,
    "untouched configuration preserved",
  );
  await page.screenshot({
    path: path.join(evidenceDir, "web-search-saved.png"),
  });
  await page.getByTestId("settings-sidebar-tab-about").click();
  await about();
  assert.equal(await dialog.count(), 0);
  await page.getByTestId("settings-sidebar-tab-web-search").click();
  await select.waitFor({ state: "visible" });
  assert.equal(await select.inputValue(), changedEngine);
  await page.getByTestId("web-search-tab-mse").click();
  assert.equal(
    await page.locator("#web-search-mse-timeout").inputValue(),
    changedTimeout,
  );
  await page.locator("#web-search-mse-timeout").fill(timeout);
  await page.getByTestId("web-search-tab-search").click();
  await select.selectOption(engine);
  await save.click();
  await clean();
  await sameConfig(initial, "original Web Search configuration restored");
  await page.getByTestId("settings-back-button").click();
  await waitForSession();
  return {
    observations,
    localTabsRetained: ["providers", "mse", "images"],
    cancelWithoutSave: true,
    savedAndReopened: true,
    originalConfigRestored: true,
    untouchedConfigurationPreserved: true,
    limitations:
      "Isolated external backend and real config store; failure, in-flight, duplicate, late settlement, credentials and five-language cases are component-level proof. No live search request or provider validation.",
  };
}
