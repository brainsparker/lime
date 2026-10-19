import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  GOAL_DONE_TEXT,
  GOAL_PROMPT,
  GOAL_FIRST_TURN_TEXT,
} from "./claw-chat-current-fixture-constants.mjs";
import { sendPromptFromGui } from "./claw-chat-current-fixture-gui-actions.mjs";
import { enableGoalModeFromGui } from "./claw-chat-current-fixture-gui-input-modes.mjs";
import { waitForGuiChatCompleted } from "./claw-chat-current-fixture-gui-completion-waits.mjs";
import { waitForSessionReadCompleted } from "./claw-chat-current-fixture-read-model-waits.mjs";
import { invokeAppServerFromPage } from "./claw-chat-current-fixture-rpc.mjs";
import {
  assert,
  logStage,
  sanitizeJson,
} from "./claw-chat-current-fixture-utils.mjs";
import {
  composerEditorSelector,
  fillComposerEditor,
} from "../lib/composer-editor-dom.mjs";
import { parseJsonRpcRequestsFromInvokeTrace } from "../electron/lib/mcp-config-fixture-evidence.mjs";

export function resolveGoalUserTurn(summary) {
  const scope = summary?.guiGoalCompleted?.completionScope;
  const sessionId = summary?.goalInputSend?.clicked?.sessionId;
  const turnId = scope?.runtimeTurnId;
  if (
    !sessionId ||
    sessionId !== summary?.sessionId ||
    !turnId ||
    scope?.assistantRuntimeTurnId !== turnId ||
    scope?.runtimeTurnStatus !== "completed"
  ) {
    throw new Error(
      "Gate B Goal requires one completed user-submitted turn and matching assistant scope",
    );
  }
  return { sessionId, turnId };
}

export function resolveGoalObjective(appServerRequests, threadId) {
  if (!threadId) return null;
  const read = appServerRequests.find(
    (request) =>
      request.method === "thread/goal/get" &&
      request.params?.threadId === threadId &&
      !request.error &&
      request.response?.goal?.threadId === threadId &&
      request.response.goal.status === "active",
  );
  return read?.response.goal.objective ?? null;
}

export async function runGoalScenario({
  page,
  options,
  summary,
  appServerRequests,
}) {
  logStage("enable-goal-mode-from-gui");
  summary.goalModeEnabled = sanitizeJson(
    await enableGoalModeFromGui(page, options),
  );

  logStage("send-goal-prompt-from-gui");
  summary.goalInputSend = sanitizeJson(
    await sendPromptFromGui(page, options, GOAL_PROMPT),
  );

  const completion = {
    prompt: GOAL_PROMPT,
    doneText: GOAL_DONE_TEXT,
    summaryText: "目标已绑定到本轮请求",
  };
  // Active goals immediately continue after a turn. Pause through the real GUI
  // before requiring an idle composer; an inter-turn idle window is not a terminal.
  logStage("read-active-thread-goal");
  await page.locator('[data-testid="thread-goal-pause"]').waitFor({
    state: "visible",
    timeout: options.timeoutMs,
  });
  const activeGoal = await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
  assert(
    activeGoal.result?.goal?.status === "active" &&
      activeGoal.result?.goal?.objective === GOAL_PROMPT &&
      activeGoal.result?.goal?.threadId === summary.threadId,
    "Goal must be active on the submitted thread before pausing",
  );
  summary.goalActiveBeforePause = sanitizeJson(activeGoal.result.goal);
  logStage("pause-goal-from-gui");
  await page
    .locator('[data-testid="thread-goal-pause"]')
    .click({ timeout: options.timeoutMs });
  await page.locator('[data-testid="thread-goal-resume"]').waitFor({
    state: "visible",
    timeout: options.timeoutMs,
  });
  const pausedGoal = await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
  assert(
    pausedGoal.result?.goal?.status === "paused" &&
      pausedGoal.result?.goal?.objective === GOAL_PROMPT &&
      pausedGoal.result?.goal?.threadId === summary.threadId,
    "GUI pause must persist on the same canonical thread goal",
  );
  summary.goalPausedFromGui = sanitizeJson(pausedGoal.result.goal);
  logStage("wait-gui-goal-completed");
  summary.guiGoalCompleted = sanitizeJson(
    await waitForGuiChatCompleted(page, options, completion),
  );

  logStage("wait-read-model-goal-completed");
  const readModel = await waitForSessionReadCompleted(
    page,
    options,
    appServerRequests,
    completion,
  );
  const serialized = JSON.stringify(readModel || {});
  const firstTurn = await invokeAppServerFromPage(
    page,
    "thread/read",
    { threadId: summary.threadId, includeTurns: true },
    appServerRequests,
  );
  const userTurnId = resolveGoalUserTurn(summary).turnId;
  const canonicalFirstTurn = firstTurn.result?.thread?.turns?.find(
    (turn) => turn.id === userTurnId,
  );
  const userText = canonicalFirstTurn?.items
    ?.filter((item) => item.type === "userMessage")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
  assert(
    userText === GOAL_FIRST_TURN_TEXT,
    "new goal first Turn must contain the exact materialized /goal objective",
  );
  summary.readModelGoalCompleted = sanitizeJson({
    detailItemCount: Array.isArray(readModel?.detail?.items)
      ? readModel.detail.items.length
      : null,
    latestTurnStatus:
      readModel?.detail?.thread_read?.runtime_summary?.latestTurnStatus ??
      readModel?.detail?.thread_read?.status ??
      readModel?.detail?.status ??
      null,
    includesPrompt: serialized.includes(GOAL_PROMPT),
    includesAssistantDone: serialized.includes(GOAL_DONE_TEXT),
    includesAssistantSummary: serialized.includes(completion.summaryText),
    exactGoalFirstTurnText: true,
  });

  logStage("read-canonical-thread-goal");
  await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
  await verifyExistingGoalComposer({
    page,
    options,
    summary,
    appServerRequests,
  });
}

