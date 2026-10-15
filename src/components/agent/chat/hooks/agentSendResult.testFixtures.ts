import type { RuntimeAcceptanceReceipt } from "@/lib/api/agentRuntime/runtimeAcceptance";
import type { AcceptedRuntimeSubmissionResult } from "./agentSendResult";
export function runtimeReceipt(
  sessionId = "session-1",
): RuntimeAcceptanceReceipt {
  return Object.freeze({
    kind: "start",
    sessionId,
    threadId: "thread-1",
    turnId: "turn-1",
    clientUserMessageId: "client-1",
  });
}
export function acceptedSubmission(
  sessionId = "session-1",
): AcceptedRuntimeSubmissionResult {
  return { kind: "runtime-accepted", receipt: runtimeReceipt(sessionId) };
}
