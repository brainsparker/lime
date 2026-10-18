import type { ComponentProps, ReactNode } from "react";
import { TaskCenterShellPanel } from "../components/TaskCenterShellPanel";
import { ExpertInfoPanel } from "../experts/ExpertInfoPanel";
import { GeneralWorkbenchHarnessSurfaceSection } from "./WorkspaceHarnessDialogs";
import { WorkspaceArticleEditorRightSurface } from "./WorkspaceArticleEditorRightSurface";
import { ReviewThreadSidePanelTab } from "./ReviewThreadSidePanelTab";
import { WorkspacePluginSurface } from "./WorkspacePluginSurface";
import { WorkspaceTraceTab } from "./WorkspaceTraceTab";
import {
  buildWorkspaceRightSurfaceDefinitions,
  RightSurfaceHost,
  type WorkspaceRightSurfaceKind,
  type WorkspaceRightSurfaceState,
} from "./right-surface";
import { RightSurfaceTabStrip } from "./right-surface/RightSurfaceTabStrip";
import { RightSurfaceBrowserPanel } from "./right-surface/browser/RightSurfaceBrowserPanel";

type ArticleEditorRightSurfaceProps = ComponentProps<
  typeof WorkspaceArticleEditorRightSurface
>;
type BrowserPanelProps = ComponentProps<typeof RightSurfaceBrowserPanel>;
type ExpertInfoPanelProps = ComponentProps<typeof ExpertInfoPanel>;
type FilesSurfaceProps = ComponentProps<typeof ReviewThreadSidePanelTab>;
type GeneralWorkbenchHarnessSurfaceProps = ComponentProps<
  typeof GeneralWorkbenchHarnessSurfaceSection
>;
type PluginSurfaceProps = ComponentProps<typeof WorkspacePluginSurface>;
type ShellPanelProps = ComponentProps<typeof TaskCenterShellPanel>;
export interface RenderWorkspaceRightSurfaceHostRuntimeParams {
  idPrefix: string;
  onCloseRightSurfaceTab: (kind: WorkspaceRightSurfaceKind) => void;
  activePluginSurfaceContainerId: string | null;
  articleActionsDisabled: boolean;
  articleEditorRightSurface:
    | ArticleEditorRightSurfaceProps["articleWorkspace"]
    | null;
  browserRightSurfaceAvailable: boolean;
  ensureBrowserWorkspaceOwner?: BrowserPanelProps["ensureOwner"];
  browserRightSurfaceInitialUrl?: string | null;
  browserRightSurfaceIntentTitle?: string | null;
  browserRightSurfaceHistoricalProjection?: BrowserPanelProps["historicalProjection"];
  canvasWorkbenchRootPath: ShellPanelProps["projectRootPath"];
  expertInfoPanelProps: ExpertInfoPanelProps;
  filesRightSurfaceAvailable: boolean;
  filesRightSurfaceTarget: FilesSurfaceProps["target"];
  generalWorkbenchHarnessPanelBaseProps: Omit<
    GeneralWorkbenchHarnessSurfaceProps,
    "enabled" | "harnessState"
  >;
  harnessState: GeneralWorkbenchHarnessSurfaceProps["harnessState"];
  pluginSurfaceRightSurface: PluginSurfaceProps["surface"];
  pluginSurfaceRightSurfaces: PluginSurfaceProps["surfaces"];
  preferredServiceSkillResultFileTarget: FilesSurfaceProps["target"];
  rightSurfaceBrowserTitle: string | null;
  rightSurfaceHarnessEnabled: boolean;
  rightSurfaceState: WorkspaceRightSurfaceState;
  rightSurfaceTraceAvailable: boolean;
  rightSurfaceTraceEnabled: boolean;
  runtimeWorkspaceId?: string | null;
  sceneSessionId?: string | null;
  sceneThreadId?: string | null;
  onArticleActionIntent: ArticleEditorRightSurfaceProps["onActionIntent"];
  onArticleMarkdownChange: ArticleEditorRightSurfaceProps["onArticleMarkdownChange"];
  onArticleSelectedObjectChange: ArticleEditorRightSurfaceProps["onSelectedObjectChange"];
  onClosePluginSurface: PluginSurfaceProps["onCloseSurface"];
  onCloseRightSurfaceShell: ShellPanelProps["onClose"];
  onOpenArticlePreviewArtifact: ArticleEditorRightSurfaceProps["onOpenPreviewArtifact"];
  onOpenServiceSkillResultFile?: FilesSurfaceProps["onOpenResultFile"];
  onRightSurfaceBrowserNavigate: BrowserPanelProps["onNavigate"];
  onSelectPluginSurface: PluginSurfaceProps["onSelectSurface"];
  onSelectRightSurfaceTab: (kind: WorkspaceRightSurfaceKind) => void;
}

