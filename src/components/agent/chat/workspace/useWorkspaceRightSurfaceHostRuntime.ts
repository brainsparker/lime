import { useCallback, useId, type MutableRefObject } from "react";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import type { WorkspaceHandleSend } from "./useWorkspaceSendActions";
import {
  renderWorkspaceRightSurfaceHostRuntime,
  type RenderWorkspaceRightSurfaceHostRuntimeParams,
} from "./WorkspaceRightSurfaceHostRuntime";
import type { WorkspaceRightSurfaceCoordinatorRuntime } from "./useWorkspaceRightSurfaceCoordinatorRuntime";
import { submitWorkspaceArticleEditorActionIntent } from "./workspaceArticleEditorActionDispatch";
import type { WorkspaceArticleWorkspaceActionIntent } from "./workspaceArticleWorkspaceModel";

type RightSurfaceHostRuntimeProjection = Pick<
  WorkspaceRightSurfaceCoordinatorRuntime,
  | "activePluginSurfaceContainerId"
  | "browserRightSurfaceAvailable"
  | "browserRightSurfaceIntent"
  | "filesRightSurfaceAvailable"
  | "filesRightSurfaceTarget"
  | "handleClosePluginSurface"
  | "handleCloseRightSurfaceShell"
  | "handleCloseRightSurfaceTab"
  | "handleRightSurfaceBrowserNavigate"
  | "handleSelectPluginSurface"
  | "handleSelectRightSurfaceTab"
  | "pluginSurfaceRightSurface"
  | "pluginSurfaceRightSurfaces"
  | "rightSurfaceBrowserTitle"
  | "rightSurfaceHarnessEnabled"
  | "rightSurfaceState"
  | "rightSurfaceTraceAvailable"
  | "rightSurfaceTraceEnabled"
>;

interface UseWorkspaceRightSurfaceHostRuntimeParams extends Omit<
  RenderWorkspaceRightSurfaceHostRuntimeParams,
  | "idPrefix"
  | "onCloseRightSurfaceTab"
  | "activePluginSurfaceContainerId"
  | "browserRightSurfaceAvailable"
  | "browserRightSurfaceInitialUrl"
  | "browserRightSurfaceIntentTitle"
  | "browserRightSurfaceHistoricalProjection"
  | "filesRightSurfaceAvailable"
  | "filesRightSurfaceTarget"
  | "pluginSurfaceRightSurface"
  | "pluginSurfaceRightSurfaces"
  | "rightSurfaceBrowserTitle"
  | "rightSurfaceHarnessEnabled"
  | "rightSurfaceState"
  | "rightSurfaceTraceAvailable"
  | "rightSurfaceTraceEnabled"
  | "onArticleActionIntent"
  | "onArticleSelectedObjectChange"
  | "onClosePluginSurface"
  | "onCloseRightSurfaceShell"
  | "onOpenArticlePreviewArtifact"
  | "onRightSurfaceBrowserNavigate"
  | "onSelectPluginSurface"
  | "onSelectRightSurfaceTab"
> {
  handleSendRef: MutableRefObject<WorkspaceHandleSend>;
  onOpenArticlePreviewArtifact: RenderWorkspaceRightSurfaceHostRuntimeParams["onOpenArticlePreviewArtifact"];
  restoreInput: (prompt: string) => void;
  rightSurfaceRuntime: RightSurfaceHostRuntimeProjection;
  setLayoutMode: (mode: LayoutMode) => void;
}

export function useWorkspaceRightSurfaceHostRuntime({
  handleSendRef,
  onOpenArticlePreviewArtifact,
  restoreInput,
  rightSurfaceRuntime,
  setLayoutMode,
  ...hostRuntimeParams
}: UseWorkspaceRightSurfaceHostRuntimeParams): ReturnType<
  typeof renderWorkspaceRightSurfaceHostRuntime
> {
  const idPrefix = useId();
  const handleArticleWorkspaceActionIntent = useCallback(
    async (intent: WorkspaceArticleWorkspaceActionIntent) => {
      setLayoutMode("chat");
      await submitWorkspaceArticleEditorActionIntent({
        intent,
        restoreInput,
        submit: async (prompt, options) =>
          await handleSendRef.current(
            [],
            undefined,
            undefined,
            prompt,
            "react",
            undefined,
            options,
          ),
      });
    },
    [handleSendRef, restoreInput, setLayoutMode],
  );

  return renderWorkspaceRightSurfaceHostRuntime({
    ...hostRuntimeParams,
    idPrefix,
    onCloseRightSurfaceTab: rightSurfaceRuntime.handleCloseRightSurfaceTab,
    activePluginSurfaceContainerId:
      rightSurfaceRuntime.activePluginSurfaceContainerId,
    browserRightSurfaceAvailable:
      rightSurfaceRuntime.browserRightSurfaceAvailable,
    browserRightSurfaceInitialUrl:
      rightSurfaceRuntime.browserRightSurfaceIntent?.launchUrl ?? null,
    browserRightSurfaceIntentTitle:
      rightSurfaceRuntime.browserRightSurfaceIntent?.title ?? null,
    browserRightSurfaceHistoricalProjection:
      rightSurfaceRuntime.browserRightSurfaceIntent?.historicalProjection ??
      null,
    filesRightSurfaceAvailable: rightSurfaceRuntime.filesRightSurfaceAvailable,
    filesRightSurfaceTarget: rightSurfaceRuntime.filesRightSurfaceTarget,
    pluginSurfaceRightSurface: rightSurfaceRuntime.pluginSurfaceRightSurface,
    pluginSurfaceRightSurfaces: rightSurfaceRuntime.pluginSurfaceRightSurfaces,
    rightSurfaceBrowserTitle: rightSurfaceRuntime.rightSurfaceBrowserTitle,
    rightSurfaceHarnessEnabled: rightSurfaceRuntime.rightSurfaceHarnessEnabled,
    rightSurfaceState: rightSurfaceRuntime.rightSurfaceState,
    rightSurfaceTraceAvailable: rightSurfaceRuntime.rightSurfaceTraceAvailable,
    rightSurfaceTraceEnabled: rightSurfaceRuntime.rightSurfaceTraceEnabled,
    onArticleActionIntent: handleArticleWorkspaceActionIntent,
    onArticleSelectedObjectChange: undefined,
    onClosePluginSurface: rightSurfaceRuntime.handleClosePluginSurface,
    onCloseRightSurfaceShell: rightSurfaceRuntime.handleCloseRightSurfaceShell,
    onOpenArticlePreviewArtifact,
    onRightSurfaceBrowserNavigate:
      rightSurfaceRuntime.handleRightSurfaceBrowserNavigate,
    onSelectPluginSurface: rightSurfaceRuntime.handleSelectPluginSurface,
    onSelectRightSurfaceTab: rightSurfaceRuntime.handleSelectRightSurfaceTab,
  });
}
