import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  buildPresentation,
  parseZip,
  renderSlide,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, one, p, r, readXml } from "./presentationPackageXml";
import type { PresentationTextStyle } from "./presentationTextPackage";
import type { PresentationTextPosition } from "./presentationTextRange";
import {
  cloneElement,
  presentationTextContent,
  runText,
  textRuns,
} from "./presentationTextRangeXml";
import { applyPresentationTextRangeStyle } from "./presentationTextStyle";
import {
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
const apply = (
  body: Element,
  anchor: PresentationTextPosition,
  caret: PresentationTextPosition,
  style: PresentationTextStyle,
) => applyPresentationTextRangeStyle(body, textBlockId, anchor, caret, style);
const properties = (paragraph: Element) =>
  ["pPr", "endParaRPr"].map((name) => {
    const item = one(paragraph, a, name);
    return item ? serializeText(item) : null;
  });
const runProperties = (run: Element) => one(run, a, "rPr")!;

describe("DrawingML selected text style", () => {
  it.each([false, true])(
    "shape/cell 同 run 边界拆分，只写选中的属性：cell=%s",
    (cell) => {
      const body = textBodyFixture({ cell }),
        source = textParagraphs(body),
        before = source.map(properties),
        unchanged = textRuns(source[0]).slice(1).map(serializeText),
        bodyPr = one(body, a, "bodyPr"),
        list = one(body, a, "lstStyle");
      expect(
        apply(body, position(0, 0, 2), position(0, 0, 4), { italic: true }),
      ).toBe(true);
      const paragraphs = textParagraphs(body),
        runs = textRuns(paragraphs[0]);
      expect(runs.map(runText)).toEqual([
        "Al",
        "ph",
        "a ",
        "中😀文",
        "\n",
        "tail",
      ]);
      for (const [index, run] of runs.slice(0, 3).entries()) {
        const props = runProperties(run);
        expect(props.getAttribute("b")).toBe("1");
        expect(props.getAttribute("i")).toBe(index === 1 ? "1" : null);
        expect(props.getAttribute("lang")).toBe("en-US");
        expect(one(props, a, "hlinkClick")?.getAttributeNS(r, "id")).toBe(
          "rLink",
        );
        expect(props.getElementsByTagNameNS("urn:keep", "run")).toHaveLength(1);
      }
      expect(runs.slice(3).map(serializeText)).toEqual(unchanged);
      expect(paragraphs.map(properties)).toEqual(before);
      expect(paragraphs[1]).toBe(source[1]);
      expect(paragraphs[2]).toBe(source[2]);
      expect(one(body, a, "bodyPr")).toBe(bodyPr);
      expect(one(body, a, "lstStyle")).toBe(list);
      expect(presentationTextContent(body)).toBe(
        "Alpha 中😀文\ntail\nSecond 👩‍💻IME\nThird",
      );
    },
  );

  it.each([false, true])(
    "跨段、软换行、混合样式和列表保留，方向不影响结果：reverse=%s",
    (reverse) => {
      const body = textBodyFixture(),
        original = textParagraphs(body),
        before = original.map(properties),
        softBreak = serializeText(textRuns(original[0])[2]),
        start = position(0, 0, 3),
        end = position(1, 1, 2);
      expect(
        apply(body, reverse ? end : start, reverse ? start : end, {
          bold: false,
          italic: true,
          fontSize: 18,
          color: "#aBcDeF",
        }),
      ).toBe(true);
      const paragraphs = textParagraphs(body),
        first = textRuns(paragraphs[0]),
        second = textRuns(paragraphs[1]);
      expect(first.map(runText)).toEqual([
        "Alp",
        "ha ",
        "中😀文",
        "\n",
        "tail",
      ]);
      expect(second.map(runText)).toEqual(["Second ", "👩", "‍💻IME"]);
      expect(serializeText(first[3])).toBe(softBreak);
      expect(runProperties(first[0]).getAttribute("i")).toBeNull();
      expect(runProperties(second[2]).getAttribute("sz")).toBe("2300");
      expect(runProperties(second[2]).getAttribute("b")).toBeNull();
      for (const run of [
        ...first.slice(1).filter((item) => item.localName === "r"),
        ...second.slice(0, 2),
      ]) {
        const props = runProperties(run);
        expect([
          props.getAttribute("sz"),
          props.getAttribute("b"),
          props.getAttribute("i"),
        ]).toEqual(["1350", "0", "1"]);
        expect(
          props.getElementsByTagNameNS(a, "srgbClr")[0].getAttribute("val"),
        ).toBe("ABCDEF");
      }
      expect(paragraphs.map(properties)).toEqual(before);
      expect(paragraphs[2]).toBe(original[2]);
      expect(first[2].getAttribute("keep")).toBe("han");
      expect(runProperties(first[2]).getAttribute("custom")).toBe("retained");
      for (const run of second.slice(1))
        expect(
          one(runProperties(run), a, "hlinkClick")?.getAttributeNS(r, "id"),
        ).toBe("rOther");
    },
  );

  it("保留未相交空 run、空段、所有未知属性和原树隔离", () => {
    const source = textBodyFixture({
        paragraphs: [
          '<a:p keep="one"><a:pPr><a:buChar char="•"/></a:pPr><a:r keep="empty"><a:rPr custom="empty"/><a:t/></a:r><a:r><a:t>AB</a:t></a:r><a:r keep="middle-empty"><a:t/></a:r><a:r><a:t>CD</a:t></a:r><a:endParaRPr custom="end"/></a:p>',
          '<a:p keep="empty-paragraph"><a:pPr custom="empty"/></a:p>',
          '<a:p keep="last"><a:r keep="last-empty"><a:t/></a:r><a:r><a:t>EF</a:t></a:r></a:p>',
        ],
      }),
      body = cloneElement(source),
      original = serializeText(source);
    const empty = textRuns(textParagraphs(body)[0])
      .filter((run) => !runText(run))
      .map(serializeText);
    expect(
      apply(body, position(0, 1, 1), position(2, 1, 1), { bold: true }),
    ).toBe(true);
    expect(
      textRuns(textParagraphs(body)[0])
        .filter((run) => !runText(run))
        .map(serializeText),
    ).toEqual(empty);
    expect(serializeText(textParagraphs(body)[1])).toBe(
      serializeText(textParagraphs(source)[1]),
    );
    expect(textRuns(textParagraphs(body)[2])[0].getAttribute("keep")).toBe(
      "last-empty",
    );
    expect(textParagraphs(body).map(properties)).toEqual(
      textParagraphs(source).map(properties),
    );
    expect(presentationTextContent(body)).toBe("ABCD\n\nEF");
    expect(serializeText(source)).toBe(original);
  });

  it("只选软换行/段落边界、collapsed 和空样式均明确不改正文", () => {
    const body = textBodyFixture(),
      before = serializeText(body);
    for (const [start, end, style] of [
      [position(0, 2), position(0, 2, 1), { bold: true }],
      [position(0, 3, 4), position(1), { bold: true }],
      [position(0, 1, 1), position(0, 1, 1), { bold: true }],
      [position(0, 0, 6), position(0, 1), { bold: true }],
      [position(), position(1, 1, 2), {}],
    ] as const)
      expect(apply(body, start, end, style)).toBe(false);
    expect(serializeText(body)).toBe(before);
  });

  it("已经拥有指定显式属性时不拆 run、不产生伪变更", () => {
    const body = textBodyFixture(),
      before = serializeText(body);
    expect(
      apply(body, position(0, 0, 1), position(0, 0, 3), { bold: true }),
    ).toBe(false);
    expect(serializeText(body)).toBe(before);
  });

  it("合法 UTF-16 边界不规范化组合字符或 ZWJ，emoji 不被拆坏", () => {
    const body = textBodyFixture({
      paragraphs: ["<a:p><a:r><a:t>中😀é👩‍💻尾</a:t></a:r></a:p>"],
    });
    expect(
      apply(body, position(0, 0, 1), position(0, 0, 10), { italic: true }),
    ).toBe(true);
    expect(textRuns(textParagraphs(body)[0]).map(runText)).toEqual([
      "中",
      "😀é👩‍💻",
      "尾",
    ]);
    expect(presentationTextContent(body)).toBe("中😀é👩‍💻尾");
  });

  it.each(
    [
      undefined,
      null,
      [],
      { underline: true },
      { bold: 1 },
      { italic: "false" },
      { fontSize: 0 },
      { fontSize: -1 },
      { fontSize: Infinity },
      { fontSize: NaN },
      { fontSize: 6000 },
      { color: "#123" },
      { color: "red" },
      { color: 123 },
      { [Symbol("hidden")]: true },
    ].map((style) => ({ style })),
  )("非法 style 在验证阶段拒绝，原正文无半修改：%j", ({ style }) => {
    const body = textBodyFixture(),
      before = serializeText(body);
    expect(() =>
      apply(
        body,
        position(),
        position(1, 1, 2),
        style as PresentationTextStyle,
      ),
    ).toThrow();
    expect(serializeText(body)).toBe(before);
  });

  it("collapsed 仍验证非法 style；空 body 不制造段落或 typing 样式", () => {
    const body = textBodyFixture({ paragraphs: [] }),
      before = serializeText(body);
    expect(apply(body, position(), position(), { bold: true })).toBe(false);
    expect(() =>
      apply(body, position(), position(), { color: "invalid" }),
    ).toThrow();
    expect(serializeText(body)).toBe(before);
  });

  it("颜色只替换所选 run 的 fill，保留线条、语言、链接与未知扩展", () => {
    const body = textBodyFixture({
      paragraphs: [
        '<a:p><a:r><a:rPr i="1" lang="zh-CN" custom="run"><a:ln w="9000"/><a:gradFill><a:gsLst/></a:gradFill><a:hlinkClick r:id="keep"/><a:extLst><a:ext uri="urn:keep"><keep:payload val="retained"/></a:ext></a:extLst></a:rPr><a:t>ABC</a:t></a:r></a:p>',
      ],
    });
    expect(
      apply(body, position(0, 0, 1), position(0, 0, 2), { color: "123456" }),
    ).toBe(true);
    const runs = textRuns(textParagraphs(body)[0]);
    for (const [index, run] of runs.entries()) {
      const props = runProperties(run);
      expect(props.getAttribute("i")).toBe("1");
      expect(props.getAttribute("custom")).toBe("run");
      expect(one(props, a, "ln")?.getAttribute("w")).toBe("9000");
      expect(one(props, a, "hlinkClick")?.getAttributeNS(r, "id")).toBe("keep");
      expect(
        props
          .getElementsByTagNameNS("urn:keep", "payload")[0]
          .getAttribute("val"),
      ).toBe("retained");
      expect(Boolean(one(props, a, "gradFill"))).toBe(index !== 1);
      expect(Boolean(one(props, a, "solidFill"))).toBe(index === 1);
    }
  });

  it("未知扩展 payload 内的同名 rPr/defRPr/endParaRPr 不被范围样式遍历", () => {
    const body = textBodyFixture({
        paragraphs: [
          '<a:p><a:r><a:rPr><a:extLst><a:ext uri="urn:opaque"><keep:payload><a:rPr b="1"/><a:defRPr sz="900"/><a:endParaRPr i="1"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:endParaRPr></keep:payload></a:ext></a:extLst></a:rPr><a:t>AB</a:t></a:r></a:p>',
        ],
      }),
      before = serializeText(
        body.getElementsByTagNameNS("urn:keep", "payload")[0],
      );
    expect(
      apply(body, position(), position(0, 0, 2), {
        bold: false,
        italic: false,
        fontSize: 24,
        color: "#AA3344",
      }),
    ).toBe(true);
    expect(
      serializeText(body.getElementsByTagNameNS("urn:keep", "payload")[0]),
    ).toBe(before);
    const props = runProperties(textRuns(textParagraphs(body)[0])[0]);
    expect([
      props.getAttribute("b"),
      props.getAttribute("i"),
      props.getAttribute("sz"),
    ]).toEqual(["0", "0", "1800"]);
  });

  it.each([
    { ...position(), blockId: "wrong" },
    position(-1),
    position(4),
    position(0, 0, 7),
    position(0, 1, 2),
    position(1, 1, 1),
  ])("非法 position 不修改正文，即使另一端合法且样式有效：%j", (invalid) => {
    const body = textBodyFixture(),
      before = serializeText(body);
    expect(() => apply(body, position(), invalid, { bold: false })).toThrow();
    expect(serializeText(body)).toBe(before);
  });

  it.each([
    '<a:fld id="field"><a:t>field</a:t></a:fld>',
    '<a:r><a:rPr><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"/></a:rPr><a:t>math</a:t></a:r>',
  ])("field/math 正文明确不可编辑：%s", (unsupported) => {
    const body = textBodyFixture({
        paragraphs: [`<a:p><a:r><a:t>valid</a:t></a:r>${unsupported}</a:p>`],
      }),
      before = serializeText(body);
    expect(() =>
      apply(body, position(), position(0, 0, 1), { bold: true }),
    ).toThrow("unsupported field or text content");
    expect(serializeText(body)).toBe(before);
  });

  it("范围样式写回真实 OPC 可由 public renderer 重新解析，非目标 ZIP 原件不变", async () => {
    const zip = await JSZip.loadAsync(
        readFileSync(
          "src/components/artifact/presentation/__fixtures__/review.pptx",
        ),
      ),
      part = "ppt/slides/slide1.xml",
      document = readXml(await zip.file(part)!.async("string")),
      shape = Array.from(document.getElementsByTagNameNS(p, "sp")).find(
        (item) =>
          item.getElementsByTagNameNS(p, "cNvPr")[0]?.getAttribute("id") ===
          "2",
      )!,
      body = one(shape, p, "txBody")!,
      fixture = textBodyFixture();
    shape.replaceChild(document.importNode(fixture, true), body);
    const target = one(shape, p, "txBody")!;
    expect(
      apply(target, position(0, 0, 2), position(0, 0, 4), {
        bold: false,
        italic: true,
        fontSize: 24,
        color: "#AA3344",
      }),
    ).toBe(true);
    const baseline = new Map(
      await Promise.all(
        Object.values(zip.files)
          .filter((entry) => !entry.dir && entry.name !== part)
          .map(
            async (entry) =>
              [entry.name, await entry.async("uint8array")] as const,
          ),
      ),
    );
    zip.file(part, serializeText(document));
    const bytes = await zip.generateAsync({ type: "uint8array" }),
      reopened = await JSZip.loadAsync(bytes, { checkCRC32: true });
    for (const [name, content] of baseline)
      expect(await reopened.file(name)!.async("uint8array"), name).toEqual(
        content,
      );
    const model = buildPresentation(
        await parseZip(bytes.slice().buffer as ArrayBuffer),
      ),
      rendered = renderSlide(model, model.slides[0], { pdfjs: false });
    try {
      const spans = Array.from(rendered.element.querySelectorAll("span")),
        changed = spans.find((span) => span.textContent === "ph")!;
      expect(changed).toBeDefined();
      expect(changed.style.fontSize).toBe("18pt");
      expect(changed.style.fontStyle).toBe("italic");
      expect(changed.style.color).toBe("rgb(170, 51, 68)");
      expect(rendered.element.textContent).toContain("Alpha 中😀文");
      const reopenedXml = readXml(await reopened.file(part)!.async("string")),
        reopenedBody = reopenedXml.getElementsByTagNameNS(p, "txBody")[0];
      expect(presentationTextContent(reopenedBody)).toBe(
        presentationTextContent(target),
      );
      expect(textParagraphs(reopenedBody).map(properties)).toEqual(
        textParagraphs(fixture).map(properties),
      );
    } finally {
      rendered.dispose();
    }
  });
});
