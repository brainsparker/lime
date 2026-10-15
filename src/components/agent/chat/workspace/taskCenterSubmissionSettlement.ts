import type { RuntimeAcceptancePostProcessingPhase } from "@/lib/api/agentRuntime/runtimeAcceptance";
import type { SendMessageObserver } from "../hooks/agentChatShared";
import {
  createRuntimeSubmissionCapture,
  isRuntimeSubmissionAccepted,
  runRuntimeSubmissionEffect,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";

export function createTaskCenterSubmissionSettlement(
  observer?: SendMessageObserver,
  onSettled?: (result: RuntimeSubmissionResult) => void,
) {
  let settled = false;
  let resolve!: (result: RuntimeSubmissionResult) => void;
  const completion = new Promise<RuntimeSubmissionResult>((done) => {
    resolve = done;
  });
  const settleOnce = (result: RuntimeSubmissionResult) => {
    if (!settled) {
      settled = true;
      resolve(result);
      if (isRuntimeSubmissionAccepted(result))
        runRuntimeSubmissionEffect(result.receipt, "observer", () =>
          onSettled?.(result),
        );
      else {
        try {
          onSettled?.(result);
        } catch {
          console.error("[TaskCenter] submission settlement callback failed");
        }
      }
    }
  };
  const capture = createRuntimeSubmissionCapture(observer, settleOnce);
  return {
    completion,
    observer: capture.observer,
    effect(phase: RuntimeAcceptancePostProcessingPhase, effect: () => void) {
      if (capture.accepted) {
        runRuntimeSubmissionEffect(capture.accepted.receipt, phase, effect);
      } else {
        try {
          effect();
        } catch {
          console.error("[TaskCenter] submission post-processing failed");
        }
      }
    },
    get accepted() {
      return capture.accepted;
    },
    settle(result: RuntimeSubmissionResult) {
      const finalResult = capture.finish(result);
      settleOnce(finalResult);
      return finalResult;
    },
    reject(error: unknown) {
      const result = capture.reject(error);
      settleOnce(result);
      return result;
    },
  };
}
