import { describe, expect, it } from "vitest";
import { appendSelectedText } from "./promptContext";

describe("appendSelectedText", () => {
  it("构建推荐提示词时应注入选中文本上下文", () => {
    const prompt = appendSelectedText("请帮我改写内容。", "这是原文。");
    expect(prompt).toContain("请帮我改写内容。");
    expect(prompt).toContain("[参考选中内容]");
    expect(prompt).toContain("这是原文。");
  });

  it("无选中文本时应保持原始提示词", () => {
    const prompt = appendSelectedText("请帮我润色。", "");
    expect(prompt).toBe("请帮我润色。");
  });

  it("选中文本过长时应截断注入", () => {
    const longSelectedText = "a".repeat(380);
    const prompt = appendSelectedText("请总结。", longSelectedText);
    expect(prompt).toContain("[参考选中内容]");
    expect(prompt).toContain("…");
  });

  it("关闭附带选区开关时应忽略选中文本", () => {
    const prompt = appendSelectedText(
      "请润色文稿。",
      "这是一段选中的文稿内容。",
      false,
    );
    expect(prompt).toBe("请润色文稿。");
  });
});
