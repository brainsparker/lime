import type { QueuedSubmission, UserInput } from "@limecloud/app-server-client";
import type { SendMessageObserver } from "../hooks/agentChatShared";
import {
  createRuntimeSubmissionCapture,
  fromQueueAcceptanceResponse,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";

export async function submitWorkspaceQueue(options: {
  sessionId?: string | null;
  threadId: string;
  clientUserMessageId: string;
  input: UserInput[];
  observer?: SendMessageObserver;
  addQueue: (params: {
    threadId: string;
    clientUserMessageId: string;
    input: readonly UserInput[];
  }) => Promise<QueuedSubmission>;
  onRejected?: () => void;
}): Promise<RuntimeSubmissionResult> {
  const context = {
    sessionId: options.sessionId,
    threadId: options.threadId,
    clientUserMessageId: options.clientUserMessageId,
  };
  const capture = createRuntimeSubmissionCapture(options.observer);
  try {
    const response = await options.addQueue({
      threadId: context.threadId,
      clientUserMessageId: context.clientUserMessageId,
      input: options.input,
    });
    return capture.finish(fromQueueAcceptanceResponse(context, response));
  } catch (error) {
    if (capture.accepted) return capture.reject(error);
    try {
      options.onRejected?.();
    } catch {
      console.error("[WorkspaceSend] queue rejection notification failed");
    }
    return { kind: "rejected", error };
  }
}
