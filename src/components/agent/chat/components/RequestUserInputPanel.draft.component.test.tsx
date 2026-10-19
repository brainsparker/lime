import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { ActionRequired } from "@/lib/api/agentActionTypes";
import { DecisionPanel } from "./DecisionPanel";
import { PendingInteractionLayer } from "./PendingInteractionLayer/PendingInteractionLayer";
import type { RequestUserInputPanelProps } from "./RequestUserInputPanel";
import {
  LOCAL_REQUEST_HOST_ID,
  requestUserInputDraftIdentity,
  requestUserInputDraftsAtom,
} from "./RequestUserInputDraftStore";
import { hasQuestionIds } from "./requestUserInputDraft";

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
const rangeDescriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
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

function request(): ActionRequired {
  return {
    actionType: "ask_user",
    requestId: "request-a",
    scope: { threadId: "thread-a", turnId: "turn-a" },
    status: "pending",
    questions: [{ id: "answer", question: "请填写", isSecret: false }],
  };
}

function identity(input = request(), hostId = LOCAL_REQUEST_HOST_ID) {
  const questions = input.questions ?? [];
  if (!hasQuestionIds(questions)) throw new Error("invalid test questions");
  return requestUserInputDraftIdentity(hostId, input, questions);
}

function mount(
  input = request(),
  options: {
    store?: ReturnType<typeof createStore>;
    onSubmit?: RequestUserInputPanelProps["onSubmit"];
    onDismiss?: RequestUserInputPanelProps["onDismiss"];
  } = {},
) {
  const store = options.store ?? createStore();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const onSubmit = options.onSubmit ?? vi.fn();
  const render = (next: ActionRequired | null = input, hostId?: string) =>
    act(() =>
      root.render(
        <Provider store={store}>
          {next && (
            <DecisionPanel
              hostId={hostId}
              request={next}
              onSubmit={onSubmit}
              onDismiss={options.onDismiss}
            />
          )}
        </Provider>,
      ),
    );
  render();
  return {
    root,
    container,
    render,
    store,
    drafts: store.get(requestUserInputDraftsAtom),
    onSubmit,
  };
}

function editor(container: HTMLElement) {
  const node = container.querySelector<HTMLElement>("[contenteditable]");
  if (!node) throw new Error("missing answer editor");
  return node;
}

function button(container: HTMLElement, label: string) {
  const node = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent?.trim() === label,
  );
  if (!node) throw new Error(`missing button: ${label}`);
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

