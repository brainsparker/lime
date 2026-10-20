import { beforeEach, expect, it, vi } from "vitest";
import { AppServerAgentSessionEventDrainRouter } from "./appServerEventStreamRouting";
import { createAgentRuntimeEventListener } from "../agentRuntimeEvents";
import { resetAgentRuntimeEventSequenceGatesForTests } from "./eventSequenceGate";
import type { AppServerEventBusSubscription } from "../appServerEventBus";
import type { AppServerJsonRpcNotification } from "../appServer";

beforeEach(resetAgentRuntimeEventSequenceGatesForTests);

it("恢复活动 Turn 后继续接收真实问题 Item 与终态，不需要重复 turn/started", async () => {
  let subscription: AppServerEventBusSubscription | undefined;
  const stop = vi.fn();
  const router = new AppServerAgentSessionEventDrainRouter(
    { drainEvents: () => [] },
    {
      subscribe(value) {
        subscription = value;
        return stop;
      },
    },
  );
  const received: unknown[] = [];
  const unlisten = await createAgentRuntimeEventListener({
    listen: async () => () => {},
  })("agentSession/event/thread", (event) => received.push(event.payload));
  router.restoreThread({
    eventName: "agentSession/event/thread",
    thread: {
      id: "thread",
      turns: [{ id: "active", status: "inProgress", startedAt: 1, items: [] }],
    } as Parameters<typeof router.restoreThread>[0]["thread"],
  });
  expect(subscription).toBeDefined();
  const item = {
    id: "question",
    type: "agentMessage",
    text: "继续？",
    delivery: "async",
    questions: [{ title: "继续？", options: ["方案 A"] }],
  };
  subscription!.onNotifications!([
    {
      method: "item/started",
      params: {
        threadId: "foreign",
        turnId: "active",
        item,
        startedAtMs: 1000,
      },
    },
    {
      method: "item/started",
      params: {
        threadId: "thread",
        turnId: "foreign",
        item,
        startedAtMs: 1000,
      },
    },
    {
      method: "item/started",
      params: { threadId: "thread", turnId: "active", item, startedAtMs: 1000 },
    },
    {
      method: "item/completed",
      params: {
        threadId: "thread",
        turnId: "active",
        item,
        completedAtMs: 2000,
      },
    },
    {
      method: "turn/completed",
      params: {
        threadId: "thread",
        turn: {
          id: "active",
          status: "completed",
          startedAt: 1,
          completedAt: 3,
          items: [item],
        },
      },
    },
  ]);
  expect(received).toMatchObject([
    {
      type: "item_started",
      item: { id: "question", turn_id: "active", questions: item.questions },
    },
    {
      type: "item_completed",
      item: { id: "question", turn_id: "active", questions: item.questions },
    },
    { type: "turn_completed", turn: { id: "active", status: "completed" } },
  ]);
  expect(received).toHaveLength(3);
  expect(stop).toHaveBeenCalledTimes(1);
  unlisten();
});

it.each(["completed", "inProgress"])(
  "canonical %s 快照恢复原 Command route，无 started 通知也能消费后续输出和单次退出",
  async (status) => {
    let subscription: AppServerEventBusSubscription | undefined;
    const stop = vi.fn();
    const router = new AppServerAgentSessionEventDrainRouter(
      { drainEvents: () => [] },
      {
        subscribe(value) {
          subscription = value;
          return stop;
        },
      },
    );
    const received: unknown[] = [];
    const unlisten = await createAgentRuntimeEventListener({
      listen: async () => () => {},
    })("restored-route", (event) => received.push(event.payload));
    const item = {
      id: "command",
      type: "commandExecution",
      source: "unifiedExecStartup",
      processId: "process",
      status: "inProgress",
      command: "wait",
      cwd: "/workspace",
      aggregatedOutput: "ready\n",
    };
    router.restoreThread({
      eventName: "restored-route",
      thread: {
        id: "thread",
        turns: [
          {
            id: "original",
            status,
            startedAt: 1,
            completedAt: status === "completed" ? 2 : null,
            items: [item],
          },
        ],
      } as Parameters<typeof router.restoreThread>[0]["thread"],
    });
    expect(received).toEqual([]);
    expect(subscription).toBeDefined();
    if (status === "inProgress") {
      subscription!.onNotifications!([
        {
          method: "turn/completed",
          params: {
            threadId: "thread",
            turn: {
              id: "original",
              status: "completed",
              startedAt: 1,
              completedAt: 2,
              items: [item],
            },
          },
        },
      ]);
      expect(stop).not.toHaveBeenCalled();
      received.length = 0;
    }
    subscription!.onNotifications!([
      {
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "foreign",
          turnId: "original",
          itemId: "command",
          delta: "foreign",
        },
      },
      {
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "thread",
          turnId: "foreign",
          itemId: "command",
          delta: "foreign",
        },
      },
      {
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "thread",
          turnId: "original",
          itemId: "foreign",
          delta: "foreign",
        },
      },
      {
        method: "item/completed",
        params: {
          threadId: "thread",
          turnId: "original",
          item: { ...item, status: "completed", processId: "foreign" },
          completedAtMs: 3000,
        },
      },
      {
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "thread",
          turnId: "original",
          itemId: "command",
          delta: "tail\n",
        },
      },
      {
        method: "item/completed",
        params: {
          threadId: "thread",
          turnId: "original",
          item: {
            ...item,
            status: "completed",
            exitCode: 0,
            aggregatedOutput: "ready\ntail\n",
          },
          completedAtMs: 4000,
        },
      },
      {
        method: "item/commandExecution/outputDelta",
        params: {
          threadId: "thread",
          turnId: "original",
          itemId: "command",
          delta: "late",
        },
      },
    ]);
    expect(received).toMatchObject([
      { type: "tool_output_delta", delta: "tail\n" },
      {
        type: "item_completed",
        item: {
          id: "command",
          turn_id: "original",
          status: "completed",
          process_id: "process",
        },
      },
    ]);
    expect(received).toHaveLength(2);
    expect(stop).toHaveBeenCalledTimes(1);
    unlisten();
  },
);

