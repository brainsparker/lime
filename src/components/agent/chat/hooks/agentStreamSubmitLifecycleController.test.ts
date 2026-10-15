import { describe, expect, it, vi } from "vitest";
import type { StreamRequestState } from "./agentStreamRuntimeHandlerTypes";
import { runAgentStreamSubmitLifecycle } from "./agentStreamSubmitLifecycleController";

function createRequestState(): StreamRequestState {
  return {
    accumulatedContent: "",
    requestLogId: null,
    requestStartedAt: 100,
    listenerBoundAt: 140,
    requestFinished: false,
    performanceTrace: {
      requestId: "request-a",
      sessionId: "session-a",
      workspaceId: "workspace-a",
      source: "home-input",
      submittedAt: 90,
    },
  };
}

function createNow(values: number[]) {
  return () => {
    const value = values.shift();
    if (value === undefined) {
      throw new Error("now sequence exhausted");
    }
    return value;
  };
}

describe("agentStreamSubmitLifecycleController", () => {
  it("应记录 submit dispatched 与 accepted 生命周期", async () => {
    const requestState = createRequestState();
    const submit = vi.fn(async () => ({
      kind: "start" as const,
      sessionId: "session-a",
      threadId: "thread-a",
      turnId: "turn-a",
    }));
    const recordMetric = vi.fn();
    const logDebug = vi.fn();

    await runAgentStreamSubmitLifecycle({
      activeSessionId: "session-a",
      effectiveModel: "deepseek-chat",
      effectiveProviderType: "deepseek",
      eventName: "event-a",
      requestState,
      submit,
      deps: {
        now: createNow([175, 230]),
        recordMetric,
        logDebug,
      },
    });

    expect(requestState.submissionDispatchedAt).toBe(175);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(recordMetric).toHaveBeenNthCalledWith(
      1,
      "agentStream.submitDispatched",
      requestState.performanceTrace,
      {
        elapsedMs: 75,
        eventName: "event-a",
        listenerBoundDeltaMs: 35,
        model: "deepseek-chat",
        provider: "deepseek",
        sessionId: "session-a",
      },
    );
    expect(recordMetric).toHaveBeenNthCalledWith(
      2,
      "agentStream.submitAccepted",
      requestState.performanceTrace,
      {
        elapsedMs: 130,
        eventName: "event-a",
        sessionId: "session-a",
        submitInvokeMs: 55,
      },
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      1,
      "AgentStream",
      "submitDispatched",
      expect.objectContaining({ eventName: "event-a" }),
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      2,
      "AgentStream",
      "submitAccepted",
      expect.objectContaining({ submitInvokeMs: 55 }),
    );
  });

  it("submit 失败时应记录 failed 并继续抛出原始错误", async () => {
    const requestState = createRequestState();
    const error = new Error("bridge timeout");
    const submit = vi.fn(async () => {
      throw error;
    });
    const recordMetric = vi.fn();
    const logDebug = vi.fn();

    await expect(
      runAgentStreamSubmitLifecycle({
        activeSessionId: "session-a",
        effectiveModel: "gpt-5.4",
        effectiveProviderType: "openai",
        eventName: "event-a",
        requestState,
        submit,
        deps: {
          now: createNow([180, 260]),
          recordMetric,
          logDebug,
        },
      }),
    ).rejects.toBe(error);

    expect(requestState.submissionDispatchedAt).toBe(180);
    expect(recordMetric).toHaveBeenNthCalledWith(
      2,
      "agentStream.submitFailed",
      requestState.performanceTrace,
      {
        elapsedMs: 160,
        error: "bridge timeout",
        eventName: "event-a",
        sessionId: "session-a",
        submitInvokeMs: 80,
      },
    );
    expect(logDebug).toHaveBeenNthCalledWith(
      2,
      "AgentStream",
      "submitFailed",
      {
        elapsedMs: 160,
        error,
        eventName: "event-a",
        sessionId: "session-a",
        submitInvokeMs: 80,
      },
      { level: "error" },
    );
  });
});

describe("explicit acceptance survives post-processing", () => {
  const receipt = {
    kind: "start" as const,
    sessionId: "session-a",
    threadId: "thread-a",
    turnId: "turn-a",
  };
  function options() {
    return {
      activeSessionId: "session-a",
      effectiveModel: "model",
      effectiveProviderType: "provider",
      eventName: "event-a",
      requestState: createRequestState(),
      deps: { recordMetric: vi.fn(), logDebug: vi.fn() },
    };
  }
  it("notifies before pending submit completion and settles callback/return once", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onRuntimeAccepted = vi.fn();
    const promise = runAgentStreamSubmitLifecycle({
      ...options(),
      onRuntimeAccepted,
      submit: async (accept) => {
        accept(receipt);
        await pending;
        return receipt;
      },
    });
    expect(onRuntimeAccepted).toHaveBeenCalledTimes(1);
    release();
    await expect(promise).resolves.toEqual(receipt);
    expect(onRuntimeAccepted).toHaveBeenCalledTimes(1);
  });
  it("keeps receipt and terminal recovery when accepted metric and observer throw", async () => {
    const base = options();
    const onRuntimeAccepted = vi.fn(() => {
      throw new Error("private callback body");
    });
    const onSubmitAccepted = vi.fn();
    base.deps.recordMetric.mockImplementation((phase) => {
      if (phase === "agentStream.submitAccepted")
        throw new Error("private metric body");
    });
    await expect(
      runAgentStreamSubmitLifecycle({
        ...base,
        onRuntimeAccepted,
        onSubmitAccepted,
        submit: async () => receipt,
      }),
    ).resolves.toEqual(receipt);
    expect(onRuntimeAccepted).toHaveBeenCalledTimes(1);
    expect(onSubmitAccepted).toHaveBeenCalledTimes(1);
    expect(
      base.deps.recordMetric.mock.calls.map((call) => call[0]),
    ).not.toContain("agentStream.submitFailed");
  });
  it("preserves genuine rejection if its diagnostic recorder throws", async () => {
    const base = options();
    const error = new Error("original runtime rejected");
    const onRuntimeAccepted = vi.fn();
    base.deps.recordMetric.mockImplementation((phase) => {
      if (phase === "agentStream.submitFailed")
        throw new Error("diagnostic error");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(
      runAgentStreamSubmitLifecycle({
        ...base,
        onRuntimeAccepted,
        submit: async () => {
          throw error;
        },
      }),
    ).rejects.toBe(error);
    expect(onRuntimeAccepted).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
  it("rejects a void result without inventing acceptance", async () => {
    const onRuntimeAccepted = vi.fn();
    await expect(
      runAgentStreamSubmitLifecycle({
        ...options(),
        onRuntimeAccepted,
        submit: (async () => undefined) as never,
      }),
    ).rejects.toThrow("Invalid runtime acceptance receipt");
    expect(onRuntimeAccepted).not.toHaveBeenCalled();
  });
});
