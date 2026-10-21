import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";
import {
  isObservedPreloadAppServerResponse,
  parseJsonRpcRequestsFromInvokeTrace,
} from "./mcp-config-fixture-evidence.mjs";

export function recentsFixtureMarkdown() {
  return "\n\n[Recent report](recent-report.tex)";
}

export function writeRecentsFixtureFile(fs, path, workspaceRoot) {
  const filePath = path.join(workspaceRoot, "recent-report.tex");
  fs.writeFileSync(
    filePath,
    "\\documentclass{article}\n\\begin{document}\nRECENTS_CANONICAL_FILE\n\\end{document}\n",
  );
  return filePath;
}

export async function collectThreadSidePanelRecentsEvidence(
  page,
  { threadId, filePath, timeoutMs, screenshotPath, fileScreenshotPath },
) {
  const read = await appServerCallFromPage(page, "thread/read", {
    threadId,
    includeTurns: true,
  });
  if (!isObservedPreloadAppServerResponse(read.ipcObservation, "thread/read"))
    throw new Error("Recents缺少真实preload thread/read收据");
  const thread = read.result?.thread;
  const turn = thread?.turns?.at(-1);
  const message = turn?.items
    ?.slice()
    .reverse()
    .find((item) => item.type === "agentMessage");
  if (
    thread?.id !== threadId ||
    !turn?.id ||
    !message?.text?.includes("recent-report.tex")
  )
    throw new Error("Recents缺少同线程canonical输出引用");
  const toggle = page.getByTestId("thread-side-panel-toggle");
  const add = page.getByTestId("workspace-right-surface-new-tab");
  if (!(await add.isVisible())) await toggle.click();
  await add.click();
  const source = page.locator(
    '[data-testid="workspace-right-surface-tab-workspace-new-tab"][aria-selected="true"]',
  );
  await source.waitFor({ state: "visible", timeout: timeoutMs });
  const sourceId = await source.getAttribute("id");
  if (!sourceId) throw new Error("Recents源New tab缺少ARIA身份");
  const toolsLayout = await page
    .getByTestId("workspace-right-surface-active-pane")
    .getByTestId("thread-side-panel-new-tab")
    .evaluate((root) => {
      const grid = root.querySelector("section > div");
      if (!grid) return null;
      const measure = () => {
        const style = getComputedStyle(root);
        return {
          containerType: style.containerType,
          contentWidth:
            root.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
          breakpoint:
            28 *
            parseFloat(getComputedStyle(document.documentElement).fontSize),
          columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        };
      };
      const natural = measure();
      const previous = root.style.maxWidth;
      try {
        root.style.maxWidth = "calc(28rem - 1px)";
        return { natural, narrow: measure() };
      } finally {
        root.style.maxWidth = previous;
      }
    });
  if (
    !toolsLayout ||
    toolsLayout.natural.containerType !== "inline-size" ||
    toolsLayout.natural.columns !==
      (toolsLayout.natural.contentWidth >= toolsLayout.natural.breakpoint
        ? 2
        : 1) ||
    toolsLayout.narrow.contentWidth >= toolsLayout.narrow.breakpoint ||
    toolsLayout.narrow.columns !== 1
  )
    throw new Error("New tab工具未按28rem容器断点排版");
  const recents = page
    .getByTestId("workspace-right-surface-active-pane")
    .getByTestId("thread-side-panel-recents");
  await recents.waitFor({ state: "visible", timeout: timeoutMs });
  const file = recents.getByTitle(filePath, { exact: true });
  await file.waitFor({ state: "visible", timeout: timeoutMs });
  const rowHeight = await file.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  if (rowHeight < 56) throw new Error("Recents行高小于56px");
  if (
    (await file.getAttribute("aria-label")) !== filePath.split(/[\\/]/).at(-1)
  )
    throw new Error("Recents缺少当前文件可访问名称");
  if (screenshotPath)
    await page.screenshot({ path: screenshotPath, animations: "disabled" });
  await file.focus();
  await page.keyboard.press("Enter");
  const opened = page.locator(
    '[data-testid="workspace-right-surface-tab-files"][aria-selected="true"]',
  );
  await opened.waitFor({ state: "visible", timeout: timeoutMs });
  if ((await opened.getAttribute("title")) !== filePath)
    throw new Error("Recents打开了不同文件身份");
  if (
    await page.evaluate((id) => Boolean(document.getElementById(id)), sourceId)
  )
    throw new Error("Recents没有消费指定New tab");
  await page.waitForFunction(
    () => {
      const pane = document.querySelector(
        '[data-testid="workspace-right-surface-active-pane"]',
      );
      return pane?.textContent?.includes("RECENTS_CANONICAL_FILE");
    },
    null,
    { timeout: timeoutMs },
  );
  const trace = parseJsonRpcRequestsFromInvokeTrace(
    await page.evaluate(() =>
      localStorage.getItem("lime_invoke_trace_buffer_v1"),
    ),
  );
  const fileRead = trace.some(
    (entry) =>
      entry.method === "fs/readFile" &&
      entry.params.path === filePath &&
      entry.transport === "electron-ipc" &&
      entry.status === "success",
  );
  const directoryRead = trace.some(
    (entry) =>
      entry.method === "fs/readDirectory" &&
      entry.params.path === filePath.slice(0, filePath.lastIndexOf("/")) &&
      entry.transport === "electron-ipc" &&
      entry.status === "success",
  );
  if (!fileRead || !directoryRead)
    throw new Error("Recents缺少真实目录资格/文件读取IPC证据");
  if (fileScreenshotPath)
    await page.screenshot({ path: fileScreenshotPath, animations: "disabled" });
  await opened
    .locator("..")
    .getByTestId("workspace-right-surface-tab-close")
    .click();
  return {
    threadId,
    turnId: turn.id,
    itemId: message.id,
    canonicalOutput: true,
    preloadRead: true,
    rowHeight,
    toolsLayout,
    keyboardOpenedFile: true,
    newTabConsumed: true,
    actualFileRead: true,
    directoryRead,
    fileRead,
    screenshotPath,
    fileScreenshotPath,
  };
}
