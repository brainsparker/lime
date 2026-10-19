import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";
import { isAuxiliaryAgentSessionId } from "@/lib/api/agentRuntime/sessionIdentity";
import { resolveSidebarSessionTitle } from "./sidebarSessionFormatting";

export function buildSidebarSessionRequestLimit(
  visibleCount: number,
  pageSize: number,
): number {
  const normalizedVisibleCount = Math.max(visibleCount, pageSize);
  return normalizedVisibleCount + 1;
}

export function hasCachedSidebarSessionEntry(
  sessions: AgentSessionInfo[],
  sessionId?: string | null,
): boolean {
  const normalizedSessionId = sessionId?.trim();
  if (!normalizedSessionId) {
    return false;
  }

  return sessions.some((session) => session.id === normalizedSessionId);
}

export function filterSidebarSessions(
  sessions: AgentSessionInfo[],
): AgentSessionInfo[] {
  return sessions.filter((session) => !isAuxiliaryAgentSessionId(session.id));
}

export function buildVisibleSidebarSessions(params: {
  sessions: AgentSessionInfo[];
  currentSessionId?: string | null;
  limit: number;
  hasMore?: boolean;
}): AgentSessionInfo[] {
  const { sessions, currentSessionId, limit, hasMore = false } = params;
  if (limit <= 0) {
    return [];
  }

  if (sessions.length <= limit) {
    return sessions;
  }

  const visibleSessions = sessions.slice(0, limit);
  const normalizedCurrentSessionId = currentSessionId?.trim();
  const currentSession = sessions
    .slice(limit)
    .find((session) => session.id === normalizedCurrentSessionId);
  if (currentSession) visibleSessions.push(currentSession);
  return !hasMore && sessions.length - visibleSessions.length === 1
    ? sessions
    : visibleSessions;
}

export function normalizeSidebarSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesSidebarSessionTitle(
  session: AgentSessionInfo,
  normalizedQuery: string,
  fallbackTitle: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }

  return normalizeSidebarSearchText(
    resolveSidebarSessionTitle(session, fallbackTitle),
  ).includes(normalizedQuery);
}