describe("RequestUserInput app-scoped drafts", () => {
  it("线程切回与真实 remount 恢复选项、自由文本和当前题号", async () => {
    const first = request();
    first.questions!.unshift({
      id: "mode",
      question: "选择模式",
      options: [{ label: "自动" }, { label: "确认" }],
    });
    const result = mount(first);
    click(result.container.querySelectorAll<HTMLElement>('[role="radio"]')[1]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    paste(editor(result.container), "线程A,保留\n下一行");
    const second = {
      ...request(),
      scope: { threadId: "thread-b", turnId: "turn-b" },
    };
    result.render(second);
    expect(editor(result.container).textContent).toBe("");
    paste(editor(result.container), "线程B");
    result.render(first);
    expect(result.container.textContent).toContain("2 / 2");
    expect(editor(result.container).textContent).toBe("线程A,保留下一行");
    click(button(result.container, "上一题"));
    expect(
      result.container
        .querySelectorAll('[role="radio"]')[1]
        .getAttribute("aria-checked"),
    ).toBe("true");
    result.render(null);
    result.render(first);
    expect(result.container.textContent).toContain("1 / 2");
    click(button(result.container, "下一题"));
    expect(editor(result.container).textContent).toBe("线程A,保留下一行");
    result.render(second);
    expect(editor(result.container).textContent).toBe("线程B");
    expect(result.onSubmit).not.toHaveBeenCalled();
  });

  it("同一应用 Store 的新组件可恢复，两个应用 Store 不共享答案", () => {
    const first = mount();
    paste(editor(first.container), "应用A");
    first.render(null);
    const remount = mount(request(), { store: first.store });
    expect(editor(remount.container).textContent).toBe("应用A");
    const second = mount();
    expect(editor(second.container).textContent).toBe("");
    paste(editor(second.container), "应用B");
    remount.render(null);
    remount.render();
    expect(editor(remount.container).textContent).toBe("应用A");
    expect(first.drafts).not.toBe(second.drafts);
  });

  it("受控 host identity 隔离，并由 Layer/DecisionPanel 传到问答 owner", () => {
    const result = mount();
    const input = request();
    const render = (hostId = LOCAL_REQUEST_HOST_ID) =>
      act(() =>
        result.root.render(
          <Provider store={result.store}>
            <PendingInteractionLayer
              hostId={hostId}
              threadId="thread-a"
              interactions={[
                {
                  id: "request_user_input:thread-a:turn-a:request-a",
                  thread_id: "thread-a",
                  turn_id: "turn-a",
                  kind: "request_user_input",
                  status: "pending",
                  payload: { request: input },
                },
              ]}
              onRespond={() => ({ accepted: true })}
              onDismiss={async () => ({ accepted: true })}
            />
          </Provider>,
        ),
      );
    render();
    paste(editor(result.container), "本地题稿");
    render("test-host-b");
    expect(editor(result.container).textContent).toBe("");
    paste(editor(result.container), "另一UI scope");
    render();
    expect(editor(result.container).textContent).toBe("本地题稿");
    render("test-host-b");
    expect(editor(result.container).textContent).toBe("另一UI scope");
  });

  it.each(["request", "turn", "question"] as const)(
    "%s identity 变化不借用旧答案",
    (change) => {
      const original = request();
      const result = mount(original);
      paste(editor(result.container), "旧题稿");
      const next = request();
      if (change === "request") next.requestId = "request-b";
      if (change === "turn") next.scope!.turnId = "turn-b";
      if (change === "question") next.questions![0].id = "other";
      result.render(next);
      expect(editor(result.container).textContent).toBe("");
      result.render(original);
      expect(editor(result.container).textContent).toBe("旧题稿");
    },
  );

  it.each(["scope", "thread", "turn", "request", "host"] as const)(
    "缺失 %s identity 不保存可恢复共享稿",
    (missing) => {
      const input = request();
      if (missing === "scope") input.scope = undefined;
      if (missing === "thread") input.scope!.threadId = "";
      if (missing === "turn") input.scope!.turnId = "";
      if (missing === "request") input.requestId = "";
      const result = mount(input);
      const host = missing === "host" ? "" : undefined;
      result.render(input, host);
      paste(editor(result.container), "不完整身份");
      result.render(null);
      result.render(input, host);
      expect(editor(result.container).textContent).toBe("");
    },
  );

  it.each(["rejected", "throw"] as const)(
    "提交前清共享稿，%s 后只保留仍挂载编辑器",
    async (failure) => {
      const store = createStore();
      const drafts = store.get(requestUserInputDraftsAtom);
      const observed: Array<ReturnType<typeof drafts.read>> = [];
      const onSubmit = vi.fn(() => {
        observed.push(drafts.read(identity()));
        if (failure === "throw") throw new Error("private reply failure");
        return { accepted: false };
      });
      const result = mount(request(), { store, onSubmit });
      const answer = editor(result.container);
      paste(answer, "提交前题稿");
      expect(drafts.read(identity())?.answers.answer.freeformText).toBe(
        "提交前题稿",
      );
      await act(async () => click(button(result.container, "提交")));
      expect(observed).toEqual([null]);
      expect(editor(result.container)).toBe(answer);
      expect(answer.textContent).toBe("提交前题稿");
      expect(result.container.querySelector('[role="alert"]')).not.toBeNull();
      expect(drafts.read(identity())).toBeNull();
      result.render(null);
      result.render();
      expect(editor(result.container).textContent).toBe("");
    },
  );

  it.each(["rejected", "throw"] as const)(
    "关闭前清共享稿，%s 后不自动复活共享答案",
    async (failure) => {
      const store = createStore();
      const drafts = store.get(requestUserInputDraftsAtom);
      const observed: Array<ReturnType<typeof drafts.read>> = [];
      const onDismiss = vi.fn(async () => {
        observed.push(drafts.read(identity()));
        if (failure === "throw") throw new Error("private interrupt failure");
        return { accepted: false };
      });
      const result = mount(request(), { store, onDismiss });
      const answer = editor(result.container);
      paste(answer, "关闭前题稿");
      await act(async () => click(button(result.container, "关闭问题")));
      expect(observed).toEqual([null]);
      expect(editor(result.container)).toBe(answer);
      expect(answer.textContent).toBe("关闭前题稿");
      expect(drafts.read(identity())).toBeNull();
      expect(result.onSubmit).not.toHaveBeenCalled();
      result.render(null);
      result.render();
      expect(editor(result.container).textContent).toBe("");
    },
  );

  it("失败后新的编辑会重新保存共享稿", async () => {
    const result = mount(request(), { onSubmit: () => ({ accepted: false }) });
    paste(editor(result.container), "旧稿");
    await act(async () => click(button(result.container, "提交")));
    expect(result.drafts.read(identity())).toBeNull();
    paste(editor(result.container), "续写");
    result.render(null);
    result.render();
    expect(editor(result.container).textContent).toBe("旧稿续写");
  });

  it.each(["submit", "dismiss"] as const)(
    "迟到的旧 %s 结果不能修改或清除新请求题稿",
    async (operation) => {
      let finish!: (result: { accepted: boolean }) => void;
      const pending = () =>
        new Promise<{ accepted: boolean }>((resolve) => {
          finish = resolve;
        });
      const result = mount(
        request(),
        operation === "submit" ? { onSubmit: pending } : { onDismiss: pending },
      );
      paste(editor(result.container), "旧请求");
      click(
        button(result.container, operation === "submit" ? "提交" : "关闭问题"),
      );
      const next = { ...request(), requestId: "request-new" };
      result.render(next);
      paste(editor(result.container), "新请求题稿");
      const answer = editor(result.container);
      await act(async () => finish({ accepted: true }));
      expect(editor(result.container)).toBe(answer);
      expect(answer.textContent).toBe("新请求题稿");
      result.render(null);
      result.render(next);
      expect(editor(result.container).textContent).toBe("新请求题稿");
      expect(
        result.drafts.read(identity(next))?.answers.answer.freeformText,
      ).toBe("新请求题稿");
    },
  );

  it("secret 只经内存恢复，不写 Storage 或日志", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const logs = ["log", "info", "debug", "warn", "error"].map((method) =>
      vi.spyOn(console, method as "log"),
    );
    const input = request();
    input.questions![0].isSecret = true;
    const result = mount(input);
    paste(editor(result.container), "secret-memory-value");
    result.render(null);
    result.render(input);
    expect(editor(result.container).textContent).toBe("secret-memory-value");
    expect(storage).not.toHaveBeenCalled();
    for (const log of logs) expect(log).not.toHaveBeenCalled();
    expect(result.onSubmit).not.toHaveBeenCalled();
  });
});
