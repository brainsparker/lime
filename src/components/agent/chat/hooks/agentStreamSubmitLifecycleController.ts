import { logAgentDebug } from "@/lib/agentDebug";
import {
  requireRuntimeAcceptanceReceipt,
  reportRuntimeAcceptancePostProcessingFailure,
  runRuntimeAcceptanceEffect,
  type RuntimeAcceptanceReceipt,
} from "@/lib/api/agentRuntime/runtimeAcceptance";
import type { StreamRequestState } from "./agentStreamRuntimeHandlerTypes";
import {
  recordAgentStreamPerformanceMetric,
  type AgentUiPerformanceTraceMetadata,
} from "./agentStreamPerformanceMetrics";
import {
  buildAgentStreamSubmitAcceptedContext,
  buildAgentStreamSubmitDispatchedContext,
  buildAgentStreamSubmitFailedContext,
  buildAgentStreamSubmitFailedLogContext,
} from "./agentStreamSubmissionController";

type AgentStreamSubmitMetricRecorder = (
  phase: string,
  trace: AgentUiPerformanceTraceMetadata | null | undefined,
  context: Record<string, unknown>,
) => unknown;
type AgentStreamSubmitDebugLogger = typeof logAgentDebug;

export interface AgentStreamSubmitLifecycleDeps {
  logDebug?: AgentStreamSubmitDebugLogger;
  now?: () => number;
  recordMetric?: AgentStreamSubmitMetricRecorder;
}

export interface RunAgentStreamSubmitLifecycleOptions {
  activeSessionId: string;
  effectiveModel: string;
  effectiveProviderType: string;
  eventName: string;
  onSubmitAccepted?: () => void;
  onRuntimeAccepted?: (receipt: RuntimeAcceptanceReceipt) => void;
  requestState: StreamRequestState;
  submit: (
    accept: (receipt: RuntimeAcceptanceReceipt) => void,
  ) => Promise<RuntimeAcceptanceReceipt>;
  deps?: AgentStreamSubmitLifecycleDeps;
}

export async function runAgentStreamSubmitLifecycle(
  options: RunAgentStreamSubmitLifecycleOptions,
): Promise<RuntimeAcceptanceReceipt> {
  const {
    activeSessionId,
    effectiveModel,
    effectiveProviderType,
    eventName,
    onSubmitAccepted,
    onRuntimeAccepted,
    requestState,
    submit,
    deps,
  } = options;
  const now = deps?.now ?? Date.now;
  const recordMetric = deps?.recordMetric ?? recordAgentStreamPerformanceMetric;
  const logDebug = deps?.logDebug ?? logAgentDebug;
  requestState.submissionDispatchedAt = now();
  const submitDispatchedContext = buildAgentStreamSubmitDispatchedContext({
    activeSessionId,
    effectiveModel,
    effectiveProviderType,
    eventName,
    timing: {
      listenerBoundAt: requestState.listenerBoundAt,
      now: requestState.submissionDispatchedAt,
      requestStartedAt: requestState.requestStartedAt,
    },
  });
  recordMetric(
    "agentStream.submitDispatched",
    requestState.performanceTrace,
    submitDispatchedContext,
  );
  logDebug("AgentStream", "submitDispatched", submitDispatchedContext);

  let accepted: RuntimeAcceptanceReceipt | undefined;
  const accept = (receipt: RuntimeAcceptanceReceipt) => {
    const validated = requireRuntimeAcceptanceReceipt(receipt);
    if (accepted) {
      if (
        accepted.kind !== validated.kind ||
        accepted.sessionId !== validated.sessionId ||
        accepted.threadId !== validated.threadId ||
        accepted.turnId !== validated.turnId ||
        accepted.clientUserMessageId !== validated.clientUserMessageId
      ) {
        throw new Error(
          "Runtime acceptance identity changed within one request",
        );
      }
      return;
    }
    accepted = validated;
    runRuntimeAcceptanceEffect(validated, "observer", () =>
      onRuntimeAccepted?.(validated),
    );
    runRuntimeAcceptanceEffect(validated, "accepted_time", () => {
      requestState.submissionAcceptedAt = now();
    });
  };
  try {
    accept(await submit(accept));
  } catch (error) {
    if (accepted) {
      reportRuntimeAcceptancePostProcessingFailure("accepted_submit", accepted);
    } else {
      try {
        const timing = {
          now: now(),
          requestStartedAt: requestState.requestStartedAt,
          submissionDispatchedAt: requestState.submissionDispatchedAt,
        };
        recordMetric(
          "agentStream.submitFailed",
          requestState.performanceTrace,
          buildAgentStreamSubmitFailedContext({
            activeSessionId,
            error,
            eventName,
            timing,
          }),
        );
        logDebug(
          "AgentStream",
          "submitFailed",
          buildAgentStreamSubmitFailedLogContext({
            activeSessionId,
            error,
            eventName,
            timing,
          }),
          { level: "error" },
        );
      } catch {
        console.error("[AgentStream] submission rejection diagnostic failed");
      }
      throw error;
    }
  }
  if (!accepted)
    throw new Error("Runtime submission did not return acceptance");
  const receipt = accepted;
  runRuntimeAcceptanceEffect(receipt, "accepted_metric", () => {
    const context = buildAgentStreamSubmitAcceptedContext({
      activeSessionId,
      eventName,
      timing: {
        now: requestState.submissionAcceptedAt ?? Date.now(),
        requestStartedAt: requestState.requestStartedAt,
        submissionDispatchedAt: requestState.submissionDispatchedAt,
      },
    });
    recordMetric(
      "agentStream.submitAccepted",
      requestState.performanceTrace,
      context,
    );
  });
  runRuntimeAcceptanceEffect(receipt, "accepted_log", () => {
    const context = buildAgentStreamSubmitAcceptedContext({
      activeSessionId,
      eventName,
      timing: {
        now: requestState.submissionAcceptedAt ?? Date.now(),
        requestStartedAt: requestState.requestStartedAt,
        submissionDispatchedAt: requestState.submissionDispatchedAt,
      },
    });
    logDebug("AgentStream", "submitAccepted", context);
  });
  runRuntimeAcceptanceEffect(receipt, "terminal_recovery_poll", () =>
    onSubmitAccepted?.(),
  );
  return receipt;
}
