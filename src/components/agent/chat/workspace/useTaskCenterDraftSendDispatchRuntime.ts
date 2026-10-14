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
import type { TaskCenterDraftSendRequest } from "../homePendingPreview";
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
  materializedSessionIdsRef: MutableRefObject<Map<string, string>>;
  prewarmedDraftSessionIdsRef?: MutableRefObject<Set<string>>;
  materializeDraftTab: (
    draftTabId: string,
    options: { reason: "send"; commit: false },
  ) => Promise<string | null>;
  commitMaterializedDraftTab: (
    draftTabId: string,
    newSessionId: string,
    options?: {
      embedHomeSession?: boolean;
      hydrateSession?: boolean;
      preserveInput?: boolean;
      syncRoute?: boolean;
    },
  ) => void;
  onNonMaterializedSessionReady?: (
    sessionId: string,
    options?: { sourceDraftTabId?: string | null },
  ) => void;
  restoreInput?: (value: string) => void;
  sendRef: MutableRefObject<WorkspaceHandleSend>;
  workspaceId?: string | null;
}

function isTemporaryDraftSendRequestId(value: string): boolean {
  return value.startsWith("draft-send-");
}

function resolveNonMaterializedReadySessionId(
  request: TaskCenterDraftSendRequest,
  currentSessionId?: string | null,
): string | null {
  const activeSessionId = currentSessionId?.trim();
  if (activeSessionId) {
    return activeSessionId;
  }

  const requestSessionId = request.draftTabId.trim();
  return requestSessionId && !isTemporaryDraftSendRequestId(requestSessionId)
    ? requestSessionId
    : null;
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
  materializedSessionIdsRef,
  prewarmedDraftSessionIdsRef,
  materializeDraftTab,
  commitMaterializedDraftTab,
  onNonMaterializedSessionReady,
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
    return () => {
      mountedRef.current = false;
      latestDispatchContextRef.current.taskCenterDraftSendRequest?.onDispatchSettled?.(
        false,
      );
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
      !isDraftSendDispatchRuntimeOwned(taskCenterDraftSendRequest) ||
      taskCenterDraftSendRequest.materializeDraft
    ) {
      return;
    }

    const readySessionId = resolveNonMaterializedReadySessionId(
      taskCenterDraftSendRequest,
      currentSessionId,
    );
    if (!readySessionId) {
      return;
    }
    if (
      taskCenterDraftSendRequest.sessionReady &&
      taskCenterDraftSendRequest.draftTabId === readySessionId
    ) {
      return;
    }

    onNonMaterializedSessionReady?.(readySessionId);
    setTaskCenterDraftSendRequest((current) =>
      current?.id === taskCenterDraftSendRequest.id
        ? {
            ...current,
            draftTabId: readySessionId,
            sessionReady: true,
          }
        : current,
    );
    setHomePendingPreviewRequest((current) =>
      current?.id === taskCenterDraftSendRequest.id
        ? {
            ...current,
            draftTabId: readySessionId,
            sessionReady: true,
          }
        : current,
    );
  }, [
    currentSessionId,
    onNonMaterializedSessionReady,
    setHomePendingPreviewRequest,
    setTaskCenterDraftSendRequest,
    taskCenterDraftSendRequest,
  ]);

  useEffect(() => {
    if (
      messagesLength === 0 ||
      !taskCenterDraftSendRequest ||
      !isDraftSendDispatchRuntimeOwned(taskCenterDraftSendRequest) ||
      taskCenterDraftSendRequest.materializeDraft
    ) {
      return;
    }

    setTaskCenterDraftSendRequest((current) => {
      if (
        !current ||
        !isDraftSendDispatchRuntimeOwned(current) ||
        current.materializeDraft ||
        current.id !== taskCenterDraftSendRequest.id
      ) {
        return current;
      }
      const readySessionId = resolveNonMaterializedReadySessionId(
        current,
        currentSessionId,
      );
      if (!readySessionId) {
        return current;
      }
      if (!current.sessionReady || current.draftTabId !== readySessionId) {
        onNonMaterializedSessionReady?.(readySessionId);
      }
      return null;
    });
    setHomePendingPreviewRequest((current) =>
      current && isDraftSendDispatchRuntimeOwned(current) ? null : current,
    );
  }, [
    displayMessagesLength,
    currentSessionId,
    messagesLength,
    onNonMaterializedSessionReady,
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
    if (
      !request.materializeDraft &&
      !resolveNonMaterializedReadySessionId(request, currentSessionId)
    ) {
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
        if (!mountedRef.current) request.onDispatchSettled?.(false);
        return;
      }

      const latestContext = latestDispatchContextRef.current;
      const latestRequest = latestContext.taskCenterDraftSendRequest;
      if (
        !latestRequest ||
        latestRequest.id !== request.id ||
        !isDraftSendDispatchRuntimeOwned(latestRequest)
      ) {
        request.onDispatchSettled?.(false);
        return;
      }
      if (
        !latestRequest.materializeDraft &&
        !resolveNonMaterializedReadySessionId(
          latestRequest,
          latestContext.currentSessionId,
        )
      ) {
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
        if (latestRequest.materializeDraft) {
          materializedSessionIdsRef.current.delete(latestRequest.draftTabId);
        }
      };

      void (async () => {
        const readyMaterializedSessionId = latestRequest.materializeDraft
          ? (materializedSessionIdsRef.current.get(latestRequest.draftTabId) ??
            null)
          : null;
        const materializedSessionId = latestRequest.materializeDraft
          ? (readyMaterializedSessionId ??
            (await materializeDraftTab(latestRequest.draftTabId, {
              reason: "send",
              commit: false,
            })))
          : null;
        if (latestRequest.materializeDraft && !materializedSessionId) {
          recordAgentUiPerformanceMetric("homeInput.sendDispatch.error", {
            durationMs: Date.now() - latestRequest.submittedAt,
            error: "draft_materialize_failed",
            requestId: latestRequest.id,
            sessionId: latestRequest.draftTabId,
            source: latestRequest.source,
            workspaceId: dispatchWorkspaceId ?? null,
          });
          clearRequest();
          latestRequest.onDispatchSettled?.(false);
          return;
        }

        if (
          !mountedRef.current ||
          latestDispatchContextRef.current.taskCenterDraftSendRequest?.id !==
            latestRequest.id
        ) {
          latestRequest.onDispatchSettled?.(false);
          return;
        }

        const dispatchSessionId =
          materializedSessionId ?? latestRequest.draftTabId;
        if (latestRequest.materializeDraft && materializedSessionId) {
          const markMaterializedSessionReady = (
            current: TaskCenterDraftSendRequest | null,
          ) =>
            current?.id === latestRequest.id
              ? {
                  ...current,
                  draftTabId: materializedSessionId,
                  sessionReady: true,
                }
              : current;
          setTaskCenterDraftSendRequest(markMaterializedSessionReady);
          setHomePendingPreviewRequest(markMaterializedSessionReady);
        }
        if (latestRequest.materializeDraft && materializedSessionId) {
          const commitOptions: Parameters<
            typeof commitMaterializedDraftTab
          >[2] = {
            embedHomeSession: false,
            hydrateSession: false,
            preserveInput: Boolean(latestRequest.onDispatchSettled),
            syncRoute: false,
          };
          commitMaterializedDraftTab(
            latestRequest.draftTabId,
            materializedSessionId,
            commitOptions,
          );
        }
        recordAgentUiPerformanceMetric("homeInput.sendDispatch.start", {
          elapsedMs: Date.now() - latestRequest.submittedAt,
          requestId: latestRequest.id,
          sessionId: dispatchSessionId,
          source: latestRequest.source,
          workspaceId: dispatchWorkspaceId ?? null,
        });
        const tracedSendOptions: HandleSendOptions = {
          ...(latestRequest.sendOptions || {}),
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
        void sendPromise.then(
          (result) => {
            recordAgentUiPerformanceMetric("homeInput.sendDispatch.done", {
              durationMs: Date.now() - latestRequest.submittedAt,
              requestId: latestRequest.id,
              result,
              sessionId: dispatchSessionId,
              source: latestRequest.source,
              workspaceId: dispatchWorkspaceId ?? null,
            });
            if (result !== true) {
              if (!latestRequest.onDispatchSettled)
                restoreInput?.(latestRequest.text);
            }
            const latestCounts = messageCountsRef.current;
            const latestActiveSessionId =
              latestDispatchContextRef.current.currentSessionId?.trim() || null;
            clearRequest({
              keepHomePreview:
                result === true &&
                (latestCounts.messagesLength === 0 ||
                  (latestRequest.materializeDraft &&
                    latestActiveSessionId !== dispatchSessionId)),
            });
            latestRequest.onDispatchSettled?.(result === true);
          },
          (error) => {
            recordAgentUiPerformanceMetric("homeInput.sendDispatch.error", {
              durationMs: Date.now() - latestRequest.submittedAt,
              error: error instanceof Error ? error.message : String(error),
              requestId: latestRequest.id,
              sessionId: dispatchSessionId,
              source: latestRequest.source,
              workspaceId: dispatchWorkspaceId ?? null,
            });
            if (!latestRequest.onDispatchSettled)
              restoreInput?.(latestRequest.text);
            clearRequest();
            latestRequest.onDispatchSettled?.(false);
          },
        );
      })().catch((error) => {
        recordAgentUiPerformanceMetric("homeInput.sendDispatch.error", {
          durationMs: Date.now() - latestRequest.submittedAt,
          error: error instanceof Error ? error.message : String(error),
          requestId: latestRequest.id,
          sessionId: latestRequest.draftTabId,
          source: latestRequest.source,
          workspaceId: dispatchWorkspaceId ?? null,
        });
        if (
          !latestRequest.onDispatchSettled &&
          !latestRequest.materializeDraft
        ) {
          restoreInput?.(latestRequest.text);
        }
        clearRequest();
        latestRequest.onDispatchSettled?.(false);
      });
    });
  }, [
    commitMaterializedDraftTab,
    currentSessionId,
    materializeDraftTab,
    materializedSessionIdsRef,
    prewarmedDraftSessionIdsRef,
    messageCountsRef,
    restoreInput,
    sendRef,
    setHomePendingPreviewRequest,
    setTaskCenterDraftSendRequest,
    taskCenterDraftSendRequest,
    workspaceId,
  ]);
}
