import http from "node:http";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";
import { sendPromptFromGui } from "../../agent-runtime/claw-chat-current-fixture-gui-actions.mjs";
import {
  isObservedPreloadAppServerResponse,
  parseJsonRpcRequestsFromInvokeTrace,
} from "./mcp-config-fixture-evidence.mjs";

const marker = "RECENTS_WEBSITE_FIXTURE ";
const htmlFilename = "recent-website.html";
const htmlDocument =
  '<!doctype html><meta charset="utf-8"><title>Recent website</title><p>RECENTS_CANONICAL_HTML</p>';

/** 仅注入受控external backend，不进入生产runtime。 */
export function renderRecentsWebsiteBackendScript() {
  return `
if (input.kind === "turnStart" && inputText.startsWith(${JSON.stringify(marker)})) {
  const target = inputText.slice(${marker.length}).trim();
  const itemId = "recents-website:" + turnId;
  const text = "Website ready: " + target;
  const now = Date.now();
  const events = [
    ...(target === ${JSON.stringify(htmlFilename)} ? [{
      type:"item.completed",
      payload:{item:{
        sessionId, threadId, turnId, itemId:"recents-html:" + turnId,
        sequence:1, ordinal:1, createdAtMs:now, updatedAtMs:now, completedAtMs:now,
        kind:"file", status:"completed",
        payload:{type:"file", status:"applied", changes:[{
          path:target, kind:{type:"add"}, diff:${JSON.stringify(`+${htmlDocument}`)}
        }]},
        metadata:{source:"recents-website-fixture"}
      }}
    }] : []),
    {type:"message.delta", payload:{itemId, role:"assistant", text, phase:"final_answer"}},
    {type:"message.completed", payload:{itemId, role:"assistant", text, phase:"final_answer", status:"completed"}},
    {type:"turn.completed", payload:{status:"completed", text}}
  ];
  if (ledgerPath) appendFileSync(ledgerPath, JSON.stringify({kind:"backendEvents", sessionId, threadId, turnId, eventTypes:events.map(event=>event.type)}) + "\\n");
  console.log(JSON.stringify({events}));
  process.exit(0);
}
`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function submitWebsiteOutput(
  page,
  { sessionId, threadId, timeoutMs },
  target,
) {
  await sendPromptFromGui(
    page,
    { timeoutMs, intervalMs: 250 },
    marker + target,
    { expectedSessionId: sessionId },
  );
  const deadline = Date.now() + timeoutMs;
  let read, turn, message;
  do {
    read = await appServerCallFromPage(page, "thread/read", {
      threadId,
      includeTurns: true,
    });
    turn = read.result?.thread?.turns?.at(-1);
    message = turn?.items?.find(
      (item) =>
        item.type === "agentMessage" &&
        item.text === `Website ready: ${target}`,
    );
    if (turn?.status === "completed" && message) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert(
    read.result?.thread?.id === threadId &&
      turn?.status === "completed" &&
      message,
    `website缺少同线程完成产物: ${JSON.stringify({ threadId, target, turnId: turn?.id, status: turn?.status })}`,
  );
  assert(
    isObservedPreloadAppServerResponse(read.ipcObservation, "thread/read"),
    "website缺少canonical preload read收据",
  );
  return { turn, message };
}

async function openRecentWebsite(page, { timeoutMs }, target, name) {
  const add = page.getByTestId("workspace-right-surface-new-tab");
  if (!(await add.isVisible()))
    await page.getByTestId("thread-side-panel-toggle").click();
  await add.click();
  const source = page.locator(
    '[data-testid="workspace-right-surface-tab-workspace-new-tab"][aria-selected="true"]',
  );
  await source.waitFor({ state: "visible", timeout: timeoutMs });
  const sourceId = await source.getAttribute("id");
  assert(sourceId, "website源New tab缺少身份");
  const output = page
    .getByTestId("workspace-right-surface-active-pane")
    .getByTestId("thread-side-panel-recents")
    .getByTitle(target, { exact: true });
  await output.waitFor({ state: "visible", timeout: timeoutMs });
  assert(
    (await output.getAttribute("aria-label")) === name,
    `website名称不符合参考合同: ${target}`,
  );
  await output.focus();
  await output.press("Enter");
  return sourceId;
}

/** GUI提交→canonical输出→Recents→当前Browser/native WebContents，两次网址验证恢复后的新导航。 */
export async function collectThreadSidePanelWebsiteEvidence(
  page,
  app,
  {
    sessionId,
    threadId,
    workspaceRoot,
    timeoutMs,
    screenshotPath,
    htmlScreenshotPath,
  },
) {
  assert(
    typeof workspaceRoot === "string" && path.isAbsolute(workspaceRoot),
    "website夹具缺少隔离工作区绝对路径",
  );
  const htmlPath = path.join(workspaceRoot, htmlFilename);
  writeFileSync(htmlPath, htmlDocument);
  const context = { sessionId, threadId, timeoutMs };
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><title>RECENTS_NATIVE${request.url}</title><p>Website fixture</p>`,
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const rounds = [];
  try {
    for (const route of ["/first", "/second"]) {
      const url = origin + route;
      const { turn, message } = await submitWebsiteOutput(page, context, url);
      const sourceId = await openRecentWebsite(
        page,
        context,
        url,
        `${new URL(url).host}${route}`,
      );
      const browser = page
        .getByTestId("workspace-right-surface-active-pane")
        .getByTestId("right-surface-browser-panel");
      await browser.waitFor({ state: "visible", timeout: timeoutMs });
      await page.waitForFunction(
        ({ url, threadId }) => {
          const pane = document.querySelector(
            '[data-testid="workspace-right-surface-active-pane"]',
          );
          const browser = pane?.querySelector(
            '[data-testid="right-surface-browser-panel"]',
          );
          return (
            browser?.getAttribute("data-browser-thread-id") === threadId &&
            Number(browser.getAttribute("data-browser-web-contents-id")) > 0 &&
            pane?.querySelector('[data-testid="browser-workspace-address"]')
              ?.value === url
          );
        },
        { url, threadId },
        { timeout: timeoutMs },
      );
      const nativeId = Number(
        await browser.getAttribute("data-browser-web-contents-id"),
      );
      let native;
      const nativeDeadline = Date.now() + Math.min(timeoutMs, 15000);
      do {
        native = await app.evaluate(({ webContents }, id) => {
          const contents = webContents.fromId(id);
          return {
            alive: Boolean(contents && !contents.isDestroyed()),
            url: contents?.getURL(),
            title: contents?.getTitle(),
          };
        }, nativeId);
        if (
          native.alive &&
          native.url === url &&
          native.title === `RECENTS_NATIVE${route}`
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (Date.now() < nativeDeadline);
      assert(
        native?.alive &&
          native.url === url &&
          native.title === `RECENTS_NATIVE${route}`,
        "website未到达真实native WebContents",
      );
      assert(
        (await page.locator(`[id=${JSON.stringify(sourceId)}]`).count()) === 1,
        "website错误消费了源New tab",
      );
      const trace = await page.evaluate(
        () => localStorage.getItem("lime_invoke_trace_buffer_v1") || "[]",
      );
      const request = parseJsonRpcRequestsFromInvokeTrace(trace).find(
        (entry) =>
          entry.method === "workspaceRightSurface/request" &&
          entry.params?.reason === "open_thread_output" &&
          entry.params?.metadata?.browser?.launchUrl === url &&
          entry.transport === "electron-ipc" &&
          entry.status === "success",
      );
      assert(
        request?.params?.sessionId === sessionId,
        "website缺少同session真实Browser请求",
      );
      rounds.push({
        threadId,
        turnId: turn.id,
        itemId: message.id,
        url,
        nativeId,
        native,
        sourceTabId: sourceId,
        sourceNewTabPreserved: true,
        canonicalPreloadRead: true,
        browserRequest: true,
      });
    }
    assert(
      rounds[0].nativeId === rounds[1].nativeId,
      "website重新打开未复用同一native owner",
    );
    assert(
      requests.includes("/first") && requests.includes("/second"),
      "website未读取两次真实HTTP资源",
    );
    if (screenshotPath)
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
    const { turn, message } = await submitWebsiteOutput(
      page,
      context,
      htmlFilename,
    );
    const file = turn.items.find(
      (item) =>
        item.type === "fileChange" &&
        item.status === "completed" &&
        item.changes?.some((change) => change.path === htmlFilename),
    );
    assert(file, "本地HTML缺少同Turn的completed文件变更");
    const sourceId = await openRecentWebsite(
      page,
      context,
      htmlFilename,
      htmlFilename,
    );
    const filesTab = page.locator(
      '[data-testid="workspace-right-surface-tab-files"][aria-selected="true"]',
    );
    await filesTab.waitFor({ state: "visible", timeout: timeoutMs });
    assert(
      (await filesTab.getAttribute("title")) === htmlPath,
      "本地HTML未按cwd打开同一绝对文件身份",
    );
    await page
      .getByTestId("workspace-right-surface-active-pane")
      .frameLocator('[data-testid="canvas-workbench-html-preview"]')
      .getByText("RECENTS_CANONICAL_HTML", { exact: true })
      .waitFor({ state: "visible", timeout: timeoutMs });
    assert(
      (await page.locator(`[id=${JSON.stringify(sourceId)}]`).count()) === 1,
      "本地HTML错误消费了源New tab",
    );
    const htmlRead = parseJsonRpcRequestsFromInvokeTrace(
      await page.evaluate(() =>
        localStorage.getItem("lime_invoke_trace_buffer_v1"),
      ),
    ).find(
      (entry) =>
        entry.method === "fs/readFile" &&
        entry.params?.path === htmlPath &&
        entry.transport === "electron-ipc" &&
        entry.status === "success",
    );
    assert(htmlRead, "本地HTML缺少真实同路径fs/readFile收据");
    if (htmlScreenshotPath)
      await page.screenshot({
        path: htmlScreenshotPath,
        animations: "disabled",
      });
    return {
      rounds,
      html: {
        threadId,
        turnId: turn.id,
        itemId: file.id,
        messageId: message.id,
        path: htmlPath,
        sourceTabId: sourceId,
        sourceNewTabPreserved: true,
        actualFileRead: true,
        iframeBodyMatched: true,
        screenshotPath: htmlScreenshotPath,
      },
      sameNativeOwner: true,
      actualHttpReads: true,
      screenshotPath,
    };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
