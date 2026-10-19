import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  METHOD_ITEM_TOOL_REQUEST_USER_INPUT,
  type ToolRequestUserInputParams,
} from "@limecloud/app-server-client";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type {
  ActionRequired,
  ConfirmResponse,
} from "@/lib/api/agentActionTypes";
import type { AppServerServerRequestHandler } from "@/lib/api/appServerServerRequest";
import {
  PendingInteractionController,
  type PendingInteractionResponseResult,
} from "@/lib/api/agentRuntime/pendingInteractionController";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { ComposerEditor } from "@/components/input-kit/ComposerEditor";
import { DecisionPanel } from "./DecisionPanel";
import { usePendingInteractions } from "../hooks/usePendingInteractions";
import { PendingInteractionLayer } from "./PendingInteractionLayer/PendingInteractionLayer";
import type { RequestUserInputPanelProps } from "./RequestUserInputPanel";

const interruptTurn = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/api/agentRuntime/threadClient", () => ({
  interruptAgentRuntimeTurn: interruptTurn,
}));

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];
const rangeDescriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  interruptTurn.mockReset().mockResolvedValue(true);
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 1, 1),
  });
  await changeLimeLocale("zh-CN");
});

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  return { container, root };
}

function params(): ToolRequestUserInputParams {
  return {
    itemId: "input-1",
    threadId: "thread-1",
    turnId: "turn-1",
    autoResolutionMs: null,
    questions: [
      {
        id: "mode",
        header: "模式",
        question: "请选择模式",
        isOther: false,
        isSecret: false,
        options: [
          { label: "自动", description: "直接执行" },
          { label: "确认", description: "等待确认" },
        ],
      },
    ],
  };
}

function action(input = params()): ActionRequired {
  return {
    requestId: input.itemId,
    actionType: "ask_user",
    questions: input.questions.map((q) => ({
      ...q,
      options: q.options ?? undefined,
    })),
    scope: { threadId: input.threadId, turnId: input.turnId },
    status: "pending",
  };
}

function mountDecision(
  request = action(),
  onSubmit: RequestUserInputPanelProps["onSubmit"] = vi.fn(),
  onDismiss?: RequestUserInputPanelProps["onDismiss"],
) {
  const result = mount();
  const store = createStore();
  const render = (next = request) =>
    act(() =>
      result.root.render(
        <Provider store={store}>
          <DecisionPanel
            request={next}
            onSubmit={onSubmit}
            onDismiss={onDismiss}
          />
        </Provider>,
      ),
    );
  render();
  return { ...result, render, onSubmit };
}

function mountWire(
  input = params(),
  firstResult?: PendingInteractionResponseResult,
) {
  const handlers = new Map<
    string,
    AppServerServerRequestHandler<unknown, unknown>
  >();
  const controller = new PendingInteractionController({
    register: (method, handler) => {
      handlers.set(method, handler);
      return () => handlers.delete(method);
    },
  });
  const detach = controller.attach();
  const handler = handlers.get(METHOD_ITEM_TOOL_REQUEST_USER_INPUT);
  if (!handler) throw new Error("missing handler");
  const requestAbort = new AbortController();
  const wireResponse = Promise.resolve(
    handler(
      input,
      {
        id: "transport-private-1",
        method: METHOD_ITEM_TOOL_REQUEST_USER_INPUT,
        params: input,
      },
      requestAbort.signal,
    ),
  );
  const ordinaryDraft = new ComposerController({ text: "保留普通主草稿" });
  const onRespond = vi.fn(
    (response: Parameters<typeof controller.respond>[0]) => {
      if (firstResult) {
        const result = firstResult;
        firstResult = undefined;
        return result;
      }
      return controller.respond(response);
    },
  );
  let pendingRuntime: ReturnType<typeof usePendingInteractions> | undefined;
  function Surface() {
    const runtime = usePendingInteractions(controller);
    pendingRuntime = runtime;
    return (
      <>
        <ComposerEditor
          controller={ordinaryDraft}
          ariaLabel="普通主输入"
          testId="ordinary-draft"
        />
        <PendingInteractionLayer
          threadId={input.threadId}
          interactions={runtime.interactions}
          onRespond={onRespond}
          onDismiss={runtime.dismiss}
        />
      </>
    );
  }
  const result = mount();
  act(() =>
    result.root.render(
      <Provider store={createStore()}>
        <Surface />
      </Provider>,
    ),
  );
  return {
    ...result,
    wireResponse,
    ordinaryDraft,
    controller,
    onRespond,
    requestAbort,
    getRuntime: () => {
      if (!pendingRuntime) throw new Error("missing pending runtime");
      return pendingRuntime;
    },
    detach: () => act(() => detach()),
  };
}

