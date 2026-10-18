import {
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { TaskCenterDraftSendRequest } from "../homePendingPreview";
import {
  isTaskCenterTopicSwitchPending,
  resolveTaskCenterPreviewTopicId,
} from "../utils/taskCenterTabs";
import {
  resolveTaskCenterHomeChromeState,
  type TaskCenterHomeChromeState,
} from "./taskCenterSurfaceState";

interface UseTaskCenterHomeChromeRuntimeParams {
  agentEntry: string;
  sessionId?: string | null;
  detachedTopicId?: string | null;
  transitionTopicId?: string | null;
  draftSurfaceActive: boolean;
  shouldSuppressDraftContent: boolean;
  draftSendRequest: TaskCenterDraftSendRequest | null;
  normalizedInitialSessionId?: string | null;
  isHomeSessionBackgroundRecovery: boolean;
  displayMessageCount: number;
  threadItemCount: number;
  hasPendingA2UIForm: boolean;
  isPreparingSend: boolean;
  isSending: boolean;
  isHomePendingPreviewActive: boolean;
  isHomeSendStarting?: boolean;
  queuedTurnCount: number;
  hasLocalSessionOverride: boolean;
  embeddedHomeSessionIds: ReadonlySet<string>;
  isAutoRestoringSession: boolean;
  isSessionHydrating: boolean;
  shouldUseBrowserWorkspaceHomeChrome: boolean;
  harnessPanelVisible: boolean;
  setHarnessPanelVisible: Dispatch<SetStateAction<boolean>>;
  clearEmbeddedHomeSession: (sessionId: string) => void;
}

export interface TaskCenterHomeChromeRuntime extends TaskCenterHomeChromeState {
  taskCenterPreviewTopicId: string | null;
  taskCenterSessionSwitchPending: boolean;
}

export function useTaskCenterHomeChromeRuntime({
  agentEntry,
  sessionId,
  detachedTopicId,
  transitionTopicId,
  draftSurfaceActive,
  shouldSuppressDraftContent,
  draftSendRequest,
  normalizedInitialSessionId,
  isHomeSessionBackgroundRecovery,
  displayMessageCount,
  threadItemCount,
  hasPendingA2UIForm,
  isPreparingSend,
  isSending,
  isHomePendingPreviewActive,
  isHomeSendStarting = false,
  queuedTurnCount,
  hasLocalSessionOverride,
  embeddedHomeSessionIds,
  isAutoRestoringSession,
  isSessionHydrating,
  shouldUseBrowserWorkspaceHomeChrome,
  harnessPanelVisible,
  setHarnessPanelVisible,
  clearEmbeddedHomeSession,
}: UseTaskCenterHomeChromeRuntimeParams): TaskCenterHomeChromeRuntime {
  const taskCenterPreviewTopicId = useMemo(
    () =>
      resolveTaskCenterPreviewTopicId({
        sessionId,
        detachedTopicId,
        switchingTopicId: transitionTopicId,
      }),
    [detachedTopicId, sessionId, transitionTopicId],
  );
  const taskCenterSessionSwitchPending = useMemo(
    () =>
      isTaskCenterTopicSwitchPending({
        sessionId,
        switchingTopicId: transitionTopicId,
      }),
    [sessionId, transitionTopicId],
  );
  const homeChromeState = resolveTaskCenterHomeChromeState({
    agentEntry,
    draftSurfaceActive,
    shouldSuppressDraftContent,
    draftSendRequest,
    sessionSwitchPending: taskCenterSessionSwitchPending,
    hasInitialSessionRoute: Boolean(normalizedInitialSessionId),
    isHomeSessionBackgroundRecovery,
    displayMessageCount,
    threadItemCount,
    hasPendingA2UIForm,
    isPreparingSend,
    isSending,
    isHomePendingPreviewActive,
    isHomeSendStarting,
    queuedTurnCount,
    hasLocalSessionOverride,
    sessionId,
    embeddedHomeSessionIds,
    isAutoRestoringSession,
    isSessionHydrating,
    shouldUseBrowserWorkspaceHomeChrome,
  });

  useEffect(() => {
    if (!sessionId || !embeddedHomeSessionIds.has(sessionId)) {
      return;
    }

    if (homeChromeState.hasHomeConversationActivity) {
      clearEmbeddedHomeSession(sessionId);
    }
  }, [
    clearEmbeddedHomeSession,
    embeddedHomeSessionIds,
    homeChromeState.hasHomeConversationActivity,
    sessionId,
  ]);

  useEffect(() => {
    if (
      !homeChromeState.suppressHomeNavbarUtilityActions ||
      !harnessPanelVisible
    ) {
      return;
    }

    setHarnessPanelVisible(false);
  }, [
    harnessPanelVisible,
    homeChromeState.suppressHomeNavbarUtilityActions,
    setHarnessPanelVisible,
  ]);

  return {
    ...homeChromeState,
    taskCenterPreviewTopicId,
    taskCenterSessionSwitchPending,
  };
}
