import { describe, expect, it } from "vitest";

import { buildTimelineInlineContentParts } from "./messageListTimelineContentParts";
import { buildThreadItems } from "./messageListTimelineContentParts.testHarness";

describe("messageListTimelineContentParts canonical timeline", () => {
  it("历史的单条思考也应按来源顺序进入正文过程流", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const contentParts = buildTimelineInlineContentParts({
      displayContent: "已确认处理方案。",
      items: buildThreadItems([
        {
          id: "reasoning-canonical-single",
          type: "reasoning",
          turn_id: "turn-canonical-single-reasoning",
          sequence: 1,
          text: "先判断用户截图里的第一句为什么没有展示在最前面。",
          summary: ["先判断用户截图里的第一句为什么没有展示在最前面。"],
          metadata: canonicalMetadata,
          status: "completed",
          started_at: "2026-06-02T09:00:00.000Z",
          completed_at: "2026-06-02T09:00:01.000Z",
          updated_at: "2026-06-02T09:00:01.000Z",
        },
        {
          id: "assistant-canonical-single-final",
          type: "agent_message",
          turn_id: "turn-canonical-single-reasoning",
          sequence: 2,
          phase: "final_answer",
          text: "已确认处理方案。",
          metadata: canonicalMetadata,
          status: "completed",
          started_at: "2026-06-02T09:00:02.000Z",
          completed_at: "2026-06-02T09:00:03.000Z",
          updated_at: "2026-06-02T09:00:03.000Z",
        },
      ]),
    });

    expect(contentParts).toEqual([
      {
        type: "thinking",
        text: "先判断用户截图里的第一句为什么没有展示在最前面。",
        metadata: {
          ...canonicalMetadata,
          source: "thread_item_reasoning",
          threadItemId: "reasoning-canonical-single",
          turnId: "turn-canonical-single-reasoning",
          sequence: 1,
        },
      },
      {
        type: "text",
        text: "已确认处理方案。",
        metadata: {
          ...canonicalMetadata,
          source: "agent_thread_item",
          threadItemId: "assistant-canonical-single-final",
          turnId: "turn-canonical-single-reasoning",
          sequence: 2,
          phase: "final_answer",
        },
      },
    ]);
  });

  it("历史计划应按事件序穿插在思考和命令之间", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const contentParts = buildTimelineInlineContentParts({
      displayContent: "计划已经整理完。",
      items: buildThreadItems([
        {
          id: "reasoning-before-plan",
          type: "reasoning",
          turn_id: "turn-canonical-plan",
          sequence: 1,
          text: "先判断应该如何拆分当前修复。",
          status: "completed",
          started_at: "2026-06-02T10:03:00.000Z",
          completed_at: "2026-06-02T10:03:01.000Z",
          updated_at: "2026-06-02T10:03:01.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "plan-canonical-update-plan",
          type: "plan",
          turn_id: "turn-canonical-plan",
          sequence: 2,
          text: "- [x] 核对计划事件\n- [ ] 投影计划内容",
          status: "completed",
          started_at: "2026-06-02T10:03:02.000Z",
          completed_at: "2026-06-02T10:03:03.000Z",
          updated_at: "2026-06-02T10:03:03.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "command-after-plan",
          type: "command_execution",
          turn_id: "turn-canonical-plan",
          sequence: 3,
          command: "cargo test",
          cwd: "/workspace/app",
          aggregated_output: "ok",
          exit_code: 0,
          status: "completed",
          started_at: "2026-06-02T10:03:04.000Z",
          completed_at: "2026-06-02T10:03:05.000Z",
          updated_at: "2026-06-02T10:03:05.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "assistant-after-plan",
          type: "agent_message",
          turn_id: "turn-canonical-plan",
          sequence: 4,
          phase: "final_answer",
          text: "计划已经整理完。",
          status: "completed",
          started_at: "2026-06-02T10:03:06.000Z",
          completed_at: "2026-06-02T10:03:07.000Z",
          updated_at: "2026-06-02T10:03:07.000Z",
          metadata: canonicalMetadata,
        },
      ]),
    });

    expect(contentParts?.map((part) => part.type)).toEqual([
      "thinking",
      "text",
      "tool_use",
      "text",
    ]);
    expect(contentParts?.[1]).toMatchObject({
      type: "text",
      text: "<proposed_plan>\n- [x] 核对计划事件\n- [ ] 投影计划内容\n</proposed_plan>",
    });
    expect(contentParts?.[2]).toMatchObject({
      type: "tool_use",
      toolCall: {
        id: "command-after-plan",
        name: "exec_command",
        status: "completed",
      },
    });
  });

  it("只有计划和最终正文时也应生成内联计划块", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const contentParts = buildTimelineInlineContentParts({
      displayContent: "继续执行计划。",
      items: buildThreadItems([
        {
          id: "plan-only-canonical",
          type: "plan",
          turn_id: "turn-canonical-plan-only",
          sequence: 1,
          text: "- [ ] 继续执行计划",
          status: "completed",
          started_at: "2026-06-02T10:04:00.000Z",
          completed_at: "2026-06-02T10:04:01.000Z",
          updated_at: "2026-06-02T10:04:01.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "assistant-plan-only",
          type: "agent_message",
          turn_id: "turn-canonical-plan-only",
          sequence: 2,
          phase: "final_answer",
          text: "继续执行计划。",
          status: "completed",
          started_at: "2026-06-02T10:04:02.000Z",
          completed_at: "2026-06-02T10:04:03.000Z",
          updated_at: "2026-06-02T10:04:03.000Z",
          metadata: canonicalMetadata,
        },
      ]),
    });

    expect(contentParts?.map((part) => part.type)).toEqual(["text", "text"]);
    expect(contentParts?.[0]).toMatchObject({
      type: "text",
      text: "<proposed_plan>\n- [ ] 继续执行计划\n</proposed_plan>",
    });
    expect(contentParts?.[1]).toMatchObject({
      type: "text",
      text: "继续执行计划。",
      metadata: {
        source: "agent_thread_item",
        threadItemId: "assistant-plan-only",
        turnId: "turn-canonical-plan-only",
        sequence: 2,
        phase: "final_answer",
      },
    });
  });

  it("历史过程应把命令、搜索和补丁还原为同一条正文过程", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const contentParts = buildTimelineInlineContentParts({
      displayContent: "已完成修复。",
      items: buildThreadItems([
        {
          id: "assistant-canonical-progress",
          type: "agent_message",
          turn_id: "turn-legacy-unphased-final",
          sequence: 1,
          text: "我会先运行测试并检查失败。",
          status: "completed",
          started_at: "2026-06-02T10:01:00.000Z",
          completed_at: "2026-06-02T10:01:01.000Z",
          updated_at: "2026-06-02T10:01:01.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "reasoning-canonical",
          type: "reasoning",
          turn_id: "turn-legacy-unphased-final",
          sequence: 2,
          text: "需要先确认测试失败点。",
          status: "completed",
          started_at: "2026-06-02T10:01:02.000Z",
          completed_at: "2026-06-02T10:01:03.000Z",
          updated_at: "2026-06-02T10:01:03.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "command-canonical-process",
          type: "command_execution",
          turn_id: "turn-legacy-unphased-final",
          sequence: 3,
          command: "npm test",
          cwd: "/workspace/canonical-codex",
          aggregated_output: "ok",
          exit_code: 0,
          metadata: canonicalMetadata,
          status: "completed",
          started_at: "2026-06-02T10:01:04.000Z",
          completed_at: "2026-06-02T10:01:05.000Z",
          updated_at: "2026-06-02T10:01:05.000Z",
        },
        {
          id: "search-canonical-process",
          type: "web_search",
          turn_id: "turn-legacy-unphased-final",
          sequence: 4,
          action: "search_query",
          output: '"search_query"',
          metadata: canonicalMetadata,
          status: "completed",
          started_at: "2026-06-02T10:01:06.000Z",
          completed_at: "2026-06-02T10:01:07.000Z",
          updated_at: "2026-06-02T10:01:07.000Z",
        },
        {
          id: "patch-canonical-process",
          type: "patch",
          turn_id: "turn-legacy-unphased-final",
          sequence: 5,
          text: "Patch changed /workspace/canonical-codex/src/lib.rs",
          paths: ["/workspace/canonical-codex/src/lib.rs"],
          success: true,
          metadata: canonicalMetadata,
          status: "completed",
          started_at: "2026-06-02T10:01:08.000Z",
          completed_at: "2026-06-02T10:01:09.000Z",
          updated_at: "2026-06-02T10:01:09.000Z",
        },
        {
          id: "assistant-canonical-process-final",
          type: "agent_message",
          turn_id: "turn-legacy-unphased-final",
          sequence: 6,
          phase: "final_answer",
          text: "已完成修复。",
          status: "completed",
          started_at: "2026-06-02T10:01:58.000Z",
          completed_at: "2026-06-02T10:02:00.000Z",
          updated_at: "2026-06-02T10:02:00.000Z",
          metadata: canonicalMetadata,
        },
      ]),
    });

    expect(contentParts?.map((part) => part.type)).toEqual([
      "text",
      "thinking",
      "tool_use",
      "tool_use",
      "file_changes_batch",
      "text",
    ]);
    expect(contentParts?.[2]).toMatchObject({
      type: "tool_use",
      toolCall: {
        id: "command-canonical-process",
        name: "exec_command",
        result: {
          metadata: expect.objectContaining(canonicalMetadata),
        },
      },
    });
    expect(contentParts?.[3]).toMatchObject({
      type: "tool_use",
      toolCall: {
        id: "search-canonical-process",
        name: "web_search",
        result: {
          metadata: expect.objectContaining(canonicalMetadata),
        },
      },
    });
    expect(contentParts?.[4]).toMatchObject({
      type: "file_changes_batch",
      aggregate: {
        fileCount: 1,
        files: [
          expect.objectContaining({
            path: "/workspace/canonical-codex/src/lib.rs",
            linesAdded: 0,
            linesRemoved: 0,
            status: "completed",
          }),
        ],
      },
    });
  });

  it("只有上下文压缩和子代理过程时也不应跳过最终正文", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const contentParts = buildTimelineInlineContentParts({
      displayContent: "已完成上下文整理。",
      items: buildThreadItems([
        {
          id: "context-compaction-canonical",
          type: "context_compaction",
          turn_id: "turn-canonical-specialized-process",
          sequence: 1,
          stage: "completed",
          trigger: "auto",
          detail: "Context compacted before continuing.",
          status: "completed",
          started_at: "2026-06-02T10:05:00.000Z",
          completed_at: "2026-06-02T10:05:01.000Z",
          updated_at: "2026-06-02T10:05:01.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "subagent-canonical",
          type: "subagent_activity",
          turn_id: "turn-canonical-specialized-process",
          sequence: 2,
          status_label: "completed",
          title: "review",
          summary: "Subagent finished canonical review.",
          status: "completed",
          started_at: "2026-06-02T10:05:02.000Z",
          completed_at: "2026-06-02T10:05:03.000Z",
          updated_at: "2026-06-02T10:05:03.000Z",
          metadata: canonicalMetadata,
        },
        {
          id: "assistant-canonical-specialized-final",
          type: "agent_message",
          turn_id: "turn-canonical-specialized-process",
          sequence: 3,
          phase: "final_answer",
          text: "已完成上下文整理。",
          status: "completed",
          started_at: "2026-06-02T10:05:04.000Z",
          completed_at: "2026-06-02T10:05:05.000Z",
          updated_at: "2026-06-02T10:05:05.000Z",
          metadata: canonicalMetadata,
        },
      ]),
    });

    expect(contentParts).toEqual([
      {
        type: "text",
        text: "已完成上下文整理。",
        metadata: {
          ...canonicalMetadata,
          source: "agent_thread_item",
          threadItemId: "assistant-canonical-specialized-final",
          turnId: "turn-canonical-specialized-process",
          sequence: 3,
          phase: "final_answer",
        },
      },
    ]);
  });
});
