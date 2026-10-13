import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { resetDefaultAppServerEventBusForTests } from "@/lib/api/appServerEventBus";
import {
  createThreadClient,
  type AgentRuntimeAppServerClient,
} from "@/lib/api/agentRuntime/threadClient";
import { resetAgentRuntimeEventSequenceGatesForTests } from "@/lib/api/agentRuntime/eventSequenceGate";
import {
  createAgentRuntimeAdapter,
  type AgentRuntimeAdapterDeps,
} from "./agentRuntimeAdapter";
import { bindRecoveredCommands } from "./commandResume";
import { readCanonicalThreadDetail } from "@/lib/api/agentRuntime/appServerCanonicalThreadProjection";

vi.mock("@/lib/dev-bridge", () => ({
  safeListen: vi.fn(async () => () => {}),
  safeInvoke: vi.fn(),
}));

const command = {
  id: "command",
  type: "commandExecution",
  source: "unifiedExecStartup",
  processId: "process",
  status: "inProgress",
  command: "wait",
  cwd: "/workspace",
  aggregatedOutput: "ready\n",
};
const thread = {
  id: "thread",
  sessionId: "thread",
  createdAt: 1,
  updatedAt: 2,
  cwd: "/workspace",
  status: { type: "idle" },
  turns: [
    {
      id: "original",
      status: "completed",
      startedAt: 1,
      completedAt: 2,
      items: [command],
    },
  ],
};
const result = (value: unknown) => ({ result: value, notifications: [] });

beforeEach(() => {
  vi.useFakeTimers();
  resetDefaultAppServerEventBusForTests();
  resetAgentRuntimeEventSequenceGatesForTests();
});
afterEach(() => {
  resetDefaultAppServerEventBusForTests();
  vi.useRealTimers();
});

it("typed resume/read -> 共享校验 -> drain route -> 同一 reducer 接通，原命令退出不覆盖新回合", async () => {
  let notifications: unknown[] = [];
  const appServerClient = {
    resumeThread: vi.fn(async () =>
      result({ thread: { ...thread, turns: [] } }),
    ),
    readThread: vi.fn(async () => result({ thread })),
    drainEvents: vi.fn(async () => notifications.splice(0)),
  } as unknown as AgentRuntimeAppServerClient;
  const client = createThreadClient({
    appServerClient,
    enableAppServerEventDrain: true,
  });
  const runtime = createAgentRuntimeAdapter({
    client: client as AgentRuntimeAdapterDeps["client"],
  });
  let items = readCanonicalThreadDetail({ thread })!.items!;
  const newItem = {
    ...items[0],
    id: "next-command",
    turn_id: "next",
    process_id: "next-process",
    aggregated_output: "next\n",
  } as AgentThreadItem;
  const cleanup = await bindRecoveredCommands({
    runtime,
    threadId: "thread",
    commands: [items[0]],
    getItems: () => items,
    setItems(value) {
      items = typeof value === "function" ? value(items) : value;
    },
  });
  expect(cleanup).not.toBeNull();
  expect(appServerClient.resumeThread).toHaveBeenCalledWith({
    threadId: "thread",
    excludeTurns: true,
  });
  expect(appServerClient.readThread).toHaveBeenCalledExactlyOnceWith({
    threadId: "thread",
    includeTurns: true,
  });
  items.push(newItem);
  notifications = [
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
          ...command,
          status: "completed",
          exitCode: 0,
          aggregatedOutput: "ready\ntail\n",
        },
        completedAtMs: 4000,
      },
    },
  ];
  await vi.advanceTimersByTimeAsync(100);
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    id: "command",
    turn_id: "original",
    process_id: "process",
    status: "completed",
    aggregated_output: "ready\ntail\n",
  });
  expect(items[1]).toEqual(newItem);
  const drains = vi.mocked(appServerClient.drainEvents).mock.calls.length;
  await vi.advanceTimersByTimeAsync(2000);
  expect(appServerClient.drainEvents).toHaveBeenCalledTimes(drains);
  expect(appServerClient.readThread).toHaveBeenCalledTimes(1);
  cleanup?.();
});

it("快照读取期间真实命令已退出时只恢复终态，不重新开始或留下监听", async () => {
  const completed = {
    ...thread,
    turns: [
      {
        ...thread.turns[0],
        items: [
          {
            ...command,
            status: "completed",
            exitCode: 0,
            aggregatedOutput: "ready\ntail\n",
          },
        ],
      },
    ],
  };
  const appServerClient = {
    resumeThread: vi.fn(async () =>
      result({ thread: { ...thread, turns: [] } }),
    ),
    readThread: vi.fn(async () => result({ thread: completed })),
    drainEvents: vi.fn(async () => []),
  } as unknown as AgentRuntimeAppServerClient;
  const client = createThreadClient({
    appServerClient,
    enableAppServerEventDrain: true,
  });
  const runtime = createAgentRuntimeAdapter({
    client: client as AgentRuntimeAdapterDeps["client"],
  });
  let items = readCanonicalThreadDetail({ thread })!.items!;
  await bindRecoveredCommands({
    runtime,
    threadId: "thread",
    commands: [items[0]],
    getItems: () => items,
    setItems(value) {
      items = typeof value === "function" ? value(items) : value;
    },
  });
  expect(items[0]).toMatchObject({
    status: "completed",
    exit_code: 0,
    aggregated_output: "ready\ntail\n",
  });
  expect(appServerClient.drainEvents).not.toHaveBeenCalled();
});
