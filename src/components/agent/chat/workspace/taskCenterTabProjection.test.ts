import { describe, expect, it } from "vitest";
import type { Topic } from "../hooks/agentChatShared";
import {
  buildBrowserWorkspaceHomeTabItem,
  buildTaskCenterTabItems,
  resolveTaskCenterTopicTitle,
  shouldRenderTaskCenterTabStrip,
  TASK_CENTER_HOME_TAB_ID,
} from "./taskCenterTabProjection";

function createTopic(id: string, overrides?: Partial<Topic>): Topic {
  return {
    id,
    title: id,
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-20T01:00:00.000Z"),
    messagesCount: 1,
    executionStrategy: "react",
    status: "done",
    statusReason: "default",
    lastPreview: `${id} preview`,
    hasUnread: false,
    sourceSessionId: id,
    ...overrides,
  };
}

describe("taskCenterTabProjection", () => {
  it("应构建不可关闭的浏览器首页标签", () => {
    expect(
      buildBrowserWorkspaceHomeTabItem({
        title: "新对话",
        updatedAtMs: Date.UTC(2026, 3, 20, 4, 0, 0),
      }),
    ).toMatchObject({
      id: TASK_CENTER_HOME_TAB_ID,
      title: "新对话",
      status: "draft",
      isActive: true,
      renamable: false,
      closable: false,
    });
  });

  it("应清理任务标签里的运行时错误标题并保留附件标题", () => {
    const runtimeErrorEnvelope = [
      "Ran into this error: Server error: upstream temporarily unavailable.",
      "",
      "Please retry if you think this is a transient or recoverable error.",
    ].join("\n");

    expect(
      resolveTaskCenterTopicTitle(runtimeErrorEnvelope, "未命名任务"),
    ).toBe("未命名任务");
    expect(
      resolveTaskCenterTopicTitle("Ran into this erro...", "未命名任务"),
    ).toBe("未命名任务");
    expect(resolveTaskCenterTopicTitle("[Image #4]", "未命名任务")).toBe(
      "图片任务 4",
    );
  });

  it("初始 Thread 标题尚未进入 Topic 投影时应使用路由元数据兜底", () => {
    const topic = createTopic("thread-active", { title: "" });

    const items = buildTaskCenterTabItems({
      sessionId: "thread-active",
      initialSessionId: "thread-active",
      initialSessionName: "修复恢复链路",
      previewTopicId: null,
      visibleTabIds: ["thread-active"],
      topicById: new Map([[topic.id, topic]]),
      untitledTaskLabel: "未命名任务",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "thread-active",
      title: "修复恢复链路",
      isActive: true,
    });
  });

  it("应在 claw 或 new-task 有标签项时渲染任务标签栏", () => {
    expect(
      shouldRenderTaskCenterTabStrip({
        agentEntry: "claw",
        hasLocalSessionOverride: false,
        tabItemCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldRenderTaskCenterTabStrip({
        agentEntry: "new-task",
        hasLocalSessionOverride: true,
        tabItemCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldRenderTaskCenterTabStrip({
        agentEntry: "new-task",
        hasLocalSessionOverride: false,
        tabItemCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldRenderTaskCenterTabStrip({
        agentEntry: "new-task",
        hasLocalSessionOverride: false,
        tabItemCount: 0,
      }),
    ).toBe(false);
  });
});
