import { describe, expect, it } from "vitest";
import type { AgentThreadTurn } from "../../agentProtocol";
import { createConversationProjectionReducer } from "./index";

function turn(id: string, status: AgentThreadTurn["status"]): AgentThreadTurn {
  return {
    id,
    thread_id: "thread",
    prompt_text: id,
    status,
    started_at: "2026-10-12T00:00:00Z",
    created_at: "2026-10-12T00:00:00Z",
    updated_at: "2026-10-12T00:00:00Z",
  };
}

describe("canonical Turn status", () => {
  it.each(["completed", "failed", "cancelled"] as const)(
    "旧 Turn 的迟到 %s 不覆盖当前 Turn 的状态",
    (status) => {
      const reducer = createConversationProjectionReducer({
        threadId: "thread",
      });
      reducer.dispatch({
        type: "turn_started",
        source: "live",
        turn: turn("old", "running"),
      });
      reducer.dispatch({
        type: "turn_completed",
        source: "live",
        turn: turn("old", "completed"),
      });
      reducer.dispatch({
        type: "turn_started",
        source: "live",
        turn: turn("current", "running"),
      });
      reducer.dispatch({
        type: "turn_completed",
        source: "read",
        turn: turn("old", status),
      });
      expect(reducer.getProjection().status).toBe("running");
      expect(reducer.getProjection().turns).toEqual([
        expect.objectContaining({ id: "old", status }),
        expect.objectContaining({ id: "current", status: "running" }),
      ]);
      reducer.dispatch({
        type: "turn_completed",
        source: "live",
        turn: turn("current", "completed"),
      });
      reducer.dispatch({
        type: "turn_completed",
        source: "read",
        turn: turn("old", "failed"),
      });
      expect(reducer.getProjection().status).toBe("completed");
    },
  );
});
