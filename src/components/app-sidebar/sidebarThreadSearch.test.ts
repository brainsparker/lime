import { describe, expect, it } from "vitest";
import type { AppServerThreadSearchResult } from "@/lib/api/appServerTypes";
import {
  mergeSidebarThreadSearchSessions,
  threadSearchResultToSidebarHit,
} from "./sidebarThreadSearch";

function searchResult(
  overrides: Partial<AppServerThreadSearchResult["thread"]> = {},
  snippet = "found needle",
): AppServerThreadSearchResult {
  return {
    snippet,
    thread: {
      id: "thread-1",
      sessionId: "session-1",
      cliVersion: "0.0.0",
      createdAt: 1_700_000_000,
      cwd: "/work/lime",
      ephemeral: false,
      modelProvider: "openai",
      name: "对话标题",
      preview: "preview",
      projectId: "project-1",
      source: "appServer",
      status: { type: "idle" },
      updatedAt: 1_700_000_100,
      recencyAt: 1_700_000_200,
      ...overrides,
    },
  };
}

describe("sidebar thread search", () => {
  it("用 sessionId 导航，并保留摘要", () => {
    const hit = threadSearchResultToSidebarHit(searchResult());

    expect(hit).toEqual({
      session: {
        id: "session-1",
        thread_id: "thread-1",
        name: "对话标题",
        created_at: 1_700_000_000_000,
        updated_at: 1_700_000_200_000,
        workspace_id: "project-1",
        working_dir: "/work/lime",
      },
      searchSnippet: "found needle",
    });
  });

  it("跳过临时线程、子线程和缺少 sessionId 的结果", () => {
    expect(
      threadSearchResultToSidebarHit(
        searchResult({ ephemeral: true }),
      ),
    ).toBeNull();
    expect(
      threadSearchResultToSidebarHit(
        searchResult({ parentThreadId: "parent-1" }),
      ),
    ).toBeNull();
    expect(
      threadSearchResultToSidebarHit(searchResult({ sessionId: "  " })),
    ).toBeNull();
  });

  it("协议命中优先，标题匹配补上协议没有的对话", () => {
    const protocolHit = threadSearchResultToSidebarHit(searchResult());
    expect(protocolHit).not.toBeNull();

    const sessions = mergeSidebarThreadSearchSessions({
      protocolHits: [protocolHit!],
      titleMatches: [
        {
          id: "session-1",
          name: "旧标题",
          created_at: 1,
          updated_at: 1,
        },
        {
          id: "session-2",
          name: "只有标题",
          created_at: 2,
          updated_at: 2,
        },
      ],
    });

    expect(sessions.map((session) => session.id)).toEqual([
      "session-1",
      "session-2",
    ]);
    expect(sessions[0]?.searchSnippet).toBe("found needle");
    expect(sessions[0]?.name).toBe("对话标题");
    expect(sessions[1]?.searchSnippet).toBeUndefined();
  });
});
