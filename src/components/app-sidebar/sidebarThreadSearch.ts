import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";
import type { AppServerThreadSearchResult } from "@/lib/api/appServerTypes";

export interface SidebarThreadSearchHit {
  session: AgentSessionInfo;
  searchSnippet?: string;
}

export type SidebarSearchSession = AgentSessionInfo & {
  searchSnippet?: string;
};

const MILLISECONDS_THRESHOLD = 100_000_000_000;

export function threadSearchResultToSidebarHit(
  result: AppServerThreadSearchResult,
): SidebarThreadSearchHit | null {
  const sessionId = result.thread.sessionId.trim();
  const threadId = result.thread.id.trim();
  if (!sessionId || !threadId || result.thread.ephemeral) {
    return null;
  }
  if (result.thread.parentThreadId?.trim()) {
    return null;
  }
  const name = result.thread.name?.trim() || result.thread.preview.trim();
  const snippet = result.snippet.trim();
  const workingDir = readThreadCwd(result.thread.cwd);
  return {
    session: {
      id: sessionId,
      thread_id: threadId,
      ...(name ? { name } : {}),
      created_at: protocolTimestampToMillis(result.thread.createdAt),
      updated_at: protocolTimestampToMillis(
        result.thread.recencyAt ?? result.thread.updatedAt,
      ),
      ...(result.thread.projectId?.trim()
        ? { workspace_id: result.thread.projectId.trim() }
        : {}),
      ...(workingDir ? { working_dir: workingDir } : {}),
      ...(result.thread.section
        ? { section: result.thread.section }
        : {}),
    },
    ...(snippet ? { searchSnippet: snippet } : {}),
  };
}

export function mergeSidebarThreadSearchSessions(params: {
  titleMatches: readonly AgentSessionInfo[];
  protocolHits: readonly SidebarThreadSearchHit[];
}): SidebarSearchSession[] {
  const sessions = new Map<string, SidebarSearchSession>();
  for (const hit of params.protocolHits) {
    sessions.set(hit.session.id, {
      ...hit.session,
      ...(hit.searchSnippet ? { searchSnippet: hit.searchSnippet } : {}),
    });
  }
  for (const session of params.titleMatches) {
    if (sessions.has(session.id)) {
      continue;
    }
    sessions.set(session.id, session);
  }
  return [...sessions.values()];
}

function protocolTimestampToMillis(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return Date.now();
  }
  return value < MILLISECONDS_THRESHOLD ? value * 1000 : value;
}

function readThreadCwd(cwd: AppServerThreadSearchResult["thread"]["cwd"]): string {
  return typeof cwd === "string" ? cwd.trim() : "";
}
