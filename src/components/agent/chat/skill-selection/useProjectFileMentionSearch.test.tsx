import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectFileMentionSearch } from "./useProjectFileMentionSearch";

const api = vi.hoisted(() => ({ search: vi.fn(), project: vi.fn() }));
vi.mock("@/lib/api/fuzzyFileSearch", () => ({
  searchProjectFiles: api.search,
}));
vi.mock("@/lib/api/project", () => ({ getProject: api.project }));

const cleanup: (() => void)[] = [];
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  api.project.mockImplementation(async (id: string) => ({
    rootPath: `/work/${id}`,
  }));
});
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
  vi.resetAllMocks();
});

function deferred() {
  let resolve!: (value: unknown[]) => void;
  const promise = new Promise<unknown[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function View(props: Parameters<typeof useProjectFileMentionSearch>[0]) {
    const result = useProjectFileMentionSearch(props);
    return (
      <output data-status={result.status}>
        {result.files.map((file) => file.path).join(",")}
      </output>
    );
  }
  const render = (projectId: string | null, query: string, active = true) =>
    act(() => root.render(<View {...{ projectId, query, active }} />));
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return { render, container };
}

async function search() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120);
  });
}

describe("project file suggestions", () => {
  it("查询或项目切换立即移除旧选项，并拒绝迟到的成功结果", async () => {
    const first = deferred();
    const second = deferred();
    api.search
      .mockResolvedValueOnce([{ path: "first.ts" }])
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const view = mount();
    view.render("a", "first");
    await search();
    expect(view.container.textContent).toBe("first.ts");
    view.render("a", "second");
    expect(view.container.textContent).toBe("");
    expect(view.container.querySelector("output")?.dataset.status).toBe(
      "loading",
    );
    await search();
    view.render("b", "second");
    expect(view.container.textContent).toBe("");
    await search();
    await act(async () => second.resolve([{ path: "b.ts" }]));
    await act(async () => first.resolve([{ path: "stale-a.ts" }]));
    expect(view.container.textContent).toBe("b.ts");
    expect(api.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ rootPath: "/work/b", query: "second" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("关闭后迟到错误不得回流；重开使用当前查询", async () => {
    let reject!: (reason: Error) => void;
    api.search
      .mockReturnValueOnce(
        new Promise((_, fail) => {
          reject = fail;
        }),
      )
      .mockResolvedValueOnce([{ path: "current.ts" }]);
    const view = mount();
    view.render("a", "old");
    await search();
    const signal = api.search.mock.calls[0][1].signal as AbortSignal;
    view.render("a", "old", false);
    expect(signal.aborted).toBe(true);
    await act(async () => reject(new Error("late")));
    expect(view.container.querySelector("output")?.dataset.status).toBe("idle");
    view.render("a", "current");
    await search();
    expect(view.container.textContent).toBe("current.ts");
  });

  it("无项目与空查询不搜索；当前错误明确结束 loading", async () => {
    const view = mount();
    view.render(null, "abc");
    await search();
    view.render("a", " ");
    await search();
    expect(api.project).not.toHaveBeenCalled();
    expect(api.search).not.toHaveBeenCalled();
    api.search.mockRejectedValueOnce(new Error("offline"));
    view.render("a", "abc");
    await search();
    expect(view.container.querySelector("output")?.dataset.status).toBe(
      "error",
    );
    expect(view.container.textContent).toBe("");
  });
});
