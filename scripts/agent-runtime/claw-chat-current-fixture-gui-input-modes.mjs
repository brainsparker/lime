import { waitForInputReady } from "./claw-chat-current-fixture-gui-actions.mjs";
import { evaluatePageSnapshot } from "./claw-chat-current-fixture-rpc.mjs";
import { assert, sanitizeJson } from "./claw-chat-current-fixture-utils.mjs";

export async function selectComposerSkillFromGui(
  page,
  { editor, skillIdentity, timeoutMs },
) {
  await editor.focus();
  await editor.press("ControlOrMeta+End");
  await page.keyboard.insertText(` $${skillIdentity.name}`);
  const list = page.locator('[data-testid="composer-context-suggestions"]');
  await list.waitFor({ state: "visible", timeout: timeoutMs });
  const option = list.locator(
    `[data-suggestion-key=${JSON.stringify(`skill:${skillIdentity.key}`)}]`,
  );
  await option.waitFor({ state: "visible", timeout: timeoutMs });
  const target = await option.elementHandle();
  assert(target, "技能建议缺少真实 option");
  await target.evaluate((node) => {
    node.addEventListener(
      "pointerdown",
      (event) => {
        node.dataset.fixtureTrustedSkillPointer = String(event.isTrusted);
      },
      { once: true },
    );
  });
  await option.click();
  const selection = await target.evaluate((node) => ({
    key: node.dataset.suggestionKey,
    text: node.textContent,
    trustedPointer: node.dataset.fixtureTrustedSkillPointer === "true",
  }));
  await target.dispose();
  const editorFocused = await editor.evaluate(
    (node) => document.activeElement === node,
  );
  assert(
    selection.trustedPointer && editorFocused,
    "真实技能建议选择未恢复同一 editor 焦点",
  );
  return sanitizeJson({ ...selection, editorFocused });
}

async function enableContextCommandFromGui(
  page,
  options,
  { label, suggestionKey, statusTestId },
) {
  await waitForInputReady(page, options);
  const editor = page
    .locator('[data-testid="composer-editor"][role="textbox"]')
    .first();
  await editor.focus();
  await page.locator('[data-testid="inputbar-plus-trigger"]').first().click();
  const list = page.locator('[data-testid="composer-context-suggestions"]');
  await list.waitFor({ state: "visible", timeout: options.timeoutMs });
  await list.locator(`[data-suggestion-key="${suggestionKey}"]`).click();
  await page
    .locator(`[data-testid="${statusTestId}"]`)
    .waitFor({ state: "visible", timeout: options.timeoutMs });
  const snapshot = await evaluatePageSnapshot(
    page,
    ({ statusTestId }) => {
      const chip = document.querySelector(`[data-testid="${statusTestId}"]`);
      return {
        statusChipVisible: Boolean(chip),
        statusText: chip?.textContent ?? "",
        editorFocused:
          document.activeElement?.matches('[data-testid="composer-editor"]') ===
          true,
      };
    },
    { statusTestId },
  );
  assert(
    snapshot?.statusChipVisible && snapshot.editorFocused,
    `${label} 未从共享建议列表启用并恢复焦点`,
  );
  return sanitizeJson(snapshot);
}

export async function enablePlanModeFromGui(page, options) {
  return await enableContextCommandFromGui(page, options, {
    label: "Plan mode",
    suggestionKey: "command:plan-mode",
    statusTestId: "inputbar-task-mode-status",
  });
}

export async function enableGoalModeFromGui(page, options) {
  return await enableContextCommandFromGui(page, options, {
    label: "追求目标",
    suggestionKey: "command:goal",
    statusTestId: "inputbar-objective-status",
  });
}
