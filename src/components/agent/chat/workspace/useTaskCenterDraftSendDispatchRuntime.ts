import { isRuntimeSubmissionAccepted } from "../hooks/agentSendResult";
import { createTaskCenterSubmissionSettlement } from "./taskCenterSubmissionSettlement";
import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { recordAgentUiPerformanceMetric } from "@/lib/agentUiPerformanceMetrics";
import { mergeAgentUiPerformanceTraceMetadata } from "../hooks/agentStreamPerformanceMetrics";
import type { HandleSendOptions } from "../hooks/handleSendTypes";
import type {
  TaskCenterDraftSendRequest,
  TaskCenterSessionReadyOptions,
} from "../homePendingPreview";
import type { WorkspaceHandleSend } from "./useWorkspaceSendActions";
import { scheduleAfterNextPaint } from "./agentChatWorkspaceHelpers";

interface UseTaskCenterDraftSendDispatchRuntimeParams {
  taskCenterDraftSendRequest: TaskCenterDraftSendRequest | null;
  setTaskCenterDraftSendRequest: Dispatch<
    SetStateAction<TaskCenterDraftSendRequest | null>
  >;
  setHomePendingPreviewRequest: Dispatch<
    SetStateAction<TaskCenterDraftSendRequest | null>
  >;
  messagesLength: number;
  displayMessagesLength?: number;
  currentSessionId?: string | null;
  onSessionAccepted?: (
    sessionId: string,
    options?: TaskCenterSessionReadyOptions,
  ) => void;
  isSendSourceCurrent?: (
    options: TaskCenterSessionReadyOptions,
    acceptedSessionId?: string,
  ) => boolean;
  restoreInput?: (value: string) => void;
  sendRef: MutableRefObject<WorkspaceHandleSend>;
  workspaceId?: string | null;
}

function isDraftSendDispatchRuntimeOwned(
  request: TaskCenterDraftSendRequest,
): boolean {
  return request.dispatchState !== "dispatched";
}

