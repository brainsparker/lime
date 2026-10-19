import { describe, expect, it } from "vitest";
import type { AppServerAgentEvent } from "@/lib/api/appServer";
import { readCanonicalThreadItem } from "./appServerCanonicalItemReader";

const event: AppServerAgentEvent = {
  eventId: "event",
  sequence: 7,
  sessionId: "session",
  threadId: "thread",
  turnId: "turn",
  type: "item.completed",
  timestamp: "now",
  payload: {},
};

describe("async questions through the canonical item reader", () => {
  it("retains typed questions and delivery with canonical identity", () => {
    const questions = [
      { title: "Which?", options: ["A, B", "C"] },
      { title: "Why?" },
    ];
    const result = readCanonicalThreadItem(
      {
        type: "agentMessage",
        id: "call",
        text: "Question",
        delivery: "async",
        phase: "final_answer",
        questions,
      },
      event,
    );
    expect(result).toMatchObject({
      id: "call",
      thread_id: "thread",
      turn_id: "turn",
      type: "agent_message",
      delivery: "async",
      questions,
      status: "completed",
    });
  });
  it.each(
    [
      [],
      [{ title: " " }],
      [{ title: "ok", options: [] }],
      [{ title: "ok", options: [""] }],
      [{ title: "ok", options: [1] }],
      [{ title: "ok" }, null],
    ].map((questions) => [questions]),
  )(
    "does not turn malformed questions into an actionable partial form: %j",
    (questions) => {
      expect(
        readCanonicalThreadItem(
          {
            type: "agentMessage",
            id: "call",
            text: "Question",
            delivery: "future",
            questions,
          },
          event,
        ),
      ).toMatchObject({ delivery: undefined, questions: undefined });
    },
  );
});
