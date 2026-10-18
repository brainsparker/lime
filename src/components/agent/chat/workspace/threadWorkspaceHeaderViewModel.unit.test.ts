import { describe, expect, it, vi } from "vitest";
import type { Topic } from "../hooks/agentChatShared";
import { buildThreadWorkspaceHeaderViewModel } from "./threadWorkspaceHeaderViewModel";

function topic(overrides?: Partial<Topic>): Topic {
  return {
    id: "thread-1",
    title: "整理 GUI 对齐计划",
    createdAt: new Date("2026-07-18T08:00:00.000Z"),
    updatedAt: new Date("2026-07-18T09:00:00.000Z"),
    workingDir: "/workspace/lime",
    messagesCount: 4,
    executionStrategy: "react",
    status: "running",
    statusReason: "default",
    lastPreview: "继续整理界面",
    hasUnread: false,
    sourceSessionId: "thread-1",
    ...overrides,
  };
}

describe("buildThreadWorkspaceHeaderViewModel", () => {
  it("使用当前线程标题，不再派生独立运行态和目录状态", () => {
    expect(
      buildThreadWorkspaceHeaderViewModel({
        sessionId: "thread-1",
        currentSessionTitle: "旧标题",
        topic: topic(),
        untitledTaskLabel: "未命名任务",
      }),
    ).toEqual({ sessionId: "thread-1", title: "整理 GUI 对齐计划" });
  });

  it("恢复标题只能回落到同一入口会话", () => {
    expect(
      buildThreadWorkspaceHeaderViewModel({
        sessionId: "thread-1",
        initialSessionId: "thread-1",
        initialSessionName: "恢复历史任务",
        untitledTaskLabel: "未命名任务",
      })?.title,
    ).toBe("恢复历史任务");
    expect(
      buildThreadWorkspaceHeaderViewModel({
        sessionId: "thread-2",
        initialSessionId: "thread-1",
        initialSessionName: "不属于当前线程",
        untitledTaskLabel: "未命名任务",
      })?.title,
    ).toBe("未命名任务");
  });

  it("直接把当前会话操作交给唯一workspace owner", () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn().mockResolvedValue(undefined);
    const onFork = vi.fn().mockResolvedValue(undefined);
    expect(
      buildThreadWorkspaceHeaderViewModel({
        sessionId: "thread-1",
        currentSessionTitle: "当前标题",
        onRename,
        onArchive,
        onFork,
        untitledTaskLabel: "未命名任务",
      }),
    ).toEqual({
      sessionId: "thread-1",
      title: "当前标题",
      onRename,
      onArchive,
      onFork,
    });
  });

  it("没有当前会话时不生成页头", () => {
    expect(
      buildThreadWorkspaceHeaderViewModel({
        sessionId: "  ",
        untitledTaskLabel: "未命名任务",
      }),
    ).toBeNull();
  });
});
