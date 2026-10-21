import type {
  AgentRuntimeFileCheckpointThreadSummary,
  AgentRuntimeThreadReadModel,
} from "@/lib/api/agentRuntime/sessionTypes";
import { projectCodingWorkbenchViewFromEvents } from "@limecloud/agent-runtime-projection";
import type { CanvasWorkbenchChangeView } from "../components/canvas-workbench";
import type {
  ActionRequired,
  AgentThreadItem,
  AgentThreadTurn,
} from "../types";
import {
  buildCanvasWorkbenchChangeViewFromCodingProjection,
  buildSessionRuntimeCountersFromCodingProjection,
  type SessionRuntimeCounters,
} from "./workspaceConversationSceneViewModel";

interface WorkspaceConversationCodingViewsParams {
  turns: readonly AgentThreadTurn[];
  threadItems?: readonly AgentThreadItem[];
  currentTurnId?: string | null;
  threadRead?: AgentRuntimeThreadReadModel | null;
  pendingActions: readonly ActionRequired[];
  isSending?: boolean;
  onOpenFile?: (path: string) => void | Promise<void>;
  onStartReview?: () => Promise<unknown>;
}

interface WorkspaceConversationCodingViews {
  currentSessionTurn: AgentThreadTurn | null;
  counters: SessionRuntimeCounters;
  fileCheckpointSummary: AgentRuntimeFileCheckpointThreadSummary | null;
  changeView: CanvasWorkbenchChangeView | null;
}

function createEmptySessionRuntimeCounters(): SessionRuntimeCounters {
  return {
    shouldUseRuntimeWorkbench: false,
    inProgressItemCount: 0,
    generatedFileCount: 0,
    hasRuntimeFileChanges: false,
    hasRuntimeOutputs: false,
    shouldExposeSessionProgress: false,
  };
}

export function buildWorkspaceConversationCodingViews({
  turns,
  threadItems = [],
  currentTurnId,
  threadRead,
  pendingActions,
  isSending,
  onOpenFile,
  onStartReview,
}: WorkspaceConversationCodingViewsParams): WorkspaceConversationCodingViews {
  const currentSessionTurn =
    turns.find((turn) => turn.id === currentTurnId) || turns.at(-1) || null;
  const hasCodingWorkbenchEvidence =
    Boolean(threadRead) ||
    Boolean(currentSessionTurn?.thread_id) ||
    threadItems.some((item) => item.type === "patch") ||
    pendingActions.length > 0;
  if (!hasCodingWorkbenchEvidence) {
    return {
      currentSessionTurn,
      counters: createEmptySessionRuntimeCounters(),
      fileCheckpointSummary: null,
      changeView: null,
    };
  }

  const fileCheckpointSummary = threadRead?.file_checkpoint_summary || null;
  const codingView = projectCodingWorkbenchViewFromEvents({
    executionEvents: [],
    threadItems,
    codingReadModel: threadRead,
  });
  const counters = buildSessionRuntimeCountersFromCodingProjection({
    codingView,
    fileCheckpointSummary,
    pendingActionCount: pendingActions.length,
  });
  const changeView = buildCanvasWorkbenchChangeViewFromCodingProjection({
    codingView,
    fileCheckpointSummary,
    onOpenFile,
    threadItems,
    reviewThreadId: threadRead?.thread_id ?? currentSessionTurn?.thread_id,
    currentTurnId,
    turnDiff: currentSessionTurn?.unified_diff,
    canInterrupt: Boolean(isSending),
    onStartReview,
  });

  return {
    currentSessionTurn,
    counters,
    fileCheckpointSummary,
    changeView,
  };
}