export function useTaskCenterDraftSendDispatchRuntime({
  taskCenterDraftSendRequest,
  setTaskCenterDraftSendRequest,
  setHomePendingPreviewRequest,
  messagesLength,
  displayMessagesLength = messagesLength,
  currentSessionId,
  onSessionAccepted,
  isSendSourceCurrent,
  restoreInput,
  sendRef,
  workspaceId,
}: UseTaskCenterDraftSendDispatchRuntimeParams): void {
  const messageCountsRef = useRef({ displayMessagesLength, messagesLength });
  const latestDispatchContextRef = useRef({
    currentSessionId,
    taskCenterDraftSendRequest,
    workspaceId,
  });
  const mountedRef = useRef(true);
  const dispatchedRequestIdsRef = useRef<Set<string>>(new Set());
  const scheduledRequestIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    const dispatchedRequestIds = dispatchedRequestIdsRef.current;
    return () => {
      mountedRef.current = false;
      const request =
        latestDispatchContextRef.current.taskCenterDraftSendRequest;
      if (
        request &&
        isDraftSendDispatchRuntimeOwned(request) &&
        !dispatchedRequestIds.has(request.id)
      ) {
        request.onDispatchSettled?.({ kind: "rejected" });
      }
    };
  }, []);

  useEffect(() => {
    latestDispatchContextRef.current = {
      currentSessionId,
      taskCenterDraftSendRequest,
      workspaceId,
    };
  }, [currentSessionId, taskCenterDraftSendRequest, workspaceId]);

  useEffect(() => {
    messageCountsRef.current = { displayMessagesLength, messagesLength };
  }, [displayMessagesLength, messagesLength]);

  useEffect(() => {
    if (
      !taskCenterDraftSendRequest &&
      dispatchedRequestIdsRef.current.size > 20
    ) {
      dispatchedRequestIdsRef.current.clear();
    }
  }, [taskCenterDraftSendRequest]);

  useEffect(() => {
    if (
      !taskCenterDraftSendRequest ||
      !isDraftSendDispatchRuntimeOwned(taskCenterDraftSendRequest)
    ) {
      return;
    }

    const readySessionId = taskCenterDraftSendRequest.sessionId;
    if (!readySessionId) {
      return;
    }
    if (
      taskCenterDraftSendRequest.sessionReady &&
      taskCenterDraftSendRequest.sessionId === readySessionId
    ) {
      return;
    }

    if (isSendSourceCurrent?.(taskCenterDraftSendRequest) === false) return;
    onSessionAccepted?.(readySessionId, taskCenterDraftSendRequest);
    setTaskCenterDraftSendRequest((current) =>
      current?.id === taskCenterDraftSendRequest.id
        ? {
            ...current,
            sessionId: readySessionId,
            sessionReady: true,
          }
        : current,
    );
    setHomePendingPreviewRequest((current) =>
      current?.id === taskCenterDraftSendRequest.id
        ? {
            ...current,
            sessionId: readySessionId,
            sessionReady: true,
          }
        : current,
    );
  }, [
    currentSessionId,
    onSessionAccepted,
    isSendSourceCurrent,
    setHomePendingPreviewRequest,
    setTaskCenterDraftSendRequest,
    taskCenterDraftSendRequest,
  ]);

  useEffect(() => {
    if (
      messagesLength === 0 ||
      !taskCenterDraftSendRequest ||
      !isDraftSendDispatchRuntimeOwned(taskCenterDraftSendRequest)
    ) {
      return;
    }

    setTaskCenterDraftSendRequest((current) => {
      if (
        !current ||
        !isDraftSendDispatchRuntimeOwned(current) ||
        current.id !== taskCenterDraftSendRequest.id
      ) {
        return current;
      }
      const readySessionId = current.sessionId;
      if (!readySessionId) {
        return current;
      }
      if (isSendSourceCurrent?.(current) === false) return current;
      if (!current.sessionReady || current.sessionId !== readySessionId) {
        onSessionAccepted?.(readySessionId, current);
      }
      return null;
    });
    setHomePendingPreviewRequest((current) =>
      current?.id === taskCenterDraftSendRequest.id &&
      isDraftSendDispatchRuntimeOwned(current) &&
      isSendSourceCurrent?.(current) !== false
        ? null
        : current,
    );
  }, [
    displayMessagesLength,
    currentSessionId,
    messagesLength,
    onSessionAccepted,
    isSendSourceCurrent,
    setHomePendingPreviewRequest,
    setTaskCenterDraftSendRequest,
    taskCenterDraftSendRequest,
  ]);

  useEffect(() => {
    if (
      !taskCenterDraftSendRequest ||
      !isDraftSendDispatchRuntimeOwned(taskCenterDraftSendRequest)
    ) {
      return;
    }

    const request = taskCenterDraftSendRequest;
    if (!request.sessionId) {
      return;
    }
    if (
      dispatchedRequestIdsRef.current.has(request.id) ||
      scheduledRequestIdsRef.current.has(request.id)
    ) {
      return;
    }
    scheduledRequestIdsRef.current.add(request.id);

    scheduleAfterNextPaint(() => {
      scheduledRequestIdsRef.current.delete(request.id);
      if (
        !mountedRef.current ||
        dispatchedRequestIdsRef.current.has(request.id)
      ) {
        if (!mountedRef.current)
          request.onDispatchSettled?.({ kind: "rejected" });
        return;
      }

      const latestContext = latestDispatchContextRef.current;
      const latestRequest = latestContext.taskCenterDraftSendRequest;
      if (
        !latestRequest ||
        latestRequest.id !== request.id ||
        !isDraftSendDispatchRuntimeOwned(latestRequest)
      ) {
        request.onDispatchSettled?.({ kind: "rejected" });
        return;
      }
      if (!latestRequest.sessionId) {
        return;
      }

      dispatchedRequestIdsRef.current.add(latestRequest.id);
      const dispatchWorkspaceId = latestContext.workspaceId;
      const clearRequest = (options?: { keepHomePreview?: boolean }) => {
        setTaskCenterDraftSendRequest((current) =>
          current?.id === latestRequest.id ? null : current,
        );
        if (!options?.keepHomePreview) {
          setHomePendingPreviewRequest((current) =>
            current?.id === latestRequest.id ? null : current,
          );
        }
      };

      const settlement = createTaskCenterSubmissionSettlement(
        latestRequest.sendOptions?.observer,
        latestRequest.onDispatchSettled,
      );
      void (async () => {
        if (
          !mountedRef.current ||
          latestDispatchContextRef.current.taskCenterDraftSendRequest?.id !==
            latestRequest.id
        ) {
          settlement.settle({ kind: "rejected" });
          return;
        }

        const dispatchSessionId = latestRequest.sessionId;
        if (!dispatchSessionId) {
          settlement.settle({ kind: "rejected" });
          return;
        }
        settlement.effect("accepted_metric", () =>
          recordAgentUiPerformanceMetric("homeInput.sendDispatch.start", {
            elapsedMs: Date.now() - latestRequest.submittedAt,
            requestId: latestRequest.id,
            sessionId: dispatchSessionId,
            source: latestRequest.source,
            workspaceId: dispatchWorkspaceId ?? null,
          }),
        );
        const tracedSendOptions: HandleSendOptions = {
          ...(latestRequest.sendOptions || {}),
          observer: settlement.observer,
          targetSessionId: dispatchSessionId,
          skipSessionRestore: true,
          skipSessionStartHooks: true,
          requestMetadata: mergeAgentUiPerformanceTraceMetadata(
            latestRequest.sendOptions?.requestMetadata,
            {
              requestId: latestRequest.id,
              sessionId: dispatchSessionId,
              source: latestRequest.source,
              submittedAt: latestRequest.submittedAt,
              workspaceId: dispatchWorkspaceId ?? null,
            },
          ),
        };
        const sendPromise = sendRef.current(
          latestRequest.images,
          undefined,
          undefined,
          latestRequest.text,
          latestRequest.sendExecutionStrategy,
          undefined,
          tracedSendOptions,
        );
        await sendPromise.then(
          (actualResult) => {
            const result = settlement.settle(actualResult);
            if (!mountedRef.current) return;
            settlement.effect("accepted_metric", () =>
              recordAgentUiPerformanceMetric("homeInput.sendDispatch.done", {
                durationMs: Date.now() - latestRequest.submittedAt,
                requestId: latestRequest.id,
                result: result.kind,
                sessionId: dispatchSessionId,
                source: latestRequest.source,
                workspaceId: dispatchWorkspaceId ?? null,
              }),
            );
            if (!isRuntimeSubmissionAccepted(result)) {
              if (
                !latestRequest.onDispatchSettled &&
                isSendSourceCurrent?.(latestRequest) !== false
              )
                restoreInput?.(latestRequest.text);
            }
            const latestCounts = messageCountsRef.current;
            const latestActiveSessionId =
              latestDispatchContextRef.current.currentSessionId?.trim() || null;
            clearRequest({
              keepHomePreview:
                isRuntimeSubmissionAccepted(result) &&
                isSendSourceCurrent?.(
                  latestRequest,
                  result.receipt.sessionId,
                ) !== false &&
                (latestCounts.messagesLength === 0 ||
                  latestActiveSessionId !== dispatchSessionId),
            });
            settlement.settle(result);
          },
          (error) => {
            const result = settlement.reject(error);
            if (!mountedRef.current || isRuntimeSubmissionAccepted(result))
              return;
            settlement.effect("accepted_metric", () =>
              recordAgentUiPerformanceMetric("homeInput.sendDispatch.error", {
                durationMs: Date.now() - latestRequest.submittedAt,
                error: "request_rejected",
                requestId: latestRequest.id,
                sessionId: dispatchSessionId,
                source: latestRequest.source,
                workspaceId: dispatchWorkspaceId ?? null,
              }),
            );
            if (
              !latestRequest.onDispatchSettled &&
              isSendSourceCurrent?.(latestRequest) !== false
            )
              restoreInput?.(latestRequest.text);
            clearRequest();
            settlement.settle({ kind: "rejected" });
          },
        );
      })().catch((error) => {
        const result = settlement.reject(error);
        if (!mountedRef.current || isRuntimeSubmissionAccepted(result)) return;
        settlement.effect("accepted_metric", () =>
          recordAgentUiPerformanceMetric("homeInput.sendDispatch.error", {
            durationMs: Date.now() - latestRequest.submittedAt,
            error: "request_rejected",
            requestId: latestRequest.id,
            sessionId: latestRequest.sessionId,
            source: latestRequest.source,
            workspaceId: dispatchWorkspaceId ?? null,
          }),
        );
        if (
          !latestRequest.onDispatchSettled &&
          isSendSourceCurrent?.(latestRequest) !== false
        ) {
          restoreInput?.(latestRequest.text);
        }
        clearRequest();
        settlement.settle({ kind: "rejected" });
      });
    });
  }, [
    currentSessionId,
    isSendSourceCurrent,
    messageCountsRef,
    restoreInput,
    sendRef,
    setHomePendingPreviewRequest,
    setTaskCenterDraftSendRequest,
    taskCenterDraftSendRequest,
    workspaceId,
  ]);
}
