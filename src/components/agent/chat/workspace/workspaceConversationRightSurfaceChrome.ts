import type { ReactNode } from "react";
import type { WorkspaceRightSurfaceState } from "./right-surface";
import type { WorkspaceRightSurfaceCoordinatorRuntime } from "./useWorkspaceRightSurfaceCoordinatorRuntime";

export type WorkspaceConversationRightSurfaceAttentionLevel =
  | "idle"
  | "active"
  | "warning";

export interface WorkspaceConversationRightSurfaceChromeRuntime {
  open: boolean;
  content?: ReactNode;
  tabStrip?: ReactNode;
  launcher?: ReactNode;
  showHarnessToggle: boolean;
  harnessPanelVisible: boolean;
  onToggleHarnessPanel?: () => void;
  harnessPendingCount: number;
  harnessAttentionLevel: WorkspaceConversationRightSurfaceAttentionLevel;
  harnessToggleLabel?: string;
}

export interface WorkspaceConversationRightSurfaceSceneProps {
  rightSurfaceOpen: boolean;
  rightSurfaceContent?: ReactNode;
  rightSurfaceTabStrip?: ReactNode;
  rightSurfaceLauncher?: ReactNode;
  showHarnessToggle: boolean;
  harnessPanelVisible: boolean;
  onToggleHarnessPanel?: () => void;
  harnessPendingCount: number;
  harnessAttentionLevel: WorkspaceConversationRightSurfaceAttentionLevel;
  harnessToggleLabel?: string;
}

type WorkspaceConversationRightSurfaceChromeRuntimeInput = Pick<
  WorkspaceRightSurfaceCoordinatorRuntime,
  "rightSurfaceState" | "handleToggleRightSurfaceHarness"
>;

export interface BuildWorkspaceConversationRightSurfaceChromeInput {
  open: boolean;
  content?: ReactNode;
  tabStrip?: ReactNode;
  launcher?: ReactNode;
  rightSurfaceRuntime: WorkspaceConversationRightSurfaceChromeRuntimeInput;
  showHarnessToggle: boolean;
  harnessPendingCount: number;
  harnessAttentionLevel: WorkspaceConversationRightSurfaceAttentionLevel;
  harnessToggleLabel?: string;
  suppressHarnessChrome?: boolean;
}

function isWorkspaceRightSurfaceActive(
  state: Pick<WorkspaceRightSurfaceState, "activeSurface">,
  surface: WorkspaceRightSurfaceState["activeSurface"],
): boolean {
  return state.activeSurface === surface;
}

export function buildWorkspaceConversationRightSurfaceChrome({
  open,
  content,
  tabStrip,
  launcher,
  rightSurfaceRuntime,
  showHarnessToggle,
  harnessPendingCount,
  harnessAttentionLevel,
  harnessToggleLabel,
  suppressHarnessChrome = false,
}: BuildWorkspaceConversationRightSurfaceChromeInput): WorkspaceConversationRightSurfaceChromeRuntime {
  const harnessChromeVisible = !suppressHarnessChrome;

  return {
    open,
    content,
    tabStrip,
    launcher,
    showHarnessToggle: harnessChromeVisible && showHarnessToggle,
    harnessPanelVisible:
      harnessChromeVisible &&
      isWorkspaceRightSurfaceActive(
        rightSurfaceRuntime.rightSurfaceState,
        "harness",
      ),
    onToggleHarnessPanel: rightSurfaceRuntime.handleToggleRightSurfaceHarness,
    harnessPendingCount: harnessChromeVisible ? harnessPendingCount : 0,
    harnessAttentionLevel: harnessChromeVisible
      ? harnessAttentionLevel
      : "idle",
    harnessToggleLabel: harnessChromeVisible ? harnessToggleLabel : undefined,
  };
}

export function buildWorkspaceConversationRightSurfaceSceneProps({
  rightSurfaceChrome,
  utilityActionsVisible,
}: {
  rightSurfaceChrome: WorkspaceConversationRightSurfaceChromeRuntime;
  utilityActionsVisible: boolean;
}): WorkspaceConversationRightSurfaceSceneProps {
  const visible = utilityActionsVisible;
  const action = <T>(value: T | undefined) => (visible ? value : undefined);

  return {
    rightSurfaceOpen: rightSurfaceChrome.open,
    rightSurfaceContent: rightSurfaceChrome.content,
    rightSurfaceTabStrip: rightSurfaceChrome.tabStrip,
    rightSurfaceLauncher: rightSurfaceChrome.launcher,
    showHarnessToggle: visible && rightSurfaceChrome.showHarnessToggle,
    harnessPanelVisible: visible && rightSurfaceChrome.harnessPanelVisible,
    onToggleHarnessPanel: action(rightSurfaceChrome.onToggleHarnessPanel),
    harnessPendingCount: visible ? rightSurfaceChrome.harnessPendingCount : 0,
    harnessAttentionLevel: visible
      ? rightSurfaceChrome.harnessAttentionLevel
      : "idle",
    harnessToggleLabel: action(rightSurfaceChrome.harnessToggleLabel),
  };
}