it("后台命令保留原 route，下一 Turn 不覆盖它，真实退出后才回收订阅", async () => {
  let subscription: AppServerEventBusSubscription | undefined;
  const stop = vi.fn();
  const router = new AppServerAgentSessionEventDrainRouter(
    { drainEvents: () => [] },
    {
      subscribe(value) {
        subscription = value;
        return stop;
      },
    },
  );
  const received: unknown[] = [];
  const unlisten = await createAgentRuntimeEventListener({
    listen: async () => () => {},
  })("background-route", (event) => received.push(event.payload));
  const notification = (
    method: string,
    params: Record<string, unknown>,
  ): AppServerJsonRpcNotification => ({ method, params });
  const item = {
    id: "command",
    type: "commandExecution",
    source: "unifiedExecStartup",
    processId: "process",
    status: "inProgress",
    command: "read answer",
    cwd: "/workspace",
  };
  router.register({ eventName: "background-route", sessionId: "thread" });
  subscription!.onNotifications!([
    notification("turn/started", {
      threadId: "thread",
      turn: { id: "original", status: "inProgress", startedAt: 1 },
    }),
    notification("item/started", {
      threadId: "thread",
      turnId: "original",
      item,
      startedAtMs: 1000,
    }),
    notification("turn/completed", {
      threadId: "thread",
      turn: {
        id: "original",
        status: "completed",
        startedAt: 1,
        completedAt: 2,
        items: [item],
      },
    }),
  ]);
  expect(stop).not.toHaveBeenCalled();
  router.register({ eventName: "background-route", sessionId: "thread" });
  subscription!.onNotifications!([
    notification("turn/started", {
      threadId: "thread",
      turn: { id: "next", status: "inProgress", startedAt: 3 },
    }),
    notification("item/commandExecution/outputDelta", {
      threadId: "thread",
      turnId: "original",
      itemId: "command",
      delta: "tail\n",
    }),
    notification("item/agentMessage/delta", {
      threadId: "thread",
      turnId: "original",
      itemId: "late",
      delta: "must not reopen",
    }),
    notification("item/completed", {
      threadId: "thread",
      turnId: "original",
      item: {
        ...item,
        status: "completed",
        exitCode: 0,
        aggregatedOutput: "tail\n",
      },
      completedAtMs: 4000,
    }),
    notification("turn/completed", {
      threadId: "thread",
      turn: { id: "next", status: "completed", startedAt: 3, completedAt: 5 },
    }),
    notification("item/commandExecution/outputDelta", {
      threadId: "thread",
      turnId: "original",
      itemId: "command",
      delta: "late",
    }),
  ]);
  expect(received).toMatchObject([
    { type: "turn_started" },
    { type: "item_started" },
    { type: "turn_completed" },
    { type: "turn_started", turn: { id: "next" } },
    { type: "tool_output_delta", delta: "tail\n" },
    {
      type: "item_completed",
      item: { id: "command", turn_id: "original", status: "completed" },
    },
    { type: "turn_completed", turn: { id: "next" } },
  ]);
  expect(stop).toHaveBeenCalledTimes(1);
  unlisten();
});
