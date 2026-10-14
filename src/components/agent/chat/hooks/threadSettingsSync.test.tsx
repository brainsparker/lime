import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  JsonRpcNotification,
  ThreadSettings,
} from "@limecloud/app-server-client";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import { AppServerEventBus } from "@/lib/api/appServerEventBus";
import {
  createAgentRuntimeAdapter,
  type AgentRuntimeAdapterDeps,
} from "./agentRuntimeAdapter";
import { useAgentContext } from "./useAgentContext";
import {
  applyCachedThreadSettingsToSnapshot,
  useAgentSessionThreadSettings,
} from "./useAgentSessionThreadSettings";
import { createEmptyAgentSessionSnapshot } from "./agentSessionState";
import type { Topic } from "./agentChatShared";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/api/project", () => ({ updateProject: vi.fn() }));
vi.mock("@/components/workspace/services/runtimeAgentsGuideService", () => ({
  notifyProjectRuntimeAgentsGuide: vi.fn(),
}));

function notification(
  model = "canonical-model",
  threadId = "thread-a",
  patch: Partial<ThreadSettings> = {},
): JsonRpcNotification {
  return {
    method: "thread/settings/updated",
    params: {
      threadId,
      threadSettings: {
        model,
        modelProvider: "canonical-provider",
        effort: "high",
        serviceTier: "fast",
        cwd: "/canonical",
        approvalPolicy: "on-request",
        approvalsReviewer: "user",
        sandboxPolicy: {},
        collaborationMode: { mode: "default", settings: { model } },
        ...patch,
      },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function mountSettings() {
  const drained: JsonRpcNotification[][] = [];
  const bus = new AppServerEventBus({
    drainEvents: () => drained.shift() ?? [],
  });
  const getSession = vi.fn(async (id: string) => {
    const suffix = id.replace(/^(session|thread)-/, "");
    return {
      id: `session-${suffix}`,
      thread_id: `thread-${suffix}`,
      workspace_id: "workspace",
      messages: [],
    };
  });
  const update = vi.fn(async () => ({
    result: {},
    notifications: [notification()],
  }));
  const runtime = createAgentRuntimeAdapter({
    eventBus: bus,
    client: {
      getAgentRuntimeSession: getSession,
      updateAgentRuntimeThreadSettings: update,
    } as unknown as AgentRuntimeAdapterDeps["client"],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let value!: ReturnType<typeof useAgentContext>;
  let read!: AgentRuntimeThreadReadModel | null;
  let dir!: string | null;
  let switchSession!: () => void;
  function Harness() {
    const sessionIdRef = useRef<string | null>("session-a");
    value = useAgentContext({
      workspaceId: "workspace",
      runtime,
      sessionIdRef,
      topicsUpdaterRef: useRef(null),
      sendMessageRef: useRef(null),
    });
    const [threadRead, setThreadRead] =
      useState<AgentRuntimeThreadReadModel | null>({
        thread_id: "thread-a",
        active_turn_id: "active-turn",
        thread_items: [],
      });
    const threadReadRef = useRef(threadRead);
    threadReadRef.current = threadRead;
    const [workingDir, setSessionWorkingDir] = useState<string | null>("/old");
    const sessionWorkingDirRef = useRef(workingDir);
    const [, setTopics] = useState<Topic[]>([]);
    useAgentSessionThreadSettings({
      runtime,
      workspaceId: "workspace",
      sessionIdRef,
      threadReadRef,
      sessionWorkingDirRef,
      setThreadRead,
      setSessionWorkingDir,
      setTopics,
    });
    read = threadRead;
    dir = workingDir;
    switchSession = () => {
      sessionIdRef.current = "session-b";
      threadReadRef.current = { thread_id: "thread-b" };
      setThreadRead(threadReadRef.current);
      setSessionWorkingDir("/other");
      value.applyWorkspaceModelPreference({
        providerType: "other-provider",
        model: "other-model",
      });
    };
    return null;
  }
  act(() => {
    root.render(<Harness />);
  });
  act(() => {
    value.applyWorkspaceModelPreference({
      providerType: "old-provider",
      model: "old-model",
    });
  });
  return {
    bus,
    drained,
    update,
    runtime,
    getSession,
    context: () => value,
    read: () => read,
    dir: () => dir,
    switchSession: () => act(() => switchSession()),
    unmount() {
      act(() => root.unmount());
      bus.reset();
      container.remove();
    },
  };
}

describe("canonical thread settings production consumer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("RPC response经同一EventBus消费canonical值，保留active turn且不写transcript", async () => {
    const h = mountSettings();
    await act(async () => {
      h.context().setModel("requested-model");
      await Promise.resolve();
      await h.context().waitForSessionProviderSelectionSync("session-a");
    });
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-a",
        model: "requested-model",
      }),
    );
    expect(h.context().model).toBe("canonical-model");
    expect(h.context().providerType).toBe("canonical-provider");
    expect(h.context().reasoningEffort).toBe("high");
    expect(h.dir()).toBe("/canonical");
    expect(h.read()).toMatchObject({
      active_turn_id: "active-turn",
      thread_items: [],
      thread_settings: { serviceTier: "fast" },
    });
    const snapshot = applyCachedThreadSettingsToSnapshot(
      {
        ...createEmptyAgentSessionSnapshot(),
        sessionId: "session-a",
        threadRead: { thread_id: "thread-a" },
        workingDir: "/stale-detail",
      },
      h.context().loadSessionModelPreference,
    );
    expect(snapshot.workingDir).toBe("/canonical");
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.threadTurns).toEqual([]);
    expect(snapshot.threadItems).toEqual([]);
    h.unmount();
  });

  it("ACK先到时UI保持canonical旧值，发送等待drain，null清除effort/serviceTier", async () => {
    const h = mountSettings();
    await h.runtime.getSession("session-a");
    await act(async () =>
      h.bus.publishThreadSettingsNotifications([notification("old-model")]),
    );
    expect(h.context().reasoningEffort).toBe("high");
    h.update.mockResolvedValueOnce({ result: {}, notifications: [] });
    await act(async () => {
      h.context().setModel("requested");
      await Promise.resolve();
      await Promise.resolve();
    });
    let completed = false;
    let futureTurnModel: string | undefined;
    const wait = h
      .context()
      .waitForSessionProviderSelectionSync("session-a")
      .then(() => {
        completed = true;
        futureTurnModel = h.context().modelRef.current;
      });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(h.context().model).toBe("old-model");
    h.drained.push([
      notification("drain-model", "thread-a", {
        effort: null,
        serviceTier: null,
      }),
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await wait;
    });
    expect(h.context().model).toBe("drain-model");
    expect(futureTurnModel).toBe("drain-model");
    expect(h.context().reasoningEffort).toBe("");
    expect(h.read()?.thread_settings?.serviceTier).toBeNull();
    expect(
      h.context().loadSessionModelPreference("session-a")?.threadSettings
        ?.effort,
    ).toBeNull();
    h.unmount();
  });

  it("在途选择草稿与canonical缓存分离，后续编辑保留尚未确认的provider", async () => {
    const h = mountSettings();
    const response = deferred<{
      result: Record<string, never>;
      notifications: JsonRpcNotification[];
    }>();
    h.update.mockReturnValueOnce(response.promise);
    await act(async () => {
      h.context().setProviderType("draft-provider");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.context().providerType).toBe("old-provider");
    expect(h.context().loadSessionModelPreference("session-a")).toBeNull();
    act(() => h.context().setModel("second-request"));
    await act(async () => {
      response.resolve({
        result: {},
        notifications: [
          notification("first", "thread-a", {
            modelProvider: "first-canonical",
          }),
        ],
      });
      await h.context().waitForSessionProviderSelectionSync("session-a");
    });
    expect(h.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelProvider: "draft-provider",
        model: "second-request",
      }),
    );
    expect(h.context().providerType).toBe("canonical-provider");
    h.unmount();
  });

  it("线程切换后的迟到response只更新inactive cache，再切回读取同一canonical值", async () => {
    const h = mountSettings();
    const response = deferred<{
      result: Record<string, never>;
      notifications: JsonRpcNotification[];
    }>();
    h.update.mockReturnValueOnce(response.promise);
    await act(async () => {
      h.context().setModel("requested");
      await Promise.resolve();
      await Promise.resolve();
    });
    h.switchSession();
    await act(async () => {
      response.resolve({
        result: {},
        notifications: [notification("inactive-model")],
      });
      await h.context().waitForSessionProviderSelectionSync("session-a");
    });
    expect(h.context().model).toBe("other-model");
    expect(h.dir()).toBe("/other");
    expect(h.read()?.thread_id).toBe("thread-b");
    const cached = h.context().loadSessionModelPreference("session-a");
    expect(cached).toMatchObject({
      model: "inactive-model",
      threadId: "thread-a",
      threadSettings: { cwd: "/canonical" },
    });
    act(() => h.context().applySessionModelPreference("session-a", cached!));
    expect(h.context().model).toBe("inactive-model");
    expect(h.context().reasoningEffort).toBe("high");
    h.unmount();
  });

  it("旧A镜像不能回滚新B，同来源A→B→A仍可见，其他response通知不广播", async () => {
    const h = mountSettings();
    await h.runtime.getSession("session-a");
    const observed = vi.fn();
    const unsubscribe = h.bus.subscribe({ onNotifications: observed });
    await act(async () => {
      h.bus.publishThreadSettingsNotifications([
        notification("A"),
        { method: "item/started", params: {} },
      ]);
      h.bus.publishThreadSettingsNotifications([notification("B")]);
    });
    h.drained.push([notification("A")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(h.context().model).toBe("B");
    expect(
      observed.mock.calls
        .flatMap(([notifications]) => notifications)
        .every((entry) => entry.method === "thread/settings/updated"),
    ).toBe(true);
    await act(async () =>
      h.bus.publishThreadSettingsNotifications([notification("A")]),
    );
    expect(h.context().model).toBe("A");
    unsubscribe();
    h.unmount();
  });

  it("失败不提交请求值，后续canonical通知与重试可恢复", async () => {
    const h = mountSettings();
    h.update.mockRejectedValueOnce(new Error("preflight failed"));
    await act(async () => {
      h.context().setModel("rejected");
      await Promise.resolve();
      await h.context().waitForSessionProviderSelectionSync("session-a");
    });
    expect(h.context().model).toBe("old-model");
    expect(h.context().loadSessionModelPreference("session-a")).toBeNull();
    await act(async () => {
      h.context().setModel("retry");
      await Promise.resolve();
      await h.context().waitForSessionProviderSelectionSync("session-a");
    });
    expect(h.context().model).toBe("canonical-model");
    h.unmount();
  });

  it("inactive thread异步归属乱序时只提交最新设置，身份不匹配不消费", async () => {
    const h = mountSettings();
    const detail = deferred<Awaited<ReturnType<typeof h.getSession>>>();
    h.getSession.mockReturnValueOnce(detail.promise);
    await act(async () => {
      h.bus.publishThreadSettingsNotifications([
        notification("old", "thread-c"),
      ]);
      h.bus.publishThreadSettingsNotifications([
        notification("latest", "thread-c", { cwd: "/inactive" }),
      ]);
      detail.resolve({
        id: "session-c",
        thread_id: "thread-c",
        workspace_id: "workspace",
        messages: [],
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.context().loadSessionModelPreference("session-c")?.model).toBe(
      "latest",
    );
    expect(h.context().model).toBe("old-model");
    h.getSession.mockResolvedValueOnce({
      id: "session-x",
      thread_id: "thread-x",
      workspace_id: "workspace",
      messages: [],
    });
    await act(async () => {
      h.bus.publishThreadSettingsNotifications([
        notification("bad", "thread-d"),
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.context().loadSessionModelPreference("session-x")).toBeNull();
    h.unmount();
  });

  it("其他workspace的通知和卸载后的迟到归属不会污染当前cache", async () => {
    const h = mountSettings();
    h.getSession.mockResolvedValueOnce({
      id: "session-c",
      thread_id: "thread-c",
      workspace_id: "other-workspace",
      messages: [],
    });
    await act(async () => {
      h.bus.publishThreadSettingsNotifications([
        notification("other", "thread-c"),
      ]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.context().loadSessionModelPreference("session-c")).toBeNull();
    expect(h.context().model).toBe("old-model");
    const detail = deferred<Awaited<ReturnType<typeof h.getSession>>>();
    h.getSession.mockReturnValueOnce(detail.promise);
    await act(async () =>
      h.bus.publishThreadSettingsNotifications([
        notification("late", "thread-d"),
      ]),
    );
    h.unmount();
    await act(async () => {
      detail.resolve({
        id: "session-d",
        thread_id: "thread-d",
        workspace_id: "workspace",
        messages: [],
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(h.context().loadSessionModelPreference("session-d")).toBeNull();
  });
});
