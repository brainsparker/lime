import {
  materializeThreadGoal,
  type MaterializedThreadGoal,
  type ThreadGoalDraft,
} from "@/lib/api/agentRuntime/threadGoalAttachments";
import type {
  SendMessageObserver,
  ThreadGoalInput,
} from "../hooks/agentChatShared";
import {
  isRuntimeSubmissionAccepted,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";
import type { InputbarSendPayload } from "./Inputbar/inputbarSendPayload";

export function formatThreadGoalPrompt(objective: string): string {
  return `/goal ${objective}`;
}

interface NewThreadGoalSubmissionInput {
  text: string;
  threadGoal: ThreadGoalInput;
  observer: SendMessageObserver;
}

/** 目标素材已物化进正文；所有首轮入口用同一 lowering，富草稿只用于恢复。 */
export function buildNewThreadGoalSendPayload(
  payload: InputbarSendPayload,
  { text, threadGoal, observer }: NewThreadGoalSubmissionInput,
): InputbarSendPayload {
  return {
    ...payload,
    images: undefined,
    textOverride: text,
    sendOptions: {
      inputRestoreDraft: payload.sendOptions?.inputRestoreDraft,
      toolPreferencesOverride: payload.sendOptions?.toolPreferencesOverride,
      collaborationMode: payload.sendOptions?.collaborationMode,
      threadGoal,
      observer,
    },
    onRuntimeAccepted: (receipt) => {
      observer.onRuntimeAccepted?.(receipt);
      payload.onRuntimeAccepted?.(receipt);
    },
    composerSubmission: payload.composerSubmission
      ? {
          ...payload.composerSubmission,
          text,
          textElements: [],
          inputMentions: [],
          attachments: [],
        }
      : undefined,
  };
}

/** 新线程素材在创建后保留供首轮恢复；已有线程独立 set 的移交点不同。 */
export async function submitNewThreadGoal({
  draft,
  assertRequestCurrent,
  onPreparationFailed,
  submit,
}: {
  draft: ThreadGoalDraft;
  assertRequestCurrent: () => void;
  onPreparationFailed: () => void;
  submit: (
    input: NewThreadGoalSubmissionInput,
  ) => Promise<RuntimeSubmissionResult>;
}): Promise<RuntimeSubmissionResult> {
  let materialized: MaterializedThreadGoal | undefined;
  try {
    materialized = await materializeThreadGoal(draft, { assertRequestCurrent });
    assertRequestCurrent();
  } catch (error) {
    await materialized?.cleanup();
    onPreparationFailed();
    return { kind: "rejected", error };
  }

  let retained = false;
  const retain = () => {
    retained = true;
  };
  try {
    const result = await submit({
      text: formatThreadGoalPrompt(materialized.objective),
      threadGoal: { objective: materialized.objective },
      observer: { onSessionReady: retain, onRuntimeAccepted: retain },
    });
    if (isRuntimeSubmissionAccepted(result) || result.kind === "unknown")
      retain();
    return result;
  } finally {
    if (!retained) await materialized.cleanup();
  }
}