function button(container: HTMLElement, text: string) {
  const node = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.textContent?.trim() === text ||
      item.getAttribute("aria-label") === text,
  );
  if (!node) throw new Error(`missing button: ${text}`);
  return node;
}

function radio(container: HTMLElement, index: number) {
  const node =
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index];
  if (!node) throw new Error("missing choice");
  return node;
}

function editor(container: HTMLElement) {
  const node = container.querySelector<HTMLElement>(
    '[data-testid="request-user-input-panel"] [contenteditable]',
  );
  if (!node) throw new Error("missing answer editor");
  return node;
}

function click(node: HTMLElement) {
  act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function paste(node: HTMLElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      files: [],
      items: [],
      types: ["text/plain"],
    },
  });
  act(() => node.dispatchEvent(event));
}

function key(
  node: HTMLElement,
  value: string,
  options: NonNullable<ConstructorParameters<typeof KeyboardEvent>[1]> = {},
) {
  act(() =>
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    ),
  );
}

async function advanceChoice() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(180);
  });
}

describe("RequestUserInput canonical surface", () => {
  it("真实 DecisionPanel -> layer -> controller 单题回包保留 ID，不产生 answer 包装", async () => {
    const result = mountWire();
    expect(radio(result.container, 0).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(
      result.container.querySelector(
        '[data-testid="request-user-input-panel"] [contenteditable]',
      ),
    ).toBeNull();
    const ordinary = result.container.querySelector(
      '[data-testid="ordinary-draft"]',
    );
    click(radio(result.container, 1));
    expect(result.onRespond).not.toHaveBeenCalled();
    await advanceChoice();
    await expect(result.wireResponse).resolves.toEqual({
      answers: { mode: { answers: ["确认"] } },
    });
    expect(result.onRespond).toHaveBeenCalledWith({
      confirmed: true,
      interactionId: "request_user_input:thread-1:turn-1:input-1",
      kind: "request_user_input",
      response: undefined,
      userData: { answers: { mode: { answers: ["确认"] } } },
    });
    expect(result.ordinaryDraft.getSnapshot().document.text).toBe(
      "保留普通主草稿",
    );
    expect(
      result.container.querySelector('[data-testid="ordinary-draft"]'),
    ).toBe(ordinary);
    expect(
      result.container.querySelector(
        '[data-testid="pending-interaction-layer"]',
      ),
    ).toBeNull();
    result.detach();
  });

  it("同文多题按 ID 留稿，逐题自由答案保留逗号与换行", async () => {
    const input = params();
    input.questions = [
      { ...input.questions[0], id: "first", question: "相同正文" },
      {
        ...input.questions[0],
        id: "second",
        question: "相同正文",
        options: null,
      },
    ];
    const result = mountWire(input);
    expect(result.container.textContent).toContain("1 / 2");
    click(radio(result.container, 1));
    await advanceChoice();
    expect(result.container.textContent).toContain("2 / 2");
    paste(editor(result.container), "甲,乙\n下一行");
    click(button(result.container, "上一题"));
    expect(radio(result.container, 1).getAttribute("aria-checked")).toBe(
      "true",
    );
    click(button(result.container, "下一题"));
    expect(editor(result.container).textContent).toBe("甲,乙下一行");
    await act(async () => click(button(result.container, "提交")));
    await expect(result.wireResponse).resolves.toEqual({
      answers: {
        first: { answers: ["确认"] },
        second: { answers: ["甲,乙\n下一行"] },
      },
    });
    result.detach();
  });

  it("isOther 开放自定义回答，输入取消选项；无选项时始终允许自由输入", async () => {
    const input = params();
    input.questions[0].isOther = true;
    const result = mountWire(input);
    const answer = editor(result.container);
    act(() => answer.focus());
    expect(radio(result.container, 0).getAttribute("aria-checked")).toBe(
      "false",
    );
    paste(answer, "保留,a,b");
    await act(async () => key(answer, "Enter"));
    await expect(result.wireResponse).resolves.toEqual({
      answers: { mode: { answers: ["保留,a,b"] } },
    });
    result.detach();
  });

  it("跳题省略当前 ID，不强制答完所有题", async () => {
    const input = params();
    input.questions.push({ ...input.questions[0], id: "second" });
    const result = mountWire(input);
    click(button(result.container, "跳过"));
    click(radio(result.container, 1));
    await advanceChoice();
    await expect(result.wireResponse).resolves.toEqual({
      answers: { second: { answers: ["确认"] } },
    });
    result.detach();
  });

  it("全部跳题仍是明确提交空 answers，与关闭中断分开", async () => {
    const result = mountWire();
    await act(async () => click(button(result.container, "跳过")));
    await expect(result.wireResponse).resolves.toEqual({ answers: {} });
    expect(result.onRespond).toHaveBeenCalledExactlyOnceWith({
      confirmed: true,
      interactionId: "request_user_input:thread-1:turn-1:input-1",
      kind: "request_user_input",
      response: undefined,
      userData: { answers: {} },
    });
    expect(interruptTurn).not.toHaveBeenCalled();
    result.detach();
  });

  it("Escape 中断同一 thread/turn，等待 canonical 移除且不伪造空答案", async () => {
    const result = mountWire();
    let answered = false;
    void result.wireResponse.then(() => {
      answered = true;
    });
    await act(async () =>
      key(result.container.querySelector("section")!, "Escape"),
    );
    expect(interruptTurn).toHaveBeenCalledExactlyOnceWith({
      session_id: "thread-1",
      turn_id: "turn-1",
    });
    expect(result.onRespond).not.toHaveBeenCalled();
    expect(answered).toBe(false);
    expect(result.controller.getSnapshot()).toHaveLength(1);
    expect(result.container.textContent).not.toContain("已提交回答");
    expect(button(result.container, "关闭问题").disabled).toBe(true);
    await act(async () => result.requestAbort.abort());
    await expect(result.wireResponse).resolves.toEqual({ answers: {} });
    expect(
      result.container.querySelector(
        '[data-testid="request-user-input-panel"]',
      ),
    ).toBeNull();
    expect(result.ordinaryDraft.getSnapshot().document.text).toBe(
      "保留普通主草稿",
    );
    result.detach();
  });

  it("取消失败不提交答案，保留同一编辑器和草稿，重复取消在处理中只发送一次", async () => {
    const input = params();
    input.questions[0].options = null;
    let rejectInterrupt!: (error: Error) => void;
    interruptTurn
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectInterrupt = reject;
          }),
      )
      .mockResolvedValueOnce(false);
    const result = mountWire(input);
    const answer = editor(result.container);
    paste(answer, "保留取消前的草稿");
    click(button(result.container, "关闭问题"));
    key(answer, "Escape");
    expect(interruptTurn).toHaveBeenCalledTimes(1);
    await act(async () =>
      rejectInterrupt(new Error("private transport failure")),
    );
    expect(
      result.container.querySelector('[role="alert"]')?.textContent,
    ).toContain("请重试");
    expect(result.container.textContent).not.toContain(
      "private transport failure",
    );
    expect(editor(result.container)).toBe(answer);
    expect(answer.textContent).toBe("保留取消前的草稿");
    expect(result.onRespond).not.toHaveBeenCalled();
    expect(result.controller.getSnapshot()).toHaveLength(1);
    await act(async () => click(button(result.container, "关闭问题")));
    expect(interruptTurn).toHaveBeenCalledTimes(2);
    expect(button(result.container, "关闭问题").disabled).toBe(false);
    expect(answer.textContent).toBe("保留取消前的草稿");
    await act(async () => click(button(result.container, "关闭问题")));
    expect(interruptTurn).toHaveBeenCalledTimes(3);
    expect(button(result.container, "关闭问题").disabled).toBe(true);
    expect(result.controller.getSnapshot()).toHaveLength(1);
    await act(async () => result.requestAbort.abort());
    result.detach();
  });

  it("取消只使用 pending owner 身份，已移除或缺少 turn 的请求 fail closed", async () => {
    const input = params();
    input.turnId = "";
    const result = mountWire(input);
    const id = result.controller.getSnapshot()[0].id;
    await expect(result.getRuntime().dismiss(id)).resolves.toEqual({
      accepted: false,
    });
    expect(interruptTurn).not.toHaveBeenCalled();
    await act(async () => result.requestAbort.abort());
    await expect(result.getRuntime().dismiss(id)).resolves.toEqual({
      accepted: false,
    });
    expect(interruptTurn).not.toHaveBeenCalled();
    result.detach();
  });

  it("旧请求取消的迟到成功不禁用新线程同 item/question 的草稿", async () => {
    const input = params();
    input.questions[0].options = null;
    let resolveInterrupt!: (value: { accepted: boolean }) => void;
    const onDismiss = vi.fn(
      () =>
        new Promise<{ accepted: boolean }>((resolve) => {
          resolveInterrupt = resolve;
        }),
    );
    const onSubmit = vi.fn<RequestUserInputPanelProps["onSubmit"]>();
    const result = mountDecision(action(input), onSubmit, onDismiss);
    paste(editor(result.container), "旧稿");
    click(button(result.container, "关闭问题"));
    result.render(action({ ...input, threadId: "thread-2" }));
    paste(editor(result.container), "新稿");
    await act(async () => resolveInterrupt({ accepted: true }));
    expect(editor(result.container).textContent).toBe("新稿");
    expect(button(result.container, "关闭问题").disabled).toBe(false);
    await act(async () => key(editor(result.container), "Enter"));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].userData).toEqual({
      answers: { mode: { answers: ["新稿"] } },
    });
  });

  it("accepted=false 透过 layer，保留原编辑器和草稿并允许重试", async () => {
    const input = params();
    input.questions[0].options = null;
    const result = mountWire(input, { accepted: false });
    const answer = editor(result.container);
    paste(answer, "保留草稿");
    await act(async () => click(button(result.container, "提交")));
    expect(
      result.container.querySelector('[role="alert"]')?.textContent,
    ).toContain("请重试");
    expect(editor(result.container)).toBe(answer);
    expect(editor(result.container).textContent).toBe("保留草稿");
    expect(result.controller.getSnapshot()).toHaveLength(1);
    await act(async () => click(button(result.container, "提交")));
    await expect(result.wireResponse).resolves.toEqual({
      answers: { mode: { answers: ["保留草稿"] } },
    });
    result.detach();
  });

  it("secret 请求失败只显示固定错误，不写日志/持久化/答案回显", async () => {
    const input = params();
    input.questions[0].options = null;
    input.questions[0].isSecret = true;
    const secret = "synthetic-private-answer";
    const onSubmit = vi
      .fn<RequestUserInputPanelProps["onSubmit"]>()
      .mockRejectedValueOnce(new Error(secret))
      .mockResolvedValue({ accepted: true });
    const result = mountDecision(action(input), onSubmit);
    const log = vi.spyOn(console, "error");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    paste(editor(result.container), secret);
    await act(async () => key(editor(result.container), "Enter"));
    expect(
      result.container.querySelector('[role="alert"]')?.textContent,
    ).not.toContain(secret);
    expect(editor(result.container).textContent).toBe(secret);
    expect(log).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(
      result.container.querySelector('button[aria-label*="听写"]'),
    ).toBeNull();
    await act(async () => key(editor(result.container), "Enter"));
    expect(result.container.textContent).toContain("已提交回答");
    expect(result.container.textContent).not.toContain(secret);
  });

  it("等待提交期间去重；同 item/question 切 thread 后忽略旧请求迟到成功", async () => {
    const input = params();
    input.questions[0].options = null;
    let resolveOld!: (value: { accepted: boolean }) => void;
    const onSubmit = vi
      .fn<RequestUserInputPanelProps["onSubmit"]>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ accepted: true });
    const result = mountDecision(action(input), onSubmit);
    paste(editor(result.container), "旧稿");
    key(editor(result.container), "Enter");
    key(editor(result.container), "Enter");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    result.render(action({ ...input, threadId: "thread-2" }));
    paste(editor(result.container), "新稿");
    await act(async () => resolveOld({ accepted: true }));
    expect(editor(result.container).textContent).toBe("新稿");
    expect(button(result.container, "提交").disabled).toBe(false);
    await act(async () => key(editor(result.container), "Enter"));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect((onSubmit.mock.calls[1][0] as ConfirmResponse).userData).toEqual({
      answers: { mode: { answers: ["新稿"] } },
    });
  });

  it("切换 identity 撤销旧选项推进定时器", async () => {
    const onSubmit = vi.fn<RequestUserInputPanelProps["onSubmit"]>();
    const result = mountDecision(action(), onSubmit);
    click(radio(result.container, 1));
    result.render(action({ ...params(), turnId: "turn-2" }));
    await advanceChoice();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(radio(result.container, 0).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("数字键选项/上下选择和 IME 不误提交", async () => {
    const onSubmit = vi.fn<RequestUserInputPanelProps["onSubmit"]>();
    const result = mountDecision(action(), onSubmit);
    const panel = result.container.querySelector("section")!;
    key(panel, "ArrowDown");
    expect(radio(result.container, 1).getAttribute("aria-checked")).toBe(
      "true",
    );
    key(panel, "1", { isComposing: true });
    await advanceChoice();
    expect(onSubmit).not.toHaveBeenCalled();
    key(panel, "2");
    await advanceChoice();
    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "input-1",
      actionType: "ask_user",
      confirmed: true,
      userData: { answers: { mode: { answers: ["确认"] } } },
    });
  });

  it("自由输入组合确认不发送，显式提交保留同一 EditorView", async () => {
    const input = params();
    input.questions[0].options = null;
    const onSubmit = vi.fn<RequestUserInputPanelProps["onSubmit"]>();
    const result = mountDecision(action(input), onSubmit);
    const answer = editor(result.container);
    act(() =>
      answer.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      ),
    );
    paste(answer, "中文,a");
    key(answer, "Enter", { isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(editor(result.container)).toBe(answer);
    act(() =>
      answer.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(editor(result.container)).toBe(answer);
    await act(async () => click(button(result.container, "提交")));
    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "input-1",
      actionType: "ask_user",
      confirmed: true,
      userData: { answers: { mode: { answers: ["中文,a"] } } },
    });
  });

  it("不从题文猜选项；缺失/重复 ID 的旧请求没有提交入口", () => {
    const request = action();
    request.questions = [{ id: "plain", question: '请选择："甲"、"乙"' }];
    const result = mountDecision(request);
    expect(result.container.querySelector('[role="radio"]')).toBeNull();
    expect(editor(result.container)).not.toBeNull();
    result.render({ ...request, questions: [{ question: "旧的无 ID 问题" }] });
    expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
    expect(result.container.querySelector("button")).toBeNull();
    result.render({
      ...request,
      questions: [
        { id: "same", question: "甲" },
        { id: "same", question: "乙" },
      ],
    });
    expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("五语言的导航、提交和失败文案均来自真实资源", async () => {
    const i18n = getLimeI18n();
    for (const locale of SUPPORTED_LOCALES) {
      await changeLimeLocale(locale);
      for (const suffix of [
        "previousQuestion",
        "nextQuestion",
        "progress",
        "dismiss",
        "answer",
        "otherPlaceholder",
        "placeholder",
        "skip",
        "next",
        "submit",
        "submitting",
        "submitted",
        "submitFailed",
        "invalidRequest",
      ]) {
        const key = `agentChat.requestUserInput.${suffix}`;
        expect(i18n.t(key, { ns: "agent", current: 1, total: 2 })).not.toBe(
          key,
        );
        expect(i18n.getResource(locale, "agent", key)).toBeTypeOf("string");
      }
    }
  });
});
