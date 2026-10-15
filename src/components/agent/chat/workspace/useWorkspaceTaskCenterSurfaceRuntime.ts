import { useMemo } from "react";
import { buildInitialDispatchPreviewMessages } from "./workspaceSendHelpers";
import { useTaskCenterHomePendingPreviewRuntime } from "./useTaskCenterDraftSendRuntime";
import {
  hasTaskCenterPendingPreviewActivity,
  resolveTaskCenterDraftSurfaceState,
} from "./taskCenterSurfaceState";

type DraftSurfaceParams = Parameters<
  typeof resolveTaskCenterDraftSurfaceState
>[0];
type HomePendingPreviewParams = Parameters<
  typeof useTaskCenterHomePendingPreviewRuntime
>[0];

interface UseWorkspaceTaskCenterSurfaceRuntimeParams {
  bootstrapDispatchPreview?:
    | Parameters<typeof buildInitialDispatchPreviewMessages>[0]
    | null;
  draftSurface: DraftSurfaceParams;
  homePendingPreview: HomePendingPreviewParams;
}

/** Task Center 草稿 surface、首页 pending preview 与物化路由统一由此处派生。 */
export function useWorkspaceTaskCenterSurfaceRuntime({
  bootstrapDispatchPreview,
  draftSurface,
  homePendingPreview,
}: UseWorkspaceTaskCenterSurfaceRuntimeParams) {
  const { homePendingPreviewMessages, isHomePendingPreviewActive } =
    useTaskCenterHomePendingPreviewRuntime(homePendingPreview);
  const bootstrapPendingPreviewMessages = useMemo(
    () =>
      bootstrapDispatchPreview && homePendingPreview.displayMessagesLength === 0
        ? buildInitialDispatchPreviewMessages(bootstrapDispatchPreview)
        : [],
    [bootstrapDispatchPreview, homePendingPreview.displayMessagesLength],
  );
  const hasPendingPreviewActivity = hasTaskCenterPendingPreviewActivity(
    isHomePendingPreviewActive,
    bootstrapPendingPreviewMessages.length,
  );
  const draftSurfaceState = resolveTaskCenterDraftSurfaceState({
    ...draftSurface,
    hasHomePendingPreview: hasPendingPreviewActivity,
  });
  const isHomeSendStarting = Boolean(
    draftSurface.draftSendRequest ||
    homePendingPreview.homePendingPreviewRequest ||
    hasPendingPreviewActivity ||
    draftSurface.isPreparingSend ||
    draftSurface.isSending ||
    draftSurface.queuedTurnCount > 0,
  );

  return {
    ...draftSurfaceState,
    bootstrapPendingPreviewMessages,
    homePendingPreviewMessages,
    isHomePendingPreviewActive,
    isHomeSendStarting,
  };
}
