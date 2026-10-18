import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { a, one } from "./presentationPackageXml";
import {
  editPresentationTablePackage,
  type PresentationTableEdit,
} from "./presentationTablePackage";
import {
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";
import {
  structureFixture,
  readStructure,
  modifyStructure,
  dimensions,
  cellText,
  serialize,
  emusPerPixel,
} from "./presentationTableStructurePackage.testFixtures";

const target = { slideId, tableId };
const action = (
  type: "insert-rows" | "delete-rows" | "insert-columns" | "delete-columns",
  index: number,
  count?: number,
): PresentationTableEdit => ({
  ...target,
  type,
  index,
  ...(count === undefined ? {} : { count }),
});
const resize = (
  overrides: Record<string, unknown> = {},
): PresentationTableEdit =>
  ({
    ...target,
    type: "resize-table",
    frame: { left: -20, top: 30, width: 600, height: 300 },
    rowHeights: [100, 200],
    columnWidths: [100, 200, 300],
    ...overrides,
  }) as PresentationTableEdit;
const edit = (bytes: Uint8Array, edits: readonly PresentationTableEdit[]) =>
  editPresentationTablePackage(bytes, edits);
const values = (cells: Element[][]) => cells.map((row) => row.map(cellText));
const attributes = (cell: Element) =>
  Object.fromEntries(
    ["gridSpan", "rowSpan", "hMerge", "vMerge"].map((key) => [
      key,
      cell.getAttribute(key),
    ]),
  );

describe("PPTX 原包表格行列结构与tracks同步resize", () => {
  it("插入多行复制index轨格式并清文字，保留源格和非目标ZIP成员", async () => {
    const input = await structureFixture(),
      before = await readStructure(input);
    const output = await edit(input, [action("insert-rows", 1, 2)]),
      after = await readStructure(output);
    expect(dimensions(after)).toEqual({
      widths: [80, 160, 240],
      heights: [72, 120, 120, 120],
      width: 480,
      height: 432,
    });
    expect(values(after.cells)).toEqual([
      ["TABLE_R1C1", "TABLE_R1C2", "TABLE_R1C3"],
      ["", "", ""],
      ["", "", ""],
      ["TABLE_R2C1", "TABLE_R2C2", "TABLE_R2C3"],
    ]);
    expect(after.rows[1].getAttributeNS("urn:keep", "row")).toBe("1");
    expect(serialize(one(after.cells[1][1], a, "tcPr")!)).toBe(
      serialize(one(before.cells[1][1], a, "tcPr")!),
    );
    expect(serialize(after.rows[0])).toBe(serialize(before.rows[0]));
    expect(serialize(after.rows[3])).toBe(serialize(before.rows[1]));
    expect(Object.keys(after.zip.files).sort()).toEqual(
      Object.keys(before.zip.files).sort(),
    );
    for (const [name, entry] of Object.entries(before.zip.files))
      if (!entry.dir && name !== tableSlidePath)
        expect(await after.zip.file(name)!.async("uint8array"), name).toEqual(
          await entry.async("uint8array"),
        );
  });

  it("插入多列复制index列宽/每行cell格式，未目标正文和unknown纯payload不变", async () => {
    const input = await structureFixture(),
      before = await readStructure(input);
    const after = await readStructure(
      await edit(input, [action("insert-columns", 1, 2)]),
    );
    expect(dimensions(after)).toEqual({
      widths: [80, 160, 160, 160, 240],
      heights: [72, 120],
      width: 800,
      height: 192,
    });
    expect(values(after.cells)).toEqual([
      ["TABLE_R1C1", "", "", "TABLE_R1C2", "TABLE_R1C3"],
      ["TABLE_R2C1", "", "", "TABLE_R2C2", "TABLE_R2C3"],
    ]);
    expect(after.columns[1].getAttributeNS("urn:keep", "column")).toBe("1");
    expect(serialize(one(after.cells[1][2], a, "tcPr")!)).toBe(
      serialize(one(before.cells[1][1], a, "tcPr")!),
    );
    expect(serialize(after.cells[0][4])).toBe(serialize(before.cells[0][2]));
  });

  it("append使用末轨模板，count省略为1；删除按旧index连续切除并更新frame总和", async () => {
    const input = await structureFixture();
    const appended = await readStructure(
      await edit(input, [
        action("insert-rows", 2),
        action("insert-columns", 3),
      ]),
    );
    expect(dimensions(appended)).toEqual({
      widths: [80, 160, 240, 240],
      heights: [72, 120, 120],
      width: 720,
      height: 312,
    });
    expect(appended.rows[2].getAttributeNS("urn:keep", "row")).toBe("1");
    expect(appended.columns[3].getAttributeNS("urn:keep", "column")).toBe("2");
    expect(values(appended.cells).at(-1)).toEqual(["", "", "", ""]);
    const deleted = await readStructure(
      await edit(input, [
        action("delete-columns", 0, 2),
        action("delete-rows", 0),
      ]),
    );
    expect(dimensions(deleted)).toEqual({
      widths: [240],
      heights: [120],
      width: 240,
      height: 120,
    });
    expect(values(deleted.cells)).toEqual([["TABLE_R2C3"]]);
    expect(deleted.transform.getAttribute("rot")).toBe("60000");
    expect(deleted.transform.getAttribute("flipH")).toBe("1");
    expect(deleted.transform.getAttribute("flipV")).toBe("1");
  });

  it.each([
    {
      axis: "rows" as const,
      index: 0,
      anchorRow: 1,
      anchorColumn: 0,
      rowSpan: "2",
      columnSpan: "2",
    },
    {
      axis: "rows" as const,
      index: 1,
      anchorRow: 0,
      anchorColumn: 0,
      rowSpan: "3",
      columnSpan: "2",
    },
    {
      axis: "rows" as const,
      index: 2,
      anchorRow: 0,
      anchorColumn: 0,
      rowSpan: "2",
      columnSpan: "2",
    },
    {
      axis: "columns" as const,
      index: 0,
      anchorRow: 0,
      anchorColumn: 1,
      rowSpan: "2",
      columnSpan: "2",
    },
    {
      axis: "columns" as const,
      index: 1,
      anchorRow: 0,
      anchorColumn: 0,
      rowSpan: "2",
      columnSpan: "3",
    },
    {
      axis: "columns" as const,
      index: 2,
      anchorRow: 0,
      anchorColumn: 0,
      rowSpan: "2",
      columnSpan: "2",
    },
  ])(
    "merged区间在$axis index=$index插入时按边界移动或扩展",
    async ({ axis, index, anchorRow, anchorColumn, rowSpan, columnSpan }) => {
      const output = await edit(await structureFixture({ merged: true }), [
        action(axis === "rows" ? "insert-rows" : "insert-columns", index),
      ]);
      const after = await readStructure(output),
        anchor = after.cells[anchorRow][anchorColumn];
      expect(cellText(anchor)).toBe("TABLE_R1C1");
      expect(attributes(anchor)).toEqual({
        gridSpan: columnSpan,
        rowSpan,
        hMerge: null,
        vMerge: null,
      });
      const bottom =
        after.cells[anchorRow + Number(rowSpan) - 1][
          anchorColumn + Number(columnSpan) - 1
        ];
      expect(attributes(bottom)).toEqual({
        gridSpan: null,
        rowSpan: null,
        hMerge: "1",
        vMerge: "1",
      });
      // 新格网仍能经过同一codec完整校验和cell文字写入。
      const rewritten = await edit(output, [
        {
          ...target,
          type: "set-cell-text",
          row: anchorRow,
          column: anchorColumn,
          text: "VALID_MERGED",
        },
      ]);
      expect(
        cellText(
          (await readStructure(rewritten)).cells[anchorRow][anchorColumn],
        ),
      ).toBe("VALID_MERGED");
    },
  );

  it("删除merged原anchor不搬移文字，幸存continuation成为新anchor并缩小span", async () => {
    const input = await structureFixture({ merged: true });
    const rows = await readStructure(
      await edit(input, [action("delete-rows", 0)]),
    );
    expect(values(rows.cells)).toEqual([["", "", "TABLE_R2C3"]]);
    expect(attributes(rows.cells[0][0])).toEqual({
      gridSpan: "2",
      rowSpan: null,
      hMerge: null,
      vMerge: null,
    });
    expect(attributes(rows.cells[0][1])).toEqual({
      gridSpan: null,
      rowSpan: null,
      hMerge: "1",
      vMerge: null,
    });
    const columns = await readStructure(
      await edit(input, [action("delete-columns", 0)]),
    );
    expect(values(columns.cells)).toEqual([
      ["", "TABLE_R1C3"],
      ["", "TABLE_R2C3"],
    ]);
    expect(attributes(columns.cells[0][0])).toEqual({
      gridSpan: null,
      rowSpan: "2",
      hMerge: null,
      vMerge: null,
    });
    expect(attributes(columns.cells[1][0])).toEqual({
      gridSpan: null,
      rowSpan: null,
      hMerge: null,
      vMerge: "1",
    });
    const removed = await readStructure(
      await edit(input, [action("delete-columns", 0, 2)]),
    );
    expect(values(removed.cells)).toEqual([["TABLE_R1C3"], ["TABLE_R2C3"]]);
    expect(attributes(removed.cells[0][0])).toEqual({
      gridSpan: null,
      rowSpan: null,
      hMerge: null,
      vMerge: null,
    });
  });

  it("resize原子修改位置、外框和非均匀tracks，保留旋转/flip与未知属性", async () => {
    const input = await structureFixture(),
      before = await readStructure(input);
    const after = await readStructure(await edit(input, [resize()]));
    expect(dimensions(after)).toEqual({
      widths: [100, 200, 300],
      heights: [100, 200],
      width: 600,
      height: 300,
    });
    const offset = one(after.transform, a, "off")!;
    expect([offset.getAttribute("x"), offset.getAttribute("y")]).toEqual([
      String(-20 * emusPerPixel),
      String(30 * emusPerPixel),
    ]);
    expect([
      after.transform.getAttribute("rot"),
      after.transform.getAttribute("flipH"),
      after.transform.getAttribute("flipV"),
      after.transform.getAttributeNS("urn:keep", "transform"),
    ]).toEqual(["60000", "1", "1", "retained"]);
    expect(
      after.columns.map((column) =>
        column.getAttributeNS("urn:keep", "column"),
      ),
    ).toEqual(["0", "1", "2"]);
    expect(after.cells.map((row) => row.map(serialize))).toEqual(
      before.cells.map((row) => row.map(serialize)),
    );
  });

  it("resize-table可用小于16px的正EMU轨道；仅容忍独立EMU舍入误差", async () => {
    const input = await structureFixture(),
      px = 1 / emusPerPixel;
    const tiny = await readStructure(
      await edit(input, [
        resize({
          frame: { left: 0, top: 0, width: 6 * px, height: 3 * px },
          rowHeights: [px, 2 * px],
          columnWidths: [px, 2 * px, 3 * px],
        }),
      ]),
    );
    expect(tiny.columns.map((column) => column.getAttribute("w"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(tiny.rows.map((row) => row.getAttribute("h"))).toEqual(["1", "2"]);
    const rounded = await readStructure(
      await edit(input, [
        resize({
          frame: {
            left: 0,
            top: 0,
            width: 480 + 0.75 * px,
            height: 192 + 0.5 * px,
          },
          rowHeights: [72 + 0.25 * px, 120 + 0.25 * px],
          columnWidths: [80 + 0.25 * px, 160 + 0.25 * px, 240 + 0.25 * px],
        }),
      ]),
    );
    expect(dimensions(rounded)).toEqual({
      widths: [80, 160, 240],
      heights: [72, 120],
      width: 480,
      height: 192,
    });
  });

  it("cell/结构/resize混合输入保持原序，地址跟随每一步新格网", async () => {
    const after = await readStructure(
      await edit(await structureFixture(), [
        {
          ...target,
          type: "set-cell-text",
          row: 0,
          column: 1,
          text: "BEFORE_INSERT",
        },
        action("insert-columns", 0),
        {
          ...target,
          type: "set-cell-text",
          row: 0,
          column: 0,
          text: "NEW_COLUMN",
        },
        action("delete-rows", 1),
        resize({
          frame: { left: 111, top: 222, width: 600, height: 200 },
          rowHeights: [200],
          columnWidths: [50, 100, 200, 250],
        }),
        {
          ...target,
          type: "set-cell-style",
          range: { row: 0, column: 2, rowCount: 1, columnCount: 1 },
          style: { bold: true },
        },
        {
          ...target,
          type: "set-cell-text",
          row: 0,
          column: 2,
          text: "AFTER_RESIZE",
        },
      ]),
    );
    expect(values(after.cells)).toEqual([
      ["NEW_COLUMN", "TABLE_R1C1", "AFTER_RESIZE", "TABLE_R1C3"],
    ]);
    expect(
      after.cells[0][2].getElementsByTagNameNS(a, "rPr")[0].getAttribute("b"),
    ).toBe("1");
    expect(dimensions(after)).toEqual({
      widths: [50, 100, 200, 250],
      heights: [200],
      width: 600,
      height: 200,
    });
  });

  it("结构修改后真实renderer重建identity、合并跨度、frame和tracks一致", async () => {
    const bytes = await edit(await structureFixture({ merged: true }), [
      action("insert-rows", 1),
      resize({ rowHeights: [60, 100, 140] }),
    ]);
    const model = buildPresentation(
      await parseZip(bytes.slice().buffer as ArrayBuffer),
    );
    materializeSlideNodes(model, model.slides[0]);
    const table = model.slides[0].nodes.find((node) => node.id === tableId);
    if (table?.nodeType !== "table") throw new Error("missing rebuilt table");
    expect(table.columns).toEqual([100, 200, 300]);
    expect(table.rows.map((row) => row.height)).toEqual([60, 100, 140]);
    expect([
      table.position.x,
      table.position.y,
      table.size.w,
      table.size.h,
      table.rotation,
      table.flipH,
      table.flipV,
    ]).toEqual([-20, 30, 600, 300, 1, true, true]);
    expect([
      table.rows[0].cells[0].gridSpan,
      table.rows[0].cells[0].rowSpan,
    ]).toEqual([2, 3]);
    expect(table.rows[0].cells[0].textBody?.paragraphs[0].runs[0].text).toBe(
      "TABLE_R1C1",
    );
  });

  it("每轴最多100、最少1；边界插入和大范围删除仍保留原包合法格网", async () => {
    const input = await structureFixture();
    const rows = await edit(input, [action("insert-rows", 2, 98)]);
    expect((await readStructure(rows)).rows).toHaveLength(100);
    await expect(edit(rows, [action("insert-rows", 100)])).rejects.toThrow(
      "table structure range",
    );
    await expect(edit(rows, [action("delete-rows", 0, 100)])).rejects.toThrow(
      "table structure range",
    );
    expect(
      (await readStructure(await edit(rows, [action("delete-rows", 0, 99)])))
        .rows,
    ).toHaveLength(1);
    const columns = await edit(input, [action("insert-columns", 3, 97)]);
    expect((await readStructure(columns)).columns).toHaveLength(100);
    await expect(
      edit(columns, [action("insert-columns", 100)]),
    ).rejects.toThrow("table structure range");
    await expect(
      edit(columns, [action("delete-columns", 0, 100)]),
    ).rejects.toThrow("table structure range");
    expect(
      (
        await readStructure(
          await edit(columns, [action("delete-columns", 0, 99)]),
        )
      ).columns,
    ).toHaveLength(1);
  });

  it.each([
    action("insert-rows", -1),
    action("insert-columns", 4),
    action("insert-rows", 0, 0),
    action("insert-rows", 0, 99),
    action("delete-rows", 0, 2),
    action("delete-columns", 2, 2),
    action("delete-columns", 0, 1.5),
    action("insert-columns", NaN),
    {
      ...action("insert-rows", 0),
      count: null,
    } as unknown as PresentationTableEdit,
  ])("拒绝无效结构范围 %j，原输入字节不变", async (operation) => {
    const input = await structureFixture(),
      copy = input.slice();
    await expect(edit(input, [operation])).rejects.toThrow(
      "table structure range",
    );
    expect(input).toEqual(copy);
  });

  it.each([
    resize({ rowHeights: [300] }),
    resize({ columnWidths: [100, 200, 0] }),
    resize({ rowHeights: [NaN, 300] }),
    resize({ columnWidths: [100, Infinity, 300] }),
    resize({ rowHeights: [-100, 400] }),
    resize({ rowHeights: [1e-9, 300] }),
    resize({ frame: { left: NaN, top: 0, width: 600, height: 300 } }),
    resize({ frame: { left: 0, top: 0, width: 601, height: 300 } }),
    resize({ frame: { left: 0, top: 0, width: 600, height: 301 } }),
    resize({ frame: { left: 1e20, top: 0, width: 600, height: 300 } }),
    resize({ frame: { x: 0, y: 0, width: 600, height: 300 } }),
  ])("拒绝无效resize，不返回部分改包：%j", async (operation) => {
    const input = await structureFixture(),
      copy = input.slice();
    await expect(edit(input, [operation])).rejects.toThrow(
      "Invalid presentation",
    );
    expect(input).toEqual(copy);
  });

  it.each([
    {
      name: "compact cell矩阵",
      change: ({ cells }: Awaited<ReturnType<typeof readStructure>>) =>
        cells[0][1].remove(),
    },
    {
      name: "非法行高",
      change: ({ rows }: Awaited<ReturnType<typeof readStructure>>) =>
        rows[0].setAttribute("h", "0"),
    },
    {
      name: "非法列宽",
      change: ({ columns }: Awaited<ReturnType<typeof readStructure>>) =>
        columns[0].setAttribute("w", "-1"),
    },
    {
      name: "孤立continuation",
      change: ({ cells }: Awaited<ReturnType<typeof readStructure>>) =>
        cells[0][1].setAttribute("hMerge", "1"),
    },
    {
      name: "越界span",
      change: ({ cells }: Awaited<ReturnType<typeof readStructure>>) =>
        cells[0][0].setAttribute("rowSpan", "3"),
    },
    {
      name: "不匹配旧frame",
      change: ({ transform }: Awaited<ReturnType<typeof readStructure>>) =>
        one(transform, a, "ext")!.setAttribute("cx", "100"),
    },
    {
      name: "缺失frame",
      change: ({ transform }: Awaited<ReturnType<typeof readStructure>>) =>
        transform.remove(),
    },
  ])("拒绝损坏结构：$name", async ({ change }) => {
    const input = await modifyStructure(await structureFixture(), change);
    await expect(edit(input, [action("insert-rows", 1)])).rejects.toThrow(
      "Invalid presentation",
    );
  });

  it.each([
    {
      name: "rowId",
      operation: action("insert-rows", 0),
      change: ({ rows, xml }: Awaited<ReturnType<typeof readStructure>>) => {
        const id = xml.createElementNS(
          "http://schemas.microsoft.com/office/drawing/2014/main",
          "a16:rowId",
        );
        id.setAttribute("val", "123");
        rows[0].append(id);
      },
    },
    {
      name: "colId",
      operation: action("insert-columns", 0),
      change: ({ columns, xml }: Awaited<ReturnType<typeof readStructure>>) => {
        const id = xml.createElementNS(
          "http://schemas.microsoft.com/office/drawing/2014/main",
          "a16:colId",
        );
        id.setAttribute("val", "456");
        columns[0].append(id);
      },
    },
    {
      name: "creationId",
      operation: action("insert-rows", 0),
      change: ({ cells, xml }: Awaited<ReturnType<typeof readStructure>>) => {
        const id = xml.createElementNS(
          "http://schemas.microsoft.com/office/drawing/2014/main",
          "a16:creationId",
        );
        id.setAttribute("id", "{1234}");
        cells[0][0].append(id);
      },
    },
    {
      name: "relationship",
      operation: action("insert-columns", 0),
      change: ({ cells }: Awaited<ReturnType<typeof readStructure>>) =>
        cells[0][0].setAttributeNS(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "r:id",
          "opaque",
        ),
    },
  ])(
    "不能证明可安全重生的$name身份/关系不盲复制",
    async ({ operation, change }) => {
      const input = await modifyStructure(await structureFixture(), change);
      await expect(edit(input, [operation])).rejects.toThrow(
        "unsupported table clone",
      );
    },
  );

  it("mixed模板插行清空新格并保留原文/样式/metadata，纯resize不改正文", async () => {
    const input = await modifyStructure(
      await structureFixture(),
      ({ cells }) => {
        const paragraph = cells[0][0].getElementsByTagNameNS(a, "p")[0];
        const run = paragraph
          .getElementsByTagNameNS(a, "r")[0]
          .cloneNode(true) as Element;
        run.getElementsByTagNameNS(a, "rPr")[0].setAttribute("i", "1");
        run.getElementsByTagNameNS(a, "t")[0].textContent = "混合尾段🦊";
        paragraph.insertBefore(run, one(paragraph, a, "endParaRPr")!);
      },
    );
    const before = await readStructure(input),
      inserted = await readStructure(
        await edit(input, [action("insert-rows", 0)]),
      ),
      resized = await readStructure(await edit(input, [resize()]));
    expect(cellText(before.cells[0][0])).toBe("TABLE_R1C1混合尾段🦊");
    expect(
      Array.from(
        before.cells[0][0].getElementsByTagNameNS(a, "rPr"),
        (property) => property.getAttribute("i"),
      ),
    ).toEqual([null, "1"]);
    expect(dimensions(inserted)).toEqual({
      widths: [80, 160, 240],
      heights: [72, 72, 120],
      width: 480,
      height: 264,
    });
    expect(values(inserted.cells)).toEqual([
      ["", "", ""],
      ...values(before.cells),
    ]);
    expect(inserted.rows[0].getAttributeNS("urn:keep", "row")).toBe("0");
    expect(inserted.rows[0].getAttribute("h")).toBe(
      before.rows[0].getAttribute("h"),
    );
    for (const [column, cell] of inserted.cells[0].entries()) {
      const template = before.cells[0][column],
        body = one(cell, a, "txBody")!,
        templateBody = one(template, a, "txBody")!,
        paragraph = one(body, a, "p")!,
        templateParagraph = one(templateBody, a, "p")!;
      expect(attributes(cell)).toEqual({
        gridSpan: null,
        rowSpan: null,
        hMerge: null,
        vMerge: null,
      });
      for (const name of ["bodyPr", "lstStyle"])
        expect(serialize(one(body, a, name)!)).toBe(
          serialize(one(templateBody, a, name)!),
        );
      for (const name of ["pPr", "endParaRPr"])
        expect(serialize(one(paragraph, a, name)!)).toBe(
          serialize(one(templateParagraph, a, name)!),
        );
      expect(serialize(one(cell, a, "tcPr")!)).toBe(
        serialize(one(template, a, "tcPr")!),
      );
    }
    for (const [row, original] of before.rows.entries())
      expect(serialize(inserted.rows[row + 1])).toBe(serialize(original));
    for (const [row, cells] of before.cells.entries())
      for (const [column, cell] of cells.entries())
        expect(serialize(resized.cells[row][column])).toBe(serialize(cell));
    for (const after of [inserted, resized]) {
      expect(Object.keys(after.zip.files).sort()).toEqual(
        Object.keys(before.zip.files).sort(),
      );
      for (const [name, entry] of Object.entries(before.zip.files))
        if (!entry.dir && name !== tableSlidePath)
          expect(await after.zip.file(name)!.async("uint8array"), name).toEqual(
            await entry.async("uint8array"),
          );
    }
  });
});
