import { selectThreadSidePanelTool } from "./thread-side-panel-navigation.mjs";

/** Summary 只通过 current 页头入口打开，不再注入 Canvas 工具标签。 */
export async function collectThreadSummaryEntryEvidence(
  page,
  { screenshotPath, timeoutMs = 60_000 },
) {
  const trigger = page.getByTestId("thread-workspace-summary-toggle");
  await trigger.waitFor({ state: "visible", timeout: timeoutMs });
  if ((await trigger.count()) !== 1) {
    throw new Error("Summary must have exactly one header entry");
  }
  const initialOpen = (await trigger.getAttribute("aria-pressed")) === "true";
  if (!initialOpen) await trigger.click();
  const panel = page.getByTestId("thread-summary-panel");
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  const opened = await page.evaluate(() => {
    const panel = document.querySelector(
      '[data-testid="thread-summary-panel"]',
    );
    const layout = document.querySelector(
      '[data-testid="thread-summary-layout"]',
    );
    const container = panel?.closest(
      '[data-testid="thread-summary-inline"], [data-testid="thread-summary-popover"]',
    );
    return {
      mode: layout?.getAttribute("data-summary-mode"),
      container: container?.getAttribute("data-testid"),
      count: document.querySelectorAll('[data-testid="thread-summary-panel"]')
        .length,
      inCanvas: Boolean(
        panel?.closest('[data-testid="canvas-workbench-shell"]'),
      ),
      obsoleteTabCount: document.querySelectorAll(
        '[data-testid="canvas-workbench-panel-summary"], [data-canvas-tab-key="summary"]',
      ).length,
    };
  });
  if (
    opened.count !== 1 ||
    opened.inCanvas ||
    opened.obsoleteTabCount !== 0 ||
    !["overlay", "shift", "gutter"].includes(opened.mode) ||
    opened.container !==
      (opened.mode === "overlay"
        ? "thread-summary-popover"
        : "thread-summary-inline")
  ) {
    throw new Error(`Summary owner/layout mismatch: ${JSON.stringify(opened)}`);
  }
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  await trigger.click();
  await panel.waitFor({ state: "hidden", timeout: timeoutMs });
  const closed = (await trigger.getAttribute("aria-pressed")) === "false";
  if (!closed) throw new Error("Header Summary did not close");
  if (initialOpen) {
    await trigger.click();
    await panel.waitFor({ state: "visible", timeout: timeoutMs });
  }
  return { initialOpen, opened, closed, restored: initialOpen, screenshotPath };
}

/** Changes 复用 current review projection 的真实 Electron 交互证据。 */
export async function collectReviewThreadSidePanelEvidence(
  page,
  { threadId, changes, timeoutMs = 60_000 },
) {
  const host = await page.evaluate(() => ({
    electron: window.__LIME_ELECTRON__ === true,
    hasInvoke: typeof window.electronAPI?.invoke === "function",
  }));
  if (!host.electron || !host.hasInvoke) {
    throw new Error("Changes review requires the real Electron/preload host");
  }

  const openCount = () =>
    page.evaluate(() => {
      const entries = JSON.parse(
        localStorage.getItem("lime_invoke_trace_buffer_v1") || "[]",
      );
      return entries.filter(
        (entry) => entry.command === "open_with_default_app",
      ).length;
    });
  const externalOpenBefore = await openCount();
  await selectThreadSidePanelTool(page, "changes", timeoutMs);
  const root = page.locator('[data-testid="workspace-changes-surface"]');
  await root.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    (identity) =>
      document
        .querySelector('[data-testid="workspace-changes-surface"]')
        ?.getAttribute("data-review-thread-id") === identity,
    threadId,
    { timeout: timeoutMs },
  );
  const filesToggle = root.getByTestId("canvas-workbench-changes-files-toggle");
  await filesToggle.waitFor({ state: "visible", timeout: timeoutMs });
  const filesInitiallyOpen =
    (await filesToggle.getAttribute("aria-expanded")) === "true";
  if (!filesInitiallyOpen) await filesToggle.click();
  await root
    .getByTestId("canvas-workbench-changes-file-list")
    .waitFor({ state: "visible", timeout: timeoutMs });

  const selected = [];
  for (const change of changes) {
    // 路径作为参数传入 DOM 查询，不插入 CSS selector。
    const button = root.getByTitle(change.path, { exact: true });
    await button.waitFor({ state: "visible", timeout: timeoutMs });
    await button.click();
    await page.waitForFunction(
      ({ path, lines }) => {
        const root = document.querySelector(
          '[data-testid="workspace-changes-surface"]',
        );
        const diff = Array.from(
          root?.querySelectorAll(
            '[data-testid="canvas-workbench-change-diff-file"]',
          ) || [],
        ).find((node) => node.getAttribute("data-review-path") === path);
        return (
          diff?.getAttribute("data-selected") === "true" &&
          lines.every((line) =>
            Array.from(diff.querySelectorAll("[data-diff-line-type]")).some(
              (row) =>
                row.getAttribute("data-diff-line-type") === line.type &&
                row.textContent?.includes(line.text),
            ),
          )
        );
      },
      change,
      { timeout: timeoutMs },
    );
    selected.push(
      await root.evaluate((element, { path, lines, openDisabled }) => {
        const diff = Array.from(
          element.querySelectorAll(
            '[data-testid="canvas-workbench-change-diff-file"]',
          ),
        ).find((node) => node.getAttribute("data-review-path") === path);
        const rect = diff.firstElementChild.getBoundingClientRect();
        const viewportRect = element
          .querySelector('[data-testid="canvas-workbench-change-diff-list"]')
          .getBoundingClientRect();
        const open = element.querySelector(
          '[data-testid="canvas-workbench-changes-open-file"]',
        );
        return {
          path,
          selected: diff.getAttribute("data-selected") === "true",
          visible:
            rect.bottom > viewportRect.top && rect.top < viewportRect.bottom,
          linesMatched:
            lines.length > 0 &&
            lines.every((line) =>
              Array.from(diff.querySelectorAll("[data-diff-line-type]")).some(
                (row) =>
                  row.getAttribute("data-diff-line-type") === line.type &&
                  row.textContent?.includes(line.text),
              ),
            ),
          originalFileOpenStateCorrect:
            open instanceof HTMLButtonElement && open.disabled === openDisabled,
          originalFileOpenDisabled:
            open instanceof HTMLButtonElement ? open.disabled : null,
        };
      }, change),
    );
  }
  const externalOpenAfter = await openCount();
  const evidence = {
    host,
    threadId,
    filesInitiallyOpen,
    selected,
    externalOpenBefore,
    externalOpenAfter,
  };
  assertReviewThreadSidePanelEvidence(evidence);
  return evidence;
}

export function assertReviewThreadSidePanelEvidence(evidence) {
  if (
    !evidence?.host?.electron ||
    !evidence.host.hasInvoke ||
    !evidence.threadId
  ) {
    throw new Error(
      "Changes review lacks Electron/preload or canonical Thread identity",
    );
  }
  if (
    !evidence.selected?.length ||
    evidence.selected.some(
      (entry) =>
        !entry.selected ||
        !entry.visible ||
        entry.linesMatched !== true ||
        entry.originalFileOpenStateCorrect !== true,
    )
  ) {
    throw new Error(
      "Changes review did not select and locate every expected diff",
    );
  }
  if (evidence.externalOpenBefore !== evidence.externalOpenAfter) {
    throw new Error(
      "Selecting a diff unexpectedly opened an external application",
    );
  }
}