async function verifyExistingGoalComposer({
  page,
  options,
  summary,
  appServerRequests,
}) {
  logStage("edit-existing-goal-through-shared-composer");
  const objective = "通过主输入框替换现有目标";
  const editor = page.locator(
    `${composerEditorSelector(summary.sessionId)}:visible`,
  );
  const originalEditor = await editor.elementHandle();
  const trace = async () =>
    parseJsonRpcRequestsFromInvokeTrace(
      await page.evaluate(() =>
        window.localStorage.getItem("lime_invoke_trace_buffer_v1"),
      ),
    );
  const key = (request) =>
    JSON.stringify([request.method, request.id, request.params]);
  const before = new Set((await trace()).map(key));
  await page.getByTestId("thread-goal-edit").click();
  assert(
    (await page.getByRole("dialog").count()) === 0,
    "goal edit must use the main Composer",
  );
  assert(
    await originalEditor.evaluate((node) => node.isConnected),
    "goal edit must keep the same EditorView",
  );
  await fillComposerEditor(page, objective, summary.sessionId);
  await page.getByTestId("send-btn").click();
  const confirmation = page.getByRole("dialog", { name: "替换当前目标？" });
  await confirmation.waitFor({ state: "visible", timeout: options.timeoutMs });
  await page.keyboard.press("Escape");
  await confirmation.waitFor({ state: "hidden" });
  assert(
    (await editor.textContent()) === objective,
    "cancel replacement must preserve the goal draft",
  );
  await page.getByTestId("send-btn").click();
  await confirmation.getByTestId("confirm-dialog-confirm").click();
  await page.waitForFunction(
    (objective) =>
      document
        .querySelector('[data-testid="thread-goal-inline-panel"]')
        ?.textContent.includes(objective),
    objective,
    { timeout: options.timeoutMs },
  );
  await page.getByTestId("thread-goal-pause").click();
  await page.getByTestId("thread-goal-resume").waitFor({ state: "visible" });
  const canonical = await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
  assert(
    canonical.result?.goal?.threadId === summary.threadId &&
      canonical.result.goal.objective === objective &&
      canonical.result.goal.status === "paused",
    "replacement must persist on the same canonical goal",
  );
  const requests = (await trace()).filter(
    (request) => !before.has(key(request)),
  );
  assert(
    requests.some(
      (request) =>
        request.method === "thread/goal/set" &&
        request.params.threadId === summary.threadId &&
        request.params.objective === objective &&
        request.transport === "electron-ipc" &&
        request.status === "success",
    ),
    "goal edit must reach the current API through real IPC",
  );
  assert(
    !requests.some((request) =>
      ["turn/start", "turn/steer"].includes(request.method),
    ),
    "goal edit must not issue an ordinary Turn submission",
  );
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.textContent === "",
    composerEditorSelector(summary.sessionId),
    { timeout: options.timeoutMs },
  );
  summary.goalComposerEdit = {
    sameThread: true,
    sameEditorView: await originalEditor.evaluate((node) => node.isConnected),
    cancelledReplacementPreservedDraft: true,
    canonicalGoalPaused: true,
    ipcGoalSet: true,
    ordinaryTurnSubmissionCount: 0,
    acceptedDraftCleared: true,
  };
  await verifyLongGoalObjective({ page, options, summary, appServerRequests });
}

