import { describe, expect, it } from "vitest";
import type { AgentThreadTurn } from "@/lib/api/agentProtocol";
import {
  hasActiveRuntimeTurn,
  hasActiveThreadReadActivity,
  hasRunningCommandReadActivity,
  hasRunningThreadReadActivity,
} from "./threadReadActivity";

describe("hasRunningCommandReadActivity", () => {
  const command = {
    id: "item-command",
    type: "command_execution",
    thread_id: "thread-1",
    turn_id: "turn-1",
    status: "in_progress",
    source: "unifiedExecStartup",
    process_id: "process-1",
  };
  const threadRead = {
    thread_id: "thread-1",
    status: "completed",
    turns: [{ turn_id: "turn-1", status: "completed" }],
    thread_items: [command],
  };

  it("完成回合内的真实后台命令保持独立活动，不将回合重新标为活动", () => {
    expect(hasRunningCommandReadActivity(threadRead)).toBe(true);
    expect(hasActiveThreadReadActivity(threadRead)).toBe(false);
    expect(hasRunningThreadReadActivity(threadRead)).toBe(false);
  });

  it.each([
    { status: "completed" },
    { source: "userShell" },
    { type: "agent_message" },
    { process_id: "" },
    { thread_id: "other-thread" },
    { turn_id: "" },
    { id: "" },
  ])("拒绝终态、无进程和不匹配的执行身份 %j", (override) => {
    expect(
      hasRunningCommandReadActivity({
        ...threadRead,
        thread_items: [{ ...command, ...override }],
      }),
    ).toBe(false);
  });
});

describe("hasActiveThreadReadActivity", () => {
  it("active turn running 时返回 true", () => {
    expect(
      hasActiveThreadReadActivity({
        status: "running",
        active_turn_id: "turn-active",
        turns: [{ turn_id: "turn-active", status: "running" }],
      }),
    ).toBe(true);
  });

  it("没有 active turn 时返回 false", () => {
    expect(
      hasActiveThreadReadActivity({
        status: "running",
        active_turn_id: null,
        turns: [{ turn_id: "turn-running", status: "running" }],
      }),
    ).toBe(false);
  });

  it("active turn 已完成时返回 false", () => {
    expect(
      hasActiveThreadReadActivity({
        status: "running",
        active_turn_id: "turn-completed",
        turns: [{ turn_id: "turn-completed", status: "completed" }],
      }),
    ).toBe(false);
  });

  it("canonical queued status 仍作为运行活动", () => {
    expect(
      hasRunningThreadReadActivity(
        {
          status: "queued",
          updated_at: "2026-07-19T12:00:00.000Z",
        },
        { nowMs: Date.parse("2026-07-19T12:00:01.000Z") },
      ),
    ).toBe(true);
  });

  it("pending request 可维持 active turn 的运行活动", () => {
    expect(
      hasRunningThreadReadActivity(
        {
          status: "running",
          active_turn_id: "turn-active",
          pending_requests: [{ id: "request-1" }],
          turns: [
            {
              turn_id: "turn-active",
              status: "running",
              updated_at: "2026-07-19T11:00:00.000Z",
            },
          ],
        },
        {
          nowMs: Date.parse("2026-07-19T12:00:00.000Z"),
          staleRunningMs: 1_000,
        },
      ),
    ).toBe(true);
  });
});

function createTurn(overrides: Partial<AgentThreadTurn> = {}): AgentThreadTurn {
  return {
    id: "turn-1",
    thread_id: "thread-1",
    status: "completed",
    prompt_text: "默认 turn",
    started_at: "2026-03-29T00:00:00.000Z",
    created_at: "2026-03-29T00:00:00.000Z",
    updated_at: "2026-03-29T00:00:02.000Z",
    ...overrides,
  };
}

describe("hasActiveRuntimeTurn", () => {
  it("canonical queued status 应阻塞下一轮用户提交", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "queued",
        turns: [createTurn({ status: "completed" })],
      }),
    ).toBe(true);

    expect(
      hasActiveRuntimeTurn({
        threadRead: {
          thread_id: "thread-queued",
          status: "queued",
          pending_requests: [],
          incidents: [],
        },
        threadReadStatus: "queued",
        turns: [createTurn({ status: "completed" })],
      }),
    ).toBe(true);

    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "queued",
        turns: [
          createTurn({
            status: "running",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        ],
      }),
    ).toBe(true);
  });

  it.each(["waitingAction", "blocked"])(
    "%s 的 canonical active Turn 仍属于活动运行时",
    (status) => {
      const threadRead = {
        thread_id: "thread-waiting",
        status,
        profile_status: "blocked" as const,
        active_turn_id: "turn-waiting",
        turns: [{ turn_id: "turn-waiting", status: "running" as const }],
      };
      expect(
        hasActiveRuntimeTurn({ threadRead, threadReadStatus: status, turns: [] }),
      ).toBe(true);
      expect(
        hasActiveRuntimeTurn({
          threadRead: { ...threadRead, active_turn_id: undefined },
          threadReadStatus: status,
          turns: [],
        }),
      ).toBe(false);
      expect(
        hasActiveRuntimeTurn({
          threadRead: {
            ...threadRead,
            turns: [{ turn_id: "turn-waiting", status: "completed" }],
          },
          threadReadStatus: status,
          turns: [],
        }),
      ).toBe(false);
    },
  );

  it("无权威 read model 时陈旧本地 running turn 不应永久阻塞输入框", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: null,
        turns: [
          createTurn({
            status: "running",
            started_at: "2026-03-29T00:00:00.000Z",
            updated_at: "2026-03-29T00:00:01.000Z",
          }),
        ],
      }),
    ).toBe(false);
  });

  it("无权威 read model 时近期本地 running turn 可短暂阻塞重复提交", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: null,
        turns: [
          createTurn({
            status: "running",
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        ],
      }),
    ).toBe(true);
  });

  it("running read model 只有 active_turn_id 时也应阻塞下一轮用户提交", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "running",
        threadRead: {
          thread_id: "thread-running",
          status: "running",
          active_turn_id: "turn-running",
          turns: [],
        },
        turns: [],
      }),
    ).toBe(true);
  });

  it("read model 已明确 idle 时不应被残留 running turn 判定为 active runtime", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "idle",
        threadRead: {
          thread_id: "thread-1",
          status: "idle",
          turns: [
            {
              turn_id: "turn-running-1",
              status: "running",
            },
          ],
        },
        turns: [],
      }),
    ).toBe(false);

    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "idle",
        threadRead: {
          thread_id: "thread-1",
          status: "idle",
          profile_status: "running",
          turns: [],
        },
        turns: [],
      }),
    ).toBe(true);
  });

  it("显式终态 read model 不应被残留 running turn 判定为 active runtime", () => {
    expect(
      hasActiveRuntimeTurn({
        threadReadStatus: "failed",
        threadRead: {
          thread_id: "thread-1",
          status: "failed",
          active_turn_id: "turn-stale",
          turns: [
            {
              turn_id: "turn-stale",
              status: "running",
            },
          ],
        },
        turns: [createTurn({ status: "running" })],
      }),
    ).toBe(false);
  });

});
