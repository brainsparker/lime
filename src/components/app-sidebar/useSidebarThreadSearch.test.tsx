import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarThreadSearch } from "./useSidebarThreadSearch";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const hoisted = vi.hoisted(() => ({
  searchDesktopThreads: vi.fn(),
}));

vi.mock("@/lib/api/threadSearch", () => ({
  searchDesktopThreads: (...args: unknown[]) =>
    hoisted.searchDesktopThreads(...args),
}));

function renderSearch(query: string, enabled = true) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const snapshot: { error?: boolean; snippet?: string } = {};

  function Probe() {
    const search = useSidebarThreadSearch(query, enabled);
    snapshot.error = search.error;
    snapshot.snippet = search.hits[0]?.searchSnippet;
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });
  return {
    snapshot,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useSidebarThreadSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.searchDesktopThreads.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("空白查询不调用 thread/search", () => {
    const view = renderSearch("   ");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(hoisted.searchDesktopThreads).not.toHaveBeenCalled();
    view.unmount();
  });

  it("失败时标记错误，不把空结果当成搜索成功", async () => {
    hoisted.searchDesktopThreads.mockRejectedValue(new Error("rpc down"));
    const view = renderSearch("needle");
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(hoisted.searchDesktopThreads).toHaveBeenCalledWith({
      searchTerm: "needle",
      cursor: null,
    });
    expect(view.snapshot.error).toBe(true);
    expect(view.snapshot.snippet).toBeUndefined();
    view.unmount();
  });
});
