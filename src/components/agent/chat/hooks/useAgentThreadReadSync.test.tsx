import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEventBusSubscription } from "@/lib/api/appServerEventBus";
import { useAgentThreadReadSync } from "./useAgentThreadReadSync";
import { refreshAgentSessionReadModelState } from "./agentSessionRefresh";

type Options = Parameters<typeof useAgentThreadReadSync>[0];
const roots: Array<{
  root: ReturnType<typeof createRoot>;
  container: HTMLDivElement;
}> = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function harness(refreshSessionReadModel: Options["refreshSessionReadModel"]) {
  const subscriptions: AppServerEventBusSubscription[] = [];
  const unsubscriptions: ReturnType<typeof vi.fn>[] = [];
  const subscribeNotifications = vi.fn(
    (subscription: AppServerEventBusSubscription) => {
      subscriptions.push(subscription);
      const unlisten = vi.fn();
      unsubscriptions.push(unlisten);
      return unlisten;
    },
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  const onWarn = vi.fn();
  const props: Options = {
    workspaceId: "workspace-a",
    sessionId: "session-a",
    threadId: "thread-a",
    refreshSessionReadModel,
    subscribeNotifications,
    onWarn,
  };
  function Component({ options }: { options: Options }) {
    useAgentThreadReadSync(options);
    return null;
  }
  const render = async (change: Partial<Options> = {}) => {
    Object.assign(props, change);
    await act(async () => {
      root.render(<Component options={{ ...props }} />);
    });
  };
  const notify = async (
    threadId = "thread-a",
    index = subscriptions.length - 1,
  ) => {
    await act(async () => {
      subscriptions[index].onNotifications?.([
        { method: "thread/queue/changed", params: { threadId } },
      ]);
    });
  };
  return { render, notify, subscriptions, unsubscriptions, onWarn };
}

describe("thread notification to canonical session projection", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    for (const { root, container } of roots.splice(0)) {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("reads only matching notifications with full replacement and thread identity", async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const current = harness(refresh);
    await current.render();
    expect(refresh).not.toHaveBeenCalled();
    await current.notify("thread-b");
    expect(refresh).not.toHaveBeenCalled();
    await current.notify();
    expect(refresh).toHaveBeenCalledWith("session-a", {
      timelineMode: "replace",
      expectedThreadId: "thread-a",
      isCurrent: expect.any(Function),
    });
  });

  it("refreshes canonical state for thread status changes without trusting notification fields", async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const current = harness(refresh);
    await current.render();
    const notify = async (threadId: string) => {
      await act(async () => {
        current.subscriptions[0].onNotifications?.([
          {
            method: "thread/status/changed",
            params: {
              threadId,
              status: {
                type: "active",
                activeFlags: ["waitingOnUserInput"],
              },
            },
          },
        ]);
      });
    };
    await notify("thread-b");
    expect(refresh).not.toHaveBeenCalled();
    await notify("thread-a");
    expect(refresh).toHaveBeenCalledExactlyOnceWith("session-a", {
      timelineMode: "replace",
      expectedThreadId: "thread-a",
      isCurrent: expect.any(Function),
    });
    await current.render({ threadId: "thread-b" });
    await notify("thread-a");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("serializes bursts and always reads the final notification after an in-flight read", async () => {
    const first = deferred<boolean>();
    const last = deferred<boolean>();
    const refresh = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => last.promise);
    const current = harness(refresh);
    await current.render();
    await current.notify();
    await current.notify();
    await current.notify();
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => {
      first.resolve(true);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => {
      last.resolve(true);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it.each(["session", "workspace"])(
    "rejects A→B→A late reads and old notification/error handlers across %s generations",
    async (boundary) => {
      const first = deferred<{ thread_id: string }>();
      const sessionIdRef = { current: "session-a" };
      const applyReadModelSnapshot = vi.fn();
      const getSessionReadModel = vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValue({ thread_id: "thread-a" });
      const refresh = vi.fn((targetSessionId, request) =>
        refreshAgentSessionReadModelState({
          runtime: { getSessionReadModel },
          sessionIdRef,
          targetSessionId,
          request,
          applyReadModelSnapshot,
        }),
      );
      const current = harness(refresh);
      await current.render();
      await current.notify();
      const field = boundary === "session" ? "sessionId" : "workspaceId";
      await current.render({ [field]: `${boundary}-b` });
      await current.render({ [field]: `${boundary}-a` });
      await act(async () => {
        first.resolve({ thread_id: "thread-a" });
      });
      expect(applyReadModelSnapshot).not.toHaveBeenCalled();
      await current.notify("thread-a", 0);
      current.subscriptions[0].onError?.(new Error("old drain"));
      expect(refresh).toHaveBeenCalledOnce();
      expect(current.onWarn).not.toHaveBeenCalled();
      expect(current.unsubscriptions[0]).toHaveBeenCalledOnce();
      await current.notify();
      expect(applyReadModelSnapshot).toHaveBeenCalledOnce();
    },
  );

  it("does not lose a queued read after failure or fabricate a projection", async () => {
    const first = deferred<boolean>();
    const refresh = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(true);
    const current = harness(refresh);
    await current.render();
    await current.notify();
    await current.notify();
    await act(async () => {
      first.reject(new Error("read failed"));
    });
    expect(current.onWarn).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(2);
    await current.render({ threadId: null });
    expect(current.unsubscriptions.at(-1)).toHaveBeenCalledOnce();
  });
});
