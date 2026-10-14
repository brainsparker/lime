import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import type { ReviewThreadSidePanelTarget } from "./ReviewThreadSidePanelTab";
import type { WorkspaceArticleWorkspace } from "./workspaceArticleWorkspaceModel";
import { useWorkspaceRightSurfaceActionRuntime } from "./useWorkspaceRightSurfaceActionRuntime";
import type { WorkspaceRightSurfacePendingActions } from "./useWorkspaceRightSurfaceArtifactOpenRuntime";
import { useWorkspaceRightSurfaceDerivedRuntime } from "./useWorkspaceRightSurfaceDerivedRuntime";
import type { WorkspaceRightSurfaceLocalStateRuntime } from "./useWorkspaceRightSurfaceLocalStateRuntime";
import { useWorkspaceRightSurfacePendingBridgeRuntime } from "./useWorkspaceRightSurfacePendingBridgeRuntime";
import { useWorkspaceRightSurfaceProjectionRuntime } from "./useWorkspaceRightSurfaceProjectionRuntime";
import {
  buildWorkspacePluginSurfacesFromThreadItems,
  mergeWorkspacePluginSurfaceDescriptors,
  resolveWorkspacePluginSurfaceSessionEpoch,
  resolveWorkspacePluginSurfaceThreadId,
  type WorkspacePluginSurfaceSessionEpoch,
} from "./workspacePluginSurfaceModel";

interface UseWorkspaceRightSurfaceCoordinatorRuntimeParams {
  articleEditorRightSurface: WorkspaceArticleWorkspace | null;
  articleEditorRightSurfaceAvailable: boolean;
  bindRightSurfacePendingActions: (
    actions: WorkspaceRightSurfacePendingActions,
  ) => void;
  canvasWorkbenchRootPath: string | null;
  clawTraceEnabled: boolean;
  expertInfoPanelCollapsed: boolean;
  expertInfoPanelVisible: boolean;
  handleToggleCanvas: () => void;
  harnessPendingCount: number;
  hasExpertInfoPanel: boolean;
  localState: WorkspaceRightSurfaceLocalStateRuntime;
  preferredServiceSkillResultFileTarget: ReviewThreadSidePanelTarget | null;
  runtimeWorkspaceId: string | null;
  sceneIsPreparingSend: boolean;
  sceneIsSending: boolean;
  sceneLayoutMode: LayoutMode;
  sceneSessionId?: string | null;
  sceneThreadId?: string | null;
  sessionId?: string | null;
  shellRightSurfaceAvailable: boolean;
  activityAvailable?: boolean;
  showHarnessToggle: boolean;
  suppressHomeNavbarUtilityActions: boolean;
  taskCenterHomeHotpathActive: boolean;
  threadItems: readonly AgentThreadItem[];
  setExpertInfoPanelCollapsed: (value: boolean) => void;
  setHarnessPanelVisible: (value: boolean) => void;
  setLayoutMode: Dispatch<SetStateAction<LayoutMode>>;
}

