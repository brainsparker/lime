import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueuedSubmission, UserInput } from "@limecloud/app-server-client";
import { QueuedMessageList } from "./QueuedMessageList";

const queueHook = vi.hoisted(() => ({
  useAgentSessionThreadQueue: vi.fn(),
}));
const queueActions = vi.hoisted(() => ({
  deleteThreadQueue: vi.fn().mockResolvedValue(true),
  reorderThreadQueue: vi.fn().mockResolvedValue({}),
  startThreadQueue: vi.fn().mockResolvedValue({ id: "turn-1" }),
  updateThreadQueue: vi.fn().mockResolvedValue({ id: "queued-1" }),
}));
const mediaClient = vi.hoisted(() => ({ readMedia: vi.fn() }));
vi.mock("@/lib/api/appServer", () => ({
  createAppServerClient: () => mediaClient,
}));

vi.mock("../hooks/useAgentSessionThreadQueue", () => queueHook);
vi.mock("@/lib/api/agentRuntime/threadQueueActions", () => queueActions);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

describe("QueuedMessageList", () => {
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
  });

  afterEach(() => {
    while (mounted.length > 0) {
      const instance = mounted.pop();
      if (!instance) {
        break;
      }
      act(() => instance.root.unmount());
      instance.container.remove();
    }
    vi.clearAllMocks();
  });

  function renderQueue(threadId = "thread-1") {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<QueuedMessageList threadId={threadId} />);
    });
    mounted.push({ container, root });
    return container;
  }

  function rerenderQueue(container: HTMLDivElement, threadId: string) {
    const instance = mounted.find((entry) => entry.container === container)!;
    act(() => instance.root.render(<QueuedMessageList threadId={threadId} />));
  }

  function click(container: HTMLElement, action: string, index = 0) {
    const button = container.querySelectorAll<HTMLButtonElement>(
      `[data-queue-action="${action}"]`,
    )[index];
    expect(button, `缺少队列动作 ${action}/${index}`).toBeDefined();
    button.click();
  }

  function editText(container: HTMLElement, text: string) {
    const editor = container.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(editor, text);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
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

  function queueState(text = "待处理", refresh = vi.fn()) {
    const submissions: QueuedSubmission[] = [
      {
        clientUserMessageId: "client-1",
        id: "queued-1",
        input: [{ type: "text", text }],
      },
    ];
    return {
      error: null,
      loading: false,
      refresh,
      submissions,
    };
  }

  it("Queue 为空时不占用会话空间", () => {
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: null,
      loading: false,
      submissions: [],
    });

    expect(renderQueue().textContent).toBe("");
  });

  it("展开队列后经同线程 media/read 呈现首张缩略图，编辑保留附件", async () => {
    const state = queueState("图片说明");
    state.submissions[0].input.push(
      { type: "image", url: "sidecar://media/first.png" },
      { type: "image", url: "sidecar://media/second.png" },
    );
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    mediaClient.readMedia.mockResolvedValue({
      result: {
        contentBase64: "iVBORw==",
        mimeType: "image/png",
        offset: 0,
        bytes: 4,
        totalBytes: 4,
        hasMore: false,
      },
    });
    const container = renderQueue();
    expect(mediaClient.readMedia).not.toHaveBeenCalled();
    await act(async () => {
      click(container, "expand");
    });
    expect(mediaClient.readMedia).toHaveBeenCalledTimes(1);
    expect(mediaClient.readMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        uri: "sidecar://media/first.png",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("data:image/png;base64,iVBORw==");
    expect(image?.getAttribute("draggable")).toBe("false");
    await act(async () => {
      click(container, "edit");
    });
    expect(container.querySelector("img")).toBe(image);
    await act(async () => {
      click(container, "collapse");
    });
    expect(container.querySelector("img")).toBeNull();
    expect(mediaClient.readMedia.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it("只展示 durable submission 数量，不重复 canonical 时间线正文", () => {
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: null,
      loading: false,
      submissions: [
        {
          clientUserMessageId: "client-1",
          id: "queued-1",
          input: [{ type: "text", text: "修复测试" }],
        },
        {
          clientUserMessageId: "client-2",
          id: "queued-2",
          input: [{ type: "image", url: "sidecar://media/input-2" }],
        },
        {
          clientUserMessageId: "client-3",
          id: "queued-3",
          input: [{ type: "text", text: "更新文档" }],
        },
        {
          clientUserMessageId: "client-4",
          id: "queued-4",
          input: [{ type: "text", text: "运行验证" }],
        },
      ],
    });

    const container = renderQueue();
    expect(container.textContent).toContain("agentChat.threadQueue.title");
    expect(container.textContent).toContain(
      "agentChat.threadQueue.pendingCount:4",
    );
    expect(container.textContent).not.toContain("修复测试");
    expect(container.textContent).not.toContain("更新文档");
    expect(
      container.querySelector("[data-testid=queued-message-action-list]"),
    ).toBeNull();
  });

  it("读取失败时保留数量并显示收敛状态，不重复已有正文", () => {
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: new Error("offline"),
      loading: false,
      submissions: [
        {
          clientUserMessageId: "client-1",
          id: "queued-1",
          input: [{ type: "text", text: "保留中的消息" }],
        },
      ],
    });

    const container = renderQueue();
    expect(container.textContent).toContain(
      "agentChat.threadQueue.pendingCount:1",
    );
    expect(container.textContent).not.toContain("保留中的消息");
    expect(container.textContent).toContain(
      "agentChat.threadQueue.refreshFailed",
    );
  });

  it("读取中只显示稳定状态，不提前显示数量或正文", () => {
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: null,
      loading: true,
      submissions: [
        {
          clientUserMessageId: "client-1",
          id: "queued-1",
          input: [{ type: "text", text: "读取中的消息" }],
        },
      ],
    });

    const container = renderQueue();
    expect(
      container.querySelector('[aria-label="agentChat.threadQueue.loading"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain(
      "agentChat.threadQueue.pendingCount",
    );
    expect(container.textContent).not.toContain("读取中的消息");
  });

  it("mutation 失败时应与读取失败使用不同状态文案", async () => {
    queueActions.deleteThreadQueue.mockRejectedValueOnce(new Error("offline"));
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: null,
      loading: false,
      refresh: vi.fn(),
      submissions: [
        {
          clientUserMessageId: "client-1",
          id: "queued-1",
          input: [{ type: "text", text: "待删除" }],
        },
      ],
    });

    const container = renderQueue();
    act(() => {
      (
        container.querySelector(
          '[aria-label="agentChat.threadQueue.expand"]',
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      (
        container.querySelector(
          '[aria-label="agentChat.threadQueue.delete"]',
        ) as HTMLButtonElement
      ).click();
    });

    expect(container.textContent).toContain(
      "agentChat.threadQueue.actionFailed",
    );
    expect(container.textContent).not.toContain(
      "agentChat.threadQueue.refreshFailed",
    );
  });

  it("展开后通过 typed action 编辑，并保持立即启动的 idle RPC 合同", async () => {
    const refresh = vi.fn();
    queueHook.useAgentSessionThreadQueue.mockReturnValue({
      error: null,
      loading: false,
      refresh,
      submissions: [
        {
          clientUserMessageId: "client-1",
          id: "queued-1",
          input: [{ type: "text", text: "第一条" }],
        },
        {
          clientUserMessageId: "client-2",
          id: "queued-2",
          input: [{ type: "text", text: "第二条" }],
        },
      ],
    });

    const container = renderQueue();
    const expand = container.querySelector(
      '[aria-label="agentChat.threadQueue.expand"]',
    ) as HTMLButtonElement;
    await act(async () => expand.click());
    expect(
      container.querySelector("[data-testid=queued-message-action-list]"),
    ).not.toBeNull();

    const edit = container.querySelector(
      '[aria-label="agentChat.threadQueue.edit"]',
    ) as HTMLButtonElement;
    await act(async () => edit.click());
    await act(async () => {
      editText(container, "已编辑");
    });
    const save = container.querySelector(
      '[aria-label="agentChat.threadQueue.save"]',
    ) as HTMLButtonElement;
    await act(async () => save.click());
    expect(queueActions.updateThreadQueue).toHaveBeenCalledWith({
      threadId: "thread-1",
      queuedSubmissionId: "queued-1",
      input: [{ type: "text", text: "已编辑" }],
    });

    const sendNow = container.querySelector(
      '[aria-label="agentChat.threadQueue.sendNow"]',
    ) as HTMLButtonElement;
    await act(async () => sendNow.click());
    expect(queueActions.startThreadQueue).toHaveBeenCalledWith({
      threadId: "thread-1",
      queuedSubmissionId: "queued-1",
    });
  });

  it("展开预览可聚焦并完整读取长消息，DOM identity 来自 canonical submission", () => {
    const fullText = "完整队列内容".repeat(40);
    queueHook.useAgentSessionThreadQueue.mockReturnValue(queueState(fullText));
    const container = renderQueue();
    act(() => click(container, "expand"));
    const surface = container.querySelector(
      '[data-testid="queued-message-list"]',
    )!;
    const row = container.querySelector('[data-testid="queued-message-item"]')!;
    const preview = row.querySelector<HTMLElement>("[data-queue-preview]")!;

    expect(surface.getAttribute("data-thread-id")).toBe("thread-1");
    expect(row.getAttribute("data-submission-id")).toBe("queued-1");
    expect(preview.textContent).toBe(fullText);
    expect(preview.getAttribute("aria-label")).toContain("1/1");
    expect(preview.tabIndex).toBe(0);
    preview.focus();
    expect(document.activeElement).toBe(preview);
    expect(
      container.querySelector('[data-testid="thread-queue-status"]'),
    ).toBeNull();
  });

  it("未修改的多文本输入保存保持 block、附件和 text_elements，不追加重复文本", async () => {
    const input: UserInput[] = [
      {
        type: "text",
        text: "A",
        text_elements: [{ byteRange: { start: 0, end: 1 } }],
      },
      { type: "image", url: "data:image/png;base64,image" },
      { type: "text", text: "B" },
    ];
    const state = queueState();
    state.submissions[0].input = input;
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    expect(container.querySelector("textarea")!.value).toBe("A\nB");
    await act(async () => click(container, "save"));

    expect(queueActions.updateThreadQueue).toHaveBeenCalledWith({
      threadId: "thread-1",
      queuedSubmissionId: "queued-1",
      input,
    });
    expect(state.submissions[0].clientUserMessageId).toBe("client-1");
  });

  it("修改多文本输入只提交一次新文本并保留非文本输入", async () => {
    const image: UserInput = {
      type: "image",
      url: "data:image/png;base64/image",
    };
    const state = queueState();
    state.submissions[0].input = [
      { type: "text", text: "A" },
      image,
      { type: "text", text: "B" },
    ];
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    act(() => editText(container, "修改后的中文🙂"));
    await act(async () => click(container, "save"));

    expect(queueActions.updateThreadQueue).toHaveBeenCalledWith({
      threadId: "thread-1",
      queuedSubmissionId: "queued-1",
      input: [{ type: "text", text: "修改后的中文🙂" }, image],
    });
  });

  it("保存失败保留当前草稿，释放忙状态后可重试", async () => {
    queueActions.updateThreadQueue.mockRejectedValueOnce(new Error("offline"));
    const state = queueState();
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    act(() => editText(container, "失败后仍保留"));
    await act(async () => click(container, "save"));

    expect(container.querySelector("textarea")!.value).toBe("失败后仍保留");
    expect(container.querySelector("textarea")!.disabled).toBe(false);
    expect(container.textContent).toContain(
      "agentChat.threadQueue.actionFailed",
    );
    expect(state.refresh).not.toHaveBeenCalled();
    await act(async () => click(container, "save"));
    expect(container.querySelector("textarea")).toBeNull();
    expect(state.refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(
      "agentChat.threadQueue.actionFailed",
    );
  });

  it("同步拒绝重复和其他行的并发 mutation，不让另一个 finally 提前解锁", async () => {
    const pending = deferred();
    queueActions.updateThreadQueue.mockReturnValueOnce(pending.promise);
    const state = queueState();
    state.submissions.push({
      id: "queued-2",
      clientUserMessageId: "client-2",
      input: [{ type: "text", text: "第二条" }],
    });
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    act(() => {
      click(container, "save");
      click(container, "save");
      click(container, "edit");
      click(container, "cancel");
      click(container, "delete", 1);
      click(container, "move-up", 1);
      click(container, "start", 1);
    });

    expect(queueActions.updateThreadQueue).toHaveBeenCalledTimes(1);
    expect(queueActions.deleteThreadQueue).not.toHaveBeenCalled();
    expect(queueActions.reorderThreadQueue).not.toHaveBeenCalled();
    expect(queueActions.startThreadQueue).not.toHaveBeenCalled();
    expect(container.querySelector("textarea")!.disabled).toBe(true);
    expect(
      container
        .querySelector('[data-testid="queued-message-list"]')!
        .getAttribute("aria-busy"),
    ).toBe("true");
    await act(async () => pending.resolve());
    expect(
      container
        .querySelector('[data-testid="queued-message-list"]')!
        .getAttribute("aria-busy"),
    ).toBe("false");
    await act(async () => click(container, "delete", 1));
    expect(queueActions.deleteThreadQueue).toHaveBeenCalledTimes(1);
  });

  it("整队重排串行提交 current 顺序，其他 mutation 在完成前不进入网关", async () => {
    const pending = deferred();
    queueActions.reorderThreadQueue.mockReturnValueOnce(pending.promise);
    const state = queueState();
    state.submissions.push({
      id: "queued-2",
      clientUserMessageId: "client-2",
      input: [{ type: "text", text: "第二条" }],
    });
    queueHook.useAgentSessionThreadQueue.mockReturnValue(state);
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => {
      click(container, "move-up", 1);
      click(container, "delete");
    });
    expect(queueActions.reorderThreadQueue).toHaveBeenCalledWith({
      threadId: "thread-1",
      queuedSubmissionIds: ["queued-2", "queued-1"],
    });
    expect(queueActions.deleteThreadQueue).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"])(
    "A 的迟到 %s 不改变 B 的编辑、错误、忙状态或 refresh",
    async (outcome) => {
      const pendingA = deferred();
      const pendingB = deferred();
      queueActions.updateThreadQueue
        .mockReturnValueOnce(pendingA.promise)
        .mockReturnValueOnce(pendingB.promise);
      const stateA = queueState("A 消息");
      const stateB = queueState("B 消息");
      queueHook.useAgentSessionThreadQueue.mockImplementation(
        ({ threadId }: { threadId: string }) =>
          threadId === "thread-1" ? stateA : stateB,
      );
      const container = renderQueue();
      act(() => click(container, "expand"));
      act(() => click(container, "edit"));
      act(() => editText(container, "A 草稿"));
      await act(async () => click(container, "save"));
      rerenderQueue(container, "thread-2");
      expect(container.querySelector("textarea")).toBeNull();
      expect(
        container.querySelector('[data-testid="queued-message-action-list"]'),
      ).toBeNull();
      act(() => click(container, "expand"));
      act(() => click(container, "edit"));
      act(() => editText(container, "B 草稿"));
      await act(async () => click(container, "save"));
      await act(async () => {
        if (outcome === "success") pendingA.resolve();
        else pendingA.reject(new Error("A 失败"));
      });

      expect(container.querySelector("textarea")!.value).toBe("B 草稿");
      expect(container.querySelector("textarea")!.disabled).toBe(true);
      expect(container.textContent).not.toContain(
        "agentChat.threadQueue.actionFailed",
      );
      expect(stateA.refresh).not.toHaveBeenCalled();
      expect(stateB.refresh).not.toHaveBeenCalled();
      await act(async () => pendingB.reject(new Error("B 失败")));
      expect(container.querySelector("textarea")!.value).toBe("B 草稿");
      expect(container.querySelector("textarea")!.disabled).toBe(false);
      expect(container.textContent).toContain(
        "agentChat.threadQueue.actionFailed",
      );
    },
  );

  it("切到空 B 后 A 的迟到失败不能创建 B 错误面", async () => {
    const pending = deferred();
    queueActions.deleteThreadQueue.mockReturnValueOnce(pending.promise);
    const stateA = queueState();
    queueHook.useAgentSessionThreadQueue.mockImplementation(
      ({ threadId }: { threadId: string }) =>
        threadId === "thread-1" ? stateA : { ...queueState(), submissions: [] },
    );
    const container = renderQueue();
    act(() => click(container, "expand"));
    await act(async () => click(container, "delete"));
    rerenderQueue(container, "thread-2");
    await act(async () => pending.reject(new Error("A 失败")));
    expect(container.textContent).toBe("");
  });

  it("A→B→A 也不接受前一个 A 实例的完成事件", async () => {
    const pending = deferred();
    queueActions.updateThreadQueue.mockReturnValueOnce(pending.promise);
    queueHook.useAgentSessionThreadQueue.mockReturnValue(queueState());
    const container = renderQueue();
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    await act(async () => click(container, "save"));
    rerenderQueue(container, "thread-2");
    rerenderQueue(container, "thread-1");
    act(() => click(container, "expand"));
    act(() => click(container, "edit"));
    act(() => editText(container, "新 A 草稿"));
    await act(async () => pending.resolve());
    expect(container.querySelector("textarea")!.value).toBe("新 A 草稿");
    expect(container.querySelector("textarea")!.disabled).toBe(false);
  });
});
