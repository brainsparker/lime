import { useCallback } from "react";
import type { ComposerDraftNavigationCallbacks } from "./composerDraftNavigation";
import { useTaskCenterChromeNavigationRuntime } from "./useTaskCenterChromeNavigationRuntime";
import { useTaskCenterTopicNavigationRuntime } from "./useTaskCenterTopicNavigationRuntime";

type TopicNavigationParams = Parameters<
  typeof useTaskCenterTopicNavigationRuntime
>[0];
type ChromeNavigationParams = Parameters<
  typeof useTaskCenterChromeNavigationRuntime
>[0];
interface UseWorkspaceTaskCenterInteractionRuntimeParams extends Pick<
  ComposerDraftNavigationCallbacks,
  "composerDraftCoordinator" | "getComposerDraftNavigationEpoch"
> {
  chromeNavigation: Omit<
    ChromeNavigationParams,
    | "onOpenTaskTopic"
    | "isTaskCenterDraftSurfaceActive"
  >;
  taskCenterSurface: { isTaskCenterDraftSurfaceActive: boolean };
  topicNavigation: Omit<
    TopicNavigationParams,
    "composerDraftCoordinator" | "getComposerDraftNavigationEpoch"
  >;
}
/** Canonical 切题与 Chrome 共用同一导航 owner，不持有草稿文档。 */
export function useWorkspaceTaskCenterInteractionRuntime({
  chromeNavigation,
  composerDraftCoordinator,
  getComposerDraftNavigationEpoch,
  taskCenterSurface,
  topicNavigation,
}: UseWorkspaceTaskCenterInteractionRuntimeParams) {
  const topicNavigationRuntime = useTaskCenterTopicNavigationRuntime({
    ...topicNavigation,
    composerDraftCoordinator,
    getComposerDraftNavigationEpoch,
  });
  const { handleOpenTaskTopic } = topicNavigationRuntime;
  const onOpenTaskTopic = useCallback(
    async (...args: Parameters<typeof handleOpenTaskTopic>) => {
      await handleOpenTaskTopic(...args);
    },
    [handleOpenTaskTopic],
  );
  const chromeNavigationRuntime = useTaskCenterChromeNavigationRuntime({
    ...chromeNavigation,
    isTaskCenterDraftSurfaceActive:
      taskCenterSurface.isTaskCenterDraftSurfaceActive,
    onOpenTaskTopic,
  });
  return { ...topicNavigationRuntime, ...chromeNavigationRuntime };
}
