import JSZip from "jszip";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import {
  editPresentationTablePackage,
  type PresentationTableEdit,
} from "./presentationTablePackage";
import { a, p, children, one } from "./presentationPackageXml";
import {
  tableFixture,
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";

const target = { slideId, tableId };
const oneCell = { row: 0, column: 0, rowCount: 1, columnCount: 1 };
const write = (text: string, row = 0, column = 0): PresentationTableEdit => ({
  ...target,
  type: "set-cell-text",
  row,
  column,
  text,
});
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);

async function document(bytes: Uint8Array, path = tableSlidePath) {
  const zip = await JSZip.loadAsync(bytes);
  return new DOMParser().parseFromString(
    await zip.file(path)!.async("string"),
    "application/xml",
  );
}

function table(xml: Document): Element {
  return xml.getElementsByTagNameNS(a, "tbl")[0];
}

function cell(xml: Document, row = 0, column = 0): Element {
  return children(children(table(xml), a, "tr")[row], a, "tc")[column];
}

function text(element: Element): string {
  return Array.from(element.getElementsByTagNameNS(a, "p"), (paragraph) =>
    Array.from(
      paragraph.getElementsByTagNameNS(a, "t"),
      (run) => run.textContent,
    ).join(""),
  ).join("\n");
}

async function modify(
  change: (xml: Document) => void,
  bytes?: Uint8Array,
): Promise<Uint8Array> {
  const source = bytes ?? (await tableFixture());
  const zip = await JSZip.loadAsync(source),
    xml = await document(source);
  change(xml);
  zip.file(tableSlidePath, serialize(xml));
  return zip.generateAsync({ type: "uint8array" });
}

