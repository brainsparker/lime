import { describe, expect, it } from "vitest";
import { a, one, r } from "./presentationPackageXml";
import { replaceText, validateTextBody } from "./presentationTextPackage";
import {
  createPresentationTextRangeAdapter,
  type PresentationTextPosition,
} from "./presentationTextRange";
import {
  paragraphText,
  presentationTextContent,
  runText,
  textRuns,
} from "./presentationTextRangeXml";
import {
  richParagraphs,
  serializeText,
  textBlockId,
  textBodyFixture,
  textParagraphs,
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
const adapter = (body: Element) =>
  createPresentationTextRangeAdapter(body, textBlockId);
const properties = (paragraph: Element) =>
  ["pPr", "endParaRPr"].map((name) => {
    const item = one(paragraph, a, name);
    return item ? serializeText(item) : null;
  });

describe("DrawingML shared text range owner", () => {
  it.each([false, true])(
    "shape/table cell 共用 UTF-16 定位，包含软换行与段落边界：cell=%s",
    (cell) => {
      const body = textBodyFixture({ cell }),
        owner = adapter(body),
        text = presentationTextContent(body);
      expect(text).toBe("Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird");
      for (let offset = 0; offset <= text.length; offset++) {
        const insidePair =
          offset > 0 &&
          offset < text.length &&
          /[\uD800-\uDBFF]/u.test(text[offset - 1]) &&
          /[\uDC00-\uDFFF]/u.test(text[offset]);
        if (insidePair)
          expect(() => owner.positionAtOffset(offset)).toThrow(
            "Unicode boundary",
          );
        else
          expect(owner.offsetAtPosition(owner.positionAtOffset(offset))).toBe(
            offset,
          );
      }
      expect(owner.offsetAtPosition(position(0, 2, 1))).toBe(11);
      expect(owner.positionAtOffset(16)).toEqual(position(1, 0, 0));
    },
  );

  it("同 run 最小替换保留节点、链接和未知 metadata", () => {
    const body = textBodyFixture(),
      owner = adapter(body),
      paragraphs = textParagraphs(body),
      run = textRuns(paragraphs[0])[1];
    const before = properties(paragraphs[0]),
      others = paragraphs.slice(1).map(serializeText);
    expect(
      owner.replaceRange(position(0, 1, 1), position(0, 1, 3), "😃拼音"),
    ).toEqual(position(0, 1, 5));
    expect(runText(run)).toBe("中😃拼音文");
    expect(textRuns(textParagraphs(body)[0])[1]).toBe(run);
    expect(properties(textParagraphs(body)[0])).toEqual(before);
    expect(paragraphs.slice(1).map(serializeText)).toEqual(others);
    expect(
      textRuns(paragraphs[0])[0]
        .getElementsByTagNameNS(a, "hlinkClick")[0]
        .getAttributeNS(r, "id"),
    ).toBe("rLink");
    expect(run.getElementsByTagNameNS(a, "rPr")[0].getAttribute("custom")).toBe(
      "retained",
    );
  });

  it("跨 run/softbreak 反向替换仅删除选区，保留前后相邻格式", () => {
    const body = textBodyFixture(),
      owner = adapter(body),
      before = textParagraphs(body),
      last = before[2];
    const caret = owner.replaceRange(
      position(0, 3, 2),
      position(0, 0, 3),
      "汉字",
    );
    expect(paragraphText(textParagraphs(body)[0])).toBe("Alp汉字il");
    const runs = textRuns(textParagraphs(body)[0]);
    expect(runs.map(runText)).toEqual(["Alp", "汉字", "il"]);
    expect(runs[0].getAttribute("keep")).toBe("latin");
    expect(runs[2].getAttribute("keep")).toBe("tail");
    expect(owner.offsetAtPosition(caret)).toBe(5);
    expect(textParagraphs(body)[2]).toBe(last);
    expect(properties(textParagraphs(body)[0])).toEqual(properties(before[0]));
  });

  it("跨段替换保留首段列表和末段相邻 run；未涉及段落保持原节点", () => {
    const body = textBodyFixture(),
      owner = adapter(body),
      original = textParagraphs(body),
      firstProps = properties(original[0]);
    const caret = owner.replaceRange(
      position(0, 0, 3),
      position(1, 0, 3),
      "A\nB",
    );
    const paragraphs = textParagraphs(body);
    expect(paragraphs.map(paragraphText)).toEqual([
      "AlpA",
      "Bond 👩‍💻IME",
      "Third",
    ]);
    expect(properties(paragraphs[0])).toEqual(firstProps);
    expect(properties(paragraphs[1])).toEqual(properties(original[1]));
    expect(paragraphs[2]).toBe(original[2]);
    expect(caret).toEqual(position(1, 0, 1));
    expect(
      paragraphs[1]
        .getElementsByTagNameNS(a, "hlinkClick")[1]
        .getAttributeNS(r, "id"),
    ).toBe("rOther");
  });

  it("getRangeFragment 克隆完整段落/run属性，跨段片段与原树互不变更", () => {
    const body = textBodyFixture(),
      owner = adapter(body),
      original = serializeText(body);
    const fragment = owner.getRangeFragment(
      position(1, 1, 2),
      position(0, 1, 1),
    );
    expect(fragment.paragraphs.map(paragraphText)).toEqual([
      "😀文\ntail",
      "Second 👩",
    ]);
    expect(fragment.paragraphs.map(properties)).toEqual(
      textParagraphs(body).slice(0, 2).map(properties),
    );
    expect(fragment.paragraphs[0].getAttribute("keep")).toBe("first");
    expect(
      fragment.paragraphs[0]
        .getElementsByTagNameNS(a, "rPr")[0]
        .getAttribute("custom"),
    ).toBe("retained");
    expect(
      fragment.paragraphs[1]
        .getElementsByTagNameNS(a, "hlinkClick")[0]
        .getAttributeNS(r, "id"),
    ).toBe("rOther");
    fragment.paragraphs[0].setAttribute("keep", "changed clone");
    expect(serializeText(body)).toBe(original);
  });

  it("同 part fragment 替换整段时采用片段列表/段落/末端属性与每个 run 的格式", () => {
    const source = textBodyFixture(),
      fragment = adapter(source).getRangeFragment(
        position(0),
        position(1, 1, 8),
      );
    const target = textBodyFixture({ paragraphs: [richParagraphs[2]] }),
      owner = adapter(target);
    const caret = owner.replaceRangeWithFragment(
      position(),
      position(0, 0, 5),
      fragment,
    );
    expect(textParagraphs(target).map(serializeText)).toEqual(
      fragment.paragraphs.map(serializeText),
    );
    expect(owner.offsetAtPosition(caret)).toBe(
      presentationTextContent(target).length,
    );
    expect(target.getElementsByTagNameNS("urn:keep", "run")).toHaveLength(1);
  });

  it("中段插入 fragment 保留 prefix 段属性和末尾 suffix 的原段属性", () => {
    const source = textBodyFixture(),
      fragment = adapter(source).getRangeFragment(
        position(0, 1, 1),
        position(1, 0, 3),
      );
    const target = textBodyFixture({ paragraphs: [richParagraphs[2]] }),
      before = properties(textParagraphs(target)[0]),
      owner = adapter(target);
    const caret = owner.replaceRangeWithFragment(
      position(0, 0, 2),
      position(0, 0, 3),
      fragment,
    );
    expect(textParagraphs(target).map(paragraphText)).toEqual([
      "Th😀文\ntail",
      "Secrd",
    ]);
    expect(textParagraphs(target).map(properties)).toEqual([before, before]);
    expect(owner.offsetAtPosition(caret)).toBe(
      presentationTextContent(target).length - 2,
    );
  });

  it.each([0, 3, 6, 7, 9, 10, 11, 15])(
    "splitParagraph 位置 %i 保留两侧格式、段属性与段后内容",
    (offset) => {
      const body = textBodyFixture(),
        owner = adapter(body),
        text = presentationTextContent(body),
        caret = owner.positionAtOffset(offset);
      const original = textParagraphs(body)[caret.paraIndex],
        originalProperties = properties(original);
      const result = owner.splitParagraph(caret);
      expect(presentationTextContent(body)).toBe(
        text.slice(0, offset) + "\n" + text.slice(offset),
      );
      expect(properties(textParagraphs(body)[caret.paraIndex])).toEqual(
        originalProperties,
      );
      expect(properties(textParagraphs(body)[caret.paraIndex + 1])).toEqual(
        originalProperties,
      );
      expect(owner.offsetAtPosition(result)).toBe(offset + 1);
    },
  );

  it.each([
    { paragraphs: [] },
    { paragraphs: ["<a:p/>"] },
    { paragraphs: ['<a:p><a:endParaRPr lang="zh-CN"/></a:p>'] },
  ])("空 body/段落可插入、分段与清空 %#", ({ paragraphs }) => {
    const body = textBodyFixture({ paragraphs }),
      owner = adapter(body);
    expect(owner.positionAtOffset(0)).toEqual(position());
    const caret = owner.insertText(position(), "拼音にほんご한글😀\r\n第二段");
    expect(presentationTextContent(body)).toBe("拼音にほんご한글😀\n第二段");
    expect(owner.offsetAtPosition(caret)).toBe(
      presentationTextContent(body).length,
    );
    owner.replaceRange(position(), caret, "");
    expect(presentationTextContent(body)).toBe("");
    expect(textParagraphs(body)).toHaveLength(1);
    expect(textRuns(textParagraphs(body)[0])).toHaveLength(1);
    expect(() => validateTextBody(body)).not.toThrow();
  });

  it("组合字符、ZWJ与多次 composition 字符串按原字节保留", () => {
    const body = textBodyFixture({ paragraphs: ["<a:p/>"] }),
      owner = adapter(body);
    let caret = position();
    for (const text of ["e\u0301", "👩‍💻", "한", "にほんご", "拼音", "한글"])
      caret = owner.insertText(caret, text);
    expect(presentationTextContent(body)).toBe("e\u0301👩‍💻한にほんご拼音한글");
    expect(caret.charIndex).toBe(presentationTextContent(body).length);
  });

  it("最小差异 replaceText 保留其他段、其他 run、softbreak 和全部属性", () => {
    const body = textBodyFixture(),
      paragraphs = textParagraphs(body),
      source = presentationTextContent(body),
      before = paragraphs.map(serializeText);
    replaceText(body, source.replace("中😀文", "中😃拼音文"));
    expect(textParagraphs(body)[0]).toBe(paragraphs[0]);
    expect(textParagraphs(body).slice(1).map(serializeText)).toEqual(
      before.slice(1),
    );
    expect(paragraphs[0].getElementsByTagNameNS(a, "br")).toHaveLength(1);
    expect(properties(paragraphs[0])).toEqual(
      properties(textBodyFixture().getElementsByTagNameNS(a, "p")[0]),
    );
    expect(textRuns(paragraphs[0]).map(runText)).toEqual([
      "Alpha ",
      "中😃拼音文",
      "\n",
      "tail",
    ]);
    const unchanged = serializeText(body);
    replaceText(body, presentationTextContent(body));
    expect(serializeText(body)).toBe(unchanged);
  });

  it("混合文本所有合法边界的正反向替换符合范围语义，返回 caret 可继续编辑", () => {
    const paragraphs = [
      '<a:p><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:t>A😀</a:t></a:r><a:br/><a:r><a:rPr i="1"/><a:t>B</a:t></a:r></a:p>',
      '<a:p><a:r><a:rPr lang="zh-CN"/><a:t>中é</a:t></a:r></a:p>',
    ];
    const text = presentationTextContent(textBodyFixture({ paragraphs }));
    const offsets = [0, 1, 3, 4, 5, 6, 7, 8, 9];
    for (const from of offsets)
      for (const to of offsets)
        for (const inserted of ["", "拼😀", "X\nY"]) {
          const body = textBodyFixture({ paragraphs }),
            owner = adapter(body);
          const caret = owner.replaceRange(
            owner.positionAtOffset(from),
            owner.positionAtOffset(to),
            inserted,
          );
          const start = Math.min(from, to),
            end = Math.max(from, to);
          expect(presentationTextContent(body)).toBe(
            text.slice(0, start) + inserted + text.slice(end),
          );
          expect(owner.offsetAtPosition(caret)).toBe(start + inserted.length);
          owner.insertText(caret, "续");
          expect(presentationTextContent(body)).toBe(
            text.slice(0, start) + inserted + "续" + text.slice(end),
          );
          expect(() => validateTextBody(body)).not.toThrow();
        }
  });

  it("零长度 run 按 runIndex 定位，选区外 metadata 保留且不重复", () => {
    const body = textBodyFixture({
        paragraphs: [
          '<a:p><!--retain-comment--><a:pPr lvl="1"/><a:r><a:rPr b="1"/><a:t>A</a:t></a:r><a:r keep="empty"><a:rPr custom="typing"/><a:t/></a:r><a:r><a:rPr i="1"/><a:t>B</a:t></a:r></a:p>',
        ],
      }),
      owner = adapter(body);
    const fragment = owner.getRangeFragment(
      position(0, 2, 0),
      position(0, 0, 1),
    );
    expect(textRuns(fragment.paragraphs[0])).toHaveLength(1);
    expect(textRuns(fragment.paragraphs[0])[0].getAttribute("keep")).toBe(
      "empty",
    );
    owner.replaceRange(position(0, 0, 1), position(0, 2, 0), "X\nY");
    expect(presentationTextContent(body)).toBe("AX\nYB");
    expect(body.querySelectorAll('[keep="empty"]')).toHaveLength(0);
    for (const paragraph of textParagraphs(body))
      expect(serializeText(paragraph)).toContain("<!--retain-comment-->");
  });

  it("片段引用不会被移入正文；重复粘贴保持每份独立", () => {
    const source = textBodyFixture(),
      fragment = adapter(source).getRangeFragment(
        position(0, 0, 1),
        position(0, 1, 1),
      ),
      before = fragment.paragraphs.map(serializeText);
    const body = textBodyFixture({ paragraphs: ["<a:p/>"] }),
      owner = adapter(body);
    const caret = owner.replaceRangeWithFragment(
      position(),
      position(),
      fragment,
    );
    owner.replaceRangeWithFragment(caret, caret, fragment);
    expect(presentationTextContent(body)).toBe("lpha 中lpha 中");
    expect(fragment.paragraphs.map(serializeText)).toEqual(before);
    expect(source.getElementsByTagNameNS(a, "p")).toHaveLength(3);
  });

  it("总结果超出限制和无效 fragment 失败后保持原树", () => {
    const body = textBodyFixture({
        paragraphs: ["<a:p><a:r><a:t/></a:r></a:p>"],
      }),
      owner = adapter(body);
    owner.insertText(position(), "x".repeat(1024 * 1024));
    const before = serializeText(body);
    expect(() => owner.insertText(position(), "Y")).toThrow("text input");
    for (const fragment of [
      null,
      {},
      { paragraphs: [body] },
      { paragraphs: new Array(10001).fill(textParagraphs(body)[0]) },
    ])
      expect(() =>
        owner.replaceRangeWithFragment(
          position(),
          position(),
          fragment as never,
        ),
      ).toThrow();
    expect(serializeText(body)).toBe(before);
  });

  it("replaceText 为无段落正文创建合法空 run，且拒绝容器里的裸文本", () => {
    const body = textBodyFixture({ paragraphs: [] });
    replaceText(body, "");
    expect(textRuns(textParagraphs(body)[0]).map(runText)).toEqual([""]);
    const invalid = textBodyFixture({
        paragraphs: ["<a:p>stray<a:r><a:t>visible</a:t></a:r></a:p>"],
      }),
      before = serializeText(invalid);
    expect(() => replaceText(invalid, "X")).toThrow("unsupported text content");
    expect(serializeText(invalid)).toBe(before);
  });

  it.each([
    ["😀", "😃"],
    ["😀后", "𠄀后"],
    ["前😀后", "前😃后"],
    ["😀", ""],
    ["", "😀"],
  ])("最小差异不切断 surrogate：%s → %s", (old, next) => {
    const body = textBodyFixture({
      paragraphs: ['<a:p><a:r><a:rPr b="1"/><a:t/></a:r></a:p>'],
    });
    textRuns(textParagraphs(body)[0])[0].getElementsByTagNameNS(
      a,
      "t",
    )[0].textContent = old;
    replaceText(body, next);
    expect(presentationTextContent(body)).toBe(next);
    expect(body.getElementsByTagNameNS(a, "rPr")[0].getAttribute("b")).toBe(
      "1",
    );
  });

  it.each([
    position(0, 1, 2),
    position(-1),
    position(0, -1),
    position(0, 999),
    position(0, 0, -1),
    position(0, 0, 7),
    { ...position(), blockId: "other" },
    { ...position(), charIndex: 0.5 },
    { ...position(), paraIndex: NaN },
  ])("非法位置失败且不变更原树 %#", (invalid) => {
    const body = textBodyFixture(),
      owner = adapter(body),
      before = serializeText(body);
    for (const operation of [
      () => owner.replaceRange(position(), invalid, "X"),
      () => owner.insertText(invalid, "X"),
      () => owner.splitParagraph(invalid),
      () => owner.getRangeFragment(position(), invalid),
    ])
      expect(operation).toThrow();
    expect(serializeText(body)).toBe(before);
  });

  it.each(["\ud800", "\udc00", "\u0000", "\u000b", "中".repeat(350000)])(
    "非法文字失败且不变更原树 %#",
    (text) => {
      const body = textBodyFixture(),
        before = serializeText(body);
      expect(() =>
        adapter(body).replaceRange(position(), position(), text),
      ).toThrow("text input");
      expect(() => replaceText(body, text)).toThrow("text input");
      expect(serializeText(body)).toBe(before);
    },
  );

  it.each([
    '<a:fld type="slidenum"><a:t>1</a:t></a:fld>',
    '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/>',
    "<a:r><a:t><a:unknown/></a:t></a:r>",
    "<a:r><a:t>1</a:t><a:t>2</a:t></a:r>",
  ])("field/math/歧义片段和源正文明确拒绝：%s", (source) => {
    const invalid = textBodyFixture({ paragraphs: [`<a:p>${source}</a:p>`] }),
      body = textBodyFixture(),
      owner = adapter(body),
      before = serializeText(body),
      invalidBefore = serializeText(invalid);
    expect(() =>
      owner.replaceRangeWithFragment(position(), position(), {
        paragraphs: textParagraphs(invalid),
      }),
    ).toThrow();
    expect(() => replaceText(invalid, "X")).toThrow();
    expect(serializeText(body)).toBe(before);
    expect(serializeText(invalid)).toBe(invalidBefore);
  });
});
