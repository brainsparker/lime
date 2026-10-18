import { describe, expect, it } from "vitest";
import {
  buildDocumentAnnotationRequest,
  buildDocumentAnnotationBatchRequest,
} from "@/components/artifact/document/documentAnnotation";
import { render } from "./MessageList.testHarness";

describe("canonical 文件批注展示", () => {
  it.each([
    ["content", "pdf", false],
    ["content_parts", "pdf", false],
    ["content", "docx", false],
    ["content_parts", "docx", false],
    ["content", "pdf", true],
    ["content_parts", "pdf", true],
    ["content", "docx", true],
    ["content_parts", "docx", true],
  ] as const)(
    "%s %s batch=%s 恢复时只显示批注正文，模型输入及 canonical 身份保持完整",
    (source, format, batch) => {
      const comment = {
        format,
        id: "comment-1",
        path: `/workspace/report.${format}`,
        sourceSha256: "a".repeat(64),
        body: "请修改这里的说明",
        pageNumber: 2,
        pageCount: 3,
        pageSize: { width: 600, height: 800 },
        anchor: { kind: "point" as const, point: { x: 100, y: 200 } },
      };
      const request = batch
        ? buildDocumentAnnotationBatchRequest([
            comment,
            {
              ...comment,
              id: "comment-2",
              pageNumber: 3,
              body: "第二条修改意见",
            },
          ])
        : buildDocumentAnnotationRequest(comment);
      const timestamp = "2026-10-17T08:00:00Z";
      const item = {
        id: "canonical-comment",
        thread_id: "thread-1",
        turn_id: "turn-1",
        sequence: 1,
        status: "completed" as const,
        started_at: timestamp,
        completed_at: timestamp,
        updated_at: timestamp,
        type: "user_message" as const,
        content: source === "content" ? request.prompt : "",
        content_parts:
          source === "content_parts"
            ? [{ type: "text" as const, text: request.prompt }]
            : undefined,
      };
      // 没有本地乐观 Message，模拟重新进入会话后的 canonical 投影。
      const container = render([], {
        turns: [
          {
            id: "turn-1",
            thread_id: "thread-1",
            prompt_text: request.prompt,
            status: "completed",
            started_at: timestamp,
            completed_at: timestamp,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
        threadItems: [item],
      });
      const bubble = container.querySelector('[data-message-role="user"]');
      expect(bubble?.textContent).toContain(`report.${format} · 2`);
      expect(bubble?.textContent).toContain("请修改这里的说明");
      if (batch) expect(bubble?.textContent).toContain("第二条修改意见");
      expect(bubble?.textContent).not.toContain("sourceSha256");
      expect(bubble?.textContent).not.toContain("Request changes to the");
      expect(item.id).toBe("canonical-comment");
      expect(
        source === "content" ? item.content : item.content_parts?.[0].text,
      ).toBe(request.prompt);
    },
  );
});
