import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectCodingWorkbenchViewFromEvents } from "@limecloud/agent-runtime-projection";
import { buildWorkspaceConversationCodingViews } from "./workspaceConversationCodingViews";

vi.mock("@/lib/api/backgroundTerminals", () => ({
  terminateBackgroundTerminalForItem: vi.fn(async () => ({
    terminated: true,
  })),
}));

vi.mock("@limecloud/agent-runtime-projection", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@limecloud/agent-runtime-projection")
    >();
  return {
    ...actual,
    projectCodingWorkbenchViewFromEvents: vi.fn(
      actual.projectCodingWorkbenchViewFromEvents,
    ),
  };
});

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  const agentZhCN = (await import("@/i18n/resources/zh-CN/agent.json"))
    .default as Record<string, string>;

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const template = agentZhCN[key] ?? key;
        return template.replace(/{{\s*([^}]+?)\s*}}/g, (_, name: string) =>
          String(options?.[name.trim()] ?? ""),
        );
      },
    }),
  };
});

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
}

const mountedRoots: MountedHarness[] = [];

function t(key: string, options?: Record<string, unknown>): string {
  return key.replace(/{{\s*([^}]+?)\s*}}/g, (_, name: string) =>
    String(options?.[name.trim()] ?? ""),
  );
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

describe("buildWorkspaceConversationCodingViews", () => {
  it("空 thread 也向 Files 传递 canonical identity 和既有文件动作", () => {
    const onOpenFile = vi.fn();
    const views = buildWorkspaceConversationCodingViews({
      t: t as never,
      locale: "zh-CN",
      turns: [],
      threadRead: { thread_id: "thread-empty" },
      pendingActions: [],
      submittedActionsInFlight: [],
      onOpenFile,
    });
    expect(views.changeView).toMatchObject({
      reviewThreadId: "thread-empty",
      items: [],
      onOpenFile,
    });
  });
  it("普通会话保留 Files identity 且不强制显示 runtime 工作台", () => {
    vi.mocked(projectCodingWorkbenchViewFromEvents).mockClear();

    const views = buildWorkspaceConversationCodingViews({
      t: t as never,
      locale: "zh-CN",
      turns: [
        {
          id: "turn-plain",
          thread_id: "thread-plain",
          prompt_text: "普通对话",
          status: "completed",
          started_at: "2026-06-24T10:00:00.000Z",
          completed_at: "2026-06-24T10:00:01.000Z",
          created_at: "2026-06-24T10:00:00.000Z",
          updated_at: "2026-06-24T10:00:01.000Z",
        },
      ],
      currentTurnId: "turn-plain",
      threadRead: null,
      pendingActions: [],
      submittedActionsInFlight: [],
      isSending: false,
    });

    expect(projectCodingWorkbenchViewFromEvents).toHaveBeenCalledOnce();
    expect(views.currentSessionTurn?.id).toBe("turn-plain");
    expect(views.counters.shouldUseRuntimeWorkbench).toBe(false);
    expect(views.sessionView).toBeNull();
    expect(views.outputView).toBeNull();
    expect(views.logView).toBeNull();
    expect(views.changeView).toMatchObject({
      reviewThreadId: "thread-plain",
      items: [],
    });
  });

  it("终止后台终端成功后应刷新 session read model", async () => {
    vi.mocked(projectCodingWorkbenchViewFromEvents).mockClear();
    const onRefreshSessionReadModel = vi.fn(async () => true);
    const views = buildWorkspaceConversationCodingViews({
      t: t as never,
      locale: "zh-CN",
      turns: [
        {
          id: "turn-1",
          thread_id: "thread-1",
          prompt_text: "运行测试",
          status: "running",
          started_at: "2026-06-24T10:00:00.000Z",
          created_at: "2026-06-24T10:00:00.000Z",
          updated_at: "2026-06-24T10:00:00.000Z",
        },
      ],
      currentTurnId: "turn-1",
      threadRead: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        commands: [
          {
            command_id: "command-1",
            status: "running",
            command: "npm test",
            process_id: "process-1",
            execution_process_status: "running",
            execution_process_control_status: "registered",
            stdin_writable: true,
          },
        ],
      },
      pendingActions: [],
      submittedActionsInFlight: [],
      onRefreshSessionReadModel,
    });
    const panel = views.outputView?.renderPanel();
    if (!panel) throw new Error("output view should render");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ container, root });

    await act(async () => {
      root.render(panel);
    });

    const terminate = container.querySelector(
      'button[aria-label="终止进程 process-1"]',
    ) as HTMLButtonElement | null;
    expect(terminate).not.toBeNull();

    await act(async () => {
      terminate?.click();
    });

    const { terminateBackgroundTerminalForItem } =
      await import("@/lib/api/backgroundTerminals");
    expect(projectCodingWorkbenchViewFromEvents).toHaveBeenCalled();
    expect(terminateBackgroundTerminalForItem).toHaveBeenCalledWith({
      threadId: "thread-1",
      itemId: "command-1",
    });
    expect(onRefreshSessionReadModel).toHaveBeenCalledTimes(1);
  });
});
