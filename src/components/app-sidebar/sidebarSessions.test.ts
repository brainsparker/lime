import { describe, expect, it } from "vitest";
import type { AgentSessionInfo } from "@/lib/api/agentRuntime/sessionTypes";
import {
  buildVisibleSidebarSessions,
  filterSidebarSessions,
} from "./sidebarSessions";

function session(
  id: string,
  overrides: Partial<AgentSessionInfo> = {},
): AgentSessionInfo {
  return {
    id,
    name: id,
    created_at: 1,
    updated_at: 1,
    archived_at: null,
    ...overrides,
  };
}

describe("sidebarSessions", () => {
  it("keeps the first page intact and appends an active item outside it", () => {
    const sessions = Array.from({ length: 15 }, (_, index) =>
      session(`r${index}`),
    );
    expect(
      buildVisibleSidebarSessions({
        sessions,
        limit: 10,
        currentSessionId: "r14",
        hasMore: true,
      }).map((item) => item.id),
    ).toEqual([...sessions.slice(0, 10).map((item) => item.id), "r14"]);
  });

  it("reveals a single remaining item only when the source has no next page", () => {
    const sessions = Array.from({ length: 11 }, (_, index) =>
      session(`r${index}`),
    );
    expect(buildVisibleSidebarSessions({ sessions, limit: 10 })).toEqual(
      sessions,
    );
    expect(
      buildVisibleSidebarSessions({ sessions, limit: 10, hasMore: true }),
    ).toEqual(sessions.slice(0, 10));
  });
  it("保持 App Server 顺序，并容忍缺少 id 或时间字段的记录", () => {
    const staleShape = {
      name: "旧形状会话",
      archived_at: null,
    } as unknown as AgentSessionInfo;

    expect(() =>
      filterSidebarSessions([
        session("older", { updated_at: 10, created_at: 10 }),
        staleShape,
        session("newer", { updated_at: 20, created_at: 20 }),
      ]),
    ).not.toThrow();

    expect(
      filterSidebarSessions([
        session("older", { updated_at: 10, created_at: 10 }),
        staleShape,
        session("newer", { updated_at: 20, created_at: 20 }),
      ]).map((item) => item.id || item.name),
    ).toEqual(["older", "旧形状会话", "newer"]);
  });
});
