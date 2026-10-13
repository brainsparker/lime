import { describe, expect, it, vi } from "vitest";
import { APP_SERVER_CLIENT_METHODS } from "@/lib/api/appServerClientMethodSpecs";
import { APP_SERVER_METHOD_THREAD_SEARCH } from "@/lib/api/appServerConstants";
import {
  DESKTOP_THREAD_SEARCH_SOURCE_KINDS,
  searchDesktopThreads,
} from "@/lib/api/threadSearch";

describe("searchDesktopThreads", () => {
  it("显式搜索桌面 appServer 与 Codex 交互来源", async () => {
    const client = {
      searchThreads: vi.fn().mockResolvedValue({
        result: { data: [], nextCursor: null },
      }),
    };

    await searchDesktopThreads({ searchTerm: "  needle  " }, client);

    expect(client.searchThreads).toHaveBeenCalledWith({
      searchTerm: "needle",
      cursor: null,
      limit: 25,
      sortKey: "recency_at",
      sortDirection: "desc",
      archived: false,
      sourceKinds: [...DESKTOP_THREAD_SEARCH_SOURCE_KINDS],
    });
    expect(DESKTOP_THREAD_SEARCH_SOURCE_KINDS).toEqual([
      "appServer",
      "cli",
      "vscode",
    ]);
  });

  it("空白 searchTerm fail closed，不调用 thread/search", async () => {
    const client = { searchThreads: vi.fn() };

    await expect(
      searchDesktopThreads({ searchTerm: "   " }, client),
    ).rejects.toThrow("non-empty searchTerm");
    expect(client.searchThreads).not.toHaveBeenCalled();
  });

  it("客户端方法规格指向 thread/search", () => {
    expect(APP_SERVER_CLIENT_METHODS).toContainEqual({
      name: "searchThreads",
      method: APP_SERVER_METHOD_THREAD_SEARCH,
      params: "required",
    });
    expect(APP_SERVER_METHOD_THREAD_SEARCH).toBe("thread/search");
  });
});
