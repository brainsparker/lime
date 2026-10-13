import type { AgentThreadTurn } from "@/lib/api/agentProtocol";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import { hasActiveThreadReadActivity } from "../projection/threadReadActivity";

export interface AgentStreamResumeBindingTarget {
  eventName: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  startedAt?: string | null;
}

interface ResolveAgentStreamResumeBindingTargetOptions {
  currentTurnId?: string | null;
  sessionId?: string | null;
  threadBusy: boolean;
  threadRead?: AgentRuntimeThreadReadModel | null;
  threadTurns: readonly AgentThreadTurn[];
}

export function normalizeNonEmpty(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isExplicitTerminalStatus(value?: string | null): boolean {
  const normalized = normalizeNonEmpty(value)?.toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "aborted"
  );
}

export function normalizeRealTurnId(value?: string | null): string | null {
  const normalized = normalizeNonEmpty(value);
  if (!normalized || normalized.startsWith("pending-turn:")) {
    return null;
  }
  return normalized;
}

export function resolveAgentStreamResumeBindingTarget(
  options: ResolveAgentStreamResumeBindingTargetOptions,
): AgentStreamResumeBindingTarget | null {
  const sessionId = normalizeNonEmpty(options.sessionId);
  if (!sessionId || !options.threadBusy) {
    return null;
  }
  if (
    isExplicitTerminalStatus(options.threadRead?.status) ||
    isExplicitTerminalStatus(options.threadRead?.profile_status)
  ) {
    return null;
  }

  if (!hasActiveThreadReadActivity(options.threadRead)) {
    return null;
  }

  const turnId =
    normalizeRealTurnId(options.threadRead?.active_turn_id) ??
    normalizeRealTurnId(
      (
        options.threadRead as
          | { activeTurnId?: string | null }
          | null
          | undefined
      )?.activeTurnId,
    );
  if (!turnId) {
    return null;
  }
  const runningThreadTurn = options.threadTurns.find(
    (turn) => normalizeRealTurnId(turn.id) === turnId,
  );

  return {
    eventName: `agentSession/event/${sessionId}`,
    sessionId,
    threadId:
      normalizeNonEmpty(runningThreadTurn?.thread_id) ??
      normalizeNonEmpty(options.threadRead?.thread_id) ??
      sessionId,
    turnId,
    startedAt: runningThreadTurn?.started_at ?? null,
  };
}
