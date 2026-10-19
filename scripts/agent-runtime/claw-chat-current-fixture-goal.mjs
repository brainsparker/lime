import {
  GOAL_DONE_TEXT,
  GOAL_PROMPT,
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
  });

  logStage("read-canonical-thread-goal");
  await invokeAppServerFromPage(
    page,
    "thread/goal/get",
    { threadId: summary.threadId },
    appServerRequests,
  );
}
