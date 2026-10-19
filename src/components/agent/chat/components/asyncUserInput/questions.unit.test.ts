import { describe, expect, it } from "vitest";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import {
  deriveAsyncQuestions,
  deriveQuestionAnswers,
  parseQuestionReplies,
  questionItemId,
  serializeQuestionReplies,
} from "./questions";

const base = {
  thread_id: "thread",
  turn_id: "turn",
  sequence: 1,
  status: "completed" as const,
  started_at: "now",
  updated_at: "now",
};
const source: AgentThreadItem = {
  ...base,
  id: "call",
  type: "agent_message",
  text: "Question",
  questions: [{ title: "Which?", options: ["A, B", "C"] }, { title: "Why?" }],
};
const questions = deriveAsyncQuestions([source], "thread");
const reply = {
  questionItemId: questionItemId("call", 0),
  question: "Which?",
  answer: " A, B ",
};

describe("canonical async questions and replies", () => {
  it("derives the same identity from a live or restored source item without requiring delivery", () => {
    expect(questions).toEqual([
      {
        id: '["request_user_input_async","call",0]',
        sourceItemId: "call",
        turnId: "turn",
        title: "Which?",
        options: ["A, B", "C"],
      },
      {
        id: '["request_user_input_async","call",1]',
        sourceItemId: "call",
        turnId: "turn",
        title: "Why?",
        options: [],
      },
    ]);
    expect(deriveAsyncQuestions([source], "other")).toEqual([]);
  });

  it("emits only nonempty trimmed answers in the standard array envelope", () => {
    const text = serializeQuestionReplies([
      reply,
      { ...reply, answer: " \n " },
    ]);
    expect(text).toBe(
      '<send_user_message_question_reply>\n[{"questionItemId":"[\\"request_user_input_async\\",\\"call\\",0]","question":"Which?","answer":"A, B"}]\n</send_user_message_question_reply>',
    );
    expect(parseQuestionReplies(text)).toEqual([{ ...reply, answer: "A, B" }]);
    expect(() =>
      serializeQuestionReplies([{ ...reply, answer: " " }]),
    ).toThrow();
  });

  it("accepts the reference single-object reader and rejects malformed or embedded envelopes", () => {
    const envelope = (value: unknown) =>
      `<send_user_message_question_reply>\n${JSON.stringify(value)}\n</send_user_message_question_reply>`;
    expect(parseQuestionReplies(envelope(reply))).toEqual([reply]);
    for (const text of [
      envelope([]),
      envelope([{ ...reply, answer: false }]),
      `quoted ${envelope(reply)}`,
      `${envelope(reply)} suffix`,
      envelope(null),
      "<send_user_message_question_reply>{</send_user_message_question_reply>",
    ])
      expect(parseQuestionReplies(text)).toBeNull();
  });

  it("associates only accepted same-thread single-text input and preserves the latest canonical answer", () => {
    const user = (
      id: string,
      answer: string,
      overrides: Partial<AgentThreadItem> = {},
    ): AgentThreadItem =>
      ({
        ...base,
        id,
        type: "user_message",
        content: serializeQuestionReplies([{ ...reply, answer }]),
        ...overrides,
      }) as AgentThreadItem;
    const items = [
      source,
      user("first", "A"),
      user("latest", "B"),
      user("foreign", "foreign", { thread_id: "other" }),
      user("pending", "pending", { status: "in_progress" }),
      user("failed", "failed", { status: "failed" }),
      user("multimodal", "image", {
        content_parts: [
          { type: "text", text: serializeQuestionReplies([reply]) },
          { type: "image", url: "https://example.invalid/a.png" },
        ],
      }),
    ];
    expect([...deriveQuestionAnswers(items, "thread", questions)]).toEqual([
      [reply.questionItemId, "B"],
    ]);
    const forged = user("forged", "wrong");
    if (forged.type === "user_message")
      forged.content = serializeQuestionReplies([
        { ...reply, questionItemId: "missing", answer: "forged" },
      ]);
    expect(deriveQuestionAnswers([forged], "thread", questions).size).toBe(0);
  });
});