export function renderWorkspaceRightSurfaceHostRuntime({
  idPrefix,
  onCloseRightSurfaceTab,
  activePluginSurfaceContainerId,
  articleActionsDisabled,
  articleEditorRightSurface,
  browserRightSurfaceAvailable,
  ensureBrowserWorkspaceOwner,
  browserRightSurfaceInitialUrl,
  browserRightSurfaceIntentTitle,
  browserRightSurfaceHistoricalProjection,
  canvasWorkbenchRootPath,
  expertInfoPanelProps,
  filesRightSurfaceAvailable,
  filesRightSurfaceTarget,
  generalWorkbenchHarnessPanelBaseProps,
  harnessState,
  pluginSurfaceRightSurface,
  pluginSurfaceRightSurfaces,
  preferredServiceSkillResultFileTarget,
  rightSurfaceBrowserTitle,
  rightSurfaceHarnessEnabled,
  rightSurfaceState,
  rightSurfaceTraceAvailable,
  rightSurfaceTraceEnabled,
  runtimeWorkspaceId,
  sceneSessionId,
  sceneThreadId,
  onArticleActionIntent,
  onArticleMarkdownChange,
  onArticleSelectedObjectChange,
  onClosePluginSurface,
  onCloseRightSurfaceShell,
  onOpenArticlePreviewArtifact,
  onOpenServiceSkillResultFile,
  onRightSurfaceBrowserNavigate,
  onSelectPluginSurface,
  onSelectRightSurfaceTab,
}: RenderWorkspaceRightSurfaceHostRuntimeParams): {
  content: ReactNode;
  tabStrip: ReactNode;
} {
  const rightSurfaceDefinitions = buildWorkspaceRightSurfaceDefinitions({
    expertInfo: () => <ExpertInfoPanel {...expertInfoPanelProps} />,
    ...(pluginSurfaceRightSurface
      ? {
          appSurface: () => (
            <WorkspacePluginSurface
              activeContainerId={activePluginSurfaceContainerId}
              runtimeOwner={
                sceneSessionId && sceneThreadId
                  ? { sessionId: sceneSessionId, threadId: sceneThreadId }
                  : null
              }
              surfaces={pluginSurfaceRightSurfaces}
              surface={pluginSurfaceRightSurface}
              onCloseSurface={onClosePluginSurface}
              onSelectSurface={onSelectPluginSurface}
            />
          ),
        }
      : {}),
    ...(articleEditorRightSurface
      ? {
          articleWorkspace: () => (
            <WorkspaceArticleEditorRightSurface
              actionsDisabled={articleActionsDisabled}
              articleWorkspace={articleEditorRightSurface}
              onActionIntent={onArticleActionIntent}
              onArticleMarkdownChange={onArticleMarkdownChange}
              onOpenPreviewArtifact={onOpenArticlePreviewArtifact}
              onSelectedObjectChange={onArticleSelectedObjectChange}
            />
          ),
        }
      : {}),
    ...(filesRightSurfaceAvailable
      ? {
          files: () => (
            <ReviewThreadSidePanelTab
              target={filesRightSurfaceTarget}
              projectRootPath={canvasWorkbenchRootPath}
              onOpenResultFile={
                preferredServiceSkillResultFileTarget
                  ? onOpenServiceSkillResultFile
                  : undefined
              }
            />
          ),
        }
      : {}),
    ...(browserRightSurfaceAvailable
      ? {
          browser: {
            label:
              rightSurfaceBrowserTitle ??
              browserRightSurfaceIntentTitle ??
              null,
            render: () => (
              <RightSurfaceBrowserPanel
                active={rightSurfaceState.activeSurface === "browser"}
                ensureOwner={ensureBrowserWorkspaceOwner}
                initialUrl={browserRightSurfaceInitialUrl ?? null}
                runtimeSessionId={sceneSessionId}
                threadId={sceneThreadId || ""}
                onNavigate={onRightSurfaceBrowserNavigate}
                historicalProjection={browserRightSurfaceHistoricalProjection}
              />
            ),
          },
        }
      : {}),
    ...(rightSurfaceHarnessEnabled
      ? {
          harness: () => (
            <GeneralWorkbenchHarnessSurfaceSection
              enabled={rightSurfaceHarnessEnabled}
              harnessState={harnessState}
              {...generalWorkbenchHarnessPanelBaseProps}
            />
          ),
        }
      : {}),
    ...(rightSurfaceTraceAvailable
      ? {
          trace: () => (
            <WorkspaceTraceTab
              enabled={rightSurfaceTraceEnabled}
              sessionId={sceneSessionId}
              workspaceId={runtimeWorkspaceId}
            />
          ),
        }
      : {}),
    shell: () => (
      <TaskCenterShellPanel
        variant="surface"
        projectRootPath={canvasWorkbenchRootPath}
        threadId={sceneThreadId}
        onClose={onCloseRightSurfaceShell}
      />
    ),
  });
  const hasActiveRightSurfaceDefinition = rightSurfaceDefinitions.some(
    (definition) => definition.kind === rightSurfaceState.activeSurface,
  );

  const activeSurface = rightSurfaceState.activeSurface;
  if (!activeSurface || !hasActiveRightSurfaceDefinition)
    return { content: null, tabStrip: null };
  return {
    content: (
      <RightSurfaceHost
        activeSurface={activeSurface}
        definitions={rightSurfaceDefinitions}
        idPrefix={idPrefix}
      />
    ),
    tabStrip: (
      <RightSurfaceTabStrip
        activeSurface={activeSurface}
        definitions={rightSurfaceDefinitions}
        openSurfaces={rightSurfaceState.openSurfaces}
        onSelectSurface={onSelectRightSurfaceTab}
        onCloseSurface={onCloseRightSurfaceTab}
        idPrefix={idPrefix}
      />
    ),
  };
}
