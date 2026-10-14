import { describe, expect, it } from "vitest";
import { composerDocumentFromJSON, composerDocumentFromText } from "./composerSchema";
import { composerDocumentFromAnnotations, projectComposerDocument, utf8ByteOffsetToUtf16 } from "./composerSerialization";
import type { ComposerEditorDocument } from "./types";

describe("composer serialization", () => {
  it("保留 CRLF、空段落和末尾换行的规范文本", () => {
    expect(projectComposerDocument(composerDocumentFromText("中\r\n\r😀\n")).text).toBe("中\n\n😀\n");
  });

  it("从中文 emoji 的 UTF-8 范围恢复 token，拒绝拆分码点", () => {
    const text = "中😀$技能";
    const doc = composerDocumentFromAnnotations({ text, textElements: [
      { byteRange: { start: 7, end: 14 }, placeholder: "$技能" },
    ] });
    const projected = projectComposerDocument(doc);
    expect(projected.text).toBe(text);
    expect(projected.textElements).toEqual([{ byteRange: { start: 7, end: 14 }, placeholder: "$技能" }]);
    expect(doc.child(0).child(1).type.name).toBe("text_element");
    expect(() => utf8ByteOffsetToUtf16(text, 4)).toThrow(/UTF-8 boundary/);
    expect(() => utf8ByteOffsetToUtf16(text, 99)).toThrow(/UTF-8 boundary/);
  });

  it("paste 展开后重新计算后续 mention 的 UTF-8 范围", () => {
    const editorDocument: ComposerEditorDocument = {
      type: "doc", content: [{ type: "paragraph", content: [
        { type: "text", text: "中" },
        { type: "paste", attrs: { id: "p", placeholder: "[paste]", text: "😀\n长文" } },
        { type: "mention", attrs: { id: "s", kind: "skill", name: "审阅", path: "/skills/review", label: "$审阅" } },
      ] }],
    };
    const doc = composerDocumentFromJSON(editorDocument);
    const display = projectComposerDocument(doc);
    const submission = projectComposerDocument(doc, true);
    expect(display.text).toBe("中[paste]$审阅");
    expect(display.mentionBindings[0]).toMatchObject({ from: 8, to: 11 });
    expect(submission.text).toBe("中😀\n长文$审阅");
    expect(submission.textElements).toEqual([
      { byteRange: { start: 3, end: 14 }, placeholder: "[paste]" },
      { byteRange: { start: 14, end: 21 }, placeholder: "$审阅" },
    ]);
    expect(submission.inputMentions).toEqual([{ type: "skill", name: "审阅", path: "/skills/review" }]);
  });

  it("不按普通文本中的占位符字面量展开 paste", () => {
    const doc = composerDocumentFromJSON({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "[paste] " },
      { type: "paste", attrs: { id: "p", placeholder: "[paste]", text: "真实内容" } },
    ] }] });
    expect(projectComposerDocument(doc, true).text).toBe("[paste] 真实内容");
  });

  it("文件与 Plugin 使用已有 mention part，Skill 使用 skill part", () => {
    const doc = composerDocumentFromJSON({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "mention", attrs: { id: "f", kind: "file", name: "文件", path: "/a.ts", label: "@文件" } },
      { type: "mention", attrs: { id: "p", kind: "plugin", name: "检索", path: "plugin:search", label: "@检索" } },
    ] }] });
    expect(projectComposerDocument(doc).inputMentions).toEqual([
      { type: "mention", name: "文件", path: "/a.ts" },
      { type: "mention", name: "检索", path: "plugin:search" },
    ]);
  });

  it("带 typed element 的 CRLF 输入归一化时重映射 byte ranges", () => {
    const doc = composerDocumentFromAnnotations({ text: "a\r\n$技能", textElements: [
      { byteRange: { start: 3, end: 10 }, placeholder: "$技能" },
    ] });
    expect(projectComposerDocument(doc)).toMatchObject({
      text: "a\n$技能", textElements: [{ byteRange: { start: 2, end: 9 }, placeholder: "$技能" }],
    });
  });

  it("拒绝重叠的 typed ranges 和未知节点/mention kind", () => {
    expect(() => composerDocumentFromAnnotations({ text: "abcdef", textElements: [
      { byteRange: { start: 1, end: 4 } }, { byteRange: { start: 3, end: 5 } },
    ] })).toThrow(/overlapping/);
    expect(() => composerDocumentFromJSON({ type: "doc", content: [{ type: "heading" }] } as unknown as ComposerEditorDocument)).toThrow();
    expect(() => composerDocumentFromJSON({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "mention", attrs: { id: "a", kind: "unknown", name: "x", path: "/x", label: "x" } },
    ] }] } as unknown as ComposerEditorDocument)).toThrow(/kind/);
  });
});
