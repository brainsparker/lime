import { describe, expect, it } from "vitest";
import { composerDocumentFromJSON, composerDocumentFromText } from "./composerSchema";
import { composerOffsetToPosition, composerPositionToOffset, composerTextSelection } from "./composerPositions";

describe("composer positions", () => {
  it("PM 块边界与显示文本换行双向映射", () => {
    const doc = composerDocumentFromText("a\n\n中😀\n");
    for (const offset of [0, 1, 2, 3, 4, 6, 7]) {
      expect(composerPositionToOffset(doc, composerOffsetToPosition(doc, offset))).toBe(offset);
    }
    expect(composerOffsetToPosition(doc, 0)).toBe(1);
  });

  it("不在 emoji 的 UTF-16 代理对中间创建 selection", () => {
    const doc = composerDocumentFromText("a😀b");
    expect(composerPositionToOffset(doc, composerOffsetToPosition(doc, 2))).toBe(3);
    expect(composerPositionToOffset(doc, composerOffsetToPosition(doc, 2, -1))).toBe(1);
    const selection = composerTextSelection(doc, { start: 2, end: 2 });
    expect(selection.empty).toBe(true);
    expect(composerPositionToOffset(doc, selection.from)).toBe(3);
  });

  it("atom 内部光标吸附边缘，跨 atom 选区完整覆盖节点", () => {
    const doc = composerDocumentFromJSON({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "中" },
      { type: "mention", attrs: { id: "f", kind: "file", name: "文件", path: "/a", label: "@文件" } },
      { type: "text", text: "尾" },
    ] }] });
    expect(composerOffsetToPosition(doc, 2, -1)).toBe(2);
    expect(composerOffsetToPosition(doc, 2, 1)).toBe(3);
    const selection = composerTextSelection(doc, { start: 2, end: 3 });
    expect(selection.from).toBe(2);
    expect(selection.to).toBe(3);
    expect(composerPositionToOffset(doc, selection.to)).toBe(4);
  });

  it("hard break 与空文档均有有效 text selection", () => {
    const doc = composerDocumentFromJSON({ type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "a" }, { type: "hard_break" }, { type: "text", text: "b" },
    ] }] });
    expect(composerPositionToOffset(doc, composerOffsetToPosition(doc, 2))).toBe(2);
    expect(composerTextSelection(composerDocumentFromText(""), { start: 0, end: 0 }).from).toBe(1);
  });
});
