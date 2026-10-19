import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { ConversationTurnTimeline } from "./ConversationTurnTimeline";
import {
  questionDraftsAtom,
  questionScope,
} from "./asyncUserInput/QuestionDraftStore";
import {
  deriveAsyncQuestions,
  serializeQuestionReplies,
} from "./asyncUserInput/questions";

vi.mock("./StreamingRenderer", () => ({
  StreamingRenderer: ({ content }: { content: string }) => (
    <div data-assistant-body="">{content}</div>
  ),
}));
vi.mock("./MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-user-body="">{content}</div>
  ),
}));
vi.mock("./AgentThreadTimeline", () => ({ AgentThreadTimeline: () => null }));
vi.mock("./MessageActionButtons", () => ({ MessageActionButtons: () => null }));

const base = {
  thread_id: "thread-1",
  turn_id: "turn-1",
  sequence: 1,
  status: "completed" as const,
  started_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
};
const source: AgentThreadItem = {
  ...base,
  id: "call",
  type: "agent_message",
  text: "RAW_TOOL_QUESTION_TEXT",
  questions: [
    { title: "**选择模式**", options: ["DO_NOT_RENDER_OPTION"] },
    { title: "补充说明" },
  ],
};
const questions = deriveAsyncQuestions([source], "thread-1");
const scope = questionScope("local", "thread-1");
let container: HTMLDivElement, root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await changeLimeLocale("zh-CN");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function mount(items: AgentThreadItem[] = [source]) {
  const app = createStore(),
    store = app.get(questionDraftsAtom);
  store.reconcile(scope, questions, new Map(), new Set(["turn-1"]));
  const props: ComponentProps<typeof ConversationTurnTimeline> = {
    entry: {
      kind: "canonical_turn",
      id: "entry",
      isActive: true,
      turn: {
        id: "turn-1",
        thread_id: "thread-1",
        status: "running",
        prompt_text: "work",
        started_at: base.started_at,
        created_at: base.started_at,
        updated_at: base.updated_at,
      },
      segments: items.map((item) => ({
        kind: "message",
        id: item.id,
        item: item as Extract<
          AgentThreadItem,
          { type: "agent_message" | "user_message" }
        >,
      })),
    },
    sessionId: "session-1",
    threadRead: { thread_id: "thread-1", can_accept_direct_input: true },
    pendingActions: [],
    submittedActionsInFlight: [],
    assistantLabel: "Assistant",
    copiedId: null,
    compactLeadingSpacing: false,
    isSending: true,
    renderA2UIInline: false,
    timelineFocusRequestKey: 0,
    shouldDeferHistoricalTimelineDetails: false,
    handleCopy: vi.fn(),
  };
  const render = () =>
    act(() =>
      root.render(
        <Provider store={app}>
          <ConversationTurnTimeline {...props} />
        </Provider>,
      ),
    );
  render();
  return { props, store, render };
}
function buttons() {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
    (node) => node.textContent === "回答问题",
  );
}

describe("canonical async question timeline", () => {
  it("replaces source text with independently keyed titles and keeps canonical source identity across updates", () => {
    const runtime = mount();
    const rows = [
      ...container.querySelectorAll<HTMLElement>("[data-question-item-id]"),
    ];
    expect(rows.map((row) => row.dataset.questionItemId)).toEqual(
      questions.map((q) => q.id),
    );
    expect(rows.every((row) => row.dataset.threadItemId === "call")).toBe(true);
    expect(container.textContent).not.toContain("RAW_TOOL_QUESTION_TEXT");
    expect(container.textContent).not.toContain("DO_NOT_RENDER_OPTION");
    expect(buttons()).toHaveLength(0);
    const item = runtime.props.entry.segments[0];
    if (item.kind !== "message" || item.item.type !== "agent_message")
      throw new Error("missing source");
    runtime.props.entry = {
      ...runtime.props.entry,
      segments: [
        {
          ...item,
          item: {
            ...item.item,
            questions: [{ title: "更新后的题目" }, { title: "补充说明" }],
          },
        },
      ],
    };
    runtime.render();
    expect(container.querySelector("[data-question-item-id]")).toBe(rows[0]);
    expect(rows[0].textContent).toBe("更新后的题目");
  });

  it("reopens a skipped unanswered question as a single selection and hides accepted or read-only actions", () => {
    const runtime = mount();
    act(() => {
      runtime.store.skip(scope, questions[0].id);
      runtime.store.close(scope);
    });
    expect(buttons()).toHaveLength(2);
    act(() => buttons()[0].click());
    expect(runtime.store.read(scope).selection?.ids).toEqual([questions[0].id]);
    expect(buttons()).toHaveLength(1);
    act(() => {
      runtime.store.accepted(scope, [
        {
          questionItemId: questions[0].id,
          question: questions[0].title,
          answer: "accepted",
        },
      ]);
      runtime.store.close(scope);
    });
    expect(buttons()).toHaveLength(1);
    runtime.props.threadRead = {
      thread_id: "thread-1",
      can_accept_direct_input: false,
    };
    runtime.render();
    expect(buttons()).toHaveLength(0);
    runtime.props.threadRead = {
      thread_id: "thread-1",
      can_accept_direct_input: true,
    };
    runtime.props.entry = {
      ...runtime.props.entry,
      turn: { ...runtime.props.entry.turn, status: "completed" },
    };
    runtime.render();
    expect(buttons()).toHaveLength(0);
  });

  it("renders question labels and ordinary user bodies without exposing the transport envelope; copy uses readable text", () => {
    const user: AgentThreadItem = {
      ...base,
      type: "user_message",
      id: "answer",
      content: serializeQuestionReplies([
        {
          questionItemId: questions[0].id,
          question: "**模式** [文档](https://example.invalid)",
          answer: "第一行\n第二行, B",
        },
        {
          questionItemId: questions[1].id,
          question: "补充说明",
          answer: "**答案正文**",
        },
      ]),
    };
    const runtime = mount([user]);
    const labels = [
      ...container.querySelectorAll("[data-question-replies] span"),
    ];
    expect(labels.map((node) => node.textContent)).toEqual([
      "模式 文档",
      "补充说明",
    ]);
    expect(container.textContent).not.toContain(
      "send_user_message_question_reply",
    );
    expect(
      [...container.querySelectorAll("[data-user-body]")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["第一行\n第二行, B", "**答案正文**"]);
    const copy = container.querySelector<HTMLButtonElement>(
      "[data-testid=user-message-footer] button",
    )!;
    act(() => copy.click());
    expect(runtime.props.handleCopy).toHaveBeenCalledWith(
      "**模式 文档**\n第一行\n第二行, B\n\n**补充说明**\n**答案正文**",
      "answer",
    );
  });

  it("keeps malformed or mixed-media input on the ordinary user-message path", () => {
    const user: AgentThreadItem = {
      ...base,
      type: "user_message",
      id: "ordinary",
      content:
        "<send_user_message_question_reply>broken</send_user_message_question_reply>",
    };
    mount([user]);
    expect(container.querySelector("[data-question-replies]")).toBeNull();
    expect(container.querySelector("[data-user-body]")?.textContent).toContain(
      "broken",
    );
  });
});
