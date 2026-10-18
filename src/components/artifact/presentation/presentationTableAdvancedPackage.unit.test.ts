import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, one } from "./presentationPackageXml";
import {
  editPresentationTablePackage as edit,
  type PresentationTableEdit,
} from "./presentationTablePackage";
import {
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";
import { advancedFixture } from "./presentationTableAdvancedPackage.testFixtures";
import {
  readStructure,
  modifyStructure,
  dimensions,
  cellText,
  serialize,
  emusPerPixel,
} from "./presentationTableStructurePackage.testFixtures";

const target = { slideId, tableId };
const range = { row: 1, column: 1, rowCount: 2, columnCount: 2 };
const move = (
  type: "move-row" | "move-column",
  index: number,
  insertionIndex: number,
  count?: number,
): PresentationTableEdit => ({
  ...target,
  type,
  index,
  insertionIndex,
  ...(count === undefined ? {} : { count }),
});
const merge = (
  type: "merge-cells" | "unmerge-cells",
  selected = range,
): PresentationTableEdit => ({ ...target, type, range: selected });
const action = (
  type: string,
  extra: Record<string, unknown>,
): PresentationTableEdit =>
  ({ ...target, type, ...extra }) as PresentationTableEdit;
const values = (cells: Element[][]) => cells.map((row) => row.map(cellText));
const content = (cells: Element[][]) =>
  cells.map((row) =>
    row.map((cell) => Array.from(cell.children).map(serialize)),
  );
const markers = (cell: Element) =>
  ["gridSpan", "rowSpan", "hMerge", "vMerge"].map((name) =>
    cell.getAttribute(name),
  );

describe("PPTX 原包表格高级编辑", () => {
  it.each([
    { type: "move-row" as const, count: 1, order: [1, 2, 3, 0] },
    { type: "move-row" as const, count: 2, order: [2, 3, 0, 1] },
    { type: "move-column" as const, count: 1, order: [1, 2, 3, 4, 0] },
    { type: "move-column" as const, count: 2, order: [2, 3, 4, 0, 1] },
  ])(
    "$type count=$count 使用移除前边界并携带原身份/正文/样式",
    async ({ type, count, order }) => {
      const input = await advancedFixture(),
        before = await readStructure(input);
      const output = await edit(input, [move(type, 0, order.length, count)]),
        after = await readStructure(output);
      if (type === "move-row") {
        expect(after.rows.map(serialize)).toEqual(
          order.map((index) => serialize(before.rows[index])),
        );
        expect(dimensions(after).heights).toEqual(
          order.map((index) => dimensions(before).heights[index]),
        );
        expect(after.columns.map(serialize)).toEqual(
          before.columns.map(serialize),
        );
      } else {
        expect(after.columns.map(serialize)).toEqual(
          order.map((index) => serialize(before.columns[index])),
        );
        expect(after.cells.map((row) => row.map(serialize))).toEqual(
          before.cells.map((row) =>
            order.map((index) => serialize(row[index])),
          ),
        );
        expect(dimensions(after).widths).toEqual(
          order.map((index) => dimensions(before).widths[index]),
        );
      }
      expect(serialize(after.transform)).toBe(serialize(before.transform));
    },
  );

  it.each(["move-row", "move-column"] as const)(
    "%s 前移多轨并保持未知兄弟节点槽位",
    async (type) => {
      const input = await modifyStructure(
        await advancedFixture(),
        ({ rows, columns, cells, xml }) => {
          for (const elements of [rows, columns, ...cells]) {
            const marker = xml.createElementNS("urn:keep", "keep:slot");
            marker.setAttribute("value", "retained");
            elements[1].parentNode!.insertBefore(marker, elements[1]);
          }
          cells[2][2].setAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "r:id",
            "retained-relationship",
          );
        },
      );
      const before = await readStructure(input),
        after = await readStructure(await edit(input, [move(type, 2, 0, 2)]));
      const order = type === "move-row" ? [2, 3, 0, 1] : [2, 3, 0, 1, 4];
      if (type === "move-row")
        expect(
          after.rows.map((row) => row.getAttributeNS("urn:keep", "row")),
        ).toEqual(order.map(String));
      else
        expect(
          after.columns.map((column) =>
            column.getAttributeNS("urn:keep", "column"),
          ),
        ).toEqual(order.map(String));
      const siblingNames = (value: typeof before) =>
        [value.table, one(value.table, a, "tblGrid")!, ...value.rows].map(
          (parent) =>
            Array.from(parent.children).map((child) => child.localName),
        );
      expect(siblingNames(after)).toEqual(siblingNames(before));
      const movedCell =
        type === "move-row" ? after.cells[0][2] : after.cells[2][0];
      expect(
        movedCell.getAttributeNS(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "id",
        ),
      ).toBe("retained-relationship");
      expect(serialize(movedCell)).toBe(serialize(before.cells[2][2]));
    },
  );

  it.each([
    move("move-row", 1, 1, 2),
    move("move-row", 1, 2, 2),
    move("move-row", 1, 3, 2),
    move("move-column", 1, 1, 2),
    move("move-column", 1, 2, 2),
    move("move-column", 1, 3, 2),
  ])("移动no-op返回原包字节 %j", async (operation) => {
    const input = await advancedFixture({ merged: true });
    expect(await edit(input, [operation])).toEqual(input);
  });

  it.each(["move-row", "move-column"] as const)(
    "%s 合并轨道连续原序可整体移动或被外部轨跨过",
    async (type) => {
      const input = await advancedFixture({ merged: true });
      const moved = await readStructure(
        await edit(input, [move(type, 1, 0, 2)]),
      );
      const anchor =
        type === "move-row" ? moved.cells[0][1] : moved.cells[1][0];
      expect(markers(anchor)).toEqual(["2", "2", null, null]);
      expect(cellText(anchor)).toBe("ADV_R1C1");
      const external = await readStructure(
        await edit(input, [move(type, 0, type === "move-row" ? 4 : 5)]),
      );
      const externalAnchor =
        type === "move-row" ? external.cells[0][1] : external.cells[1][0];
      expect(markers(externalAnchor)).toEqual(["2", "2", null, null]);
      expect(cellText(externalAnchor)).toBe("ADV_R1C1");
    },
  );

  it.each([
    move("move-row", 1, 3),
    move("move-row", 3, 2),
    move("move-column", 1, 3),
    move("move-column", 4, 2),
  ])("移动排列打断或反转merged轨道即拒绝 %j", async (operation) => {
    const input = await advancedFixture({ merged: true }),
      copy = input.slice();
    await expect(edit(input, [operation])).rejects.toThrow(
      "split a merged cell",
    );
    expect(input).toEqual(copy);
  });

  it("merge仅lowering标记，保留全部物理cell内容；partial unmerge恢复整个相交矩形", async () => {
    const input = await advancedFixture(),
      before = await readStructure(input);
    const mergedBytes = await edit(input, [merge("merge-cells")]),
      joined = await readStructure(mergedBytes);
    expect(content(joined.cells)).toEqual(content(before.cells));
    expect(values(joined.cells)).toEqual(values(before.cells));
    expect(markers(joined.cells[1][1])).toEqual(["2", "2", null, null]);
    expect(markers(joined.cells[1][2])).toEqual([null, "2", "1", null]);
    expect(markers(joined.cells[2][1])).toEqual(["2", null, null, "1"]);
    expect(markers(joined.cells[2][2])).toEqual([null, null, "1", "1"]);
    await expect(
      edit(mergedBytes, [
        action("set-cell-text", { row: 2, column: 2, text: "FORBIDDEN" }),
      ]),
    ).rejects.toThrow("continuation target");
    const unmerged = await readStructure(
      await edit(mergedBytes, [
        merge("unmerge-cells", {
          row: 2,
          column: 2,
          rowCount: 1,
          columnCount: 1,
        }),
      ]),
    );
    expect(unmerged.cells.map((row) => row.map(serialize))).toEqual(
      before.cells.map((row) => row.map(serialize)),
    );
  });

  it("raw局部merge先解除全部相交旧矩形；允许1x1且不要求GUI canMerge", async () => {
    const input = await advancedFixture({ merged: true }),
      before = await readStructure(input);
    const after = await readStructure(
      await edit(input, [
        merge("merge-cells", {
          row: 0,
          column: 2,
          rowCount: 2,
          columnCount: 2,
        }),
      ]),
    );
    expect(markers(after.cells[0][2])).toEqual(["2", "2", null, null]);
    expect(markers(after.cells[2][1])).toEqual([null, null, null, null]);
    expect(markers(after.cells[2][2])).toEqual([null, null, null, null]);
    expect(content(after.cells)).toEqual(content(before.cells));
    const single = await readStructure(
      await edit(input, [
        merge("merge-cells", {
          row: 2,
          column: 2,
          rowCount: 1,
          columnCount: 1,
        }),
      ]),
    );
    for (const row of single.cells)
      for (const cell of row)
        expect(markers(cell)).toEqual([null, null, null, null]);
    expect(values(single.cells)).toEqual(values(before.cells));
  });

  it("不相交unmerge原字节不变；原生导入merged continuation非空内容同样保留", async () => {
    const input = await advancedFixture({ merged: true }),
      before = await readStructure(input);
    expect(
      await edit(input, [
        merge("unmerge-cells", {
          row: 0,
          column: 0,
          rowCount: 1,
          columnCount: 1,
        }),
      ]),
    ).toEqual(input);
    const output = await edit(input, [merge("unmerge-cells")]),
      after = await readStructure(output);
    expect(content(after.cells)).toEqual(content(before.cells));
    expect(cellText(after.cells[2][2])).toBe("ADV_R2C2");
  });

  it("resize-row默认取原尺寸；resize-column的可选数组替换整轴并同步frame", async () => {
    const input = await advancedFixture(),
      before = await readStructure(input);
    const after = await readStructure(
      await edit(input, [
        action("resize-row", { index: 1, size: 90 }),
        action("resize-column", {
          index: 2,
          size: 16,
          columnWidths: [50, 60, 70, 80, 90],
        }),
      ]),
    );
    expect(dimensions(after)).toEqual({
      widths: [50, 60, 16, 80, 90],
      heights: [40, 90, 80, 100],
      width: 296,
      height: 310,
    });
    expect(after.cells.map((row) => row.map(serialize))).toEqual(
      before.cells.map((row) => row.map(serialize)),
    );
    expect(after.transform.getAttribute("rot")).toBe("60000");
    expect(after.transform.getAttributeNS("urn:keep", "transform")).toBe(
      "retained",
    );
    expect(serialize(one(after.transform, a, "off")!)).toBe(
      serialize(one(before.transform, a, "off")!),
    );
  });

  it("可选轨道数组仅要求正finite，16px下限只约束当前size，数组本身不被修改", async () => {
    const rowHeights = [1 / emusPerPixel, 20, 30, 40],
      copy = rowHeights.slice();
    const after = await readStructure(
      await edit(await advancedFixture(), [
        action("resize-row", { index: 1, size: 16, rowHeights }),
      ]),
    );
    expect(after.rows.map((row) => row.getAttribute("h"))).toEqual([
      "1",
      String(16 * emusPerPixel),
      String(30 * emusPerPixel),
      String(40 * emusPerPixel),
    ]);
    expect(rowHeights).toEqual(copy);
  });

  it("均分只处理range在目标轴的区间、保总和，raw partial merged range可接受", async () => {
    const input = await advancedFixture({ merged: true }),
      before = await readStructure(input);
    const after = await readStructure(
      await edit(input, [
        action("distribute-rows", { range }),
        action("distribute-columns", {
          range: { row: 2, column: 2, rowCount: 1, columnCount: 2 },
        }),
      ]),
    );
    expect(dimensions(after)).toEqual({
      widths: [40, 80, 140, 140, 200],
      heights: [40, 70, 70, 100],
      width: 600,
      height: 280,
    });
    expect(after.cells.map((row) => row.map(serialize))).toEqual(
      before.cells.map((row) => row.map(serialize)),
    );
  });

  it("EMU无法等分时差值至多1且总和精确保留，不累计frame误差", async () => {
    const input = await modifyStructure(
      await advancedFixture(),
      ({ columns, rows, transform }) => {
        columns.forEach((column, index) =>
          column.setAttribute("w", String([1, 2, 4, 5, 7][index])),
        );
        rows.forEach((row, index) =>
          row.setAttribute("h", String([1, 2, 4, 8][index])),
        );
        one(transform, a, "ext")!.setAttribute("cx", "19");
        one(transform, a, "ext")!.setAttribute("cy", "15");
      },
    );
    const after = await readStructure(
      await edit(input, [
        action("distribute-rows", {
          range: { row: 0, column: 0, rowCount: 4, columnCount: 1 },
        }),
        action("distribute-columns", {
          range: { row: 0, column: 1, rowCount: 1, columnCount: 3 },
        }),
      ]),
    );
    expect(after.rows.map((row) => Number(row.getAttribute("h")))).toEqual([
      4, 4, 4, 3,
    ]);
    expect(
      after.columns.map((column) => Number(column.getAttribute("w"))),
    ).toEqual([1, 4, 4, 3, 7]);
    expect([
      one(after.transform, a, "ext")!.getAttribute("cx"),
      one(after.transform, a, "ext")!.getAttribute("cy"),
    ]).toEqual(["19", "15"]);
  });

  it("动作混合有序应用，新格网仍能供cell编辑、结构与真实renderer消费", async () => {
    const output = await edit(await advancedFixture(), [
      merge("merge-cells"),
      move("move-column", 1, 0, 2),
      merge("unmerge-cells", {
        row: 1,
        column: 0,
        rowCount: 1,
        columnCount: 1,
      }),
      action("set-cell-text", { row: 2, column: 1, text: "RESTORED_CELL" }),
      action("insert-rows", { index: 4 }),
      action("delete-rows", { index: 4 }),
      action("resize-row", { index: 0, size: 50 }),
      action("distribute-columns", {
        range: { row: 0, column: 0, rowCount: 4, columnCount: 5 },
      }),
      merge("merge-cells", { row: 0, column: 0, rowCount: 2, columnCount: 3 }),
    ]);
    const rebuilt = buildPresentation(
      await parseZip(output.slice().buffer as ArrayBuffer),
    );
    materializeSlideNodes(rebuilt, rebuilt.slides[0]);
    const table = rebuilt.slides[0].nodes.find((node) => node.id === tableId);
    if (table?.nodeType !== "table") throw new Error("missing rebuilt table");
    expect(table.columns).toEqual([120, 120, 120, 120, 120]);
    expect(table.rows.map((row) => row.height)).toEqual([50, 60, 80, 100]);
    expect([
      table.rows[0].cells[0].gridSpan,
      table.rows[0].cells[0].rowSpan,
    ]).toEqual([3, 2]);
    expect(table.rows[2].cells[1].textBody?.paragraphs[0].runs[0].text).toBe(
      "RESTORED_CELL",
    );
    expect([
      table.size.w,
      table.size.h,
      table.rotation,
      table.flipH,
      table.flipV,
    ]).toEqual([600, 290, 1, true, true]);
  });

  it.each([
    move("move-row", 0, 4),
    move("move-column", 0, 5),
    merge("merge-cells"),
    merge("unmerge-cells"),
    action("resize-row", { index: 0, size: 80 }),
    action("resize-column", { index: 0, size: 80 }),
    action("distribute-rows", { range }),
    action("distribute-columns", { range }),
  ])(
    "八动作保留非目标ZIP成员、opaque cell正文和外部关系 %j",
    async (operation) => {
      const input = await modifyStructure(
        await advancedFixture({ merged: operation.type === "unmerge-cells" }),
        ({ cells, xml }) => {
          const field = xml.createElementNS(a, "a:fld");
          field.setAttribute("id", "{retained-field}");
          field.textContent = "OPAQUE_FIELD";
          one(one(cells[0][0], a, "txBody")!, a, "p")!.append(field);
          cells[0][0].setAttributeNS(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "r:id",
            "existing-link",
          );
        },
      );
      const before = await readStructure(input),
        after = await readStructure(await edit(input, [operation]));
      for (const [name, entry] of Object.entries(before.zip.files))
        if (!entry.dir && name !== tableSlidePath)
          expect(await after.zip.file(name)!.async("uint8array"), name).toEqual(
            await entry.async("uint8array"),
          );
      expect(Object.keys(after.zip.files).sort()).toEqual(
        Object.keys(before.zip.files).sort(),
      );
      const retained = after.cells
        .flat()
        .find(
          (cell) =>
            cell.getAttributeNS(
              "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
              "id",
            ) === "existing-link",
        )!;
      expect(content([[retained]])).toEqual(content([[before.cells[0][0]]]));
    },
  );

  it.each([
    move("move-row", -1, 0),
    move("move-column", 4, 0, 2),
    move("move-row", 0, 5),
    move("move-column", 0, 6),
    move("move-row", 0.5, 1),
    move("move-row", 0, 1.5),
    move("move-row", 0, 1, 0),
    move("move-row", 0, 1, 1.5),
    action("move-row", { index: 0, insertionIndex: 1, count: null }),
    action("resize-row", { index: 0, size: 15.99 }),
    action("resize-column", { index: 0, size: Infinity }),
    action("resize-row", { index: 4, size: 16 }),
    action("resize-column", { index: -1, size: 16 }),
    action("resize-row", { index: 0, size: 16, rowHeights: [1, 2] }),
    action("resize-column", {
      index: 0,
      size: 16,
      columnWidths: [40, 0, 50, 60, 70],
    }),
    action("resize-row", {
      index: 0,
      size: 16,
      rowHeights: [40, NaN, 80, 100],
    }),
    action("resize-row", {
      index: 0,
      size: 16,
      rowHeights: [40, 1e-9, 80, 100],
    }),
    action("resize-row", { index: 0, size: 16, rowHeights: Array(4) }),
    action("resize-column", { index: 0, size: 16, columnWidths: null }),
    action("resize-row", { index: 0, size: 1e20 }),
    merge("merge-cells", { row: 3, column: 0, rowCount: 2, columnCount: 1 }),
    merge("unmerge-cells", { row: 0, column: 0, rowCount: 0, columnCount: 1 }),
    action("distribute-rows", {
      range: { row: -1, column: 0, rowCount: 1, columnCount: 1 },
    }),
    action("distribute-columns", {
      range: { row: 0, column: 0, rowCount: 1, columnCount: 1.5 },
    }),
  ])("无效输入明确拒绝且不修改调用者原包 %j", async (operation) => {
    const input = await advancedFixture(),
      copy = input.slice();
    await expect(edit(input, [operation])).rejects.toThrow(
      "Invalid presentation",
    );
    expect(input).toEqual(copy);
  });
});
