import { NEWS_PROMPT } from "./claw-chat-current-fixture-constants.mjs";
import { sendPromptFromGui } from "./claw-chat-current-fixture-gui-actions.mjs";
import {
  waitForGuiChatCanceled,
  waitForStopButtonVisibleAndClick,
} from "./claw-chat-current-fixture-gui-completion-waits.mjs";
import { waitForBackendLedgerEntry } from "./claw-chat-current-fixture-backend-ledger.mjs";
import { waitForSessionReadCanceled } from "./claw-chat-current-fixture-read-model-waits.mjs";
import {
  collectReadModelTurns,
  readModelTurnId,
  readModelTurnStatus,
} from "./claw-chat-current-fixture-read-model-core.mjs";
import { assert, sanitizeJson } from "./claw-chat-current-fixture-utils.mjs";

export async function verifyRestartTurnContinuation({
  page,
  options,
  requestLog,
  backendLedgerPath,
  identity,
  orphanTurnId,
}) {
  const prompt = `${NEWS_PROMPT}（重启后继续发送）`;
  const inputSend = await sendPromptFromGui(page, options, prompt, {
    expectedSessionId: identity.sessionId,
    expectedThreadId: identity.threadId,
    requireTurnStart: true,
  });
  const trace = inputSend.afterClick?.matchingTurnStartTrace;
  assert(
    trace?.transport === "electron-ipc" && trace.threadId === identity.threadId,
    `cold continuation requires current GUI IPC: ${JSON.stringify(sanitizeJson(trace))}`,
  );
  const started = await waitForBackendLedgerEntry(
    backendLedgerPath,
    (entry) =>
      entry.kind === "turnStart" &&
      entry.sessionId === identity.sessionId &&
      entry.inputText === prompt &&
      Boolean(entry.turnId) &&
      entry.turnId !== orphanTurnId,
    options,
  );
  const turnId = started.entry.turnId;
  const stopClick = await waitForStopButtonVisibleAndClick(page, options, {
    prompt,
    visibleOutputText: "以下是今日国际新闻简要整理",
    requireVisibleOutput: true,
  });
  const canceled = await waitForBackendLedgerEntry(
    backendLedgerPath,
    (entry) =>
      entry.kind === "turnCancel" &&
      entry.sessionId === identity.sessionId &&
      entry.turnId === turnId,
    options,
  );
  const readModel = await waitForSessionReadCanceled(
    page,
    options,
    requestLog,
    {
      threadId: identity.threadId,
      prompt,
      partialText: "以下是今日国际新闻简要整理",
    },
  );
  const gui = await waitForGuiChatCanceled(page, options, {
    prompt,
    partialText: "以下是今日国际新闻简要整理",
  });
  const turns = collectReadModelTurns(readModel);
  for (const expectedId of [orphanTurnId, turnId]) {
    const turn = turns.find((entry) => readModelTurnId(entry) === expectedId);
    assert(
      readModelTurnStatus(turn) === "interrupted",
      `cold restart Turn ${expectedId} must be interrupted: ${JSON.stringify(sanitizeJson(turn))}`,
    );
  }
  return sanitizeJson({
    inputSend,
    turnId,
    backendStart: started.entry,
    stopClick,
    backendCancel: canceled.entry,
    readModel,
    gui,
    continuedAndStopped: true,
  });
}
