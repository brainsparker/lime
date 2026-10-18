import { Children, type ReactNode } from "react";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import { LayoutTransition } from "@/components/workspace/layout/LayoutTransition";
import {
  MainArea,
  GeneralWorkbenchInputOverlay,
  GeneralWorkbenchLayoutShell,
  RIGHT_SURFACE_CHAT_PANEL_WIDTH,
} from "./WorkspaceStyles";

interface WorkspaceMainAreaProps {
  compactChrome: boolean;
  mainToolbar?: ReactNode;
  mainTabLabel?: string;
  sidePanelTabStrip?: ReactNode;
  taskCenterShellPanelNode?: ReactNode;
  contentSyncNoticeNode: ReactNode;
  shellBottomInset: string;
  layoutMode: LayoutMode;
  forceCanvasMode: boolean;
  chatContent: ReactNode;
  canvasContent: ReactNode;
  rightSurfaceContent?: ReactNode;
  chatPanelWidth?: string;
  generalWorkbenchDialog: ReactNode;
  showFloatingInputOverlay: boolean;
  hasPendingA2UIForm: boolean;
  inputbarNode: ReactNode;
  inputContentShift?: number;
}

export function WorkspaceMainArea({
  compactChrome,
  mainToolbar,
  mainTabLabel,
  sidePanelTabStrip,
  taskCenterShellPanelNode,
  contentSyncNoticeNode,
  shellBottomInset,
  layoutMode,
  forceCanvasMode,
  chatContent,
  canvasContent,
  rightSurfaceContent,
  chatPanelWidth,
  generalWorkbenchDialog,
  showFloatingInputOverlay,
  hasPendingA2UIForm,
  inputbarNode,
  inputContentShift = 0,
}: WorkspaceMainAreaProps) {
  const hasRightSurfaceContent = Children.count(rightSurfaceContent) > 0;
  const useRightSurfaceWidth = hasRightSurfaceContent && !chatPanelWidth;
  const effectiveCanvasContent = hasRightSurfaceContent
    ? rightSurfaceContent
    : canvasContent;
  const effectiveLayoutMode = hasPendingA2UIForm
    ? "chat"
    : hasRightSurfaceContent
      ? "chat-canvas"
      : forceCanvasMode
        ? "canvas"
        : layoutMode;

  return (
    <MainArea
      $compact={compactChrome}
      $taskCenterSurface
      data-testid="workspace-main-area"
      data-layout-mode={effectiveLayoutMode}
      data-has-right-surface={hasRightSurfaceContent ? "true" : "false"}
      data-floating-input-overlay={showFloatingInputOverlay ? "true" : "false"}
    >
      {contentSyncNoticeNode}
      <GeneralWorkbenchLayoutShell
        $bottomInset={shellBottomInset}
        $taskCenterSurface
      >
        <LayoutTransition
          mode={effectiveLayoutMode}
          mainToolbar={mainToolbar}
          mainTabLabel={mainTabLabel}
          sidePanelTabStrip={
            hasRightSurfaceContent ? sidePanelTabStrip : undefined
          }
          chatContent={chatContent}
          canvasContent={effectiveCanvasContent}
          chatPanelWidth={
            useRightSurfaceWidth
              ? RIGHT_SURFACE_CHAT_PANEL_WIDTH
              : chatPanelWidth
          }
          forceOpenChatPanel={hasPendingA2UIForm}
        />
      </GeneralWorkbenchLayoutShell>
      {generalWorkbenchDialog}
      {showFloatingInputOverlay ? (
        <GeneralWorkbenchInputOverlay
          style={{ transform: `translateX(${inputContentShift}px)` }}
          $bottomInset={shellBottomInset}
          data-testid="general-workbench-input-overlay"
          data-action-owner="composer"
          data-bottom-inset={shellBottomInset}
        >
          {inputbarNode}
        </GeneralWorkbenchInputOverlay>
      ) : null}
      {taskCenterShellPanelNode}
    </MainArea>
  );
}