describe("PPTX 原包表格文字与范围编辑", () => {
  it("两个不同cell、连续同cell文字/样式/清空保序，保留全部非目标成员与格网", async () => {
    const input = await tableFixture(),
      before = await document(input);
    const output = await editPresentationTablePackage(input, [
      write("First"),
      write("Second", 0, 1),
      {
        ...target,
        type: "set-cell-style",
        range: oneCell,
        style: {
          bold: true,
          color: "#abCdEF",
          fontSize: 24,
          fillColor: "123456",
        },
      },
      {
        ...target,
        type: "clear-cells",
        range: { ...oneCell, row: 1, column: 2 },
      },
      write("Final"),
    ]);
    const after = await document(output);
    expect(text(cell(after))).toBe("Final");
    expect(text(cell(after, 0, 1))).toBe("Second");
    expect(text(cell(after, 1, 2))).toBe("");
    expect(serialize(cell(after, 1, 0))).toBe(serialize(cell(before, 1, 0)));
    for (const name of ["tblGrid", "tblPr"])
      expect(serialize(one(table(after), a, name)!)).toBe(
        serialize(one(table(before), a, name)!),
      );
    expect(serialize(after.getElementsByTagNameNS(p, "xfrm")[0])).toBe(
      serialize(before.getElementsByTagNameNS(p, "xfrm")[0]),
    );
    const properties = cell(after).getElementsByTagNameNS(a, "rPr")[0];
    expect([
      properties.getAttribute("b"),
      properties.getAttribute("sz"),
      properties.getAttribute("lang"),
    ]).toEqual(["1", "1800", "zh-CN"]);
    expect(
      properties.getElementsByTagNameNS(a, "srgbClr")[0].getAttribute("val"),
    ).toBe("ABCDEF");
    expect(
      properties.getElementsByTagNameNS(a, "latin")[0].getAttribute("typeface"),
    ).toBe("Arial");
    const cellProperties = one(cell(after), a, "tcPr")!;
    expect(cellProperties.getAttribute("marL")).toBe("91440");
    expect(cellProperties.getAttribute("anchor")).toBe("ctr");
    expect(
      Array.from(cellProperties.children, (child) => child.localName),
    ).toEqual(["lnL", "solidFill", "extLst"]);
    expect(serialize(one(cellProperties, a, "lnL")!)).toBe(
      serialize(one(one(cell(before), a, "tcPr")!, a, "lnL")!),
    );
    expect(
      cellProperties
        .getElementsByTagNameNS("urn:keep", "cell")[0]
        .getAttribute("value"),
    ).toBe("retained");
    const beforeZip = await JSZip.loadAsync(input),
      afterZip = await JSZip.loadAsync(output);
    expect(Object.keys(afterZip.files).sort()).toEqual(
      Object.keys(beforeZip.files).sort(),
    );
    for (const [name, entry] of Object.entries(beforeZip.files))
      if (!entry.dir && name !== tableSlidePath)
        expect(await afterZip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
  });

  it.each(["", "\n", "  中文 <tag> & 😀\r\n第二行\n", "一\r二"])(
    "保留合法Unicode、空行和xml:space：%j",
    async (value) => {
      const output = await editPresentationTablePackage(await tableFixture(), [
        write(value),
      ]);
      const target = cell(await document(output));
      expect(text(target)).toBe(value.replace(/\r\n?|\n/g, "\n"));
      for (const node of Array.from(target.getElementsByTagNameNS(a, "t")))
        expect(
          node.getAttributeNS("http://www.w3.org/XML/1998/namespace", "space"),
        ).toBe("preserve");
      expect(
        target.getElementsByTagNameNS(a, "bodyPr")[0].getAttribute("wrap"),
      ).toBe("square");
      expect(
        target.getElementsByTagNameNS(a, "lvl1pPr")[0].getAttribute("marL"),
      ).toBe("42");
      expect(target.getElementsByTagNameNS(p, "txBody")).toHaveLength(0);
    },
  );

  it("范围样式和清空只影响所选格，样式保留不同run内容及其非目标格式", async () => {
    const input = await modify((xml) => {
      const paragraph = cell(xml).getElementsByTagNameNS(a, "p")[0],
        run = paragraph
          .getElementsByTagNameNS(a, "r")[0]
          .cloneNode(true) as Element;
      run.getElementsByTagNameNS(a, "t")[0].textContent = "Mixed";
      run.getElementsByTagNameNS(a, "rPr")[0].setAttribute("i", "1");
      paragraph.insertBefore(run, one(paragraph, a, "endParaRPr")!);
    });
    const styled = await editPresentationTablePackage(input, [
      {
        ...target,
        type: "set-cell-style",
        range: { ...oneCell, columnCount: 2 },
        style: { bold: false, fontSize: 28 },
      },
    ]);
    const xml = await document(styled);
    expect(text(cell(xml))).toBe("TABLE_R1C1Mixed");
    expect(
      cell(xml).getElementsByTagNameNS(a, "rPr")[1].getAttribute("i"),
    ).toBe("1");
    expect(text(cell(xml, 1, 0))).toBe("TABLE_R2C1");
    const cleared = await editPresentationTablePackage(styled, [
      {
        ...target,
        type: "clear-cells",
        range: { ...oneCell, row: 1, columnCount: 2 },
      },
    ]);
    expect(text(cell(await document(cleared), 1, 0))).toBe("");
    expect(text(cell(await document(cleared), 1, 1))).toBe("");
    expect(text(cell(await document(cleared), 1, 2))).toBe("TABLE_R2C3");
    const changed = await editPresentationTablePackage(input, [
      write("中文替换Mixed"),
    ]);
    const changedCell = cell(await document(changed));
    expect(text(changedCell)).toBe("中文替换Mixed");
    const runs = changedCell.getElementsByTagNameNS(a, "r");
    expect(runs[1].getElementsByTagNameNS(a, "t")[0].textContent).toBe("Mixed");
    expect(new XMLSerializer().serializeToString(runs[1])).toBe(
      new XMLSerializer().serializeToString(
        cell(await document(input)).getElementsByTagNameNS(a, "r")[1],
      ),
    );
  });

  it("合并锚点可编辑，完整矩形range只处理一次锚点，保留continuation XML", async () => {
    const input = await tableFixture({ merged: true }),
      before = await document(input);
    const output = await editPresentationTablePackage(input, [
      write("Merged"),
      {
        ...target,
        type: "set-cell-style",
        range: { ...oneCell, rowCount: 2, columnCount: 2 },
        style: { italic: true },
      },
      {
        ...target,
        type: "clear-cells",
        range: { ...oneCell, rowCount: 2, columnCount: 2 },
      },
    ]);
    const after = await document(output);
    expect(text(cell(after))).toBe("");
    expect(cell(after).getAttribute("gridSpan")).toBe("2");
    expect(cell(after).getAttribute("rowSpan")).toBe("2");
    for (const [row, column] of [
      [0, 1],
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ])
      expect(serialize(cell(after, row, column))).toBe(
        serialize(cell(before, row, column)),
      );
  });

  it("缺少txBody/tcPr或正文段落时创建合法命名空间节点和可持久化默认文字样式", async () => {
    const input = await modify((xml) => {
      one(cell(xml), a, "txBody")!.remove();
      one(cell(xml), a, "tcPr")!.remove();
    });
    const output = await editPresentationTablePackage(input, [
      {
        ...target,
        type: "set-cell-style",
        range: oneCell,
        style: { bold: true, fillColor: "FEF3C7" },
      },
    ]);
    const targetCell = cell(await document(output));
    expect(
      Array.from(targetCell.children, (child) => [
        child.namespaceURI,
        child.localName,
      ]),
    ).toEqual([
      [a, "txBody"],
      [a, "tcPr"],
    ]);
    expect(
      targetCell.getElementsByTagNameNS(a, "defRPr")[0].getAttribute("b"),
    ).toBe("1");
    const rewritten = await editPresentationTablePackage(output, [
      write("After empty"),
    ]);
    expect(text(cell(await document(rewritten)))).toBe("After empty");
  });

  it("保存后真实renderer重建仍得到相同表格identity、格网和单元格内容", async () => {
    const bytes = await editPresentationTablePackage(await tableFixture(), [
      write("Renderer reopened", 1, 1),
    ]);
    const model = buildPresentation(
      await parseZip(bytes.slice().buffer as ArrayBuffer),
    );
    materializeSlideNodes(model, model.slides[0]);
    const node = model.slides[0].nodes.find((node) => node.id === tableId);
    expect(node?.nodeType).toBe("table");
    if (node?.nodeType !== "table") throw new Error("missing parsed table");
    expect(node.columns).toEqual([192, 192, 192]);
    expect(
      node.rows[1].cells[1].textBody?.paragraphs[0].runs
        .map((run) => run.text)
        .join(""),
    ).toBe("Renderer reopened");
    expect(node.rotation).toBe(1);
  });

  it("无编辑返回原字节副本；slide关系重排/重命名仍按identity定位", async () => {
    const input = await tableFixture();
    const unchanged = await editPresentationTablePackage(input, []);
    expect(unchanged).toEqual(input);
    expect(unchanged).not.toBe(input);
    const zip = await JSZip.loadAsync(input);
    zip.file(
      "ppt/slides/renamed.xml",
      await zip.file(tableSlidePath)!.async("uint8array"),
    );
    zip.remove(tableSlidePath);
    const path = "ppt/_rels/presentation.xml.rels";
    zip.file(
      path,
      (await zip.file(path)!.async("string")).replace(
        'Target="slides/slide1.xml"',
        'Target="slides/renamed.xml"',
      ),
    );
    const output = await editPresentationTablePackage(
      await zip.generateAsync({ type: "uint8array" }),
      [write("Identity")],
    );
    expect(text(cell(await document(output, "ppt/slides/renamed.xml")))).toBe(
      "Identity",
    );
  });
});

describe("PPTX 表格拒绝歧义与破坏性输入", () => {
  it.each([
    [0, 1],
    [1, 0],
    [1, 1],
  ])("拒绝对merged continuation %j直接替换", async (row, column) => {
    await expect(
      editPresentationTablePackage(await tableFixture({ merged: true }), [
        write("Rejected", row, column),
      ]),
    ).rejects.toThrow("continuation target");
  });

  it.each([
    { ...oneCell },
    { ...oneCell, column: 1 },
    { ...oneCell, columnCount: 2 },
    { ...oneCell, row: 1, columnCount: 3 },
  ])("拒绝仅触及半个merged格的range %#", async (range) => {
    await expect(
      editPresentationTablePackage(await tableFixture({ merged: true }), [
        { ...target, type: "clear-cells", range },
      ]),
    ).rejects.toThrow("partial merged");
  });

  it.each([
    (xml: Document) => cell(xml).setAttribute("gridSpan", "4"),
    (xml: Document) => cell(xml).setAttribute("rowSpan", "0"),
    (xml: Document) => cell(xml).setAttribute("hMerge", "maybe"),
    (xml: Document) => cell(xml).setAttribute("vMerge", "1"),
    (xml: Document) => cell(xml, 0, 1).setAttribute("hMerge", "1"),
    (xml: Document) => cell(xml, 0, 1).remove(),
    (xml: Document) =>
      table(xml).getElementsByTagNameNS(a, "gridCol")[0].setAttribute("w", "0"),
  ])("拒绝非法/孤立/不完整格网 %#", async (change) => {
    await expect(
      editPresentationTablePackage(await modify(change), [write("Rejected")]),
    ).rejects.toThrow();
  });

  it("拒绝缺失merge flags或continuation span与锚点矛盾", async () => {
    for (const change of [
      (xml: Document) => cell(xml, 1, 1).removeAttribute("vMerge"),
      (xml: Document) => cell(xml, 0, 1).setAttribute("gridSpan", "2"),
      (xml: Document) => cell(xml, 1, 0).setAttribute("rowSpan", "2"),
    ])
      await expect(
        editPresentationTablePackage(
          await modify(change, await tableFixture({ merged: true })),
          [write("Rejected")],
        ),
      ).rejects.toThrow();
  });

  it.each([
    '<a:fld type="slidenum"><a:t>1</a:t></a:fld>',
    "<a:unknown/>",
    "<a:r><a:t>One</a:t><a:t>Two</a:t></a:r>",
    "<a:r><a:t><a:unknown/></a:t></a:r>",
    '<foreign:r xmlns:foreign="urn:foreign"/>',
  ])("拒绝字段、数学或未知正文，失败后输入字节不变：%s", async (source) => {
    const input = await modify((xml) => {
      const extra = new DOMParser().parseFromString(
        `<root xmlns:a="${a}">${source}</root>`,
        "application/xml",
      );
      cell(xml)
        .getElementsByTagNameNS(a, "p")[0]
        .append(xml.importNode(extra.documentElement.firstElementChild!, true));
    });
    const baseline = input.slice();
    await expect(
      editPresentationTablePackage(input, [
        write("First", 1, 2),
        write("Rejected"),
      ]),
    ).rejects.toThrow();
    expect(input).toEqual(baseline);
  });

  it.each([
    { ...write("Bad"), row: -1 },
    { ...write("Bad"), row: 0.5 },
    { ...write("Bad"), column: 3 },
    { ...write("Bad"), tableId: "2" },
    { ...write("Bad"), tableId: "7.0" },
    { ...write("Bad"), slideId: "900" },
    { ...write("Bad"), text: "\u0000" },
    { ...write("Bad"), text: "\ud800" },
    { ...write("Bad"), text: "中".repeat(350000) },
    { ...target, type: "clear-cells", range: { ...oneCell, rowCount: 0 } },
    { ...target, type: "clear-cells", range: { ...oneCell, columnCount: 4 } },
    {
      ...target,
      type: "set-cell-style",
      range: oneCell,
      style: { fontSize: Infinity },
    },
    {
      ...target,
      type: "set-cell-style",
      range: oneCell,
      style: { fontSize: 0 },
    },
    {
      ...target,
      type: "set-cell-style",
      range: oneCell,
      style: { color: "red" },
    },
    {
      ...target,
      type: "set-cell-style",
      range: oneCell,
      style: { fillColor: "12345678" },
    },
  ] satisfies PresentationTableEdit[])(
    "拒绝非法地址、range或样式 %#",
    async (edit) => {
      await expect(
        editPresentationTablePackage(await tableFixture(), [edit]),
      ).rejects.toThrow();
    },
  );

  it("拒绝重复identity、错误table URI/namespace、未知edit/style与签名包", async () => {
    for (const change of [
      (xml: Document) =>
        xml.getElementsByTagNameNS(p, "cNvPr")[0].setAttribute("id", tableId),
      (xml: Document) =>
        xml
          .getElementsByTagNameNS(a, "graphicData")[0]
          .setAttribute("uri", "urn:unknown"),
    ])
      await expect(
        editPresentationTablePackage(await modify(change), [write("Rejected")]),
      ).rejects.toThrow();
    for (const invalid of [
      { ...target, type: "resize-table" },
      {
        ...target,
        type: "set-cell-style",
        range: oneCell,
        style: { borderWidth: 2 },
      },
      { ...target, type: "set-cell-style", range: oneCell, style: null },
      { ...target, type: "clear-cells", range: null },
    ])
      await expect(
        editPresentationTablePackage(await tableFixture(), [
          invalid as unknown as PresentationTableEdit,
        ]),
      ).rejects.toThrow();
    const zip = await JSZip.loadAsync(await tableFixture());
    zip.file("_xmlsignatures/sig.xml", "<signature/>");
    await expect(
      editPresentationTablePackage(
        await zip.generateAsync({ type: "uint8array" }),
        [write("Rejected")],
      ),
    ).rejects.toThrow();
  });
});
