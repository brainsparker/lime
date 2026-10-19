import { listRecentThreads } from "@/lib/api/agentRuntime/sessionClient";
import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";
import { listThreadSections } from "@/lib/api/threadSections";
import {
  sessionBelongsToProject,
  type SidebarOpenedProjectSummary,
} from "./sidebarConversationGroups";
import { filterSidebarSessions } from "./sidebarSessions";

export async function loadSidebarSessions({
  limit,
  projectIds,
  projectCwds,
}: {
  limit: number;
  projectIds: string[];
  projectCwds: string[];
}) {
  const projects: SidebarOpenedProjectSummary[] = [
    ...projectIds.map((id) => ({ id, name: id })),
    ...projectCwds.map((rootPath) => ({
      id: rootPath,
      name: rootPath,
      rootPath,
    })),
  ];
  const loadSource = async (sectionId: string | null, cwd?: string) => {
    const sessionsById = new Map<string, AgentSessionInfo>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const page = await listRecentThreads({
        archived: false,
        limit,
        sectionId,
        ...(cwd ? { cwd } : {}),
        ...(cursor ? { cursor } : {}),
        ...(sectionId ? { sortKey: "section_position" } : {}),
      });
      for (const session of page.sessions)
        sessionsById.set(session.id, session);
      const sessions = filterSidebarSessions([...sessionsById.values()]);
      const standaloneCount = sessions.filter(
        (session) =>
          !projects.some((project) =>
            sessionBelongsToProject(session, project),
          ),
      ).length;
      if (!page.nextCursor || sectionId || cwd || standaloneCount >= limit) {
        return {
          sessions,
          standaloneCount,
          hasMore: page.nextCursor !== null,
        };
      }
      if (seenCursors.has(page.nextCursor)) {
        throw new Error("thread/list repeated a sidebar source cursor");
      }
      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
  };
  const sections = await listThreadSections();
  const [recents, ...groups] = await Promise.all([
    loadSource(null),
    ...sections.map(({ id: sectionId }) => loadSource(sectionId)),
    ...projectCwds.map((cwd) => loadSource(null, cwd)),
  ]);
  return {
    sessionGroups: [recents.sessions, ...groups.map((group) => group.sessions)],
    loadedRecentCount: recents.standaloneCount,
    hasMore: recents.hasMore,
  };
}
