import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  installStreamingRendererTestHarness,
  renderStreamingRendererHarness as renderHarness,
} from "./StreamingRenderer.testHarness";

installStreamingRendererTestHarness();

describe("StreamingRenderer canonical history", () => {
  it("历史命令应复用普通命令名称、参数和输出展示", () => {
    const { container } = renderHarness({
      content: "历史完成",
      toolCalls: [
        {
          id: "local-history-canonical-command",
          name: "command_execution",
          arguments: JSON.stringify({ command: "npm test" }),
          status: "completed",
          result: {
            success: true,
            output: "ok",
            metadata: {
              environmentId: "environment-main",
              exit_code: 0,
              stdout_text: "ok",
            },
          },
          startTime: new Date("2026-06-17T10:00:00.000Z"),
          endTime: new Date("2026-06-17T10:00:01.000Z"),
        },
      ],
    });

    expect(container.textContent).toContain("已运行 npm test");
    expect(container.textContent).toContain("ok");
    expect(container.textContent).not.toContain("历史的命令记录");
    expect(container.textContent).not.toContain("stdout");
    expect(container.textContent).not.toContain("environmentId");
  });

  it("续聊后的历史过程应保留命令记录并单独展示搜索摘要", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const { container } = renderHarness({
      content: "",
      contentParts: [
        {
          type: "tool_use",
          toolCall: {
            id: "local-history-canonical-command-hydrated",
            name: "Bash",
            arguments: JSON.stringify({
              command: "npm test",
              cwd: "/workspace/canonical-local-history",
            }),
            status: "completed",
            result: {
              success: true,
              output: "ok",
              metadata: canonicalMetadata,
            },
            startTime: new Date("2026-06-17T10:00:00.000Z"),
            endTime: new Date("2026-06-17T10:00:01.000Z"),
          },
        },
        {
          type: "tool_use",
          toolCall: {
            id: "local-history-canonical-search-hydrated",
            name: "web_search",
            arguments: JSON.stringify({
              action: {
                type: "search_query",
                query: "Lime history import",
              },
            }),
            status: "completed",
            result: {
              success: true,
              output: '"search_query"',
              metadata: canonicalMetadata,
            },
            startTime: new Date("2026-06-17T10:00:02.000Z"),
            endTime: new Date("2026-06-17T10:00:03.000Z"),
          },
        },
        {
          type: "action_required",
          actionRequired: {
            requestId: "local-history-canonical-approval-hydrated",
            actionType: "tool_confirmation",
            status: "submitted",
            prompt: "Approve canonical command",
            submittedResponse: JSON.stringify({
              decision: "approved",
            }),
          },
        },
        {
          type: "text",
          text: "已完成修复。",
        },
      ],
      isStreaming: false,
    });

    const processGroupButtons = container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="streaming-process-group"] > button',
    );
    expect(processGroupButtons).toHaveLength(1);
    expect(container.textContent).toContain("已运行 npm test");
    expect(processGroupButtons[0]?.textContent).toContain(
      "已搜索网页：Lime history import",
    );
    expect(processGroupButtons[0]?.textContent).not.toContain("历史的命令记录");
    expect(container.textContent).toContain("已完成修复。");
    expect(container.textContent).not.toContain("历史的命令记录");
  });

  it("来源 provenance 不应改变普通命令展示", () => {
    const { container } = renderHarness({
      content: "",
      contentParts: [
        {
          type: "tool_use",
          toolCall: {
            id: "other-canonical-command-hydrated",
            name: "Bash",
            arguments: JSON.stringify({
              command: "npm test",
              cwd: "/workspace/canonical-history",
            }),
            status: "completed",
            result: {
              success: true,
              output: "ok",
              metadata: {
                environmentId: "environment-main",
              },
            },
            startTime: new Date("2026-06-17T10:00:00.000Z"),
            endTime: new Date("2026-06-17T10:00:01.000Z"),
          },
        },
        {
          type: "text",
          text: "已完成修复。",
        },
      ],
      isStreaming: false,
    });

    expect(
      container.querySelector('[data-testid="streaming-process-group"]'),
    ).toBeNull();
    const commandRecord = container.querySelector(
      '[data-testid="inline-tool-process-step"]',
    );
    expect(commandRecord).not.toBeNull();
    expect(commandRecord?.textContent).toContain("已运行 npm test");
    expect(container.textContent).not.toContain("历史的命令记录");
    expect(container.textContent).not.toContain("environmentId");
  });

  it("历史思考与命令应按普通历史顺序展示", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const { container } = renderHarness({
      content: "",
      contentParts: [
        {
          type: "thinking",
          text: "I need to inspect the test failure first.",
          metadata: canonicalMetadata,
        },
        {
          type: "tool_use",
          toolCall: {
            id: "local-history-canonical-command-after-thinking",
            name: "Bash",
            arguments: JSON.stringify({
              command: "npm test",
              cwd: "/workspace/canonical-local-history",
            }),
            status: "completed",
            result: {
              success: true,
              output: "ok",
              metadata: canonicalMetadata,
            },
            startTime: new Date("2026-06-17T10:00:00.000Z"),
            endTime: new Date("2026-06-17T10:00:01.000Z"),
          },
        },
        {
          type: "text",
          text: "已完成修复。",
        },
      ],
      isStreaming: false,
    });

    expect(
      container.querySelector('[data-testid="streaming-process-group"]'),
    ).toBeNull();
    const thinkingBlock = container.querySelector(
      '[data-testid="thinking-block"]',
    );
    const commandRecord = container.querySelector(
      '[data-testid="inline-tool-process-step"]',
    );
    expect(thinkingBlock).not.toBeNull();
    expect(commandRecord).not.toBeNull();
    expect(
      thinkingBlock!.compareDocumentPosition(commandRecord!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.textContent).toContain(
      "I need to inspect the test failure first.",
    );
    expect(container.textContent).toContain("已完成修复。");
    expect(container.textContent).toContain("npm test");
  });

  it("工具轨同组的思考即使缺少来源 metadata 也应还原原文", () => {
    const canonicalMetadata = {
      environmentId: "environment-main",
    };
    const canonicalPath =
      "/workspace/canonical-local-history/docs/canonical-preview.md";
    const onFileClick = vi.fn();
    const { container } = renderHarness({
      content: "",
      contentParts: [
        {
          type: "thinking",
          text: "I need to inspect the test failure first.",
        },
        {
          type: "tool_use",
          toolCall: {
            id: "canonical-read-file-after-thinking",
            name: "read_file",
            arguments: JSON.stringify({
              path: canonicalPath,
            }),
            status: "completed",
            result: {
              success: true,
              output: "会话 Markdown 预览内容",
              metadata: canonicalMetadata,
            },
            startTime: new Date("2026-06-17T10:00:00.000Z"),
            endTime: new Date("2026-06-17T10:00:01.000Z"),
          },
        },
        {
          type: "text",
          text: "已完成修复。",
        },
      ],
      isStreaming: false,
      onFileClick,
    });

    expect(
      container.querySelector('[data-testid="streaming-process-group"]'),
    ).toBeNull();
    expect(container.textContent).toContain(
      "I need to inspect the test failure first.",
    );
    expect(
      container
        .querySelector('[data-testid="thinking-block"]')
        ?.getAttribute("data-visual-style"),
    ).not.toBe("grouped-inline");
    expect(container.textContent).toContain("已查看 canonical-preview.md");

    const openFileButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="inline-tool-open-file"]',
    );
    expect(openFileButton?.getAttribute("data-file-path")).toBe(canonicalPath);

    act(() => {
      openFileButton?.click();
    });

    expect(onFileClick).toHaveBeenCalledWith(
      canonicalPath,
      "会话 Markdown 预览内容",
    );
  });
});
