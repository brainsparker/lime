import { withComposerEditorDom } from "../lib/composer-editor-dom.mjs";
import { APP_SERVER_METHOD_SESSION_READ } from "./claw-chat-current-fixture-constants.mjs";
import { invokeAppServerFromPage } from "./claw-chat-current-fixture-rpc.mjs";
import { parseJsonRpcRequestsFromInvokeTrace } from "../electron/lib/mcp-config-fixture-evidence.mjs";
import { assert } from "./claw-chat-current-fixture-utils.mjs";

const SUBMIT_METHODS = new Set([
  "turn/start",
  "turn/steer",
  "thread/queue/add",
  "thread/queue/start",
]);
const SIGNALS = ["isComposing", "Process", "keyCode229", "compositionstart"];

function submittedRequests(raw, threadId) {
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error("Composer IME invoke trace 必须为数组");
  }
  return parseJsonRpcRequestsFromInvokeTrace(raw).filter(
    (request) =>
      request.params.threadId === threadId &&
      SUBMIT_METHODS.has(request.method),
  ).length;
}

export function summarizeComposerImeBoundary({
  observation,
  before,
  after,
  threadId,
  sessionId,
}) {
  const canonicalEmpty = (read) =>
    read?.thread?.id === threadId &&
    Array.isArray(read.thread.turns) &&
    read.thread.turns.length === 0;
  const signals = observation?.signals;
  const signalCoverage =
    Array.isArray(signals) &&
    signals.length === SIGNALS.length &&
    SIGNALS.every(
      (signal, index) =>
        signals[index]?.signal === signal &&
        signals[index].defaultPrevented === false &&
        signals[index].draftUnchanged === true,
    );
  const hostObserved =
    observation?.electron === true &&
    observation.preload === true &&
    observation.editorCount === 1 &&
    observation.sessionId === sessionId;
  let noSubmitRequest = false;
  try {
    noSubmitRequest =
      submittedRequests(observation.beforeTrace, threadId) === 0 &&
      submittedRequests(observation.afterTrace, threadId) === 0;
  } catch {
    // Missing or malformed evidence cannot establish a negative request claim.
  }
  const noCanonicalTurn = canonicalEmpty(before) && canonicalEmpty(after);
  return {
    ok: hostObserved && signalCoverage && noSubmitRequest && noCanonicalTurn,
    hostObserved,
    signalCoverage,
    noSubmitRequest,
    noCanonicalTurn,
    threadId,
    sessionId,
    eventSource: "synthetic DOM composition and keydown in real Electron",
  };
}

export async function verifyComposerImeEditingOnly({
  page,
  appServerRequests,
  threadId,
  sessionId,
  prompt,
}) {
  const before = await invokeAppServerFromPage(
    page,
    APP_SERVER_METHOD_SESSION_READ,
    { threadId, includeTurns: true },
    appServerRequests,
  );
  const observation = await page.evaluate(
    withComposerEditorDom(async ({ sessionId, prompt }) => {
      const editors = findVisibleComposerEditorsDom(sessionId);
      const editor = editors.length === 1 ? editors[0] : null;
      if (
        !(editor instanceof HTMLElement) ||
        !readComposerEditorTextDom(editor).startsWith(prompt)
      ) {
        throw new Error("Composer IME fixture 的当前草稿未就绪");
      }
      editor.focus();
      const draftText = readComposerEditorTextDom(editor);
      const tokenSnapshot = () =>
        JSON.stringify(
          Array.from(editor.querySelectorAll("[data-composer-token]")).map(
            (token) => ({
              kind: token.getAttribute("data-composer-token"),
              id: token.getAttribute("data-composer-id"),
              name: token.getAttribute("data-composer-name"),
              path: token.getAttribute("data-composer-path"),
              text: token.textContent,
              editable: token.getAttribute("contenteditable"),
            }),
          ),
        );
      const draftTokens = tokenSnapshot();
      const beforeTrace = localStorage.getItem("lime_invoke_trace_buffer_v1");
      const signals = [];
      for (const signal of [
        "isComposing",
        "Process",
        "keyCode229",
        "compositionstart",
      ]) {
        if (signal === "compositionstart") {
          editor.dispatchEvent(
            new CompositionEvent("compositionstart", { bubbles: true }),
          );
        }
        const event = new KeyboardEvent("keydown", {
          key: signal === "Process" ? "Process" : "Enter",
          keyCode: signal === "keyCode229" ? 229 : 13,
          isComposing: signal === "isComposing",
          bubbles: true,
          cancelable: true,
        });
        editor.dispatchEvent(event);
        if (signal === "compositionstart") {
          editor.dispatchEvent(
            new CompositionEvent("compositionend", { bubbles: true }),
          );
        }
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        signals.push({
          signal,
          defaultPrevented: event.defaultPrevented,
          draftUnchanged:
            readComposerEditorTextDom(editor) === draftText &&
            tokenSnapshot() === draftTokens &&
            editor.isConnected,
        });
      }
      return {
        electron: window.__LIME_ELECTRON__ === true,
        preload: typeof window.electronAPI?.invoke === "function",
        sessionId: editor.dataset.sessionId,
        editorCount: editors.length,
        beforeTrace,
        afterTrace: localStorage.getItem("lime_invoke_trace_buffer_v1"),
        signals,
      };
    }),
    { sessionId, prompt },
  );
  const after = await invokeAppServerFromPage(
    page,
    APP_SERVER_METHOD_SESSION_READ,
    { threadId, includeTurns: true },
    appServerRequests,
  );
  const evidence = summarizeComposerImeBoundary({
    observation,
    before: before.result,
    after: after.result,
    threadId,
    sessionId,
  });
  assert(evidence.ok, `Composer IME 编辑边界失败: ${JSON.stringify(evidence)}`);
  return evidence;
}
