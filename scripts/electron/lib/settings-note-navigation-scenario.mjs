import assert from "node:assert/strict";
import path from "node:path";
import {
  openSettings,
  waitForPageCondition,
} from "../mcp-config-fixture-smoke.mjs";
import { invokeAppServerFromPage } from "../../agent-runtime/claw-chat-current-fixture-rpc.mjs";

export async function runSettingsNoteNavigationScenario({
  page,
  options,
  evidenceDir,
  stage,
  waitForSession,
}) {
  const input = page.getByTestId("settings-memory-note-textarea");
  const dialog = page.getByTestId("settings-unsaved-changes-dialog");
  const keep = dialog.getByRole("button", { name: "继续编辑", exact: true });
  const discard = dialog.getByRole("button", { name: "放弃更改", exact: true });
  const marker = `Settings correction ${path.basename(evidenceDir)}`;
  const listNotes = async () => {
    const response = await invokeAppServerFromPage(page, "memoryStore/list", {
      scope: "global",
      path: "extensions/ad_hoc/notes",
      maxResults: 200,
    });
    assert.equal(response.result?.truncated, false);
    return (response.result.entries ?? []).map((entry) => entry.path).sort();
  };
  stage("note-store-inventory");
  const initialPaths = await listNotes();
  const openMemory = async () => {
    await openSettings(page, options);
    await page.getByTestId("settings-sidebar-tab-memory").click();
    await input.waitFor({ state: "visible" });
    assert.equal(await input.inputValue(), "");
  };
  const waitForAbout = () =>
    waitForPageCondition(
      page,
      options,
      () =>
        document
          .querySelector('[data-testid="settings-sidebar-tab-about"]')
          ?.getAttribute("aria-current") === "page" &&
        !document.querySelector('[data-testid="settings-page-loading"]'),
      "note navigation committed About",
    );
  const observations = [];
  for (const target of ["section", "back"]) {
    stage(`unsaved-note-${target}`);
    await openMemory();
    await input.fill(marker);
    const trigger = {
      section: page.getByTestId("settings-sidebar-tab-about"),
      back: page.getByTestId("settings-back-button"),
    }[target];
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    if (target === "section")
      await page.screenshot({
        path: path.join(evidenceDir, "note-unsaved-dialog.png"),
      });
    await keep.click();
    assert.equal(await input.inputValue(), marker);
    assert.deepEqual(
      await listNotes(),
      initialPaths,
      "confirmation never persists a note",
    );
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    await discard.click();
    await dialog.waitFor({ state: "detached" });
    if (target === "section") {
      await waitForAbout();
      await page.getByTestId("settings-back-button").click();
    }
    await waitForSession();
    assert.deepEqual(
      await listNotes(),
      initialPaths,
      "discard never writes a note",
    );
    observations.push({
      target,
      keptInput: true,
      discardedWithoutSave: true,
      sameSessionReturn: true,
    });
  }

  stage("note-retained-across-local-tabs-and-config-cancel");
  await openMemory();
  const saveButtonLayout = await page
    .getByTestId("settings-memory-note-save")
    .evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: rect.width,
        height: rect.height,
        lineHeight: Number.parseFloat(style.lineHeight),
        contentHeight:
          rect.height -
          Number.parseFloat(style.paddingTop) -
          Number.parseFloat(style.paddingBottom),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        whiteSpace: style.whiteSpace,
        flexShrink: style.flexShrink,
      };
    });
  assert.ok(
    saveButtonLayout.contentHeight <= saveButtonLayout.lineHeight + 2,
    "note save text stays on one line",
  );
  assert.ok(
    saveButtonLayout.scrollWidth <= saveButtonLayout.clientWidth,
    "note save text is not clipped",
  );
  await input.fill(marker);
  await page.getByTestId("settings-memory-toggle").click();
  await page.getByTestId("settings-memory-cancel").click();
  assert.equal(await input.inputValue(), marker);
  for (const tab of ["soul", "advanced"]) {
    await page.getByTestId(`settings-memory-tab-${tab}`).click();
    await input.waitFor({ state: "hidden" });
    await page.getByTestId("settings-sidebar-tab-about").click();
    await dialog.waitFor({ state: "visible" });
    await keep.click();
    await page.getByTestId("settings-memory-tab-memory").click();
    await input.waitFor({ state: "visible" });
    assert.equal(await input.inputValue(), marker);
  }
  assert.deepEqual(await listNotes(), initialPaths);

  stage("note-save-through-current-store-and-read");
  await page.getByTestId("settings-memory-note-save").click();
  await waitForPageCondition(
    page,
    options,
    () => {
      const note = document.querySelector(
        '[data-testid="settings-memory-note-textarea"]',
      );
      const save = document.querySelector(
        '[data-testid="settings-memory-note-save"]',
      );
      return note?.value === "" && save?.disabled === false;
    },
    "note persisted and submitted input consumed",
  );
  const savedPaths = await listNotes();
  const added = savedPaths.filter((entry) => !initialPaths.includes(entry));
  assert.equal(added.length, 1, "one explicit save creates exactly one note");
  assert.equal(savedPaths.length, initialPaths.length + 1);
  const read = await invokeAppServerFromPage(page, "memoryStore/read", {
    scope: "global",
    path: added[0],
    maxLines: 100,
    maxTokens: 2048,
  });
  assert.equal(read.result?.path, added[0]);
  assert.equal(read.result?.truncated, false);
  assert.equal(read.result?.content, `# 设置页记忆修正\n\n${marker}\n`);
  await page.screenshot({ path: path.join(evidenceDir, "note-saved.png") });
  await page.getByTestId("settings-sidebar-tab-about").click();
  await waitForAbout();
  assert.equal(await dialog.count(), 0);
  await page.getByTestId("settings-sidebar-tab-memory").click();
  await input.waitFor({ state: "visible" });
  assert.equal(await input.inputValue(), "");
  await page.getByTestId("settings-back-button").click();
  await waitForSession();
  return {
    observations,
    localTabsRetained: ["soul", "advanced"],
    configurationCancelKeepsNote: true,
    savedAndReopened: true,
    savedPath: added[0],
    exactPersistedContent: true,
    saveButtonLayout,
    initialNotes: initialPaths.length,
    finalNotes: savedPaths.length,
    limitations:
      "Controlled isolated store; failure, duplicate/in-flight edits and late results are covered by component integration tests. No live provider or other settings-form claim.",
  };
}
