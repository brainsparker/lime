import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposerSubmissionRestoreToken } from "../components/composerSubmissionSettlement";
import { createRestoreTokenFixture } from "./agentStreamRestoreToken.testFixtures";
import { useAgentStream } from "./useAgentStream";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import { activityLogger } from "@/lib/workspace/workbenchRuntime";
import { clearAllAgentStreamTextOverlays } from "./agentStreamTextOverlayStore";
import {
  rememberLocallyInterruptedAgentStreamBinding,
  rememberLocallyStartedAgentStreamBinding,
} from "./streamBindingRecords";

vi.mock("@/lib/api/permissionProfiles", () => ({
  resolveAllowedPermissionProfile: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/lib/api/modelRegistry", () => ({
  modelRegistryApi: {
    getModelRegistry: vi.fn().mockResolvedValue({ models: [] }),
  },
}));
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  activityLogger.clear();
  clearAllAgentStreamTextOverlays();
  vi.restoreAllMocks();
});

function mountHook(
  configure?: (
    fixture: ReturnType<typeof createRestoreTokenFixture>,
  ) => Partial<Parameters<typeof useAgentStream>[0]>,
) {
  const f = createRestoreTokenFixture();
  const options = {
    ...f.env,
    waitForSessionProviderSelectionSync:
      f.env.waitForSessionProviderSelectionSync!,
    setTodoItems: f.env.setTodoItems!,
    currentAssistantMsgIdRef: { current: null },
    currentStreamingSessionIdRef: { current: null },
    currentStreamingEventNameRef: { current: null },
    getMessages: () => f.state.messages,
    executionRuntime: null,
    threadBusy: false,
    threadTurns: [],
    onRestoreInterruptedInput: f.onRestoreInterruptedInput,
    ...configure?.(f),
  };
  let current: ReturnType<typeof useAgentStream> | undefined;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness() {
    current = useAgentStream(options);
    return null;
  }
  act(() => root.render(<Harness />));
  return {
    ...f,
    getHook: () => current!,
    rerender: (patch: Partial<Parameters<typeof useAgentStream>[0]>) => {
      Object.assign(options, patch);
      act(() => root.render(<Harness />));
    },
    unmount: () => {
      act(() => {
        current?.detachStreamBindings();
        root.unmount();
      });
      container.remove();
    },
  };
}
function token(): ComposerSubmissionRestoreToken {
  return Object.freeze({ kind: "composer-submission" });
}

