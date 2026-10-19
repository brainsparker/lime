import { describe, expect, it } from "vitest";

import {
  buildProjection,
  type Message,
  type ProjectionTimelineItems,
} from "./messageListItemProjection.testHarness";

function buildCanonicalProjection(
  message: Message,
  timelineItems: ProjectionTimelineItems = [
    {
      id: "command-canonical",
      type: "command_execution",
      thread_id: "thread-canonical-history",
      turn_id: "turn-canonical-history",
      sequence: 1,
      command: "npm test",
      cwd: "/workspace/canonical-codex",
      aggregated_output: "Exit code: 0\nOutput:\nok",
      exit_code: 0,
      metadata: {
        environmentId: "environment-main",
      },
      status: "completed",
      started_at: "2026-06-02T10:01:02.000Z",
      completed_at: "2026-06-02T10:01:03.000Z",
      updated_at: "2026-06-02T10:01:03.000Z",
    },
    {
      id: "assistant-canonical-final",
      type: "agent_message",
      thread_id: "thread-canonical-history",
      turn_id: "turn-canonical-history",
      sequence: 2,
      phase: "final_answer",
      text: "已完成修复。",
      status: "completed",
      started_at: "2026-06-02T10:01:58.000Z",
      completed_at: "2026-06-02T10:02:00.000Z",
      updated_at: "2026-06-02T10:02:00.000Z",
    },
  ],
) {
  return buildProjection(message, timelineItems, {
    turnId: "turn-canonical-history",
  });
}

describe("messageListItemProjection canonical history", () => {
  it("命令应保留 canonical 元数据供历史投影使用", () => {
    const projection = buildCanonicalProjection({
      id: "assistant-canonical-command",
      role: "assistant",
      content: "已完成修复。",
      timestamp: new Date("2026-06-02T10:02:00.000Z"),
    });

    expect(projection.rendererContentParts?.map((part) => part.type)).toEqual([
      "text",
    ]);
    expect(projection.primaryTimeline?.items).toHaveLength(1);
    expect(projection.primaryTimeline?.items[0]).toMatchObject({
      type: "command_execution",
      metadata: {
        environmentId: "environment-main",
      },
    });
  });

  it("历史命令没有额外助手过程文本时仍只渲染最终正文", () => {
    const projection = buildCanonicalProjection(
      {
        id: "assistant-canonical-command-only",
        role: "assistant",
        content: "已完成修复。",
        timestamp: new Date("2026-06-02T10:02:00.000Z"),
      },
      [
        {
          id: "command-canonical",
          type: "command_execution",
          thread_id: "thread-canonical-history",
          turn_id: "turn-canonical-history",
          sequence: 1,
          command: "npm test",
          cwd: "/workspace/canonical-codex",
          aggregated_output: "Exit code: 0\nOutput:\nok",
          exit_code: 0,
          metadata: {
            environmentId: "environment-main",
          },
          status: "completed",
          started_at: "2026-06-02T10:01:02.000Z",
          completed_at: "2026-06-02T10:01:03.000Z",
          updated_at: "2026-06-02T10:01:03.000Z",
        },
      ],
    );

    expect(projection.rendererContentParts?.map((part) => part.type)).toEqual([
      "text",
    ]);
    expect(projection.rendererContentParts?.[0]).toEqual({
      type: "text",
      text: "已完成修复。",
    });
    expect(projection.primaryTimeline?.items).toHaveLength(1);
  });
});
