/** Files 复用 current review projection 的真实 Electron 交互证据。 */
export async function collectReviewThreadSidePanelEvidence(
  page,
  { threadId, changes, timeoutMs = 60_000 },
) {
  const host = await page.evaluate(() => ({
    electron: window.__LIME_ELECTRON__ === true,
    hasInvoke: typeof window.electronAPI?.invoke === "function",
  }));
  if (!host.electron || !host.hasInvoke) {
    throw new Error("Files review requires the real Electron/preload host");
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
  const toggle = page
    .locator('[data-testid="task-center-files-toggle"]')
    .first();
  await toggle.waitFor({ state: "visible", timeout: timeoutMs });
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
  const root = page.locator('[data-testid="workspace-files-surface"]');
  await root.waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    (identity) =>
      document
        .querySelector('[data-testid="workspace-files-surface"]')
        ?.getAttribute("data-review-thread-id") === identity,
    threadId,
    { timeout: timeoutMs },
  );

  const selected = [];
  for (const change of changes) {
    // 路径作为参数传入 DOM 查询，不插入 CSS selector。
    const button = root.getByTitle(change.path, { exact: true });
    await button.waitFor({ state: "visible", timeout: timeoutMs });
    await button.click();
    await page.waitForFunction(
      ({ path, lines }) => {
        const root = document.querySelector(
          '[data-testid="workspace-files-surface"]',
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
      "Files review lacks Electron/preload or canonical Thread identity",
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
      "Files review did not select and locate every expected diff",
    );
  }
  if (evidence.externalOpenBefore !== evidence.externalOpenAfter) {
    throw new Error(
      "Selecting a diff unexpectedly opened an external application",
    );
  }
}
