import type { AgentRuntimeFileCheckpointThreadSummary } from "@/lib/api/agentRuntime/sessionTypes";
import type { CodingWorkbenchView } from "@limecloud/agent-runtime-projection";

export interface SessionRuntimeProjectionState {
  key: string;
  sessionId: string;
  firstMessageId: string;
  lastMessageId: string;
  ready: boolean;
}

export interface SessionRuntimeProjectionIdentity {
  key: string;
  sessionId: string;
  firstMessageId: string;
  lastMessageId: string;
  lastTurnId: string;
  lastItemId: string;
}

export interface SessionRuntimeProjectionStatus {
  alreadyReady: boolean;
  appendOnlyMessageUpdate: boolean;
  shouldDefer: boolean;
  ready: boolean;
  shouldUseDeferredProjection: boolean;
}

interface IdentifiableItem {
  id?: string | null;
}

export function buildSessionRuntimeProjectionIdentity({
  sessionId,
  messages,
  turns,
  threadItems,
}: {
  sessionId?: string | null;
  messages: readonly IdentifiableItem[];
  turns: readonly IdentifiableItem[];
  threadItems: readonly IdentifiableItem[];
}): SessionRuntimeProjectionIdentity {
  const resolvedSessionId = sessionId ?? "no-session";
  const firstMessageId = messages[0]?.id ?? "no-first-message";
  const lastMessageId = messages[messages.length - 1]?.id ?? "no-last-message";
  const lastTurnId = turns[turns.length - 1]?.id ?? "no-last-turn";
  const lastItemId = threadItems[threadItems.length - 1]?.id ?? "no-last-item";

  return {
    key: [
      resolvedSessionId,
      firstMessageId,
      lastMessageId,
      lastTurnId,
      lastItemId,
    ].join("|"),
    sessionId: resolvedSessionId,
    firstMessageId,
    lastMessageId,
    lastTurnId,
    lastItemId,
  };
}

export function shouldConsiderSessionRuntimeProjectionDeferral({
  isRestoringSession,
  isSending,
  focusedTimelineItemId,
  pendingA2UIForm,
  messageCount,
  turnCount,
  threadItemCount,
  messageThreshold,
  turnThreshold,
  threadItemThreshold,
}: {
  isRestoringSession: boolean;
  isSending: boolean;
  focusedTimelineItemId?: string | null;
  pendingA2UIForm?: unknown;
  messageCount: number;
  turnCount: number;
  threadItemCount: number;
  messageThreshold: number;
  turnThreshold: number;
  threadItemThreshold: number;
}): boolean {
  const hasHeavySessionRuntimeProjection =
    messageCount >= messageThreshold ||
    turnCount >= turnThreshold ||
    threadItemCount >= threadItemThreshold;

  return (
    isRestoringSession &&
    !isSending &&
    !focusedTimelineItemId &&
    !pendingA2UIForm &&
    hasHeavySessionRuntimeProjection
  );
}

export function resolveSessionRuntimeProjectionStatus({
  currentState,
  identity,
  shouldConsiderDeferring,
}: {
  currentState: SessionRuntimeProjectionState;
  identity: SessionRuntimeProjectionIdentity;
  shouldConsiderDeferring: boolean;
}): SessionRuntimeProjectionStatus {
  const alreadyReady = currentState.key === identity.key && currentState.ready;
  const appendOnlyMessageUpdate =
    currentState.key !== identity.key &&
    currentState.sessionId === identity.sessionId &&
    currentState.firstMessageId === identity.firstMessageId &&
    currentState.lastMessageId !== identity.lastMessageId;
  const shouldDefer =
    shouldConsiderDeferring && !alreadyReady && !appendOnlyMessageUpdate;
  const ready =
    currentState.key === identity.key ? currentState.ready : !shouldDefer;

  return {
    alreadyReady,
    appendOnlyMessageUpdate,
    shouldDefer,
    ready,
    shouldUseDeferredProjection: shouldDefer && !ready,
  };
}

export function buildSessionRuntimeProjectionState(params: {
  key: string;
  sessionId: string;
  firstMessageId: string;
  lastMessageId: string;
  ready: boolean;
}): SessionRuntimeProjectionState {
  return params;
}

export function resolveNextSessionRuntimeProjectionState(
  current: SessionRuntimeProjectionState,
  next: SessionRuntimeProjectionState,
): SessionRuntimeProjectionState {
  return current.key === next.key &&
    current.sessionId === next.sessionId &&
    current.firstMessageId === next.firstMessageId &&
    current.lastMessageId === next.lastMessageId &&
    current.ready === next.ready
    ? current
    : next;
}

export function buildQuotedReplyText({
  content,
  input,
}: {
  content: string;
  input: string;
}): string | null {
  const normalized = content.trim();
  if (!normalized) {
    return null;
  }

  const quotedBlock = `${normalized
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")}\n\n`;

  return input.trim() ? `${input.trimEnd()}\n\n${quotedBlock}` : quotedBlock;
}

export interface SessionRuntimeCounters {
  inProgressItemCount: number;
  generatedFileCount: number;
  hasRuntimeFileChanges: boolean;
  hasRuntimeOutputs: boolean;
  shouldUseRuntimeWorkbench: boolean;
  shouldExposeSessionProgress: boolean;
}

export function buildSessionRuntimeCountersFromCodingProjection({
  codingView,
  fileCheckpointSummary,
  pendingActionCount,
}: {
  codingView: CodingWorkbenchView;
  fileCheckpointSummary?: AgentRuntimeFileCheckpointThreadSummary | null;
  pendingActionCount: number;
}): SessionRuntimeCounters {
  const inProgressItemCount =
    codingView.commands.filter((command) => command.status === "running")
      .length +
    codingView.tests.filter((test) => test.status === "running").length +
    codingView.changes.filter(
      (change) => change.status === "running" || change.status === "pending",
    ).length;
  const generatedFileCount =
    codingView.changes.length || codingView.files.length;
  const hasRuntimeFileChanges =
    (fileCheckpointSummary?.count ?? 0) > 0 || codingView.changes.length > 0;
  const hasRuntimeOutputs =
    codingView.commands.length > 0 ||
    codingView.tests.length > 0 ||
    codingView.actions.length > 0 ||
    codingView.diagnostics.length > 0;
  const shouldUseRuntimeWorkbench =
    hasRuntimeFileChanges ||
    hasRuntimeOutputs ||
    inProgressItemCount > 0 ||
    codingView.mainObject.status === "running" ||
    codingView.mainObject.status === "blocked";

  return {
    inProgressItemCount,
    generatedFileCount,
    hasRuntimeFileChanges,
    hasRuntimeOutputs,
    shouldUseRuntimeWorkbench,
    shouldExposeSessionProgress:
      inProgressItemCount > 0 ||
      pendingActionCount > 0 ||
      codingView.mainObject.status === "running" ||
      codingView.mainObject.status === "blocked",
  };
}
