import type { QueuedSubmission } from "@limecloud/app-server-client";
import {
  requireRuntimeAcceptanceReceipt,
  reportRuntimeAcceptancePostProcessingFailure,
  type RuntimeAcceptanceReceipt,
  type RuntimeAcceptancePostProcessingPhase,
} from "@/lib/api/agentRuntime/runtimeAcceptance";
import { parseQueuedSubmission } from "@/lib/api/agentRuntime/threadQueueClient";
import type { SendMessageObserver } from "./agentChatShared";

export interface RuntimeQueueAcceptanceReceipt {
  readonly kind: "queue";
  readonly sessionId: string;
  readonly threadId: string;
  readonly queuedSubmissionId: string;
  readonly clientUserMessageId: string;
  readonly submission: QueuedSubmission;
}
export type RuntimeSubmissionAcceptance =
  | RuntimeAcceptanceReceipt
  | RuntimeQueueAcceptanceReceipt;
export type AcceptedRuntimeSubmissionResult =
  | {
      readonly kind: "runtime-accepted";
      readonly receipt: RuntimeAcceptanceReceipt;
    }
  | {
      readonly kind: "queue-accepted";
      readonly receipt: RuntimeQueueAcceptanceReceipt;
    };
export type RuntimeSubmissionResult =
  | AcceptedRuntimeSubmissionResult
  | { readonly kind: "local-handled" }
  | { readonly kind: "rejected"; readonly error?: unknown }
  | { readonly kind: "unknown" };

function isId(value: unknown): value is string {
  return (
    typeof value === "string" && Boolean(value.trim()) && value === value.trim()
  );
}
export function fromRuntimeAcceptanceReceipt(
  receipt: RuntimeAcceptanceReceipt,
): RuntimeSubmissionResult {
  try {
    return Object.freeze({
      kind: "runtime-accepted",
      receipt: requireRuntimeAcceptanceReceipt(receipt),
    });
  } catch {
    return { kind: "unknown" };
  }
}
export function fromQueueAcceptanceResponse(
  context: {
    sessionId?: string | null;
    threadId: string;
    clientUserMessageId: string;
  },
  response: QueuedSubmission,
): RuntimeSubmissionResult {
  const submission = parseQueuedSubmission(response);
  if (
    !isId(context.sessionId) ||
    !isId(context.threadId) ||
    !isId(context.clientUserMessageId) ||
    !submission ||
    !isId(submission.id) ||
    submission.clientUserMessageId !== context.clientUserMessageId
  ) {
    return { kind: "unknown" };
  }
  return Object.freeze({
    kind: "queue-accepted",
    receipt: Object.freeze({
      kind: "queue",
      sessionId: context.sessionId,
      threadId: context.threadId,
      queuedSubmissionId: submission.id,
      clientUserMessageId: context.clientUserMessageId,
      submission,
    }),
  });
}
export function normalizeRuntimeSubmissionResult(
  value: unknown,
): RuntimeSubmissionResult {
  if (!value || typeof value !== "object" || !("kind" in value))
    return { kind: "unknown" };
  if (value.kind === "runtime-accepted" && "receipt" in value) {
    return fromRuntimeAcceptanceReceipt(
      value.receipt as RuntimeAcceptanceReceipt,
    );
  }
  if (value.kind === "queue-accepted" && "receipt" in value) {
    const receipt = value.receipt as RuntimeQueueAcceptanceReceipt;
    if (!receipt || receipt.kind !== "queue") return { kind: "unknown" };
    const result = fromQueueAcceptanceResponse(receipt, receipt.submission);
    return result.kind === "queue-accepted" &&
      result.receipt.queuedSubmissionId === receipt.queuedSubmissionId
      ? result
      : { kind: "unknown" };
  }
  if (value.kind === "local-handled") return { kind: "local-handled" };
  if (value.kind === "rejected")
    return {
      kind: "rejected",
      ...("error" in value ? { error: value.error } : {}),
    };
  return { kind: "unknown" };
}
export function isRuntimeSubmissionAccepted(
  result: RuntimeSubmissionResult,
): result is AcceptedRuntimeSubmissionResult {
  return result.kind === "runtime-accepted" || result.kind === "queue-accepted";
}
export function runRuntimeSubmissionEffect(
  receipt: RuntimeSubmissionAcceptance,
  phase: RuntimeAcceptancePostProcessingPhase,
  effect: () => void,
): void {
  try {
    effect();
  } catch {
    reportRuntimeAcceptancePostProcessingFailure(phase, receipt);
  }
}
export function createRuntimeSubmissionCapture(
  observer?: SendMessageObserver,
  onAccepted?: (result: AcceptedRuntimeSubmissionResult) => void,
) {
  let accepted: AcceptedRuntimeSubmissionResult | undefined;
  const accept = (receipt: RuntimeSubmissionAcceptance) => {
    const result =
      receipt.kind === "queue"
        ? normalizeRuntimeSubmissionResult({ kind: "queue-accepted", receipt })
        : fromRuntimeAcceptanceReceipt(receipt);
    if (!isRuntimeSubmissionAccepted(result))
      throw new Error("Invalid submission acceptance receipt");
    if (accepted) {
      if (
        accepted.kind !== result.kind ||
        accepted.receipt.kind !== result.receipt.kind ||
        accepted.receipt.sessionId !== result.receipt.sessionId ||
        accepted.receipt.threadId !== result.receipt.threadId ||
        accepted.receipt.clientUserMessageId !==
          result.receipt.clientUserMessageId ||
        (accepted.kind === "runtime-accepted" &&
          result.kind === "runtime-accepted" &&
          accepted.receipt.turnId !== result.receipt.turnId) ||
        (accepted.kind === "queue-accepted" &&
          result.kind === "queue-accepted" &&
          accepted.receipt.queuedSubmissionId !==
            result.receipt.queuedSubmissionId)
      ) {
        reportRuntimeAcceptancePostProcessingFailure(
          "observer",
          accepted.receipt,
        );
      }
      return;
    }
    accepted = result;
    runRuntimeSubmissionEffect(result.receipt, "observer", () =>
      onAccepted?.(result),
    );
    runRuntimeSubmissionEffect(result.receipt, "observer", () =>
      observer?.onRuntimeAccepted?.(result.receipt),
    );
  };
  return {
    observer: {
      ...observer,
      onRuntimeAccepted: accept,
    } satisfies SendMessageObserver,
    get accepted() {
      return accepted;
    },
    finish(value: RuntimeSubmissionResult): RuntimeSubmissionResult {
      const result = normalizeRuntimeSubmissionResult(value);
      if (isRuntimeSubmissionAccepted(result)) accept(result.receipt);
      return accepted ?? result;
    },
    reject(error: unknown): RuntimeSubmissionResult {
      if (accepted) {
        reportRuntimeAcceptancePostProcessingFailure(
          "accepted_submit",
          accepted.receipt,
        );
        return accepted;
      }
      return { kind: "rejected", error };
    },
    rethrow(error: unknown): AcceptedRuntimeSubmissionResult {
      if (accepted) {
        reportRuntimeAcceptancePostProcessingFailure(
          "accepted_submit",
          accepted.receipt,
        );
        return accepted;
      }
      throw error;
    },
  };
}
