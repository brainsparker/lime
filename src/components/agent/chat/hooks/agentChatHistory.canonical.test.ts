import { describe, expect, it } from "vitest";

import type { AgentSessionDetail } from "@/lib/api/agentRuntime/sessionTypes";

import { hydrateSessionDetailMessages } from "./agentChatHistory";

describe("agentChatHistory canonical timeline", () => {
  it("timeline 已有 canonical 工具过程时 Message 不应再注入工具摘要", () => {
    const detail: AgentSessionDetail = {
      id: "session-timeline-tool-read-summary",
      thread_id: "thread-timeline-tool-read-summary",
      created_at: 1,
      updated_at: 2,
      messages: [
        {
          id: "turn-current:user",
          role: "user",
          timestamp: 1_781_000_001,
          content: [{ type: "text", text: "搜索最新评测" }] as never,
        },
        {
          id: "turn-current:assistant",
          role: "assistant",
          timestamp: 1_781_000_004,
          runtimeTurnId: "turn-current",
          content: [{ type: "text", text: "已完成搜索。" }] as never,
        } as never,
      ],
      turns: [
        {
          id: "turn-current",
          thread_id: "thread-timeline-tool-read-summary",
          prompt_text: "搜索最新评测",
          status: "completed",
          started_at: "2026-06-16T00:00:01.000Z",
          completed_at: "2026-06-16T00:00:04.000Z",
          created_at: "2026-06-16T00:00:01.000Z",
          updated_at: "2026-06-16T00:00:04.000Z",
        },
      ],
      items: [
        {
          id: "tool-current-search",
          thread_id: "thread-timeline-tool-read-summary",
          turn_id: "turn-current",
          sequence: 1,
          type: "tool_call",
          status: "completed",
          tool_name: "search_query",
          arguments: { q: "学习机 权威评测" },
          output: "timeline search result",
          success: true,
          started_at: "2026-06-16T00:00:02.000Z",
          completed_at: "2026-06-16T00:00:03.000Z",
          updated_at: "2026-06-16T00:00:03.000Z",
        } as never,
        {
          id: "assistant-current",
          thread_id: "thread-timeline-tool-read-summary",
          turn_id: "turn-current",
          sequence: 2,
          type: "agent_message",
          status: "completed",
          text: "已完成搜索。",
          started_at: "2026-06-16T00:00:04.000Z",
          completed_at: "2026-06-16T00:00:04.000Z",
          updated_at: "2026-06-16T00:00:04.000Z",
        } as never,
      ],
      thread_read: {
        thread_id: "thread-timeline-tool-read-summary",
        status: "completed",
        profile_status: "completed",
        turns: [
          {
            turn_id: "turn-current",
            status: "completed",
          },
        ],
        tool_calls: [
          {
            id: "tool-current-search",
            turn_id: "turn-current",
            tool_name: "search_query",
            status: "completed",
            output_preview: "read model duplicate summary",
            output: "read model duplicate summary",
            success: true,
            started_at: "2026-06-16T00:00:02.000Z",
            completed_at: "2026-06-16T00:00:03.000Z",
          },
        ],
      } as never,
    };

    const messages = hydrateSessionDetailMessages(
      detail,
      "session-timeline-tool-read-summary",
    );
    const assistant = messages.find((message) => message.role === "assistant");
    const toolParts =
      assistant?.contentParts?.filter((part) => part.type === "tool_use") || [];

    expect(messages).toHaveLength(2);
    expect(assistant?.runtimeTurnId).toBe("turn-current");
    expect(toolParts).toHaveLength(0);
    expect(assistant?.toolCalls).toBeUndefined();
  });

  it("canonical reasoning/tool 不应重复写回 Message", () => {
    const detail: AgentSessionDetail = {
      id: "session-canonical-thread-read",
      thread_id: "thread-canonical-thread-read",
      created_at: 1,
      updated_at: 2,
      messages: [
        {
          id: "turn-codex:user",
          role: "user",
          timestamp: 1_781_000_001,
          content: [{ type: "text", text: "run it" }] as never,
        },
        {
          id: "turn-codex:assistant",
          role: "assistant",
          timestamp: 1_781_000_004,
          runtimeTurnId: "turn-codex",
          content: [{ type: "text", text: "done" }] as never,
        } as never,
      ],
      turns: [
        {
          id: "turn-codex",
          thread_id: "thread-canonical-thread-read",
          prompt_text: "run it",
          status: "completed",
          started_at: "2026-06-16T00:00:01.000Z",
          completed_at: "2026-06-16T00:00:04.000Z",
          created_at: "2026-06-16T00:00:01.000Z",
          updated_at: "2026-06-16T00:00:04.000Z",
        },
      ],
      items: [
        {
          id: "reasoning-codex",
          thread_id: "thread-canonical-thread-read",
          turn_id: "turn-codex",
          sequence: 1,
          type: "reasoning",
          status: "completed",
          text: "I need to inspect the test failure first.",
          started_at: "2026-06-16T00:00:01.150Z",
          completed_at: "2026-06-16T00:00:01.150Z",
          updated_at: "2026-06-16T00:00:01.150Z",
        } as never,
        {
          id: "command-codex",
          thread_id: "thread-canonical-thread-read",
          turn_id: "turn-codex",
          sequence: 2,
          type: "command_execution",
          status: "completed",
          command: "npm test",
          cwd: "/workspace/app",
          aggregated_output: "Exit code: 0\nOutput:\nok",
          exit_code: 0,
          started_at: "2026-06-16T00:00:02.000Z",
          completed_at: "2026-06-16T00:00:03.000Z",
          updated_at: "2026-06-16T00:00:03.000Z",
        } as never,
        {
          id: "assistant-codex",
          thread_id: "thread-canonical-thread-read",
          turn_id: "turn-codex",
          sequence: 3,
          type: "agent_message",
          status: "completed",
          text: "done",
          started_at: "2026-06-16T00:00:04.000Z",
          completed_at: "2026-06-16T00:00:04.000Z",
          updated_at: "2026-06-16T00:00:04.000Z",
        } as never,
      ],
      thread_read: {
        thread_id: "thread-canonical-thread-read",
        status: "completed",
        profile_status: "completed",
        turns: [
          {
            turn_id: "turn-codex",
            status: "completed",
          },
        ],
        tool_calls: [
          {
            id: "command-codex",
            turn_id: "turn-codex",
            tool_name: "exec_command",
            status: "completed",
            output_preview: "ok",
            started_at: "2026-06-16T00:00:02.000Z",
            completed_at: "2026-06-16T00:00:03.000Z",
          },
        ],
      } as never,
    };

    const messages = hydrateSessionDetailMessages(
      detail,
      "session-canonical-thread-read",
    );

    expect(messages).toHaveLength(2);
    expect(messages[1]?.contentParts?.map((part) => part.type)).toEqual([
      "text",
    ]);
  });

  it("App Server thread_read.tool_calls 与 artifact summary 同时存在时仍应保留工具过程", () => {
    const detail: AgentSessionDetail = {
      id: "session-app-server-tool-artifact",
      thread_id: "thread-app-server-tool-artifact",
      created_at: 1,
      updated_at: 2,
      messages_count: 2,
      history_limit: 40,
      history_cursor: {
        item_cursor: null,
        turn_cursor: null,
        loaded_entry_count: 2,
        loaded_turn_count: 0,
        loaded_item_count: 2,
        has_more: false,
      },
      history_truncated: false,
      messages: [
        {
          role: "user",
          timestamp: 1780704100,
          content: [
            {
              type: "text",
              text: "生成 TypeScript greeting 代码产物",
            },
          ],
        },
        {
          role: "assistant",
          timestamp: 1780704102,
          content: [
            {
              type: "text",
              text: "已生成代码产物，可在工作台查看。",
            },
          ],
        },
      ],
      turns: [
        {
          id: "turn-tool-artifact",
          thread_id: "thread-app-server-tool-artifact",
          prompt_text: "生成 TypeScript greeting 代码产物",
          status: "completed",
          started_at: "2026-06-07T10:41:40.000Z",
          completed_at: "2026-06-07T10:41:42.000Z",
          created_at: "2026-06-07T10:41:40.000Z",
          updated_at: "2026-06-07T10:41:42.000Z",
        },
      ],
      thread_read: {
        thread_id: "thread-app-server-tool-artifact",
        status: "completed",
        profile_status: "completed",
        turns: [
          {
            turn_id: "turn-tool-artifact",
            status: "completed",
            native_status: "completed",
          },
        ],
        pending_requests: [],
        incidents: [],
        tool_calls: [
          {
            tool_call_id: "tool-webfetch-artifact",
            turn_id: "turn-tool-artifact",
            tool_name: "WebFetch",
            status: "completed",
            started_at: "2026-06-07T10:41:41.000Z",
            finished_at: "2026-06-07T10:41:42.000Z",
            arguments: {
              url: "https://example.com/lime-workbench-tool",
            },
            output_preview:
              "已获取 fixture 工具事实: https://example.com/lime-workbench-tool",
            output:
              "已获取 fixture 工具事实: https://example.com/lime-workbench-tool",
            success: true,
          },
        ],
        artifacts: [
          {
            artifactRef: "artifact-ref-tool-artifact",
            eventId: "event-artifact-tool-artifact",
            sequence: 1,
            turnId: "turn-tool-artifact",
            artifactId: "code-artifact:greeting",
            path: ".lime/qc/code-artifact-workbench/src/greeting.ts",
            title: "greeting.ts",
            kind: "code",
            status: "complete",
            contentStatus: "available",
            metadata: {
              language: "typescript",
              previewText: "export const greeting = 'hello';",
            },
          },
        ],
      },
    };

    const messages = hydrateSessionDetailMessages(
      detail,
      "session-app-server-tool-artifact",
      {
        compactCompletedHistory: true,
        includeTimelineFallback: true,
      },
    );

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: "assistant",
      content: "已生成代码产物，可在工作台查看。",
      runtimeTurnId: "turn-tool-artifact",
      toolCalls: [
        {
          id: "tool-webfetch-artifact",
          name: "WebFetch",
          status: "completed",
        },
      ],
      artifacts: [
        {
          id: "code-artifact:greeting",
          title: "greeting.ts",
        },
      ],
    });
    expect(messages[1]?.contentParts?.map((part) => part.type)).toEqual([
      "tool_use",
      "text",
    ]);
  });

  it("应清理仅用于内部展示的图片占位文本", () => {
    const detail: AgentSessionDetail = {
      id: "session-image-placeholder",
      created_at: 1,
      updated_at: 2,
      messages: [
        {
          role: "user",
          timestamp: 1710000200,
          content: [
            { type: "input_text", text: "[Image #1]" } as never,
            {
              type: "input_image",
              image_url: "data:image/png;base64,aGVsbG8=",
            } as never,
          ],
        },
        {
          role: "assistant",
          timestamp: 1710000201,
          content: [{ type: "output_text", text: "已收到图片" } as never],
        },
      ],
    };

    const messages = hydrateSessionDetailMessages(
      detail,
      "session-image-placeholder",
    );

    expect(messages[0]).toMatchObject({
      role: "user",
      content: "",
      images: [
        {
          mediaType: "image/png",
          data: "aGVsbG8=",
        },
      ],
    });
    expect(messages[1]?.content).toBe("已收到图片");
  });

  it("应从消息顶层附件恢复图片并保留用户文本", () => {
    const detail: AgentSessionDetail = {
      id: "session-attachment",
      created_at: 1,
      updated_at: 2,
      messages: [
        {
          role: "user",
          timestamp: 1710000200,
          content: [
            {
              type: "text",
              text: "请运行测试并修复失败",
            },
          ],
          attachments: [
            {
              kind: "image",
              uri: "data:image/png;base64,aGVsbG8=",
              metadata: {
                mediaType: "image/png",
                index: 0,
                detail: "low",
              },
            },
          ],
        } as never,
        {
          role: "assistant",
          timestamp: 1710000201,
          content: [{ type: "output_text", text: "已收到图片。" } as never],
        },
      ],
    };

    const messages = hydrateSessionDetailMessages(detail, "session-attachment");

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: "请运行测试并修复失败",
      images: [
        {
          mediaType: "image/png",
          data: "aGVsbG8=",
          sourceUri: "data:image/png;base64,aGVsbG8=",
          previewUrl: "data:image/png;base64,aGVsbG8=",
          metadata: {
            mediaType: "image/png",
            index: 0,
            detail: "low",
          },
          index: 0,
        },
      ],
    });
    expect(messages[1]?.content).toBe("已收到图片。");
  });

  it("消息同时包含 content image 和 attachment 时不应重复展示图片", () => {
    const detail: AgentSessionDetail = {
      id: "session-attachment-dedupe",
      created_at: 1,
      updated_at: 2,
      messages: [
        {
          role: "user",
          timestamp: 1710000200,
          content: [
            {
              type: "text",
              text: "请运行测试并修复失败",
            },
            {
              type: "image",
              uri: "data:image/png;base64,aGVsbG8=",
              metadata: {
                mediaType: "image/png",
                index: 0,
              },
            },
          ],
          attachments: [
            {
              kind: "image",
              uri: "data:image/png;base64,aGVsbG8=",
              metadata: {
                mediaType: "image/png",
                index: 0,
              },
            },
          ],
        } as never,
      ],
    };

    const messages = hydrateSessionDetailMessages(
      detail,
      "session-attachment-dedupe",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("请运行测试并修复失败");
    expect(messages[0]?.images).toHaveLength(1);
    expect(messages[0]?.images?.[0]).toMatchObject({
      mediaType: "image/png",
      data: "aGVsbG8=",
      sourceUri: "data:image/png;base64,aGVsbG8=",
      previewUrl: "data:image/png;base64,aGVsbG8=",
    });
  });
});