export function useWorkspaceRightSurfaceCoordinatorRuntime({
  articleEditorRightSurface,
  articleEditorRightSurfaceAvailable,
  bindRightSurfacePendingActions,
  canvasWorkbenchRootPath,
  clawTraceEnabled,
  expertInfoPanelCollapsed,
  expertInfoPanelVisible,
  handleToggleCanvas,
  harnessPendingCount,
  hasExpertInfoPanel,
  localState,
  preferredServiceSkillResultFileTarget,
  runtimeWorkspaceId,
  sceneIsPreparingSend,
  sceneIsSending,
  sceneLayoutMode,
  sceneSessionId,
  sceneThreadId,
  sessionId,
  shellRightSurfaceAvailable,
  activityAvailable = false,
  showHarnessToggle,
  suppressHomeNavbarUtilityActions,
  taskCenterHomeHotpathActive,
  threadItems,
  setExpertInfoPanelCollapsed,
  setHarnessPanelVisible,
  setLayoutMode,
}: UseWorkspaceRightSurfaceCoordinatorRuntimeParams) {
  const effectiveSessionId = sessionId || sceneSessionId || null;
  const effectiveSceneThreadId = resolveWorkspacePluginSurfaceThreadId(
    sceneThreadId,
    threadItems,
  );
  const pluginSurfaceSessionEpochRef =
    useRef<WorkspacePluginSurfaceSessionEpoch | null>(null);
  const pluginSurfaceSessionEpoch = resolveWorkspacePluginSurfaceSessionEpoch({
    currentSessionId: effectiveSessionId,
    currentThreadId: effectiveSceneThreadId,
    previousEpoch: pluginSurfaceSessionEpochRef.current,
  });
  useEffect(() => {
    if (pluginSurfaceSessionEpoch.ready) {
      pluginSurfaceSessionEpochRef.current = pluginSurfaceSessionEpoch.epoch;
    }
  }, [pluginSurfaceSessionEpoch.epoch, pluginSurfaceSessionEpoch.ready]);
  const canonicalPluginSurfaces = useMemo(
    () =>
      pluginSurfaceSessionEpoch.ready
        ? buildWorkspacePluginSurfacesFromThreadItems(
            threadItems,
            localState.dismissedPluginSurfaceContainerIds,
            pluginSurfaceSessionEpoch.epoch?.threadId,
          )
        : [],
    [
      localState.dismissedPluginSurfaceContainerIds,
      pluginSurfaceSessionEpoch.epoch?.threadId,
      pluginSurfaceSessionEpoch.ready,
      threadItems,
    ],
  );
  const pendingRuntime = useWorkspaceRightSurfacePendingBridgeRuntime({
    bindRightSurfacePendingActions,
    canvasWorkbenchRootPath,
    manualRightSurface: localState.manualRightSurface,
    runtimeWorkspaceId,
    sceneIsPreparingSend,
    sceneIsSending,
    sceneLayoutMode,
    sceneSessionId,
    sessionId,
    taskCenterHomeHotpathActive,
  });
  const mergedIncomingPluginSurfaces = useMemo(
    () =>
      mergeWorkspacePluginSurfaceDescriptors(
        pendingRuntime.pendingPluginSurfaces,
        canonicalPluginSurfaces,
      ),
    [canonicalPluginSurfaces, pendingRuntime.pendingPluginSurfaces],
  );
  const derivedRuntime = useWorkspaceRightSurfaceDerivedRuntime({
    activeBrowserRightSurfaceIntent: localState.activeBrowserRightSurfaceIntent,
    activeFilesRightSurfaceTarget: localState.activeFilesRightSurfaceTarget,
    activePluginSurfaceContainerId: localState.activePluginSurfaceContainerId,
    activePluginSurfaces: localState.activePluginSurfaces,
    pendingBrowserRightSurfaceIntent: pendingRuntime.pendingBrowserIntent,
    pendingFileTarget: pendingRuntime.pendingFileTarget,
    pendingPluginSurfaces: mergedIncomingPluginSurfaces,
    preferredServiceSkillResultFileTarget,
    projectRootPath: canvasWorkbenchRootPath,
    threadItems,
  });
  const rightSurfaceHarnessEnabled =
    !suppressHomeNavbarUtilityActions && showHarnessToggle;
  const rightSurfaceTraceAvailable = !suppressHomeNavbarUtilityActions;
  const rightSurfaceTraceEnabled =
    rightSurfaceTraceAvailable && clawTraceEnabled;
  const { availableSurfaces, rightSurfaceLaunchers, rightSurfaceState } =
    useWorkspaceRightSurfaceProjectionRuntime({
      appServerPendingIntents: pendingRuntime.pendingIntents,
      appSurfaceAvailable: derivedRuntime.pluginSurfaceRightSurfaceAvailable,
      articleWorkspaceAvailable: articleEditorRightSurfaceAvailable,
      expertInfoVisible: expertInfoPanelVisible,
      filesAvailable: derivedRuntime.filesRightSurfaceAvailable,
      harnessPendingCount,
      hasExpertInfoPanel,
      manualRightSurface: localState.manualRightSurface,
      openedRightSurfaces: localState.openedRightSurfaces,
      preferredServiceSkillResultFileTargetRelativePath:
        preferredServiceSkillResultFileTarget?.relativePath,
      sceneLayoutMode,
      shellAvailable: shellRightSurfaceAvailable,
      showHarnessToggle,
      suppressHomeNavbarUtilityActions,
      traceAvailable: rightSurfaceTraceAvailable,
      activityAvailable,
    });
  const { pruneRightSurfaces, rememberRightSurface } = localState;
  useEffect(() => {
    pruneRightSurfaces(availableSurfaces);
  }, [
    availableSurfaces,
    localState.manualRightSurface,
    localState.openedRightSurfaces,
    pruneRightSurfaces,
  ]);
  useEffect(() => {
    if (rightSurfaceState.activeSurface) {
      rememberRightSurface(rightSurfaceState.activeSurface);
    }
  }, [rememberRightSurface, rightSurfaceState.activeSurface]);
  const actionRuntime = useWorkspaceRightSurfaceActionRuntime({
    activeBrowserRightSurfaceIntent: localState.activeBrowserRightSurfaceIntent,
    activePluginSurfaceContainerId: localState.activePluginSurfaceContainerId,
    activePluginSurfaces: localState.activePluginSurfaces,
    articleEditorRightSurface,
    articleEditorRightSurfaceAvailable,
    availableSurfaces,
    browserRightSurfaceAvailable: derivedRuntime.browserRightSurfaceAvailable,
    closeRightSurface: localState.closeRightSurface,
    consumePendingRequestsForSurface:
      pendingRuntime.consumePendingRequestsForSurface,
    dismissPendingRequestsForSurface:
      pendingRuntime.dismissPendingRequestsForSurface,
    expertInfoPanelCollapsed,
    filesRightSurfaceAvailable: derivedRuntime.filesRightSurfaceAvailable,
    filesRightSurfaceTarget: derivedRuntime.filesRightSurfaceTarget,
    handleToggleCanvas,
    manualRightSurface: localState.manualRightSurface,
    pendingBrowserRightSurfaceIntent: pendingRuntime.pendingBrowserIntent,
    pendingPluginSurfaces: mergedIncomingPluginSurfaces,
    pluginSurfaceRightSurface: derivedRuntime.pluginSurfaceRightSurface,
    pluginSurfaceRightSurfaceAvailable:
      derivedRuntime.pluginSurfaceRightSurfaceAvailable,
    pluginSurfaceRightSurfaces: derivedRuntime.pluginSurfaceRightSurfaces,
    refreshRightSurfacePendingRequests: pendingRuntime.refreshPendingRequests,
    rightSurfaceActiveSurface: rightSurfaceState.activeSurface,
    rightSurfaceHarnessEnabled,
    rightSurfaceTraceAvailable,
    rightSurfaceActivityAvailable: activityAvailable,
    sceneLayoutMode,
    setActiveArticleWorkspace: localState.setActiveArticleWorkspace,
    setActiveBrowserRightSurfaceIntent:
      localState.setActiveBrowserRightSurfaceIntent,
    setActiveFilesRightSurfaceTarget:
      localState.setActiveFilesRightSurfaceTarget,
    setActivePluginSurfaceContainerId:
      localState.setActivePluginSurfaceContainerId,
    setActivePluginSurfaces: localState.setActivePluginSurfaces,
    setDismissedPluginSurfaceContainerIds:
      localState.setDismissedPluginSurfaceContainerIds,
    setExpertInfoPanelCollapsed,
    setHarnessPanelVisible,
    setLayoutMode,
    setManualRightSurface: localState.setManualRightSurface,
    setRightSurfaceBrowserTitle: localState.setRightSurfaceBrowserTitle,
  });

  return {
    ...derivedRuntime,
    ...actionRuntime,
    activePluginSurfaceContainerId: localState.activePluginSurfaceContainerId,
    rightSurfaceBrowserTitle: localState.rightSurfaceBrowserTitle,
    rightSurfaceHarnessEnabled,
    rightSurfaceLaunchers,
    rightSurfaceState,
    rightSurfaceTraceAvailable,
    rightSurfaceTraceEnabled,
  };
}

export type WorkspaceRightSurfaceCoordinatorRuntime = ReturnType<
  typeof useWorkspaceRightSurfaceCoordinatorRuntime
>;
