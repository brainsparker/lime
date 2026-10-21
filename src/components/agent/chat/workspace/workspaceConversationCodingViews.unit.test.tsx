import { describe, expect, it, vi } from "vitest";
import { projectCodingWorkbenchViewFromEvents } from "@limecloud/agent-runtime-projection";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";
import { buildWorkspaceConversationCodingViews } from "./workspaceConversationCodingViews";

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

describe("buildWorkspaceConversationCodingViews", () => {
  it("空 thread 也向 Files 传递 canonical identity 和既有文件动作", () => {
    const onOpenFile = vi.fn();
    const views = buildWorkspaceConversationCodingViews({
      turns: [],
      threadRead: { thread_id: "thread-empty" },
      pendingActions: [],
      onOpenFile,
    });
    expect(views.changeView).toMatchObject({
      reviewThreadId: "thread-empty",
      items: [],
      onOpenFile,
    });
  });

  it("普通会话保留 Files identity 且不显示已删除的 Outputs view", () => {
    vi.mocked(projectCodingWorkbenchViewFromEvents).mockClear();
    const views = buildWorkspaceConversationCodingViews({
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
      isSending: false,
    });
    expect(projectCodingWorkbenchViewFromEvents).toHaveBeenCalledOnce();
    expect(views.currentSessionTurn?.id).toBe("turn-plain");
    expect(views.counters.shouldUseRuntimeWorkbench).toBe(false);
    expect(views.sessionView).toBeNull();
    expect(views).not.toHaveProperty("logView");
    expect(views.changeView).toMatchObject({
      reviewThreadId: "thread-plain",
      items: [],
    });
  });

  it("Coding Workbench Summary 复用 canonical ThreadSummaryPanel owner", () => {
    const threadItems = [
      {
        id: "plan-1",
        thread_id: "thread-summary",
        turn_id: "turn-summary",
        sequence: 1,
        status: "completed",
        type: "plan",
        text: "Ship the change",
      },
    ] as const;
    const canonicalChildren = [
      {
        name: "Reviewer",
        threadId: "child-1",
        sessionId: "session-child",
        parentThreadId: "thread-summary",
        status: "running",
        updatedAtMs: 1,
      },
    ];
    const views = buildWorkspaceConversationCodingViews({
      turns: [
        {
          id: "turn-summary",
          thread_id: "thread-summary",
          prompt_text: "Review the change",
          status: "running",
          started_at: "2026-06-24T10:00:00.000Z",
          created_at: "2026-06-24T10:00:00.000Z",
          updated_at: "2026-06-24T10:00:00.000Z",
        },
      ],
      threadItems,
      currentTurnId: "turn-summary",
      pendingActions: [
        {
          requestId: "request-1",
          actionType: "tool_confirmation",
          prompt: "Approve the change",
          status: "pending",
        },
      ],
      threadRead: { thread_id: "thread-summary" },
      canonicalChildren,
    });

    const panel = views.sessionView?.renderPanel();
    expect(panel).toBeTruthy();
    expect((panel as { type?: unknown }).type).toBe(ThreadSummaryPanel);
    expect((panel as { props?: Record<string, unknown> }).props).toMatchObject({
      threadId: "thread-summary",
      threadItems,
      canonicalChildren,
    });
  });
});
