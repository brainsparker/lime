import type { WorkflowGateState } from "./workflowInputState";

interface ResolveFloatingChromeInsetParams {
  showFloatingInputOverlay: boolean;
  hasCanvasContent: boolean;
  workflowRunState?: "idle" | "auto_running" | "await_user_decision";
  gateStatus?: WorkflowGateState["status"];
}

interface ResolveLayoutBottomSpacingParams extends ResolveFloatingChromeInsetParams {
  contextWorkspaceEnabled: boolean;
}

export function resolveWorkflowFloatingChromeInset({
  showFloatingInputOverlay,
  hasCanvasContent,
  workflowRunState,
  gateStatus,
}: ResolveFloatingChromeInsetParams): string {
  if (!showFloatingInputOverlay) {
    return "0";
  }

  if (hasCanvasContent) {
    if (workflowRunState === "auto_running") {
      return "24px";
    }

    if (gateStatus === "waiting") {
      return "12px";
    }

    return "0";
  }

  if (workflowRunState === "auto_running") {
    return "216px";
  }

  if (gateStatus === "waiting") {
    return "184px";
  }

  return "136px";
}

export function resolveWorkflowLayoutBottomSpacing({
  contextWorkspaceEnabled,
  showFloatingInputOverlay,
  hasCanvasContent,
  workflowRunState,
  gateStatus,
}: ResolveLayoutBottomSpacingParams): {
  shellBottomInset: string;
  messageViewportBottomPadding: string;
} {
  const floatingChromeInset = resolveWorkflowFloatingChromeInset({
    showFloatingInputOverlay,
    hasCanvasContent,
    workflowRunState,
    gateStatus,
  });

  if (!showFloatingInputOverlay) {
    return {
      shellBottomInset: "0",
      messageViewportBottomPadding: "128px",
    };
  }

  if (contextWorkspaceEnabled) {
    return {
      shellBottomInset: "0",
      messageViewportBottomPadding: floatingChromeInset,
    };
  }

  return {
    shellBottomInset: floatingChromeInset,
    messageViewportBottomPadding: "128px",
  };
}
