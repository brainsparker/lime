import assert from "node:assert/strict";
import path from "node:path";
import {
  openSettings,
  waitForPageCondition,
} from "../mcp-config-fixture-smoke.mjs";
import { invokeAppServerFromPage } from "../../agent-runtime/claw-chat-current-fixture-rpc.mjs";

export async function runSettingsUnsavedNavigationScenario({
  page,
  options,
  evidenceDir,
  sessionId,
  stage,
  waitForSession,
  waitForHome,
}) {
  const readEnabled = async () => {
    const response = await invokeAppServerFromPage(page, "config/read", {
      includeLayers: true,
    });
    assert.ok(response.result?.config);
    return response.result.config.memory?.enabled ?? true;
  };
  const memory = page.getByTestId("settings-memory-page");
  const toggle = page.getByTestId("settings-memory-toggle");
  const dialog = page.getByTestId("settings-unsaved-changes-dialog");
  const keepEditing = dialog.getByRole("button", {
    name: "继续编辑",
    exact: true,
  });
  const discard = dialog.getByRole("button", { name: "放弃更改", exact: true });
  const saved = await readEnabled();
  const observations = [];
  const waitForAbout = () =>
    waitForPageCondition(
      page,
      options,
      () =>
        document
          .querySelector('[data-testid="settings-sidebar-tab-about"]')
          ?.getAttribute("aria-current") === "page" &&
        !document.querySelector('[data-testid="settings-page-loading"]'),
      "About section committed",
    );
  const openMemory = async () => {
    await openSettings(page, options);
    await page.getByTestId("settings-sidebar-tab-memory").click();
    await toggle.waitFor({ state: "visible" });
    assert.equal(await toggle.getAttribute("aria-checked"), String(saved));
  };
  const returnToSession = async () => {
    await page
      .locator(
        `[data-testid="app-sidebar-conversation-open"][data-session-id="${sessionId}"]`,
      )
      .click();
    await waitForSession();
  };

  for (const target of ["section", "back", "home", "root"]) {
    stage(`unsaved-memory-${target}`);
    await openMemory();
    await toggle.click();
    const trigger = {
      section: page.getByTestId("settings-sidebar-tab-about"),
      back: page.getByTestId("settings-back-button"),
      home: page.getByTestId("app-sidebar-nav-home-general"),
      root: page.getByTestId("app-sidebar-nav-scheduled-tasks"),
    }[target];
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(
      await keepEditing.evaluate((node) => document.activeElement === node),
      true,
    );
    if (target === "section") {
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await discard.evaluate((node) => document.activeElement === node),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await keepEditing.evaluate((node) => document.activeElement === node),
        true,
      );
    }
    assert.equal(
      await page
        .getByTestId("settings-sidebar-tab-memory")
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(await toggle.getAttribute("aria-checked"), String(!saved));
    assert.equal(
      await readEnabled(),
      saved,
      "opening confirmation never saves the draft",
    );
    if (target === "back") await page.keyboard.press("Escape");
    else await keepEditing.click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await toggle.getAttribute("aria-checked"), String(!saved));
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    if (target === "section") {
      await page.screenshot({
        path: path.join(evidenceDir, "memory-unsaved-dialog.png"),
      });
    }
    await discard.click();
    await dialog.waitFor({ state: "detached" });
    if (target === "section") {
      await waitForAbout();
      await page.getByTestId("settings-back-button").click();
      await waitForSession();
    } else if (target === "back") await waitForSession();
    else {
      if (target === "home") await waitForHome();
      else {
        await memory.waitFor({ state: "detached" });
        assert.equal(
          await page
            .getByTestId("app-sidebar-nav-scheduled-tasks")
            .getAttribute("aria-current"),
          "page",
        );
        await page.getByTestId("app-sidebar-nav-home-general").click();
        await waitForHome();
      }
      await returnToSession();
    }
    assert.equal(
      await readEnabled(),
      saved,
      "discard never persists the draft",
    );
    observations.push({
      target,
      keptInput: true,
      discardedWithoutSave: true,
      sameSessionReturn: true,
    });
  }

  stage("unsaved-memory-save-through-current-config");
  await openMemory();
  await toggle.click();
  await page.getByTestId("settings-memory-save").click();
  await waitForPageCondition(
    page,
    options,
    () => {
      const save = document.querySelector(
        '[data-testid="settings-memory-save"]',
      );
      const cancel = document.querySelector(
        '[data-testid="settings-memory-cancel"]',
      );
      return (
        save?.disabled === true &&
        cancel?.disabled === true &&
        save.textContent.trim() === "保存"
      );
    },
    "Memory save acknowledged and draft clean",
  );
  assert.equal(await readEnabled(), !saved);
  await page.getByTestId("settings-sidebar-tab-about").click();
  await waitForAbout();
  assert.equal(await dialog.count(), 0);
  await page.getByTestId("settings-sidebar-tab-memory").click();
  await toggle.waitFor({ state: "visible" });
  assert.equal(await toggle.getAttribute("aria-checked"), String(!saved));
  await toggle.click();
  await page.getByTestId("settings-memory-save").click();
  await waitForPageCondition(
    page,
    options,
    () => {
      const cancel = document.querySelector(
        '[data-testid="settings-memory-cancel"]',
      );
      const save = document.querySelector(
        '[data-testid="settings-memory-save"]',
      );
      return cancel?.disabled === true && save?.textContent.trim() === "保存";
    },
    "Memory original config restored",
  );
  assert.equal(await readEnabled(), saved);

  stage("unsaved-memory-unapplied-soul-input");
  await page.getByTestId("settings-memory-tab-advanced").click();
  const imported = page.getByTestId("settings-memory-soul-import-textarea");
  await imported.fill("# Unsaved fixture personality");
  await page.getByTestId("settings-back-button").click();
  await dialog.waitFor({ state: "visible" });
  await keepEditing.click();
  assert.equal(await imported.inputValue(), "# Unsaved fixture personality");
  await page.getByTestId("settings-memory-cancel").click();
  assert.equal(await imported.inputValue(), "");
  await page.getByTestId("settings-back-button").click();
  await waitForSession();
  assert.equal(await readEnabled(), saved);
  return {
    observations,
    savedAndReopened: true,
    originalConfigRestored: true,
    unappliedSoulInputKeptAndCanceled: true,
    limitations:
      "Failure, in-flight edits and late completion are covered by component tests; other settings forms remain outside this scenario.",
  };
}
