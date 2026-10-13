import { describe, expect, it } from "vitest";
import {
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
