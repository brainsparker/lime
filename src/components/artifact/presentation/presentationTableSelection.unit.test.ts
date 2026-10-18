import JSZip from "jszip";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
  type TableNodeData,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, children } from "./presentationPackageXml";
import {
  presentationTableCellAt,
  presentationTableCells,
  presentationTableRange,
  presentationTableSnapshot,
} from "./presentationTableSelection";
import {
  tableFixture,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";

async function parseTable(bytes: Uint8Array): Promise<TableNodeData> {
  const model = buildPresentation(
    await parseZip(bytes.slice().buffer as ArrayBuffer),
  );
  materializeSlideNodes(model, model.slides[0]);
  const table = model.slides[0].nodes.find((node) => node.id === tableId);
  if (table?.nodeType !== "table") throw new Error("missing fixture table");
  return table;
}

async function modify(
  change: (rows: Element[][]) => void,
  merged = false,
): Promise<TableNodeData> {
  const zip = await JSZip.loadAsync(await tableFixture({ merged }));
  const xml = new DOMParser().parseFromString(
    await zip.file(tableSlidePath)!.async("string"),
    "application/xml",
  );
  const rows = children(xml.getElementsByTagNameNS(a, "tbl")[0], a, "tr");
  change(rows.map((row) => children(row, a, "tc")));
  zip.file(tableSlidePath, new XMLSerializer().serializeToString(xml));
  return parseTable(await zip.generateAsync({ type: "uint8array" }));
}

describe("演示文稿表格选择投影", () => {
  it("合并菜单能力来自闭包内resolved锚点，不把物理格数当可合并数量", async () => {
    const table = await parseTable(await tableFixture({ merged: true }));
    const selection = {
      tableId,
      anchor: { row: 1, column: 1 },
      focus: { row: 1, column: 1 },
    };
    expect(presentationTableSnapshot(table, selection)).toMatchObject({
      canMerge: false,
      canUnmerge: true,
      selection: {
        range: { row: 0, column: 0, rowCount: 2, columnCount: 2 },
      },
    });
    expect(
      presentationTableSnapshot(table, {
        ...selection,
        focus: { row: 1, column: 2 },
      }),
    ).toMatchObject({ canMerge: true, canUnmerge: true });
    expect(presentationTableSnapshot(table, null)).toMatchObject({
      canMerge: false,
      canUnmerge: false,
    });
  });
  it("真实包投影得到有序锚点和表格局部格网，不把旋转应用两次", async () => {
    const table = await parseTable(await tableFixture());
    const cells = presentationTableCells(table)!;
    expect(table.rotation).toBe(1);
    expect(cells.map(({ row, column }) => [row, column])).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(cells[0].frame).toEqual({ x: 0, y: 0, width: 192, height: 96 });
    expect(cells[5].frame).toEqual({ x: 384, y: 96, width: 192, height: 96 });
    expect(
      presentationTableRange(
        cells,
        { row: 1, column: 2 },
        { row: 0, column: 1 },
      ),
    ).toEqual({
      row: 0,
      column: 1,
      rowCount: 2,
      columnCount: 2,
    });
  });

  it("合并continuation定位到唯一锚点，格网尺寸覆盖完整合并矩形", async () => {
    const cells = presentationTableCells(
      await parseTable(await tableFixture({ merged: true })),
    )!;
    expect(cells.map(({ row, column }) => [row, column])).toEqual([
      [0, 0],
      [0, 2],
      [1, 2],
    ]);
    const anchor = cells[0];
    expect(anchor).toMatchObject({
      rowSpan: 2,
      columnSpan: 2,
      frame: { x: 0, y: 0, width: 384, height: 192 },
    });
    expect(presentationTableCellAt(cells, { row: 1, column: 1 })).toBe(anchor);
    expect(presentationTableCellAt(cells, { row: 0, column: 1 })).toBe(anchor);
    expect(
      presentationTableRange(
        cells,
        { row: 1, column: 1 },
        { row: 0, column: 0 },
      ),
    ).toEqual({ row: 0, column: 0, rowCount: 2, columnCount: 2 });
    expect(
      presentationTableRange(
        cells,
        { row: 0, column: 2 },
        { row: 1, column: 1 },
      ),
    ).toEqual({ row: 0, column: 0, rowCount: 2, columnCount: 3 });
    expect(
      presentationTableRange(
        cells,
        { row: 0, column: 2 },
        { row: 1, column: 2 },
      ),
    ).toEqual({ row: 0, column: 2, rowCount: 2, columnCount: 1 });
  });

  it.each([
    { row: -1, column: 0 },
    { row: 2, column: 0 },
    { row: 0, column: 3 },
    { row: 0.5, column: 1 },
    { row: 0, column: NaN },
  ])("拒绝格网外或非整数坐标 %j", async (position) => {
    const cells = presentationTableCells(
      await parseTable(await tableFixture()),
    )!;
    expect(presentationTableCellAt(cells, position)).toBeUndefined();
    expect(
      presentationTableRange(cells, { row: 0, column: 0 }, position),
    ).toBeNull();
  });

  it("公共snapshot区分对象选择与cell选择，不暴露内部cells", async () => {
    const table = await parseTable(await tableFixture({ merged: true }));
    expect(presentationTableSnapshot(table, null)).toMatchObject({
      tableId,
      rowCount: 2,
      columnCount: 3,
      frame: { left: 96, top: 192, width: 576, height: 192 },
      rowHeights: [96, 96],
      columnWidths: [192, 192, 192],
      selection: null,
      activeCell: null,
    });
    const snapshot = presentationTableSnapshot(table, {
      tableId,
      anchor: { row: 0, column: 2 },
      focus: { row: 1, column: 1 },
    });
    expect(snapshot).not.toHaveProperty("cells");
    expect(snapshot).toMatchObject({
      activeCell: { row: 0, column: 0 },
      selection: {
        anchor: { row: 0, column: 2 },
        focus: { row: 1, column: 1 },
        range: { row: 0, column: 0, rowCount: 2, columnCount: 3 },
      },
      style: { bold: false, italic: false, fontSize: 20 },
      mixed: { bold: false, italic: false, fontSize: false, color: false },
    });
  });

  it("范围样式mixed来自真实单元格run，未选中的差异不污染snapshot", async () => {
    const table = await modify((rows) => {
      const properties = rows[0][1].getElementsByTagNameNS(a, "rPr")[0];
      properties.setAttribute("b", "1");
      properties.setAttribute("sz", "2100");
      const fill = properties.getElementsByTagNameNS(a, "solidFill")[0];
      fill.textContent = "";
      const color = fill.ownerDocument.createElementNS(a, "a:srgbClr");
      color.setAttribute("val", "ABCDEF");
      fill.append(color);
    });
    const select = (column: number) =>
      presentationTableSnapshot(table, {
        tableId,
        anchor: { row: 0, column: 0 },
        focus: { row: 0, column },
      });
    expect(select(0)?.mixed).toMatchObject({
      bold: false,
      italic: false,
      fontSize: false,
      color: false,
    });
    expect(select(1)?.mixed).toMatchObject({
      bold: true,
      italic: false,
      fontSize: true,
      color: true,
    });
  });

  it.each([
    {
      name: "缺失cell",
      merged: false,
      change: (rows: Element[][]) => rows[1][2].remove(),
    },
    {
      name: "孤立continuation",
      merged: false,
      change: (rows: Element[][]) => rows[0][1].setAttribute("hMerge", "1"),
    },
    {
      name: "锚点覆盖未合并cell",
      merged: false,
      change: (rows: Element[][]) => rows[0][0].setAttribute("gridSpan", "2"),
    },
    {
      name: "越界合并",
      merged: false,
      change: (rows: Element[][]) => rows[1][2].setAttribute("rowSpan", "2"),
    },
    {
      name: "continuation跨度不一致",
      merged: true,
      change: (rows: Element[][]) => rows[0][1].setAttribute("rowSpan", "1"),
    },
    {
      name: "纵向continuation跨度不一致",
      merged: true,
      change: (rows: Element[][]) => rows[1][0].setAttribute("gridSpan", "1"),
    },
  ])("拒绝真实OOXML损坏拓扑：$name", async ({ change, merged }) => {
    const table = await modify(change, merged);
    expect(presentationTableCells(table)).toBeNull();
    expect(presentationTableSnapshot(table, null)).toBeNull();
  });

  it("拒绝非有限或非正的轨道尺寸", async () => {
    const table = await parseTable(await tableFixture());
    table.columns[0] = Infinity;
    expect(presentationTableCells(table)).toBeNull();
    table.columns[0] = 192;
    table.rows[1].height = 0;
    expect(presentationTableCells(table)).toBeNull();
  });
});
