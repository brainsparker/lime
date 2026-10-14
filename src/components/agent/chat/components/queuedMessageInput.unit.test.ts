import { describe, expect, it } from "vitest";
import type { UserInput } from "@limecloud/app-server-client";
import {
  getQueuedMessageText,
  getQueuedMessageImage,
  replaceQueuedMessageText,
} from "./queuedMessageInput";

describe("queued message text editing", () => {
  it("只投影第一张图片到缩略图，保留 sidecar URI 并区分本地图片路径", () => {
    expect(
      getQueuedMessageImage([
        { type: "text", text: "图片" },
        { type: "image", url: "sidecar://media/first.webp" },
        { type: "image", url: "sidecar://media/second.png" },
      ]),
    ).toEqual({
      data: "",
      mediaType: "image/webp",
      sourceUri: "sidecar://media/first.webp",
    });
    expect(
      getQueuedMessageImage([
        { type: "localImage", path: "C:\\fixture\\first.jpg" },
      ]),
    ).toEqual({
      data: "",
      mediaType: "image/jpeg",
      sourcePath: "C:\\fixture\\first.jpg",
    });
    expect(
      getQueuedMessageImage([{ type: "text", text: "没有图片" }]),
    ).toBeNull();
  });
  const input: UserInput[] = [
    {
      type: "text",
      text: "中文🙂",
      text_elements: [{ byteRange: { start: 0, end: 6 }, placeholder: "中文" }],
    },
    { type: "image", url: "data:image/png;base64/image", detail: "high" },
    {
      type: "text",
      text: "第二段",
      text_elements: [{ byteRange: { start: 0, end: 9 } }],
    },
    { type: "mention", name: "README", path: "/workspace/README.md" },
    { type: "skill", name: "review", path: "/workspace/review/SKILL.md" },
  ];

  it("读取所有文本段，只在段之间加入一个换行", () => {
    expect(getQueuedMessageText(input)).toBe("中文🙂\n第二段");
  });

  it("原样保存保留原始文本块、text_elements 和非文本的顺序", () => {
    const result = replaceQueuedMessageText(input, getQueuedMessageText(input));
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    result.forEach((block, index) => expect(block).toBe(input[index]));
  });

  it("修改后的扁平草稿只保留一个文本段，删除失效字节范围而不改非文本", () => {
    const result = replaceQueuedMessageText(input, "新的中文🙂\n全文");
    expect(result).toEqual([
      { type: "text", text: "新的中文🙂\n全文" },
      input[1],
      input[3],
      input[4],
    ]);
    expect(getQueuedMessageText(result)).toBe("新的中文🙂\n全文");
    expect(result[1]).toBe(input[1]);
    expect(input[0]).toHaveProperty("text_elements");
    expect(input).toHaveLength(5);
  });

  it("首次文本段前的非文本与后续非文本相对顺序保持不变", () => {
    const withLeadingImage = [input[1], input[0], input[3], input[2], input[4]];
    expect(replaceQueuedMessageText(withLeadingImage, "新内容")).toEqual([
      input[1],
      { type: "text", text: "新内容" },
      input[3],
      input[4],
    ]);
  });

  it("只有非文本输入时，新增草稿放在首位且保留所有非文本", () => {
    const attachments = [input[1], input[3], input[4]];
    expect(replaceQueuedMessageText(attachments, "说明")).toEqual([
      { type: "text", text: "说明" },
      ...attachments,
    ]);
    expect(replaceQueuedMessageText(attachments, "")).toEqual(attachments);
  });
});
