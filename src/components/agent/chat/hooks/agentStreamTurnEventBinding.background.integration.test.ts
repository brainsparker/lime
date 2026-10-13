import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { StreamRequestState } from "./agentStreamRuntimeHandlerTypes";
import { registerAgentStreamTurnEventBinding } from "./agentStreamTurnEventBinding";
import { activityLogger } from "@/lib/workspace/workbenchRuntime";

const noopDispatch = <T>() => vi.fn() as unknown as Dispatch<SetStateAction<T>>;

afterEach(() => {
  vi.useRealTimers();
  activityLogger.clear();
});

describe("Turn binding session Command lifecycle", () => {
  it("模型 Turn 结束后保留监听，真实命令输出与终态到达后释放且不重启 sending", async () => {
    vi.useFakeTimers();
    let handler: (event: { payload: unknown }) => void = () => {};
    const unlisten = vi.fn();
    let dispose: () => void = () => {};
    const disposeListener = vi.fn(() => dispose());
    const activateStream = vi.fn();
    const setIsSending = vi.fn();
    const runtime = {
      listenToTurnEvents: vi.fn(async (_name, listener) => {
        handler = listener;
        return unlisten;
      }),
    } as unknown as AgentRuntimeAdapter;
    const command: AgentThreadItem = {
      id: "command",
      type: "command_execution",
      thread_id: "thread",
      turn_id: "original",
      status: "in_progress",
      sequence: 0,
      started_at: "2026-10-12T00:00:00Z",
      updated_at: "2026-10-12T00:00:00Z",
      command: "wait for release",
      cwd: "/workspace",
      source: "unifiedExecStartup",
      process_id: "process",
      aggregated_output: "ready\n",
    };
    let items = [command];
    const requestState: StreamRequestState = {
      accumulatedContent: "",
      currentTurnId: "original",
      requestLogId: null,
      requestStartedAt: 0,
      requestFinished: false,
    };
    dispose = await registerAgentStreamTurnEventBinding({
      runtime,
      eventName: "event",
      requestState,
      skipUserMessage: false,
      effectiveProviderType: "openai",
      effectiveModel: "fixture",
      effectiveExecutionStrategy: "react",
      content: "run",
      activeSessionId: "thread",
      resolvedWorkspaceId: "workspace",
      assistantMsgId: "assistant",
      pendingTurnKey: "pending-turn",
      pendingItemKey: "pending-item",
      effectiveWaitingRuntimeStatus: { phase: "preparing", title: "处理中" },
      warnedKeysRef: { current: new Set() },
      actionLoggedKeys: new Set(),
      toolLogIdByToolId: new Map(),
      toolStartedAtByToolId: new Map(),
      toolNameByToolId: new Map(),
      callbacks: {
        activateStream,
        isStreamActivated: () => true,
        clearOptimisticItem: vi.fn(),
        clearOptimisticTurn: vi.fn(),
        disposeListener,
        clearActiveStreamIfMatch: () => true,
      },
      appendThinkingToParts: (parts) => parts,
      setMessages: noopDispatch(),
      setPendingActions: noopDispatch(),
      getThreadItems: () => items,
      setThreadItems: (value) => {
        items = typeof value === "function" ? value(items) : value;
      },
      setThreadTurns: noopDispatch(),
      setCurrentTurnId: noopDispatch(),
      setExecutionRuntime: noopDispatch(),
      setIsSending,
    });
    handler({
      payload: {
        type: "turn_completed",
        text: "background started",
        protocol_method: "turn/completed",
        turn: {
          id: "original",
          thread_id: "thread",
          status: "completed",
          prompt_text: "run",
          started_at: "2026-10-12T00:00:00Z",
          created_at: "2026-10-12T00:00:00Z",
          updated_at: "2026-10-12T00:00:01Z",
          completed_at: "2026-10-12T00:00:01Z",
        },
      },
    });
    expect(requestState.requestFinished).toBe(true);
    expect(setIsSending).toHaveBeenLastCalledWith(false);
    expect(unlisten).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(disposeListener).not.toHaveBeenCalled();
    activateStream.mockClear();
    setIsSending.mockClear();
    handler({
      payload: {
        type: "tool_output_delta",
        thread_id: "thread",
        turn_id: "original",
        tool_id: "command",
        delta: "tail\n",
        protocol_method: "item/commandExecution/outputDelta",
      },
    });
    expect(items[0]).toMatchObject({
      status: "in_progress",
      aggregated_output: "ready\ntail\n",
    });
    expect(unlisten).not.toHaveBeenCalled();
    handler({
      payload: {
        type: "item_completed",
        protocol_method: "item/completed",
        item: {
          ...command,
          status: "completed",
          exit_code: 0,
          aggregated_output: "ready\ntail\n",
        },
      },
    });
    expect(items[0]).toMatchObject({
      status: "completed",
      exit_code: 0,
      aggregated_output: "ready\ntail\n",
    });
    expect(disposeListener).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(activateStream).not.toHaveBeenCalled();
    expect(setIsSending).not.toHaveBeenCalled();
  });
});
