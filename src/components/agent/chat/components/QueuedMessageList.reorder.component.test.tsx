import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuedSubmission } from "@limecloud/app-server-client";
import { QueuedMessageList } from "./QueuedMessageList";

const queueHook = vi.hoisted(() => ({
  useAgentSessionThreadQueue: vi.fn(),
}));
const queueActions = vi.hoisted(() => ({
  deleteThreadQueue: vi.fn(),
  reorderThreadQueue: vi.fn(),
  startThreadQueue: vi.fn(),
  updateThreadQueue: vi.fn(),
}));
vi.mock("../hooks/useAgentSessionThreadQueue", () => queueHook);
vi.mock("@/lib/api/agentRuntime/threadQueueActions", () => queueActions);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

interface QueueState {
  submissions: QueuedSubmission[];
  loading: boolean;
  error: Error | null;
  refresh: ReturnType<typeof vi.fn>;
}

describe("QueuedMessageList canonical reorder", () => {
  const mounted: Array<{
    container: HTMLDivElement;
    root: ReturnType<typeof createRoot>;
  }> = [];

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    queueActions.reorderThreadQueue.mockResolvedValue({});
    queueActions.deleteThreadQueue.mockResolvedValue(true);
    queueActions.startThreadQueue.mockResolvedValue({ id: "turn-1" });
    queueActions.updateThreadQueue.mockResolvedValue({ id: "a" });
  });

  afterEach(() => {
    for (const { container, root } of mounted.splice(0)) {
      act(() => root.unmount());
      container.remove();
    }
    vi.resetAllMocks();
  });

  function richQueue(): QueueState {
    return {
      loading: false,
      error: null,
      refresh: vi.fn(),
      submissions: [
        {
          id: "a",
          clientUserMessageId: "client-a",
          input: [
            {
              type: "text",
              text: "中文🙂",
              text_elements: [{ byteRange: { start: 0, end: 6 } }],
            },
            { type: "image", url: "data:image/png;base64,aW1hZ2U=" },
            { type: "text", text: "保留第二段" },
          ],
        },
        {
          id: "b",
          clientUserMessageId: "client-b",
          input: [
            { type: "text", text: "Review" },
            {
              type: "skill",
              name: "review",
              path: "/workspace/review/SKILL.md",
            },
          ],
        },
        {
          id: "c",
          clientUserMessageId: "client-c",
          input: [
            { type: "mention", name: "README", path: "C:\\fixture\\README.md" },
            { type: "text", text: "查看文件" },
          ],
        },
      ],
    };
  }

  function renderQueue(threadId = "thread-a") {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ container, root });
    act(() => root.render(<QueuedMessageList threadId={threadId} />));
    act(() => action(container, "expand").click());
    return container;
  }

  function rerender(container: HTMLDivElement, threadId = "thread-a") {
    const root = mounted.find((entry) => entry.container === container)!.root;
    act(() => root.render(<QueuedMessageList threadId={threadId} />));
  }

  function row(container: HTMLElement, id: string) {
    return container.querySelector<HTMLDivElement>(
      `[data-submission-id="${id}"]`,
    )!;
  }

  function action(container: HTMLElement, name: string) {
    return container.querySelector<HTMLButtonElement>(
      `[data-queue-action="${name}"]`,
    )!;
  }

  function handle(container: HTMLElement, id: string) {
    return action(row(container, id), "reorder");
  }

  function order(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll("[data-submission-id]"),
      (node) => node.getAttribute("data-submission-id"),
    );
  }

  function transfer() {
    const values = new Map<string, string>();
    return {
      values,
      effectAllowed: "none",
      dropEffect: "none",
      setData: vi.fn((type: string, value: string) => values.set(type, value)),
      getData: vi.fn((type: string) => values.get(type) ?? ""),
    };
  }

  function dragEvent(
    target: HTMLElement,
    type: string,
    dataTransfer: ReturnType<typeof transfer>,
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    target.dispatchEvent(event);
    return event;
  }

  function key(target: HTMLElement, value: string) {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  function deferred() {
    let resolve!: (value?: unknown) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }

  it.each(["drag", "button", "keyboard"])(
    "%s 走同一按 ID 动作，三项富输入不变，显示顺序只接受 canonical readback",
    async (method) => {
      const state = richQueue();
      const original = state.submissions;
      const before = structuredClone(original);
      queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
      const container = renderQueue();
      const data = transfer();
      await act(async () => {
        if (method === "drag") {
          dragEvent(handle(container, "c"), "dragstart", data);
          expect(data.effectAllowed).toBe("move");
          expect(data.setData).toHaveBeenCalledTimes(1);
          expect(
            dragEvent(row(container, "b"), "dragover", data).defaultPrevented,
          ).toBe(true);
          expect(data.dropEffect).toBe("move");
          dragEvent(row(container, "b"), "drop", data);
        } else if (method === "button") {
          action(row(container, "c"), "move-up").click();
        } else {
          handle(container, "c").focus();
          key(handle(container, "c"), "ArrowUp");
        }
      });

      expect(queueActions.reorderThreadQueue).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread-a",
        queuedSubmissionIds: ["a", "c", "b"],
      });
      expect(order(container)).toEqual(["a", "b", "c"]);
      expect(state.refresh).toHaveBeenCalledTimes(1);
      expect(original).toEqual(before);
      expect(queueActions.updateThreadQueue).not.toHaveBeenCalled();
      expect(queueActions.deleteThreadQueue).not.toHaveBeenCalled();
      expect(queueActions.startThreadQueue).not.toHaveBeenCalled();
      state.submissions = [original[0], original[2], original[1]];
      rerender(container);
      expect(order(container)).toEqual(["a", "c", "b"]);
      state.submissions.forEach((submission) =>
        expect(submission).toBe(
          original.find((item) => item.id === submission.id),
        ),
      );
    },
  );

  it.each(["same-position", "dragend", "Escape", "collapse", "external"])(
    "%s 取消或未声明的拖拽不发请求",
    async (reason) => {
      queueHook.useAgentSessionThreadQueue.mockReturnValue(richQueue());
      const container = renderQueue();
      const data = transfer();
      await act(async () => {
        if (reason !== "external")
          dragEvent(handle(container, "a"), "dragstart", data);
        if (reason === "dragend")
          dragEvent(handle(container, "a"), "dragend", data);
        if (reason === "Escape") key(handle(container, "a"), "Escape");
        if (reason === "collapse") {
          action(container, "collapse").click();
        }
      });
      if (reason === "collapse") act(() => action(container, "expand").click());
      await act(async () => {
        dragEvent(
          row(container, reason === "same-position" ? "a" : "c"),
          "drop",
          data,
        );
      });
      expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
      expect(order(container)).toEqual(["a", "b", "c"]);
      expect(
        container.querySelector('[data-queue-dragging="true"]'),
      ).toBeNull();
    },
  );

  it.each(["tampered", "empty", "unreadable", "unwritable"])(
    "DataTransfer %s 不构成有效原始拖拽身份",
    async (reason) => {
      queueHook.useAgentSessionThreadQueue.mockReturnValue(richQueue());
      const container = renderQueue();
      const data = transfer();
      if (reason === "unwritable")
        data.setData.mockImplementation(() => {
          throw new Error("blocked");
        });
      await act(async () => {
        const start = dragEvent(handle(container, "a"), "dragstart", data);
        if (reason === "unwritable") expect(start.defaultPrevented).toBe(true);
        if (reason === "tampered")
          for (const type of data.values.keys())
            data.values.set(type, "foreign-thread");
        if (reason === "empty") data.values.clear();
        if (reason === "unreadable")
          data.getData.mockImplementation(() => {
            throw new Error("blocked");
          });
        dragEvent(row(container, "c"), "drop", data);
      });
      expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    },
  );

  it("内部重排的 drop 由队列消费，外部拖拽继续留给既有附件 owner", async () => {
    queueHook.useAgentSessionThreadQueue.mockReturnValue(richQueue());
    const container = renderQueue();
    const outerDrop = vi.fn();
    document.body.addEventListener("drop", outerDrop);
    try {
      const data = transfer();
      await act(async () => {
        dragEvent(handle(container, "a"), "dragstart", data);
        dragEvent(row(container, "c"), "drop", data);
      });
      expect(outerDrop).not.toHaveBeenCalled();
      await act(async () => dragEvent(row(container, "c"), "drop", transfer()));
      expect(outerDrop).toHaveBeenCalledTimes(1);
      expect(queueActions.reorderThreadQueue).toHaveBeenCalledTimes(1);
    } finally {
      document.body.removeEventListener("drop", outerDrop);
    }
  });

  it.each([
    "source-removed",
    "destination-removed",
    "order-changed",
    "added",
    "new-snapshot",
    "loading",
    "error",
  ])("拖拽后 %s 使原快照失效，不能向旧目标提交", async (change) => {
    const state = richQueue();
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    const oldDestination = row(container, "c");
    const data = transfer();
    act(() => dragEvent(handle(container, "a"), "dragstart", data));
    if (change === "source-removed") state.submissions.splice(0, 1);
    if (change === "destination-removed") state.submissions.splice(2, 1);
    if (change === "order-changed") state.submissions.reverse();
    if (change === "added")
      state.submissions.push({
        id: "d",
        clientUserMessageId: "client-d",
        input: [{ type: "text", text: "新消息" }],
      });
    if (change === "new-snapshot") state.submissions = [...state.submissions];
    if (change === "loading") state.loading = true;
    if (change === "error") state.error = new Error("stale");
    rerender(container);
    await act(async () =>
      dragEvent(row(container, "c") ?? oldDestination, "drop", data),
    );
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it.each(["loading", "error", "single"])(
    "%s 时不能开始 drag 或键盘重排",
    async (condition) => {
      const state = richQueue();
      if (condition === "loading") state.loading = true;
      if (condition === "error") state.error = new Error("offline");
      if (condition === "single") state.submissions = [state.submissions[0]];
      queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
      const container = renderQueue();
      const source = handle(container, "a");
      const data = transfer();
      await act(async () => {
        expect(source.disabled).toBe(true);
        expect(source.draggable).toBe(false);
        expect(dragEvent(source, "dragstart", data).defaultPrevented).toBe(
          true,
        );
        key(source, "ArrowDown");
      });
      expect(data.setData).not.toHaveBeenCalled();
      expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    },
  );

  it("请求在途同步拒绝第二次 drop、键盘、按钮与其他 mutation", async () => {
    const pending = deferred();
    queueActions.reorderThreadQueue.mockReturnValueOnce(pending.promise);
    const state = richQueue();
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    const data = transfer();
    act(() => {
      dragEvent(handle(container, "a"), "dragstart", data);
      dragEvent(row(container, "c"), "drop", data);
      dragEvent(row(container, "b"), "drop", data);
      key(handle(container, "b"), "ArrowDown");
      action(row(container, "b"), "move-down").click();
      action(row(container, "b"), "delete").click();
      action(row(container, "b"), "start").click();
    });
    expect(queueActions.reorderThreadQueue).toHaveBeenCalledTimes(1);
    expect(queueActions.deleteThreadQueue).not.toHaveBeenCalled();
    expect(queueActions.startThreadQueue).not.toHaveBeenCalled();
    expect(order(container)).toEqual(["a", "b", "c"]);
    const blocked = transfer();
    act(() => {
      expect(
        dragEvent(handle(container, "b"), "dragstart", blocked)
          .defaultPrevented,
      ).toBe(true);
    });
    expect(blocked.setData).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it("其他 mutation 开始并结束后也不能重用之前的 drag snapshot", async () => {
    const pending = deferred();
    queueActions.deleteThreadQueue.mockReturnValueOnce(pending.promise);
    queueHook.useAgentSessionThreadQueue.mockReturnValue(richQueue());
    const container = renderQueue();
    const data = transfer();
    act(() => {
      dragEvent(handle(container, "a"), "dragstart", data);
      action(row(container, "b"), "delete").click();
      dragEvent(row(container, "c"), "drop", data);
    });
    await act(async () => pending.resolve());
    await act(async () => dragEvent(row(container, "c"), "drop", data));
    expect(queueActions.deleteThreadQueue).toHaveBeenCalledTimes(1);
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
  });

  it("重排失败保留原序和富输入，错误后可通过新 drag 重试", async () => {
    queueActions.reorderThreadQueue.mockRejectedValueOnce(new Error("offline"));
    const state = richQueue();
    const original = structuredClone(state.submissions);
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    await act(async () => {
      handle(container, "b").focus();
      key(handle(container, "b"), "ArrowUp");
    });
    expect(order(container)).toEqual(["a", "b", "c"]);
    expect(state.submissions).toEqual(original);
    expect(state.refresh).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      "agentChat.threadQueue.actionFailed",
    );
    expect(handle(container, "b").disabled).toBe(false);
    expect(document.activeElement).toBe(handle(container, "b"));
    const data = transfer();
    await act(async () => {
      dragEvent(handle(container, "b"), "dragstart", data);
      dragEvent(row(container, "a"), "drop", data);
    });
    expect(queueActions.reorderThreadQueue).toHaveBeenCalledTimes(2);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(
      "agentChat.threadQueue.actionFailed",
    );
  });

  it("跨 thread A→B→A 后拒绝旧 transfer，新的有效 drag 仍可提交", async () => {
    const stateA = richQueue();
    const stateB = richQueue();
    queueHook.useAgentSessionThreadQueue.mockImplementation(
      ({ threadId }: { threadId: string }) =>
        threadId === "thread-a" ? stateA : stateB,
    );
    const container = renderQueue();
    const data = transfer();
    act(() => dragEvent(handle(container, "a"), "dragstart", data));
    for (const threadId of ["thread-b", "thread-a"]) {
      rerender(container, threadId);
      act(() => action(container, "expand").click());
      await act(async () => dragEvent(row(container, "c"), "drop", data));
    }
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    const fresh = transfer();
    act(() => dragEvent(handle(container, "a"), "dragstart", fresh));
    await act(async () => dragEvent(row(container, "c"), "drop", data));
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    act(() => dragEvent(handle(container, "a"), "dragstart", fresh));
    await act(async () => dragEvent(row(container, "c"), "drop", fresh));
    expect(queueActions.reorderThreadQueue).toHaveBeenCalledExactlyOnceWith({
      threadId: "thread-a",
      queuedSubmissionIds: ["b", "c", "a"],
    });
  });

  it.each(["success", "failure"])(
    "旧 A 的重排迟到 %s 不影响新 A 的编辑、错误或 refresh",
    async (outcome) => {
      const pending = deferred();
      queueActions.reorderThreadQueue.mockReturnValueOnce(pending.promise);
      let currentA = richQueue();
      const oldA = currentA;
      queueHook.useAgentSessionThreadQueue.mockImplementation(
        ({ threadId }: { threadId: string }) =>
          threadId === "thread-a" ? currentA : richQueue(),
      );
      const container = renderQueue();
      act(() => key(handle(container, "a"), "ArrowDown"));
      rerender(container, "thread-b");
      currentA = richQueue();
      rerender(container);
      act(() => action(container, "expand").click());
      act(() => action(row(container, "a"), "edit").click());
      const editor = container.querySelector("textarea")!;
      editor.focus();
      await act(async () =>
        outcome === "success"
          ? pending.resolve()
          : pending.reject(new Error("old A")),
      );
      expect(container.querySelector("textarea")).toBe(editor);
      expect(editor.disabled).toBe(false);
      expect(document.activeElement).toBe(editor);
      expect(container.textContent).not.toContain(
        "agentChat.threadQueue.actionFailed",
      );
      expect(oldA.refresh).not.toHaveBeenCalled();
      expect(currentA.refresh).not.toHaveBeenCalled();
    },
  );

  it("方向键边界不提交，读回后的焦点继续绑定原 submission 而非原索引", async () => {
    const state = richQueue();
    const original = state.submissions;
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    const source = handle(container, "c");
    expect(source.getAttribute("aria-label")).toContain(
      "agentChat.threadQueue.moveUp",
    );
    expect(source.getAttribute("aria-keyshortcuts")).toBe("ArrowUp ArrowDown");
    source.focus();
    await act(async () => {
      key(source, "ArrowDown");
      key(handle(container, "a"), "ArrowUp");
    });
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    await act(async () => key(source, "ArrowUp"));
    state.loading = true;
    state.submissions = [];
    rerender(container);
    expect(document.activeElement).not.toBe(source);
    state.loading = false;
    state.submissions = [original[0], original[2], original[1]];
    rerender(container);
    expect(order(container)).toEqual(["a", "c", "b"]);
    expect(document.activeElement).toBe(handle(container, "c"));
  });

  it("等待 readback 时用户改聚焦其他控件，完成不得抢走焦点", async () => {
    const state = richQueue();
    const original = state.submissions;
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    handle(container, "a").focus();
    await act(async () => key(handle(container, "a"), "ArrowDown"));
    const expand = action(container, "collapse");
    expand.focus();
    state.submissions = [original[1], original[0], original[2]];
    rerender(container);
    expect(document.activeElement).toBe(expand);
  });
});
