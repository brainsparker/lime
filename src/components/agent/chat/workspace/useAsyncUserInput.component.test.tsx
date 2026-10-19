import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { ComposerEditor } from "@/components/input-kit/ComposerEditor";
import type { AgentThreadItem, AgentThreadTurn } from "@/lib/api/agentProtocol";
import type { SendMessageFn } from "../hooks/agentChatShared";
import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";
import {
  questionDraftsAtom,
  questionScope,
} from "../components/asyncUserInput/QuestionDraftStore";
import {
  parseQuestionReplies,
  questionItemId,
} from "../components/asyncUserInput/questions";
import { useAsyncUserInput } from "./useAsyncUserInput";

let container: HTMLDivElement, root: Root;
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

const base = {
  thread_id: "thread-1",
  turn_id: "turn-1",
  sequence: 1,
  status: "completed" as const,
  started_at: "now",
  updated_at: "now",
};
const source: AgentThreadItem = {
  ...base,
  id: "call",
  type: "agent_message",
  text: "questions",
  questions: [
    { title: "选择模式", options: ["保留 A, B", "C"] },
    { title: "补充说明" },
  ],
};
const turns: AgentThreadTurn[] = [
  {
    id: "turn-1",
    thread_id: "thread-1",
    prompt_text: "work",
    status: "running",
    started_at: "now",
    created_at: "now",
    updated_at: "now",
  },
];

function mount(
  sendMessage = vi.fn<SendMessageFn>(async () => acceptedSubmission()),
) {
  const app = createStore(),
    store = app.get(questionDraftsAtom);
  const main = new ComposerController({ text: "主输入草稿 😀" });
  function Surface({ threadId }: { threadId: string }) {
    const runtime = useAsyncUserInput({
      threadId,
      sessionId: "session-1",
      enabled: true,
      items: [source],
      turns,
      sendMessage,
      collaborationMode: "plan",
    });
    return (
      <>
        <div data-main="">
          <ComposerEditor controller={main} />
        </div>
        {runtime.node}
      </>
    );
  }
  const render = (threadId = "thread-1") =>
    act(() =>
      root.render(
        <Provider store={app}>
          <Surface threadId={threadId} />
        </Provider>,
      ),
    );
  render();
  return { main, store, render, sendMessage };
}
function button(label: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (button) =>
      button.textContent?.trim() === label ||
      button.getAttribute("aria-label") === label,
  );
  if (!button) throw new Error(`missing button ${label}`);
  return button;
}
function click(node: HTMLElement) {
  act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
function editor() {
  const editor = container.querySelector<HTMLElement>(
    "[data-async-user-input] [contenteditable]",
  );
  if (!editor) throw new Error("missing async editor");
  return editor;
}
function paste(text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (type: string) => (type === "text/plain" ? text : ""),
      files: [],
      items: [],
      types: ["text/plain"],
    },
  });
  act(() => editor().dispatchEvent(event));
}

describe("async question form on the ordinary send coordinator", () => {
  it("advances a deliberate option without sending; final freeform submits one standard message and preserves the main draft", async () => {
    const runtime = mount();
    const draft = runtime.main.captureDraft();
    expect(runtime.sendMessage).not.toHaveBeenCalled();
    click(
      container.querySelector<HTMLElement>('[data-async-question-option="0"]')!,
    );
    await act(async () => vi.advanceTimersByTime(180));
    expect(container.textContent).toContain("补充说明");
    expect(runtime.sendMessage).not.toHaveBeenCalled();
    paste("第一行\n第二行, 保留标点");
    await act(async () => button("发送").click());
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
    const args = runtime.sendMessage.mock.calls[0];
    expect(parseQuestionReplies(args[0])).toEqual([
      {
        questionItemId: questionItemId("call", 0),
        question: "选择模式",
        answer: "保留 A, B",
      },
      {
        questionItemId: questionItemId("call", 1),
        question: "补充说明",
        answer: "第一行\n第二行, 保留标点",
      },
    ]);
    expect(args[1]).toEqual([]);
    expect(args[8]).toMatchObject({
      targetSessionId: "session-1",
      shouldSendPermissionOverrides: false,
      collaborationMode: "plan",
      requestMetadata: { turnTrigger: "send_user_message_async_question" },
    });
    expect(runtime.main.captureDraft()).toEqual(draft);
    expect(container.querySelector("[data-async-user-input]")).toBeNull();
  });

  it("retains failed answers for retry and preserves edits made before a delayed acceptance", async () => {
    let accept!: (value: Awaited<ReturnType<SendMessageFn>>) => void;
    const send = vi
      .fn<SendMessageFn>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            accept = resolve;
          }),
      );
    const runtime = mount(send);
    click(button("跳过"));
    paste("旧回答");
    await act(async () => button("发送").click());
    expect(container.querySelector("[role=alert]")?.textContent).toContain(
      "无法发送回答",
    );
    expect(editor().textContent).toBe("旧回答");
    await act(async () => button("发送").click());
    expect(editor().getAttribute("contenteditable")).toBe("true");
    paste("，发送中编辑");
    await act(async () => accept(acceptedSubmission()));
    expect(editor().textContent).toBe("旧回答，发送中编辑");
    expect(
      runtime.store
        .read(questionScope("local", "thread-1"))
        .drafts.get(questionItemId("call", 1))?.lastSubmission,
    ).toBe("旧回答");
  });

  it("restores the selected question and its draft after switching threads; Escape closes without sending", async () => {
    const runtime = mount();
    click(button("跳过"));
    paste("跨线程保留");
    const originalEditor = container.querySelector(
      "[data-main] [contenteditable]",
    );
    runtime.render("thread-2");
    expect(container.querySelector("[data-async-user-input]")).toBeNull();
    runtime.render();
    expect(editor().textContent).toBe("跨线程保留");
    expect(container.querySelector("[data-main] [contenteditable]")).toBe(
      originalEditor,
    );
    act(() =>
      editor().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(container.querySelector("[data-async-user-input]")).toBeNull();
    expect(runtime.sendMessage).not.toHaveBeenCalled();
    runtime.render();
    expect(container.querySelector("[data-async-user-input]")).toBeNull();
  });

  it("last Skip sends earlier nonempty answers; skipping every question just closes", async () => {
    const runtime = mount();
    click(
      container.querySelector<HTMLElement>('[data-async-question-option="0"]')!,
    );
    await act(async () => vi.advanceTimersByTime(180));
    await act(async () => button("跳过").click());
    expect(runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(
      parseQuestionReplies(runtime.sendMessage.mock.calls[0][0]),
    ).toHaveLength(1);
    act(() => root.unmount());
    root = createRoot(container);
    const second = mount();
    click(button("跳过"));
    click(button("跳过"));
    expect(second.sendMessage).not.toHaveBeenCalled();
    expect(container.querySelector("[data-async-user-input]")).toBeNull();
  });
});