describe("useAgentStream restore capability lifetime", () => {
  it.each([
    ["submitted", rememberLocallyStartedAgentStreamBinding],
    ["interrupted", rememberLocallyInterruptedAgentStreamBinding],
  ] as const)(
    "同线程前一回合 %s 不能阻断后续回合的恢复和终态",
    async (kind, remember) => {
      const sessionId = `restore-after-${kind}`;
      const turnId = "next-canonical-turn";
      remember({
        assistantMsgId: "previous-assistant",
        eventName: `agent_stream_${kind}`,
        sessionId,
        turnId: "previous-canonical-turn",
      });
      const handlers = new Set<(event: { payload: unknown }) => void>();
      const h = mountHook((f) => ({
        sessionId,
        runtime: {
          ...f.env.runtime,
          listenToTurnEvents: vi.fn<AgentRuntimeAdapter["listenToTurnEvents"]>(
            async (_eventName, handler) => {
              handlers.add(handler);
              return () => handlers.delete(handler);
            },
          ),
          resumeThread: vi.fn().mockResolvedValue(true),
        },
        allowRecoveredStreamBinding: true,
        threadBusy: true,
        threadRead: {
          thread_id: sessionId,
          active_turn_id: turnId,
          status: "running",
          turns: [{ id: turnId, status: "running" }],
        } as NonNullable<Parameters<typeof useAgentStream>[0]["threadRead"]>,
      }));
      try {
        await act(async () => {});
        expect(handlers.size).toBe(1);
        expect(h.getHook().isSending).toBe(true);
        act(() => {
          const timestamp = new Date().toISOString();
          for (const handler of handlers) {
            handler({
              payload: {
                type: "turn_completed",
                protocol_method: "turn/completed",
                session_id: sessionId,
                turn_id: turnId,
                turn: {
                  id: turnId,
                  thread_id: sessionId,
                  prompt_text: "",
                  status: "completed",
                  started_at: timestamp,
                  completed_at: timestamp,
                  created_at: timestamp,
                  updated_at: timestamp,
                },
              },
            });
          }
        });
        expect(h.getHook().isSending).toBe(false);
        expect(handlers.size).toBe(0);
      } finally {
        h.unmount();
      }
    },
  );

  it("恢复流的展示回调更新不能卸载当前线程监听或丢失真实终态", async () => {
    const handlers = new Set<(event: { payload: unknown }) => void>();
    const listen = vi.fn(
      async (
        _eventName: string,
        handler: (event: { payload: unknown }) => void,
      ) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
    );
    const h = mountHook((f) => ({
      runtime: {
        ...f.env.runtime,
        listenToTurnEvents: listen,
        resumeThread: vi.fn().mockResolvedValue(true),
      },
      allowRecoveredStreamBinding: true,
      threadBusy: true,
      threadRead: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        status: "running",
        turns: [{ id: "turn-1", status: "running" }],
      } as NonNullable<Parameters<typeof useAgentStream>[0]["threadRead"]>,
      onWriteFile: vi.fn(),
    }));
    try {
      await act(async () => {});
      expect(handlers.size).toBe(1);
      expect(h.getHook().isSending).toBe(true);
      h.rerender({ onWriteFile: vi.fn() });
      await act(async () => {});
      expect(handlers.size).toBe(1);
      act(() => {
        const timestamp = new Date().toISOString();
        for (const handler of handlers) {
          handler({
            payload: {
              type: "turn_completed",
              protocol_method: "turn/completed",
              session_id: "session-1",
              turn_id: "turn-1",
              turn: {
                id: "turn-1",
                thread_id: "thread-1",
                prompt_text: "",
                status: "completed",
                started_at: timestamp,
                completed_at: timestamp,
                created_at: timestamp,
                updated_at: timestamp,
              },
            },
          });
        }
      });
      expect(h.getHook().isSending).toBe(false);
      expect(handlers.size).toBe(0);
    } finally {
      h.unmount();
    }
  });

  it.each([false, true])(
    "preserves token identity with active stream detached=%s",
    async (detached) => {
      const h = mountHook();
      const original = token();
      try {
        await act(async () => {
          await h
            .getHook()
            .sendMessage(
              "原输入",
              [],
              false,
              false,
              false,
              undefined,
              undefined,
              undefined,
              { composerRestoreToken: original },
            );
        });
        if (detached) act(() => h.getHook().detachStreamBindings());
        await act(async () => {
          await h.getHook().stopSending();
        });
        const request = h.onRestoreInterruptedInput.mock.calls[0][0];
        expect(request.composerRestoreToken).toBe(original);
        expect(request.draft.text).toBe("原输入");
        expect(request.draft).not.toHaveProperty("composerRestoreToken");
        const count = h.onRestoreInterruptedInput.mock.calls.length;
        await act(async () => {
          await h.getHook().stopSending();
        });
        expect(h.onRestoreInterruptedInput).toHaveBeenCalledTimes(count);
      } finally {
        h.unmount();
      }
    },
  );

  it("replaces the fallback token with the next send and clears it for a token-free send", async () => {
    const h = mountHook();
    const first = token();
    const second = token();
    try {
      for (const [text, restoreToken] of [
        ["first", first],
        ["second", second],
        ["legacy", undefined],
      ] as const) {
        await act(async () => {
          await h
            .getHook()
            .sendMessage(
              text,
              [],
              false,
              false,
              false,
              undefined,
              undefined,
              undefined,
              { composerRestoreToken: restoreToken },
            );
        });
        act(() => h.getHook().detachStreamBindings());
        await act(async () => {
          await h.getHook().stopSending();
        });
        const request = h.onRestoreInterruptedInput.mock.calls.at(-1)![0];
        expect(request.draft.text).toBe(text);
        expect(request.composerRestoreToken).toBe(restoreToken);
      }
      expect(h.onRestoreInterruptedInput).toHaveBeenCalledTimes(3);
    } finally {
      h.unmount();
    }
  });
});
