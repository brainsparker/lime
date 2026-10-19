import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSidebarSessions } from "./loadSidebarSessions";
import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";

const { listPage, listSections } = vi.hoisted(() => ({
  listPage: vi.fn(),
  listSections: vi.fn(),
}));
vi.mock("@/lib/api/agentRuntime/sessionClient", () => ({
  listRecentThreads: listPage,
}));
vi.mock("@/lib/api/threadSections", () => ({
  listThreadSections: listSections,
  PINNED_THREAD_SECTION: { id: "pinned", name: "Pinned" },
}));
const session = (id: string, workspace_id?: string): AgentSessionInfo => ({
  id,
  name: id,
  created_at: 1,
  updated_at: 1,
  workspace_id,
});

describe("sidebar source paging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listSections.mockResolvedValue([]);
  });

  it("follows an opaque cursor after a short project-only page to fill Recents", async () => {
    listPage
      .mockResolvedValueOnce({
        sessions: [session("project-thread", "project")],
        nextCursor: "opaque-source-page",
      })
      .mockResolvedValueOnce({
        sessions: [session("r1"), session("r2")],
        nextCursor: "next-recents-page",
      });
    const source = await loadSidebarSessions({
      limit: 2,
      projectIds: ["project"],
      projectCwds: [],
    });
    expect(source.loadedRecentCount).toBe(2);
    expect(source.hasMore).toBe(true);
    expect(listPage).toHaveBeenLastCalledWith({
      archived: false,
      limit: 2,
      sectionId: null,
      cursor: "opaque-source-page",
    });
  });

  it("marks a full page exhausted when the server returns no cursor", async () => {
    listPage.mockResolvedValueOnce({
      sessions: [session("r1"), session("r2")],
      nextCursor: null,
    });
    const source = await loadSidebarSessions({
      limit: 2,
      projectIds: [],
      projectCwds: [],
    });
    expect(source.hasMore).toBe(false);
    expect(listPage).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a source repeats its cursor before filling Recents", async () => {
    listPage.mockResolvedValue({
      sessions: [session("project-thread", "project")],
      nextCursor: "stuck-cursor",
    });
    await expect(
      loadSidebarSessions({
        limit: 2,
        projectIds: ["project"],
        projectCwds: [],
      }),
    ).rejects.toThrow("repeated a sidebar source cursor");
    expect(listPage).toHaveBeenCalledTimes(2);
  });
});
