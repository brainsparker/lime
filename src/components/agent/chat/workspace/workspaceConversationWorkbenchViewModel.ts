import type { AgentRuntimeFileCheckpointThreadSummary } from "@/lib/api/agentRuntime/sessionTypes";
import type { AgentThreadItem } from "@/lib/api/agentProtocolCoreTypes";
import type { CodingWorkbenchView } from "@limecloud/agent-runtime-projection";
import type {
  CanvasWorkbenchChangeItem,
  CanvasWorkbenchChangeView,
} from "../components/canvas-workbench/changes/CanvasWorkbenchChangesPanelViewModel";
import { extractFileNameFromPath } from "./workspacePath";
import { parseCanvasWorkbenchPatchDiffLines } from "../components/canvas-workbench/changes/CanvasWorkbenchChangesPanelViewModel";

function statusForCanvasChange(
  status: string,
): CanvasWorkbenchChangeItem["status"] {
  if (status === "running" || status === "pending") return "in_progress";
  if (status === "failed") return "failed";
  return "completed";
}

export function buildCanvasWorkbenchChangeViewFromCodingProjection({
  codingView,
  fileCheckpointSummary,
  onOpenFile,
  threadItems,
  reviewThreadId,
  currentTurnId,
  turnDiff,
  canInterrupt,
  onStartReview,
}: {
  codingView: CodingWorkbenchView;
  fileCheckpointSummary?: AgentRuntimeFileCheckpointThreadSummary | null;
  onOpenFile?: (path: string) => void | Promise<void>;
  threadItems?: readonly AgentThreadItem[];
  reviewThreadId?: string | null;
  currentTurnId?: string | null;
  turnDiff?: string;
  canInterrupt?: boolean;
  onStartReview?: () => Promise<unknown>;
}): CanvasWorkbenchChangeView | null {
  const items = codingView.changes.map(
    (change): CanvasWorkbenchChangeItem => ({
      id: change.id,
      path: change.path,
      destinationPath: change.destinationPath,
      displayName: change.destinationPath
        ? `${extractFileNameFromPath(change.path)} -> ${extractFileNameFromPath(
            change.destinationPath,
          )}`
        : extractFileNameFromPath(change.path),
      source: "runtime",
      status: statusForCanvasChange(change.status),
      changeKind: change.changeKind,
      preview: change.preview,
      diffLines:
        change.diff !== undefined
          ? parseCanvasWorkbenchPatchDiffLines(change.diff)
          : undefined,
      checkpointPath: change.checkpointRef || null,
      checkpointLabel: change.checkpointRef ? "snapshot" : null,
    }),
  );
  if (
    items.length === 0 &&
    !reviewThreadId &&
    !(fileCheckpointSummary?.count ?? 0) &&
    turnDiff === undefined
  ) {
    return null;
  }
  const latestCheckpoint = fileCheckpointSummary?.latest_checkpoint || null;
  return {
    items,
    checkpointCount: fileCheckpointSummary?.count ?? 0,
    latestCheckpointPath:
      latestCheckpoint?.snapshot_path || latestCheckpoint?.path || null,
    onOpenFile,
    threadItems,
    reviewThreadId,
    currentTurnId,
    turnDiff,
    canInterrupt,
    onStartReview,
  };
}
