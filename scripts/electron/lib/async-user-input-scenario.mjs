import assert from "node:assert/strict";
import path from "node:path";
import { composerEditorSelector } from "../../lib/composer-editor-dom.mjs";
import { INVOKE_TRACE_COLLECTOR_KEY } from "../../lib/invoke-trace-collector.mjs";

export const ASYNC_QUESTIONS = [
  { title: "异步选择如何继续？", options: ["保留推荐方案", "另一个方案"] },
  { title: "补充异步说明？" },
];
export const ASYNC_DONE = "ASYNC_QUESTION_NON_BLOCKING_DONE";
export const ASYNC_REPLY_DONE = "ASYNC_QUESTION_REPLY_ACCEPTED";
const ANSWER = "异步回答，保留标点, 和主输入草稿";

/** Real tool producer, canonical read, cross-thread draft and ordinary send. */
export async function runAsyncUserInputScenario({
  page,
  identity,
  otherIdentity,
  call,
  startTurn,
  waitForTurn,
  verifyMainDraft,
  refreshMainEditor,
  releaseContinuation,
  releaseQuestion,
  fixture,
  evidenceDir,
  summary,
  stage,
}) {
  stage("async-producer-start");
  const turnId = await startTurn(
    "请使用异步问题，提问后继续执行。",
    "async-question-user",
    {
      harness: {
        model_request_policy: {
          source: "controlled-provider-fixture",
          native_tool_policy: {
            experimental_supported_tools: ["request_user_input_async"],
          },
        },
      },
    },
  );
  const panel = page.locator("[data-async-user-input]:visible");
  // Raw setup starts a real Turn but does not register a renderer stream route.
  // Restore it through the product's ordinary thread navigation/hydration path.
  stage("async-restore-active-producer");
  for (const target of [otherIdentity, identity]) {
    await page
      .locator(
        `[data-testid="app-sidebar-conversation-open"][data-session-id="${target.sessionId}"]`,
      )
      .click();
    await page
      .locator(`${composerEditorSelector(target.sessionId)}:visible`)
      .waitFor();
  }
  await refreshMainEditor();
  // Publish after the product has restored its full active-Turn subscription,
  // so this scenario proves live delivery rather than a lucky history snapshot.
  stage("async-live-subscription-restored");
  await page.waitForFunction(
    ({ key, threadId }) =>
      JSON.parse(localStorage.getItem(key) || "[]").some(
        (entry) =>
          entry.command === "app_server_handle_json_lines" &&
          entry.transport === "electron-ipc" &&
          entry.status === "success" &&
          (entry.args_preview?.request?.lines ?? []).some((line) => {
            const request = JSON.parse(line);
            return (
              request.method === "thread/read" &&
              request.params?.threadId === threadId &&
              request.params?.includeTurns === true
            );
          }),
      ),
    { key: INVOKE_TRACE_COLLECTOR_KEY, threadId: identity.threadId },
  );
  releaseQuestion();
  stage("async-first-question-visible");
  await panel.waitFor({ state: "visible" });
  const sourceItemId = await panel.getAttribute("data-source-item-id");
  assert.equal(sourceItemId, "call-async-question");
  const read = await call("thread/read", {
    threadId: identity.threadId,
    includeTurns: true,
  });
  const turn = read.thread.turns.find((turn) => turn.id === turnId);
  assert.equal(turn.status, "inProgress");
  const questionItem = turn.items.find((item) => item.id === sourceItemId);
  assert.equal(questionItem.type, "agentMessage");
  assert.equal(questionItem.delivery, "async");
  assert.deepEqual(
    questionItem.questions.map(({ title, options }) => ({
      title,
      ...(options == null ? {} : { options }),
    })),
    ASYNC_QUESTIONS,
  );
  await verifyMainDraft();

  stage("async-select-and-edit");
  await panel.locator('[data-async-question-option="0"]').click();
  const editor = panel.locator(
    '[data-testid="composer-editor"][role="textbox"]',
  );
  await page.waitForFunction(
    (title) =>
      document
        .querySelector("[data-async-user-input]")
        ?.textContent.includes(title),
    ASYNC_QUESTIONS[1].title,
  );
  await editor.fill(ANSWER);
  stage("async-switch-thread");
  await page
    .locator(
      `[data-testid="app-sidebar-conversation-open"][data-session-id="${otherIdentity.sessionId}"]`,
    )
    .click();
  await page
    .locator(`${composerEditorSelector(otherIdentity.sessionId)}:visible`)
    .waitFor();
  await page
    .locator(
      `[data-testid="app-sidebar-conversation-open"][data-session-id="${identity.sessionId}"]`,
    )
    .click();
  stage("async-restore-question");
  await panel.waitFor({ state: "visible" });
  assert.equal(await editor.innerText(), ANSWER);
  await refreshMainEditor();

  stage("async-producer-completes-before-reply");
  releaseContinuation();
  const completed = await waitForTurn(
    call,
    identity.threadId,
    turnId,
    "completed",
  );
  assert.ok(JSON.stringify(completed).includes(ASYNC_DONE));
  assert.equal(
    await panel.isVisible(),
    true,
    "question must not block the producer Turn",
  );
  await verifyMainDraft();
  const screenshot = "async-question.png";
  await page.screenshot({ path: path.join(evidenceDir, screenshot) });
  summary.screenshots.push(screenshot);
  stage("async-ordinary-reply");
  await editor.press("Enter");
  await panel.waitFor({ state: "hidden" });
  const deadline = Date.now() + 120_000;
  let replyTurn;
  while (Date.now() < deadline) {
    const read = await call("thread/read", {
      threadId: identity.threadId,
      includeTurns: true,
    });
    replyTurn = read.thread.turns.find(
      (turn) =>
        turn.id !== turnId &&
        turn.status === "completed" &&
        JSON.stringify(turn).includes(ASYNC_REPLY_DONE),
    );
    if (replyTurn) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(replyTurn, "ordinary question-reply Turn must complete");
  const user = replyTurn.items.find((item) => item.type === "userMessage");
  assert.ok(user, "accepted canonical user message required");
  const text = user.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const match =
    /^<send_user_message_question_reply>\s*([\s\S]*)\s*<\/send_user_message_question_reply>$/.exec(
      text,
    );
  assert.ok(match, "canonical reply must use the reference envelope");
  assert.deepEqual(
    JSON.parse(match[1]),
    ASYNC_QUESTIONS.map((question, index) => ({
      questionItemId: JSON.stringify([
        "request_user_input_async",
        sourceItemId,
        index,
      ]),
      question: question.title,
      answer: index === 0 ? question.options[0] : ANSWER,
    })),
  );
  assert.ok(
    fixture.requests.some((request) =>
      request.body?.messages?.some(
        (message) =>
          message.role === "tool" && message.content === '{"accepted":true}',
      ),
    ),
    "provider continuation must consume the actual accepted tool result",
  );
  assert.ok(
    fixture.requests.some((request) =>
      JSON.stringify(request.body).includes("send_user_message_question_reply"),
    ),
  );
  await verifyMainDraft();
  return {
    turnId,
    sourceItemId,
    replyTurnId: replyTurn.id,
    questionCount: ASYNC_QUESTIONS.length,
    nonBlocking: true,
    crossThreadDraftRestored: true,
    canonicalReplyVerified: true,
    mainDraftPreserved: true,
    modelCapability:
      "explicit test-only model_request_policy; production catalog discovery not claimed",
  };
}
