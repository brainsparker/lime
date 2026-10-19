/** 只经 current 共享标签或 New tab 工具入口操作侧栏。 */
export async function selectThreadSidePanelTool(
  page,
  kind,
  timeoutMs = 60_000,
) {
  const tab = page.getByTestId(`workspace-right-surface-tab-${kind}`).first();
  if (await tab.isVisible()) {
    await tab.click();
    return { source: "existing-tab", kind };
  }
  const actionId = {
    files: "open-file",
    changes: "review",
    shell: "terminal",
    browser: "browser",
  }[kind];
  if (!actionId) throw new Error(`No current New tab action for ${kind}`);
  const action = page.locator(
    `[data-testid="side-panel-new-tab-${actionId}"]:visible`,
  );
  const add = page.getByTestId("workspace-right-surface-new-tab");
  if (!(await add.isVisible())) {
    await page.getByTestId("thread-side-panel-toggle").click();
    if (await tab.isVisible()) {
      await tab.click();
      return { source: "existing-tab", kind };
    }
  }
  if (!(await action.isVisible())) await add.click();
  await action.waitFor({ state: "visible", timeout: timeoutMs });
  await action.click();
  return { source: "new-tab", kind, actionId };
}

export async function closeThreadSidePanelTab(page, kind) {
  const tab = page.getByTestId(`workspace-right-surface-tab-${kind}`).first();
  await tab
    .locator("..")
    .getByTestId("workspace-right-surface-tab-close")
    .click();
}
