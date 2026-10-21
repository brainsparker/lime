import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThreadOutputs } from "./useThreadOutputs";
import type { ThreadOutput, ThreadOutputsInput } from "./threadOutputs";

const boundary = vi.hoisted(() => ({ readDirectory: vi.fn() }));
vi.mock("@/lib/api/appServer", () => ({
  AppServerClient: class {
    readDirectory = boundary.readDirectory;
  },
}));
const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
function input(threadId = "thread", count = 1): ThreadOutputsInput {
  const timestamp = "2026-10-20T02:00:00Z";
  return {
    threadId,
    cwd: "/project",
    turns: [
      {
        id: "turn",
        thread_id: threadId,
        status: "completed",
        prompt_text: "",
        started_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
    items: Array.from({ length: count }, (_, index) => ({
      id: `file-${index}`,
      turn_id: "turn",
      thread_id: threadId,
      type: "file_artifact",
      sequence: index,
      status: "completed",
      started_at: timestamp,
      updated_at: timestamp,
      path: `/project/${index}.pdf`,
      source: "tool",
    })),
  };
}
function deferred() {
  let resolve!: (value: {
    result: { entries: Array<{ fileName: string }> };
  }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{
    result: { entries: Array<{ fileName: string }> };
  }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function mount(initial = input()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  let files: readonly ThreadOutput[] = [];
  function Probe({
    value,
    enabled,
  }: {
    value: ThreadOutputsInput;
    enabled: boolean;
  }) {
    files = useThreadOutputs(value, enabled);
    return null;
  }
  const render = (value = initial, enabled = true) =>
    act(() => root.render(<Probe value={value} enabled={enabled} />));
  render();
  return { render, files: () => files };
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  boundary.readDirectory.mockReset();
});
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});
describe("thread output filesystem qualification", () => {
  function website(threadId = "thread") {
    const value = input(threadId, 0);
    value.items = [
      {
        ...input(threadId).items[0],
        type: "agent_message",
        text: "http://localhost:4317/demo",
        id: "website",
        sequence: 0,
      },
    ];
    return value;
  }
  it("website立即显示且不把URL传给文件系统；隐藏或换线程立即失效", () => {
    const view = mount(website());
    expect(view.files()).toMatchObject([
      { type: "website", target: "http://localhost:4317/demo" },
    ]);
    expect(boundary.readDirectory).not.toHaveBeenCalled();
    view.render(website("other"));
    expect(view.files()).toMatchObject([{ threadId: "other" }]);
    view.render(website("other"), false);
    expect(view.files()).toEqual([]);
  });
  it("文件资格查询pending/空目录时保留其他回合website，旧响应不污染新候选", async () => {
    const request = deferred();
    boundary.readDirectory.mockReturnValue(request.promise);
    const mixed = input();
    const other = website("thread");
    mixed.turns = [...mixed.turns, { ...other.turns[0], id: "web-turn" }];
    mixed.items = [...mixed.items, { ...other.items[0], turn_id: "web-turn" }];
    const view = mount(mixed);
    expect(view.files()).toMatchObject([{ type: "website" }]);
    expect(boundary.readDirectory).toHaveBeenCalledExactlyOnceWith({
      path: "/project",
    });
    await act(async () => request.resolve({ result: { entries: [] } }));
    expect(view.files()).toMatchObject([{ type: "website" }]);
    view.render(website("next"));
    expect(view.files()).toMatchObject([{ threadId: "next" }]);
  });
  it("website与本地文件共用前24项预算，文件过滤后按原canonical顺序补足", async () => {
    const value = input("thread", 30);
    const web = website();
    value.turns = [...value.turns, { ...web.turns[0], id: "web" }];
    value.items = [...value.items, { ...web.items[0], turn_id: "web" }];
    const request = deferred();
    boundary.readDirectory.mockReturnValue(request.promise);
    const view = mount(value);
    await act(async () =>
      request.resolve({
        result: {
          entries: Array.from({ length: 29 }, (_, i) => ({
            fileName: `${i + 1}.pdf`,
          })),
        },
      }),
    );
    expect(view.files()).toHaveLength(24);
    expect(view.files()[0]).toMatchObject({ type: "website" });
    expect(view.files().at(-1)).toMatchObject({ path: "/project/23.pdf" });
  });
  it("相同目录的流式投影更新不清空已确认结果或重新查询", async () => {
    const request = deferred();
    boundary.readDirectory.mockReturnValue(request.promise);
    const view = mount();
    view.render(input());
    expect(boundary.readDirectory).toHaveBeenCalledTimes(1);
    await act(async () =>
      request.resolve({ result: { entries: [{ fileName: "0.pdf" }] } }),
    );
    const first = view.files();
    view.render(input());
    expect(view.files()).toBe(first);
    expect(boundary.readDirectory).toHaveBeenCalledTimes(1);
  });
  it("Windows盘符根目录保留绝对路径分隔符", async () => {
    const value = input();
    value.cwd = "C:/";
    const item = value.items[0];
    if (item.type !== "file_artifact") throw new Error("fixture type");
    item.path = "C:/report.pdf";
    const request = deferred();
    boundary.readDirectory.mockReturnValue(request.promise);
    const view = mount(value);
    expect(boundary.readDirectory).toHaveBeenCalledWith({ path: "C:/" });
    await act(async () =>
      request.resolve({ result: { entries: [{ fileName: "report.pdf" }] } }),
    );
    expect("path" in view.files()[0] ? view.files()[0].path : undefined).toBe(
      "C:/report.pdf",
    );
  });
  it("pending不显示未确认文件；目录成功后过滤缺失文件，再取前24项", async () => {
    const request = deferred();
    boundary.readDirectory.mockReturnValue(request.promise);
    const view = mount(input("thread", 30));
    expect(view.files()).toEqual([]);
    await act(async () =>
      request.resolve({
        result: {
          entries: Array.from({ length: 29 }, (_, index) => ({
            fileName: `${index + 1}.pdf`,
          })),
        },
      }),
    );
    expect(view.files()).toHaveLength(24);
    expect("path" in view.files()[0] ? view.files()[0].path : undefined).toBe(
      "/project/1.pdf",
    );
    expect(boundary.readDirectory).toHaveBeenCalledTimes(1);
    expect(boundary.readDirectory).toHaveBeenCalledWith({ path: "/project" });
  });
  it("成功空目录与查询错误不同；错误保留原始来源供Files显示实际错误", async () => {
    const first = deferred();
    boundary.readDirectory.mockReturnValueOnce(first.promise);
    const view = mount();
    await act(async () => first.resolve({ result: { entries: [] } }));
    expect(view.files()).toEqual([]);
    const second = deferred();
    boundary.readDirectory.mockReturnValueOnce(second.promise);
    view.render(input("next"));
    await act(async () => second.reject(new Error("unavailable")));
    expect(view.files()).toMatchObject([
      { path: "/project/0.pdf", threadId: "next" },
    ]);
  });
  it("切线程立即清空目录并拒绝旧响应；隐藏New tab不继续查询", async () => {
    const old = deferred(),
      current = deferred();
    boundary.readDirectory
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const view = mount();
    const next = input("next");
    view.render(next);
    await act(async () =>
      old.resolve({ result: { entries: [{ fileName: "0.pdf" }] } }),
    );
    expect(view.files()).toEqual([]);
    await act(async () =>
      current.resolve({ result: { entries: [{ fileName: "0.pdf" }] } }),
    );
    expect(view.files()[0].threadId).toBe("next");
    view.render(next, false);
    expect(view.files()).toEqual([]);
    expect(boundary.readDirectory).toHaveBeenCalledTimes(2);
  });
});
