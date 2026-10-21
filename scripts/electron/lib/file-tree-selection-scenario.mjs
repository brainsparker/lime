import assert from "node:assert/strict";
import path from "node:path";

/** 用真实指针/键盘验证选择；不注入组件状态，不批量打开文件。 */
export async function collectFileTreeSelectionEvidence(
  page,
  { tree, workspace, file, timeoutMs, capture },
) {
  const firstPath = path.join(workspace.rootPath, file.relativePath);
  const secondPath = path.join(workspace.rootPath, file.secondRelativePath);
  const markdownPath = path.join(workspace.rootPath, file.markdownRelativePath);
  const first = tree
    .getByRole("treeitem")
    .and(tree.getByTitle(firstPath, { exact: true }));
  const second = tree
    .getByRole("treeitem")
    .and(tree.getByTitle(secondPath, { exact: true }));
  const markdown = tree
    .getByRole("treeitem")
    .and(tree.getByTitle(markdownPath, { exact: true }));
  const tabs = page.getByTestId("workspace-right-surface-tab-files");
  const initialTabCount = await tabs.count();
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  const waitSelected = (paths) =>
    page.waitForFunction(
      (expected) => {
        const tree = [
          ...document.querySelectorAll('[data-testid="workspace-file-tree"]'),
        ].find((element) => element.getClientRects().length > 0);
        if (!tree) return false;
        const selected = [
          ...(tree?.querySelectorAll(
            '[role="treeitem"][aria-selected="true"]',
          ) ?? []),
        ]
          .map((element) => element.getAttribute("data-item-path"))
          .sort();
        return JSON.stringify(selected) === JSON.stringify(expected);
      },
      [...paths].sort(),
      { timeout: timeoutMs },
    );

  await tree.getByRole("textbox").fill("");
  await first.waitFor({ state: "visible", timeout: timeoutMs });
  await second.waitFor({ state: "visible", timeout: timeoutMs });
  await first.click();
  await waitSelected([firstPath]);
  await second.click({ modifiers: [modifier] });
  await waitSelected([firstPath, secondPath]);
  await capture("file-selection-multiple");
  await second.click({ modifiers: [modifier] });
  await waitSelected([firstPath]);

  const visiblePaths = await tree
    .getByRole("treeitem")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-item-path")),
    );
  const firstIndex = visiblePaths.indexOf(firstPath);
  const secondIndex = visiblePaths.indexOf(secondPath);
  const markdownIndex = visiblePaths.indexOf(markdownPath);
  assert.ok(
    firstIndex >= 0 &&
      markdownIndex > firstIndex &&
      secondIndex > markdownIndex,
    "Fixture files must retain canonical tree order",
  );
  const range = visiblePaths.slice(firstIndex, secondIndex + 1);
  await second.click({ modifiers: [modifier] });
  await waitSelected([firstPath, secondPath]);
  await markdown.click({ modifiers: [modifier, "Shift"] });
  const additiveRange = [
    firstPath,
    ...visiblePaths.slice(markdownIndex, secondIndex + 1),
  ];
  await waitSelected(additiveRange);
  await capture("file-selection-additive");
  await first.click();
  await second.click({ modifiers: ["Shift"] });
  await waitSelected(range);
  await first.click();
  await first.focus();
  await first.press("Shift+ArrowDown");
  await waitSelected([firstPath, visiblePaths[firstIndex + 1]]);
  await page.keyboard.press("Shift+ArrowUp");
  await waitSelected([firstPath]);
  await first.press(`${modifier}+Space`);
  await waitSelected([]);
  await first.press(`${modifier}+Space`);
  await waitSelected([firstPath]);
  assert.equal(
    await first.evaluate((node) => node === document.activeElement),
    true,
  );
  assert.equal(
    await tabs.count(),
    initialTabCount,
    "Selection must not batch-open file tabs",
  );
  await capture("file-selection-keyboard");

  // 先选择可见树的首个文件，确保全选不因受控 preview 路径变化而归一。
  const allAnchor = tree
    .locator('[role="treeitem"][data-item-type="file"]')
    .first();
  const allAnchorPath = await allAnchor.getAttribute("data-item-path");
  assert.ok(allAnchorPath);
  await allAnchor.click();
  await waitSelected([allAnchorPath]);
  const beforeSelectAllTabCount = await tabs.count();
  await allAnchor.press(`${modifier}+a`);
  await waitSelected(visiblePaths);
  assert.equal(
    await allAnchor.evaluate((node) => node === document.activeElement),
    true,
  );
  assert.equal(await tabs.count(), beforeSelectAllTabCount);
  await capture("file-selection-all");

  // 真实搜索重建所属树；前一个目录的选择集合不能泄漏到新query。
  await tree.getByRole("textbox").fill(file.relativePath);
  await first.waitFor({ state: "visible", timeout: timeoutMs });
  await waitSelected([]);
  await first.click();
  await waitSelected([firstPath]);
  return {
    modifier,
    pointerToggle: true,
    visibleRange: range,
    additiveRange,
    keyboardExtendAndContract: true,
    keyboardToggle: true,
    keyboardSelectAll: visiblePaths,
    retainedFocus: true,
    noBatchOpen: true,
    searchScopeReset: true,
  };
}
