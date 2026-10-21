import type { ComponentProps } from "react";
import type {
  AgentRuntimeFileCheckpointThreadSummary,
  AgentRuntimeThreadReadModel,
} from "@/lib/api/agentRuntime/sessionTypes";
import { projectCodingWorkbenchViewFromEvents } from "@limecloud/agent-runtime-projection";
import type { CanvasWorkbenchSessionView } from "../components/CanvasWorkbenchLayout";
import type { CanvasWorkbenchChangeView } from "../components/canvas-workbench";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";
import type {
  ActionRequired,
  AgentThreadItem,
  AgentThreadTurn,
} from "../types";
import {
  buildCanvasWorkbenchChangeViewFromCodingProjection,
  buildSessionSummaryViewModel,
  buildSessionRuntimeCountersFromCodingProjection,
  type SessionRuntimeCounters,
} from "./workspaceConversationSceneViewModel";

interface WorkspaceConversationCodingViewsParams {
  turns: readonly AgentThreadTurn[];
  threadItems?: readonly AgentThreadItem[];
  currentTurnId?: string | null;
  threadRead?: AgentRuntimeThreadReadModel | null;
  canonicalChildren?: ComponentProps<
    typeof ThreadSummaryPanel
  >["canonicalChildren"];
  pendingActions: readonly ActionRequired[];
  isSending?: boolean;
  projectless?: boolean;
  onOpenFile?: (path: string) => void | Promise<void>;
  onFileClick?: (fileName: string, content: string) => void;
  onOpenArtifactFromTimeline?: ComponentProps<
    typeof ThreadSummaryPanel
  >["onOpenArtifactFromTimeline"];
  onOpenSubagentSession?: ComponentProps<
    typeof ThreadSummaryPanel
  >["onOpenSubagentSession"];
  onOpenBackgroundTerminal?: ComponentProps<
    typeof ThreadSummaryPanel
  >["onOpenBackgroundTerminal"];
  onRefreshThread?: ComponentProps<typeof ThreadSummaryPanel>["onRefresh"];
  onOpenPluginDirectory?: () => void;
  onStartReview?: () => Promise<unknown>;
}

interface WorkspaceConversationCodingViews {
  currentSessionTurn: AgentThreadTurn | null;
  counters: SessionRuntimeCounters;
  fileCheckpointSummary: AgentRuntimeFileCheckpointThreadSummary | null;
  sessionView: CanvasWorkbenchSessionView | null;
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
  canonicalChildren = [],
  pendingActions,
  isSending,
  projectless = false,
  onOpenFile,
  onFileClick,
  onOpenArtifactFromTimeline,
  onOpenSubagentSession,
  onOpenBackgroundTerminal,
  onRefreshThread,
  onOpenPluginDirectory,
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
      sessionView: null,
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
  const sessionSummaryView = buildSessionSummaryViewModel({ counters });
  const sessionView: CanvasWorkbenchSessionView | null = sessionSummaryView
    ? {
        ...sessionSummaryView,
        renderPanel: () => (
          <ThreadSummaryPanel
            threadId={threadRead?.thread_id ?? currentSessionTurn?.thread_id}
            projectless={projectless}
            turns={turns}
            threadItems={threadItems}
            canonicalChildren={canonicalChildren}
            onOpenBackgroundTerminal={onOpenBackgroundTerminal}
            onRefresh={onRefreshThread}
            onOpenSubagentSession={onOpenSubagentSession}
            onFileClick={onFileClick}
            onOpenArtifactFromTimeline={onOpenArtifactFromTimeline}
            onOpenPluginDirectory={onOpenPluginDirectory}
          />
        ),
      }
    : null;
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
    sessionView,
    changeView,
  };
}
