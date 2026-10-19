import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { FileDiff, Files, Globe, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readProjectGitStatus } from "@/lib/api/projectGit";
import { ThreadSidePanelLauncher } from "./right-surface/ThreadSidePanelLauncher";
import { FileTabLifecycleProvider } from "./text-file-editor/FileTabLifecycle";
import { FileTabDraftContext } from "./text-file-editor/fileTabDraftContext";
import { useFileTabCloseGuard } from "./text-file-editor/useFileTabCloseGuard";
import type { ThreadSidePanelAction } from "./right-surface/threadSidePanelActions";
import type { WorkspaceRightSurfaceKind } from "./right-surface";
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
  | "handleCloseSidePanelTab"
  | "handleNewSidePanelTab"
  | "handleSelectSidePanelTab"
  | "handleSelectChatFromNewTab"
  | "handleToggleSidePanel"
  | "sidePanelTabs"
  | "getFileDraft"
  | "setFileDraft"
  | "openWorkspaceFile"
  | "pinSidePanelTab"
  | "backgroundTerminalItems"
  | "rightSurfaceLaunchers"
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
  | "sidePanelTabs"
  | "sidePanelActions"
  | "onNewSidePanelTab"
  | "onSelectSidePanelTab"
  | "onCloseSidePanelTab"
  | "onSelectSidePanelAction"
  | "onSelectChatFromNewTab"
  | "onOpenWorkspaceFile"
  | "onPinSidePanelTab"
  | "backgroundTerminalItems"
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
  | "onOpenArticlePreviewArtifact"
  | "onRightSurfaceBrowserNavigate"
  | "onSelectPluginSurface"
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
> & { launcher: ReactNode } {
  const idPrefix = useId();
  const fileTabDrafts = useMemo(
    () => ({
      getFileDraft: rightSurfaceRuntime.getFileDraft,
      setFileDraft: rightSurfaceRuntime.setFileDraft,
    }),
    [rightSurfaceRuntime.getFileDraft, rightSurfaceRuntime.setFileDraft],
  );
  const fileTabLifecycle = useFileTabCloseGuard(
    rightSurfaceRuntime.sidePanelTabs.tabs,
    rightSurfaceRuntime.handleCloseSidePanelTab,
  );
  const { t } = useTranslation("agent");
  const root = hostRuntimeParams.canvasWorkbenchRootPath?.trim() || null;
  const gitContext = useMemo(() => ({ root }), [root]);
  const [gitStatus, setGitStatus] = useState<{
    context: typeof gitContext;
    available: boolean;
  } | null>(null);
  useEffect(() => {
    let current = true;
    if (root)
      void readProjectGitStatus(root).then(
        (status) => {
          if (current)
            setGitStatus({
              context: gitContext,
              available: status.hasGitRepository,
            });
        },
        () => {
          if (current) setGitStatus({ context: gitContext, available: false });
        },
      );
    return () => {
      current = false;
    };
  }, [root, gitContext]);
  const available = new Set(
    rightSurfaceRuntime.rightSurfaceLaunchers
      .filter((action) => !action.disabled)
      .map((action) => action.kind),
  );
  const sidePanelActions: ThreadSidePanelAction[] = [
    ...(root && available.has("files")
      ? [
          {
            id: "open-file",
            kind: "files" as const,
            title: t("agentChat.rightSurface.tabs.files"),
            icon: createElement(Files, { size: 16 }),
            deferSelectionUntilDropdownClose: true,
          },
        ]
      : []),
    ...(available.has("browser")
      ? [
          {
            id: "browser",
            kind: "browser" as const,
            title: t("agentChat.rightSurface.tabs.browser"),
            icon: createElement(Globe, { size: 16 }),
            deferSelectionUntilDropdownClose: true,
          },
        ]
      : []),
    ...(root &&
    gitStatus?.context === gitContext &&
    gitStatus.available &&
    available.has("changes")
      ? [
          {
            id: "review",
            kind: "changes" as const,
            title: t("agentChat.rightSurface.tabs.changes"),
            icon: createElement(FileDiff, { size: 16 }),
          },
        ]
      : []),
    ...(root && available.has("shell")
      ? [
          {
            id: "terminal",
            kind: "shell" as const,
            title: t("agentChat.rightSurface.tabs.shell"),
            icon: createElement(SquareTerminal, { size: 16 }),
          },
        ]
      : []),
  ];

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

  const surfaces = renderWorkspaceRightSurfaceHostRuntime({
    ...hostRuntimeParams,
    idPrefix,
    sidePanelTabs: rightSurfaceRuntime.sidePanelTabs,
    backgroundTerminalItems: rightSurfaceRuntime.backgroundTerminalItems,
    sidePanelActions,
    onNewSidePanelTab: rightSurfaceRuntime.handleNewSidePanelTab,
    onSelectSidePanelTab: rightSurfaceRuntime.handleSelectSidePanelTab,
    onCloseSidePanelTab: fileTabLifecycle.requestClose,
    onSelectSidePanelAction: (
      kind: WorkspaceRightSurfaceKind,
      replaceTabId?: string,
    ) => rightSurfaceRuntime.handleSelectRightSurfaceTab(kind, replaceTabId),
    onSelectChatFromNewTab: rightSurfaceRuntime.handleSelectChatFromNewTab,
    onOpenWorkspaceFile: rightSurfaceRuntime.openWorkspaceFile,
    onPinSidePanelTab: rightSurfaceRuntime.pinSidePanelTab,
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
    onOpenArticlePreviewArtifact,
    onRightSurfaceBrowserNavigate:
      rightSurfaceRuntime.handleRightSurfaceBrowserNavigate,
    onSelectPluginSurface: rightSurfaceRuntime.handleSelectPluginSurface,
  });
  return {
    ...surfaces,
    content: createElement(FileTabLifecycleProvider, {
      register: fileTabLifecycle.register,
      children: createElement(
        "div",
        { className: "contents" },
        createElement(FileTabDraftContext.Provider, {
          value: fileTabDrafts,
          children: surfaces.content,
        }),
        fileTabLifecycle.confirmation,
      ),
    }),
    launcher: createElement(ThreadSidePanelLauncher, {
      open: rightSurfaceRuntime.rightSurfaceState.activeSurface !== null,
      onToggle: () =>
        rightSurfaceRuntime.handleToggleSidePanel(
          sidePanelActions.length === 1 ? sidePanelActions[0].kind : undefined,
        ),
    }),
  };
}
