import { createContext } from "react";
import type { HarnessFilePreviewResult } from "../components/HarnessStatusPanel";
import type { CanvasWorkbenchChangeView } from "../components/canvas-workbench/changes/CanvasWorkbenchChangesPanelViewModel";

/** 只传递会话工作台已有的 canonical projection，不维护第二份变更状态。 */
export interface ReviewThreadSidePanelProjection {
  readonly changeView?: CanvasWorkbenchChangeView | null;
  readonly workspaceRoot?: string | null;
  readonly loadFilePreview?: (
    path: string,
  ) => Promise<HarnessFilePreviewResult>;
}

export const ReviewThreadSidePanelProjectionContext =
  createContext<ReviewThreadSidePanelProjection | null>(null);
