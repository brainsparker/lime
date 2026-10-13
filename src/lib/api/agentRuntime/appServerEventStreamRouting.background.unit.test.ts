import { beforeEach, expect, it, vi } from "vitest";
import { AppServerAgentSessionEventDrainRouter } from "./appServerEventStreamRouting";
import { createAgentRuntimeEventListener } from "../agentRuntimeEvents";
import { resetAgentRuntimeEventSequenceGatesForTests } from "./eventSequenceGate";
import type { AppServerEventBusSubscription } from "../appServerEventBus";
import type { AppServerJsonRpcNotification } from "../appServer";

beforeEach(resetAgentRuntimeEventSequenceGatesForTests);

it("canonical 快照直接恢复原 Command route，无 started 通知也能消费后续输出和单次退出", async () => {
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
  router.restoreCommands({
    eventName: "restored-route",
    thread: {
      id: "thread",
      turns: [
        {
          id: "original",
          status: "completed",
          startedAt: 1,
          completedAt: 2,
          items: [item],
        },
      ],
    } as Parameters<typeof router.restoreCommands>[0]["thread"],
  });
  expect(received).toEqual([]);
  expect(subscription).toBeDefined();
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
});

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
