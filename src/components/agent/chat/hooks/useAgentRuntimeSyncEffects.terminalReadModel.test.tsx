import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCanonicalThreadDetail } from "@/lib/api/agentRuntime/appServerCanonicalThreadProjection";
import {
  cleanupRuntimeSyncEffectsTestHarness,
  createThreadTurn,
  mountHook,
  setupRuntimeSyncEffectsTestHarness,
} from "./useAgentRuntimeSyncEffects.testHarness";

describe("useAgentRuntimeSyncEffects terminal read model", () => {
  beforeEach(() => {
    setupRuntimeSyncEffectsTestHarness();
  });

  afterEach(() => {
    cleanupRuntimeSyncEffectsTestHarness();
  });

  it("真实 thread/read detail 冷恢复后台命令后持续刷新并在实际终态停止", async () => {
    const detailFor = (status: "inProgress" | "completed") =>
      readCanonicalThreadDetail({
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          createdAt: 1780704000,
          updatedAt: 1780704002,
          status: { type: "idle" },
          turns: [
            {
              id: "turn-1",
              status: "completed",
              items: [
                {
                  id: "item-background",
                  type: "commandExecution",
                  command: "printf ready; read answer",
                  cwd: "/tmp/workspace",
                  status,
                  source: "unifiedExecStartup",
                  processId: "process-background",
                  aggregatedOutput:
                    status === "completed" ? "ready\ntail" : "ready",
                  ...(status === "completed" ? { exitCode: 0 } : {}),
                },
              ],
            },
          ],
        },
      });
    const running = detailFor("inProgress");
    expect(running).not.toBeNull();
    const refreshSessionDetail = vi.fn(async () => true);
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      threadRead: running!.thread_read,
      threadReadStatus: "idle",
      threadTurns: running!.turns,
      refreshSessionDetail,
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });
      expect(refreshSessionDetail).toHaveBeenCalledExactlyOnceWith(
        "session-1",
        {
          source: "runtimeSync.recoveredPoll",
          detailMergeMode: "runtime_sync",
        },
      );
      expect(running!.thread_read?.thread_items).toEqual(running!.items);
      expect(running!.thread_read?.thread_items?.[0]).toMatchObject({
        id: "item-background",
        thread_id: "thread-1",
        turn_id: "turn-1",
        status: "in_progress",
        process_id: "process-background",
      });
      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();

      const completed = detailFor("completed");
      await harness.render({
        threadRead: completed!.thread_read,
        threadTurns: completed!.turns,
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      expect(refreshSessionDetail).toHaveBeenCalledTimes(1);
      expect(completed!.thread_read?.thread_items?.[0]).toMatchObject({
        id: "item-background",
        status: "completed",
        process_id: "process-background",
        aggregated_output: "ready\ntail",
        exit_code: 0,
      });
      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("冷恢复终态回合中的后台命令仍刷新，实际命令完成后停止", async () => {
    const refreshSessionDetail = vi.fn(async () => true);
    const settleActiveRuntimeStream = vi.fn();
    const command = {
      id: "item-background",
      type: "command_execution",
      thread_id: "thread-1",
      turn_id: "turn-1",
      status: "in_progress",
      source: "unifiedExecStartup",
      process_id: "process-background",
    };
    const threadRead = {
      thread_id: "thread-1",
      status: "completed",
      turns: [{ turn_id: "turn-1", status: "completed" }],
      thread_items: [command],
    };
    const harness = await mountHook({
      threadRead,
      threadReadStatus: "completed",
      threadTurns: [createThreadTurn()],
      refreshSessionDetail,
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        vi.advanceTimersByTime(1500);
        await Promise.resolve();
      });
      expect(refreshSessionDetail).toHaveBeenCalledExactlyOnceWith(
        "session-1",
        {
          source: "runtimeSync.recoveredPoll",
          detailMergeMode: "runtime_sync",
        },
      );
      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();

      await harness.render({
        threadRead: {
          ...threadRead,
          thread_items: [{ ...command, status: "completed" }],
        },
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });
      expect(refreshSessionDetail).toHaveBeenCalledTimes(1);
      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("旧终态 timeline 不应误收起当前本地 running turn", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "idle",
      threadRead: {
        thread_id: "thread-1",
        status: "idle",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("旧 completed thread read 不应误收起新发起的当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "completed",
      threadRead: {
        thread_id: "thread-1",
        status: "completed",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("本地 running turn 尚未绑定 stream turnId 时旧 completed read 不应收起当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: null,
      threadReadStatus: "completed",
      threadRead: {
        thread_id: "thread-1",
        status: "completed",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("本地 running turn 尚未绑定 stream turnId 时 idle 历史终态不应收起当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: null,
      threadReadStatus: "idle",
      threadRead: {
        thread_id: "thread-1",
        status: "idle",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("listener 已绑定但 runtime turnId 尚未到达时不应消费历史终态", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentTurnEventName: "agent_stream-current",
      currentStreamTurnId: null,
      threadReadStatus: "completed",
      threadRead: {
        thread_id: "thread-1",
        status: "completed",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("active listener ref 已写入时应屏蔽旧 effect 闭包中的历史终态", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const currentTurnEventNameRef = { current: "agent_stream-current" };
    const harness = await mountHook({
      isSending: true,
      currentTurnEventName: null,
      currentTurnEventNameRef,
      currentStreamTurnId: null,
      threadReadStatus: "completed",
      threadRead: {
        thread_id: "thread-1",
        status: "completed",
        active_turn_id: "turn-previous",
        turns: [{ turn_id: "turn-previous", status: "completed" }],
      },
      threadTurns: [
        createThreadTurn({ id: "turn-previous", status: "completed" }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("旧 done thread read 不应误收起新发起的当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "done",
      threadRead: {
        thread_id: "thread-1",
        status: "done",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "completed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("旧 canceled thread read 不应误收起新发起的当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "canceled",
      threadRead: {
        thread_id: "thread-1",
        status: "canceled",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "canceled",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "canceled",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("本地 running turn 尚未绑定 stream turnId 时旧 failed read 不应收起当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: null,
      threadReadStatus: "failed",
      threadRead: {
        thread_id: "thread-1",
        status: "failed",
        active_turn_id: "turn-previous",
        turns: [
          {
            turn_id: "turn-previous",
            status: "failed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-previous",
          status: "failed",
        }),
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });

  it("thread_read active turn 已终态时应覆盖本地 running 并收起 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "running",
      threadRead: {
        thread_id: "thread-1",
        status: "running",
        active_turn_id: "turn-current",
        turns: [
          {
            turn_id: "turn-current",
            status: "completed",
          },
        ],
      },
      threadTurns: [
        createThreadTurn({
          id: "pending-turn-current",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).toHaveBeenCalledTimes(1);
      expect(settleActiveRuntimeStream).toHaveBeenCalledWith("session-1");
    } finally {
      harness.unmount();
    }
  });

  it("threadTurns 中当前 turn 已终态时应收起 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "idle",
      threadRead: {
        thread_id: "thread-1",
        status: "idle",
        turns: [],
      },
      threadTurns: [
        createThreadTurn({
          id: "turn-current",
          status: "completed",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).toHaveBeenCalledTimes(1);
      expect(settleActiveRuntimeStream).toHaveBeenCalledWith("session-1");
    } finally {
      harness.unmount();
    }
  });

  it("当前 turn 已终态且后续 turn 仍排队时应只收起当前 stream", async () => {
    const settleActiveRuntimeStream = vi.fn();
    const harness = await mountHook({
      isSending: true,
      currentStreamTurnId: "turn-current",
      threadReadStatus: "completed",
      threadRead: {
        thread_id: "thread-1",
        status: "completed",
        active_turn_id: null,
        turns: [],
      },
      queuedTurnCount: 1,
      threadTurns: [
        createThreadTurn({
          id: "turn-current",
          status: "completed",
        }),
        createThreadTurn({
          id: "turn-queued",
          status: "running",
        }),
      ],
      settleActiveRuntimeStream,
    });

    try {
      await act(async () => {
        await Promise.resolve();
      });

      expect(settleActiveRuntimeStream).toHaveBeenCalledTimes(1);
      expect(settleActiveRuntimeStream).toHaveBeenCalledWith("session-1");
    } finally {
      harness.unmount();
    }
  });

  it("diagnostics 最新 turn 已终态时不应继续 recovered poll", async () => {
    const refreshSessionDetail = vi.fn(async () => true);
    const harness = await mountHook({
      isSending: false,
      threadReadStatus: "running",
      threadRead: {
        thread_id: "thread-1",
        status: "running",
        active_turn_id: "turn-stale",
        diagnostics: {
          latest_turn_status: "completed",
        },
        turns: [],
      },
      refreshSessionDetail,
    });

    try {
      await act(async () => {
        vi.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(refreshSessionDetail).not.toHaveBeenCalled();
    } finally {
      harness.unmount();
    }
  });
});
