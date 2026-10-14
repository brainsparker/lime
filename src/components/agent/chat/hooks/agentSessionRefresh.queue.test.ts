import { describe, expect, it, vi } from "vitest";
import type { AgentThreadItem, AgentThreadTurn, Message } from "../types";
import {
  createAgentSessionReadModelSnapshot,
  filterAgentSessionReadModelMessages,
  mergeAgentSessionReadModelThreadItems,
  preserveActiveAgentSessionReadModel,
  reconcileAgentSessionReadModelTurns,
  refreshAgentSessionReadModelState,
} from "./agentSessionRefresh";

const timestamp = "2026-10-14T00:00:00.000Z";
function turn(id: string): AgentThreadTurn {
  return {
    id,
    thread_id: "thread-a",
    status: "completed",
    prompt_text: id,
    started_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
  };
}
function item(id: string, content = id): AgentThreadItem {
  return {
    id: `user-${id}`,
    turn_id: id,
    thread_id: "thread-a",
    sequence: 1,
    type: "user_message",
    status: "completed",
    content,
    started_at: timestamp,
    updated_at: timestamp,
  };
}
function snapshot(turns: AgentThreadTurn[], items: AgentThreadItem[]) {
  return createAgentSessionReadModelSnapshot(
    {
      thread_id: "thread-a",
      thread_turns: turns,
      thread_items: items,
      turns: turns.map((turn) => ({
        turn_id: turn.id,
        status: "completed" as const,
      })),
    },
    { timelineMode: "replace" },
  );
}

describe("Queue canonical timeline refresh", () => {
  it("uses canonical order, adds new Turns and replaces edited Items while removing deleted ones", () => {
    const incoming = snapshot(
      [turn("b"), turn("a"), turn("new")],
      [item("b", "edited"), item("a"), item("new")],
    );
    expect(
      reconcileAgentSessionReadModelTurns(
        [turn("a"), turn("b"), turn("deleted")],
        incoming,
      ).map((turn) => turn.id),
    ).toEqual(["b", "a", "new"]);
    expect(
      mergeAgentSessionReadModelThreadItems(
        [item("a"), item("b", "old"), item("deleted")],
        incoming,
      ),
    ).toEqual(incoming.threadRead!.thread_items);
  });

  it("preserves only active streaming and unconfirmed optimistic input across replacement", () => {
    const incoming = snapshot([turn("queued")], [item("queued", "edited")]);
    const messages: Message[] = [
      {
        id: "active-msg",
        runtimeTurnId: "active",
        role: "assistant",
        content: "delta",
        timestamp: new Date(timestamp),
      },
      {
        id: "pending-msg",
        runtimeTurnId: "pending-turn:input",
        role: "user",
        content: "new input",
        timestamp: new Date(timestamp),
      },
      {
        id: "deleted-msg",
        runtimeTurnId: "deleted",
        role: "user",
        content: "stale",
        timestamp: new Date(timestamp),
      },
    ];
    const protectedSnapshot = preserveActiveAgentSessionReadModel(incoming, {
      active: true,
      activeTurnId: "active",
      messages,
    });
    expect(
      reconcileAgentSessionReadModelTurns(
        [turn("active"), turn("deleted")],
        protectedSnapshot,
      ).map((turn) => turn.id),
    ).toEqual(["queued", "active"]);
    expect(
      mergeAgentSessionReadModelThreadItems(
        [item("active", "delta"), item("pending-turn:input"), item("deleted")],
        protectedSnapshot,
      ).map((item) => item.turn_id),
    ).toEqual(["queued", "active", "pending-turn:input"]);
    expect(
      filterAgentSessionReadModelMessages(messages, protectedSnapshot).map(
        (message) => message.id,
      ),
    ).toEqual(["active-msg", "pending-msg"]);
    const settled = preserveActiveAgentSessionReadModel(incoming, {
      active: false,
      activeTurnId: "active",
      messages,
    });
    expect(filterAgentSessionReadModelMessages(messages, settled)).toEqual([]);
  });

  it("does not replace active local deltas with a stale snapshot of the same Item", () => {
    const local = item("active", "latest delta");
    const incoming = preserveActiveAgentSessionReadModel(
      snapshot([turn("active")], [item("active", "old")]),
      {
        active: true,
        activeTurnId: "active",
        messages: [],
      },
    );
    expect(mergeAgentSessionReadModelThreadItems([local], incoming)).toEqual([
      local,
    ]);
  });

  it.each(["generation", "thread"])(
    "rejects a late %s read before any projection is applied",
    async (boundary) => {
      let resolve!: (value: { thread_id: string }) => void;
      let current = true;
      const applyReadModelSnapshot = vi.fn();
      const getSessionReadModel = vi.fn(
        () =>
          new Promise<{ thread_id: string }>((done) => {
            resolve = done;
          }),
      );
      const promise = refreshAgentSessionReadModelState({
        runtime: { getSessionReadModel },
        sessionIdRef: { current: "session-a" },
        request: {
          timelineMode: "replace",
          expectedThreadId: "thread-a",
          isCurrent: () => current,
        },
        applyReadModelSnapshot,
      });
      if (boundary === "generation") current = false;
      resolve({ thread_id: boundary === "thread" ? "thread-b" : "thread-a" });
      expect(await promise).toBe(false);
      expect(applyReadModelSnapshot).not.toHaveBeenCalled();
    },
  );

  it("failed reads retain the existing projection, and disposed requests never start a read", async () => {
    const applyReadModelSnapshot = vi.fn();
    const onWarn = vi.fn();
    const getSessionReadModel = vi
      .fn()
      .mockRejectedValue(new Error("read failed"));
    const options = {
      runtime: { getSessionReadModel },
      sessionIdRef: { current: "session-a" },
      applyReadModelSnapshot,
      onWarn,
    };
    expect(await refreshAgentSessionReadModelState(options)).toBe(false);
    expect(onWarn).toHaveBeenCalledOnce();
    expect(
      await refreshAgentSessionReadModelState({
        ...options,
        request: { isCurrent: () => false },
      }),
    ).toBe(false);
    expect(getSessionReadModel).toHaveBeenCalledOnce();
    expect(applyReadModelSnapshot).not.toHaveBeenCalled();
  });

  it("missing canonical reads cannot report replacement success or clear the timeline", async () => {
    const applyReadModelSnapshot = vi.fn();
    expect(
      await refreshAgentSessionReadModelState({
        runtime: { getSessionReadModel: vi.fn(async () => null) },
        sessionIdRef: { current: "session-a" },
        request: { timelineMode: "replace" },
        applyReadModelSnapshot,
      }),
    ).toBe(false);
    expect(applyReadModelSnapshot).not.toHaveBeenCalled();
  });
});
