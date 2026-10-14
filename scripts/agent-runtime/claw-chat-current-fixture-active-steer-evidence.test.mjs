import { describe, expect, it } from "vitest";
import {
  isPublicQueueMutationMethod,
  summarizeActiveSteerSubmission,
} from "./claw-chat-current-fixture-active-steer-evidence.mjs";

function fixture() {
  return {
    threadId: "thread-steer",
    activeTurnId: "turn-steer",
    inputText: "方向确认😀",
    steer: {
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      requestId: "steer-request",
      threadId: "thread-steer",
      expectedTurnId: "turn-steer",
      clientUserMessageId: "steer-client",
      input: [{ type: "text", text: "方向确认😀" }],
    },
    canonical: {
      thread: {
        id: "thread-steer",
        turns: [
          {
            id: "turn-steer",
            items: [
              {
                type: "userMessage",
                id: "steer-item",
                clientId: "steer-client",
                content: [
                  { type: "text", text: "方向确认😀", text_elements: [] },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

describe("active Steer canonical input evidence", () => {
  it("requires real transport and the same client User Item inside the active Turn", () => {
    expect(summarizeActiveSteerSubmission(fixture())).toMatchObject({
      ok: true,
      itemId: "steer-item",
      clientUserMessageId: "steer-client",
      turnId: "turn-steer",
    });
  });

  it.each([
    "command",
    "transport",
    "status",
    "requestId",
    "threadId",
    "expectedTurnId",
    "clientUserMessageId",
    "input",
  ])("rejects absent %s wire evidence", (field) => {
    const input = fixture();
    delete input.steer[field];
    expect(summarizeActiveSteerSubmission(input).ok).toBe(false);
  });

  it.each(["thread", "turn", "client", "id", "text", "extra", "duplicate"])(
    "rejects canonical %s drift",
    (mode) => {
      const input = fixture();
      const thread = input.canonical.thread;
      const turn = thread.turns[0];
      const item = turn.items[0];
      if (mode === "thread") thread.id = "foreign";
      if (mode === "turn") turn.id = "second-turn";
      if (mode === "client") item.clientId = "foreign";
      if (mode === "id") item.id = "";
      if (mode === "text") item.content[0].text = "prefix 方向确认😀 suffix";
      if (mode === "extra")
        item.content.push({ type: "mention", name: "lost", path: "/lost" });
      if (mode === "duplicate")
        thread.turns.push({
          id: "second-turn",
          items: [structuredClone(item)],
        });
      expect(summarizeActiveSteerSubmission(input).ok).toBe(false);
    },
  );

  it.each(["add", "update", "reorder", "delete", "start"])(
    "treats current thread/queue/%s as a queue mutation",
    (method) =>
      expect(isPublicQueueMutationMethod(`thread/queue/${method}`)).toBe(true),
  );

  it("permits read-only queue synchronization and still detects retired mutations", () => {
    expect(isPublicQueueMutationMethod("thread/queue/list")).toBe(false);
    expect(isPublicQueueMutationMethod("thread/read")).toBe(false);
    expect(isPublicQueueMutationMethod("agentSession/queuedTurn/promote")).toBe(
      true,
    );
  });
});
