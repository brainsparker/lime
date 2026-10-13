import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readCanonicalThreadDetail } from "@/lib/api/agentRuntime/appServerCanonicalThreadProjection";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import { bindRecoveredCommands } from "./commandResume";
import { useCommandResume } from "./useCommandResume";

vi.mock("./commandResume", () => ({ bindRecoveredCommands: vi.fn() }));

const detail = readCanonicalThreadDetail({
  thread: {
    id: "thread",
    sessionId: "thread",
    createdAt: 1,
    updatedAt: 2,
    status: { type: "idle" },
    turns: [
      {
        id: "original",
        status: "completed",
        items: [
          {
            id: "command",
            type: "commandExecution",
            source: "unifiedExecStartup",
            status: "inProgress",
            processId: "process",
            command: "wait",
            cwd: "/workspace",
            aggregatedOutput: "ready\n",
          },
        ],
      },
    ],
  },
})!;

type Options = Parameters<typeof useCommandResume>[0];
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const cleanup = vi.fn();
let options: Options;

function Harness({ value }: { value: Options }) {
  useCommandResume(value);
  return null;
}
const render = async (value = options) => {
  await act(async () => {
    root.render(<Harness value={value} />);
  });
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.mocked(bindRecoveredCommands).mockResolvedValue(cleanup);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  options = {
    enabled: true,
    sessionId: "thread",
    threadRead: detail.thread_read,
    turns: detail.turns!,
    activeStreamRef: { current: null },
    listenerMapRef: { current: new Map() },
    runtime: {} as AgentRuntimeAdapter,
    setItems: vi.fn(),
    getItems: () => detail.items!,
  };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("冷恢复只订阅原 terminal Turn 的后台 Command，新 Turn 开始不会移除它", async () => {
  await render();
  expect(bindRecoveredCommands).toHaveBeenCalledTimes(1);
  expect(bindRecoveredCommands).toHaveBeenCalledWith(
    expect.objectContaining({
      threadId: "thread",
      commands: detail.items,
      signal: expect.any(AbortSignal),
    }),
  );
  options.activeStreamRef.current = {
    eventName: "new-event",
    sessionId: "thread",
    turnId: "new-turn",
    assistantMsgId: "new-assistant",
    pendingTurnKey: "new-turn",
    pendingItemKey: "new-item",
  };
  await render({
    ...options,
    turns: [
      ...options.turns,
      { ...detail.turns![0], id: "new-turn", status: "running" },
    ],
  });
  expect(bindRecoveredCommands).toHaveBeenCalledTimes(1);
  expect(cleanup).not.toHaveBeenCalled();
});

it("本地 live listener 仍在时不创建重复恢复监听", async () => {
  options.listenerMapRef.current.set("local-event", vi.fn());
  await render();
  expect(bindRecoveredCommands).not.toHaveBeenCalled();
});

it("running Turn 和非当前 Thread 的命令不进入后台恢复", async () => {
  await render({
    ...options,
    turns: [{ ...detail.turns![0], status: "running" }],
  });
  expect(bindRecoveredCommands).not.toHaveBeenCalled();
  await render({
    ...options,
    threadRead: {
      ...detail.thread_read!,
      thread_items: detail.items!.map((item) => ({
        ...item,
        thread_id: "foreign",
      })),
    },
  });
  expect(bindRecoveredCommands).not.toHaveBeenCalled();
});

it("异步绑定未结束即卸载时立即取消，迟到的 cleanup 仍执行一次", async () => {
  let finish!: (value: () => void) => void;
  vi.mocked(bindRecoveredCommands).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  const signal = vi.mocked(bindRecoveredCommands).mock.calls[0][0].signal!;
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish(cleanup);
  });
  expect(cleanup).toHaveBeenCalledTimes(1);
});
