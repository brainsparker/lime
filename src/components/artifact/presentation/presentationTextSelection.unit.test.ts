import { describe, expect, it } from "vitest";
import type { PresentationTextPosition } from "./presentationTextRange";
import { presentationTextSelection } from "./presentationTextSelection";
import {
  serializeText,
  textBlockId,
  textBodyFixture,
} from "./presentationTextRange.testFixtures";

const position = (
  paraIndex = 0,
  runIndex = 0,
  charIndex = 0,
): PresentationTextPosition => ({
  blockId: textBlockId,
  paraIndex,
  runIndex,
  charIndex,
});
const select = (
  body: Element,
  anchor: PresentationTextPosition,
  caret: PresentationTextPosition,
) => presentationTextSelection(body, textBlockId, anchor, caret);

describe("DrawingML text selection projection", () => {
  it.each([false, true])(
    "shape/cell 返回源 run 的真实区间，保留反向 anchor/caret：cell=%s",
    (cell) => {
      const body = textBodyFixture({ cell }),
        before = serializeText(body),
        anchor = position(1, 1, 2),
        caret = position(0, 0, 3),
        result = select(body, anchor, caret);
      expect(result).toEqual({
        anchor,
        caret,
        selection: [
          { paraIndex: 0, runIndex: 0, start: 3, end: 6 },
          { paraIndex: 0, runIndex: 1, start: 0, end: 4 },
          { paraIndex: 0, runIndex: 2, start: 0, end: 1 },
          { paraIndex: 0, runIndex: 3, start: 0, end: 4 },
          { paraIndex: 1, runIndex: 0, start: 0, end: 7 },
          { paraIndex: 1, runIndex: 1, start: 0, end: 2 },
        ],
        selectedPlainText: "ha 中😀文\ntail\nSecond 👩",
      });
      expect(select(body, caret, anchor).selection).toEqual(result.selection);
      anchor.charIndex = 0;
      result.caret.charIndex = 1;
      expect(result.anchor.charIndex).toBe(2);
      expect(caret.charIndex).toBe(3);
      expect(serializeText(body)).toBe(before);
    },
  );

  it("折叠和同一绝对位置的不同 run 边界均返回空选区", () => {
    const body = textBodyFixture();
    for (const [anchor, caret] of [
      [position(0, 1, 1), position(0, 1, 1)],
      [position(0, 0, 6), position(0, 1, 0)],
      [position(0, 2, 1), position(0, 3, 0)],
    ]) {
      const result = select(body, anchor, caret);
      expect(result.selection).toEqual([]);
      expect(result.selectedPlainText).toBe("");
    }
  });

  it("软换行有真实 run 区间；仅段落分隔符没有伪 run", () => {
    const body = textBodyFixture();
    expect(select(body, position(0, 2), position(0, 2, 1))).toMatchObject({
      selection: [{ paraIndex: 0, runIndex: 2, start: 0, end: 1 }],
      selectedPlainText: "\n",
    });
    expect(select(body, position(0, 3, 4), position(1))).toMatchObject({
      selection: [],
      selectedPlainText: "\n",
    });
  });

  it("空段落与空 run 不产生零长区间，跨段纯文本仍准确", () => {
    const body = textBodyFixture({
      paragraphs: [
        '<a:p><a:r><a:t>A</a:t></a:r><a:r keep="empty"><a:t/></a:r></a:p>',
        "<a:p/>",
        "<a:p><a:r><a:t>B</a:t></a:r></a:p>",
      ],
    });
    expect(select(body, position(), position(2, 0, 1))).toMatchObject({
      selection: [
        { paraIndex: 0, runIndex: 0, start: 0, end: 1 },
        { paraIndex: 2, runIndex: 0, start: 0, end: 1 },
      ],
      selectedPlainText: "A\n\nB",
    });
    expect(select(body, position(1), position(1)).selection).toEqual([]);
  });

  it("Unicode 使用 UTF-16：emoji、ZWJ 和组合字符保留原文", () => {
    const body = textBodyFixture({
      paragraphs: ["<a:p><a:r><a:t>中😀é👩‍💻尾</a:t></a:r></a:p>"],
    });
    expect(select(body, position(0, 0, 1), position(0, 0, 10))).toMatchObject({
      selection: [{ paraIndex: 0, runIndex: 0, start: 1, end: 10 }],
      selectedPlainText: "😀é👩‍💻",
    });
    expect(select(body, position(0, 0, 4), position(0, 0, 5))).toMatchObject({
      selectedPlainText: "́",
    });
  });

  it.each([
    { ...position(), blockId: "other" },
    position(-1),
    position(3),
    position(0, 4),
    position(0, -1),
    position(0, 1, 2),
    position(0, 0, 7),
    position(0, 0, 1.5),
    position(0, 2, 2),
  ])("非法位置不变更正文：%j", (invalid) => {
    const body = textBodyFixture(),
      before = serializeText(body);
    expect(() => select(body, position(), invalid)).toThrow();
    expect(() => select(body, invalid, position())).toThrow();
    expect(serializeText(body)).toBe(before);
  });
});