async function verifyLongGoalObjective({
  page,
  options,
  summary,
  appServerRequests,
}) {
  logStage("materialize-long-goal-through-current-desktop-root");
  const objective = "真实目标文件内容：\n" + "目标正文".repeat(1100);
  await page.getByTestId("thread-goal-edit").click();
  await fillComposerEditor(page, objective, summary.sessionId);
  await page.getByTestId("send-btn").click();
  await page
    .getByRole("dialog", { name: "替换当前目标？" })
    .getByTestId("confirm-dialog-confirm")
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="thread-goal-inline-panel"]')
        ?.textContent.includes("goal-objective.md"),
    undefined,
    { timeout: options.timeoutMs },
  );
  await page.getByTestId("thread-goal-pause").click();
  await page.getByTestId("thread-goal-resume").waitFor({ state: "visible" });
  const read = await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
  const goal = read.result?.goal;
  assert(
    goal?.threadId === summary.threadId && goal.status === "paused",
    "materialized goal must preserve canonical thread identity",
  );
  const match =
    /^Read the Codex goal objective file at (.+) before continuing\.$/.exec(
      goal.objective,
    );
  assert(
    match,
    "long objective must use the observed model instruction contract",
  );
  const objectivePath = match[1];
  const agentRoot = await page.evaluate(() => window.electronAPI?.agentRoot);
  assert(
    typeof agentRoot === "string" && path.isAbsolute(agentRoot),
    "real Desktop AgentRoot metadata required",
  );
  assert(
    path.dirname(path.dirname(objectivePath)) ===
      path.join(agentRoot, "attachments"),
    "goal file must stay under the real AgentRoot attachments directory",
  );
  assert(
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      path.basename(path.dirname(objectivePath)),
    ),
    "goal attachment directory must be UUIDv4",
  );
  assert(
    path.basename(objectivePath) === "goal-objective.md",
    "owned objective filename required",
  );
  const bytes = fs.readFileSync(objectivePath);
  assert(
    bytes.toString("utf8") === objective,
    "current file gateway must preserve the complete Unicode objective",
  );
  assert(
    Array.from(goal.objective).length <= 4000,
    "canonical goal objective length bound",
  );
  const trace = parseJsonRpcRequestsFromInvokeTrace(
    await page.evaluate(() =>
      window.localStorage.getItem("lime_invoke_trace_buffer_v1"),
    ),
  );
  for (const method of [
    "fs/createDirectory",
    "fs/writeFile",
    "thread/goal/set",
  ])
    assert(
      trace.some(
        (request) =>
          request.method === method &&
          request.transport === "electron-ipc" &&
          request.status === "success",
      ),
      `${method} must reach the real current IPC path`,
    );
  summary.goalComposerAttachment = {
    canonicalThreadId: goal.threadId,
    canonicalStatus: goal.status,
    objectiveCodepoints: Array.from(objective).length,
    referenceCodepoints: Array.from(goal.objective).length,
    objectiveFileBytes: bytes.length,
    objectiveFileSha256: createHash("sha256").update(bytes).digest("hex"),
    exactFileContents: true,
    realDesktopAgentRoot: true,
    ownedUuidDirectory: true,
    successfulFileRetained: true,
    ipcFileMaterialization: true,
  };
}
