import { webcrypto } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationElementFrame,
  presentationElementText,
} from "./presentationElements";
import {
  a,
  p,
  children,
  one,
  slidePaths,
  xmlPart,
} from "./presentationPackageXml";
import { fixture as slidesFixture } from "./presentationSlidesPackage.testFixtures";
import {
  tableFixture,
  slideId,
  tableId,
  tableSlidePath,
} from "./presentationTablePackage.testFixtures";

const path = "/workspace/table.pptx";
const read = (bytes: Uint8Array) =>
  importPresentationDocument(bytes, new AbortController().signal);
const serialize = (node: Node) => new XMLSerializer().serializeToString(node);
const oneCell = { row: 0, column: 0, rowCount: 1, columnCount: 1 };

async function cells(bytes: Uint8Array, id = slideId) {
  const zip = await JSZip.loadAsync(bytes);
  const paths = slidePaths(
    await xmlPart(zip, "ppt/presentation.xml"),
    await xmlPart(zip, "ppt/_rels/presentation.xml.rels"),
  );
  const xml = await xmlPart(zip, paths.get(id)!);
  const table = xml.getElementsByTagNameNS(a, "tbl")[0];
  return children(table, a, "tr").map((row) => children(row, a, "tc"));
}

function text(cell: Element): string {
  return Array.from(cell.getElementsByTagNameNS(a, "p"), (paragraph) =>
    Array.from(
      paragraph.getElementsByTagNameNS(a, "t"),
      (run) => run.textContent,
    ).join(""),
  ).join("\n");
}

async function tableWithLayouts(): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await slidesFixture());
  const tableZip = await JSZip.loadAsync(await tableFixture());
  const target = await xmlPart(zip, tableSlidePath);
  const source = await xmlPart(tableZip, tableSlidePath);
  target
    .getElementsByTagNameNS(p, "spTree")[0]
    .append(
      target.importNode(
        source.getElementsByTagNameNS(p, "graphicFrame")[0],
        true,
      ),
    );
  zip.file(tableSlidePath, serialize(target));
  return zip.generateAsync({ type: "uint8array" });
}

describe("PresentationController 表格共用语义编辑历史", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  async function setup(bytes = tableFixture()) {
    let disk = (await bytes).slice();
    const files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, value: Uint8Array) => {
        disk = value.slice();
      }),
    };
    const document = await read(disk);
    const controller = new PresentationController(path, document, files);
    controller.setEditingEnabled(true);
    controller.setSelectedElementId(tableId);
    const edit = async (value: string, row = 0, column = 0) => {
      expect(controller.textActivateBlockEnd({ tableId, row, column })).toBe(
        true,
      );
      controller.textHandleInput(value);
      expect(await controller.flushEdits()).toBe(true);
    };
    return { controller, files, document, edit, disk: () => disk };
  }

  it("不同cell切换先提交在途文字和IME，保序且不以tableId覆盖上一格", async () => {
    const { controller, disk, files } = await setup();
    expect(
      controller.textActivateBlockEnd({ tableId, row: 0, column: 0 }),
    ).toBe(true);
    controller.textHandleInput("第一格草稿");
    expect(
      controller.textActivateBlockEnd({ tableId, row: 1, column: 2 }),
    ).toBe(true);
    controller.textHandleCompositionEnd("第二格 输入完成😀\n下一行");
    expect(await controller.flushEdits()).toBe(true);
    let rows = await cells(controller.getSnapshot().document.sourceBytes);
    expect(text(rows[0][0])).toBe("第一格草稿");
    expect(text(rows[1][2])).toBe("第二格 输入完成😀\n下一行");
    expect(text(rows[0][1])).toBe("TABLE_R1C2");
    expect(await controller.flushPublicFile()).toBe(true);
    rows = await cells((await read(disk())).sourceBytes);
    expect(text(rows[0][0])).toBe("第一格草稿");
    expect(text(rows[1][2])).toBe("第二格 输入完成😀\n下一行");
    expect(files.write).toHaveBeenCalledExactlyOnceWith(
      path,
      expect.any(Uint8Array),
    );
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      failure: null,
    });
  });

  it("cell文字、范围样式与clear保序，清空保留表格对象和非目标格及原包成员", async () => {
    const { controller, edit, document, disk } = await setup();
    const before = await cells(document.sourceBytes);
    await edit("文字保留");
    expect(
      controller.tableEditing.edit({
        type: "set-cell-style",
        tableId,
        range: { ...oneCell, columnCount: 2 },
        style: {
          bold: true,
          italic: true,
          fontSize: 28,
          color: "#abcdef",
          fillColor: "123456",
        },
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(
      controller.tableEditing.edit({
        type: "clear-cells",
        tableId,
        range: { ...oneCell, row: 1, columnCount: 2 },
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const rows = await cells(disk());
    expect(rows.map((row) => row.map(text))).toEqual([
      ["文字保留", "TABLE_R1C2", "TABLE_R1C3"],
      ["", "", "TABLE_R2C3"],
    ]);
    const properties = rows[0][0].getElementsByTagNameNS(a, "rPr")[0];
    expect([
      properties.getAttribute("b"),
      properties.getAttribute("i"),
      properties.getAttribute("sz"),
    ]).toEqual(["1", "1", "2100"]);
    expect(
      properties.getElementsByTagNameNS(a, "srgbClr")[0].getAttribute("val"),
    ).toBe("ABCDEF");
    expect(
      one(one(rows[0][0], a, "tcPr")!, a, "solidFill")!
        .getElementsByTagNameNS(a, "srgbClr")[0]
        .getAttribute("val"),
    ).toBe("123456");
    expect(serialize(rows[1][2])).toBe(serialize(before[1][2]));
    const reopened = await read(disk());
    expect(
      presentationElements(reopened, slideId).find(
        (node) => node.id === tableId,
      )?.nodeType,
    ).toBe("table");
    const zip = await JSZip.loadAsync(disk());
    expect(
      await zip.file("customXml/table-retained.xml")!.async("string"),
    ).toBe('<keep xmlns="urn:keep">retained</keep>');
    expect(
      await zip.file("ppt/media/table-retained.bin")!.async("uint8array"),
    ).toEqual(new Uint8Array([0, 255, 128, 19]));
  });

  it("cell、对象和幻灯片共用原序：复制捕获当时稿，源与副本后续编辑相互独立", async () => {
    const { controller, edit, disk } = await setup(tableWithLayouts());
    await edit("CELL_AT_COPY");
    const shape = presentationElements(
      controller.getSnapshot().document,
      slideId,
    ).find((node) => presentationElementText(node) !== undefined)!;
    expect(controller.textActivateBlockEnd(shape.id)).toBe(true);
    controller.textHandleInput("OBJECT_AT_COPY");
    expect(controller.duplicateSelectedSlide()).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    const copyId = controller.getSnapshot().selectedSlideId;
    expect(copyId).not.toBe(slideId);
    await edit("COPY_CELL_ONLY", 0, 1);
    expect(
      presentationElements(controller.getSnapshot().document, copyId).map(
        presentationElementText,
      ),
    ).toContain("OBJECT_AT_COPY");
    controller.setSelectedSlideIdx(0);
    await edit("SOURCE_AFTER_COPY");
    expect(controller.moveSlide(1, 3)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const source = await cells(disk(), slideId),
      copy = await cells(disk(), copyId);
    expect(text(source[0][0])).toBe("SOURCE_AFTER_COPY");
    expect(text(source[0][1])).toBe("TABLE_R1C2");
    expect(text(copy[0][0])).toBe("CELL_AT_COPY");
    expect(text(copy[0][1])).toBe("COPY_CELL_ONLY");
    expect((await read(disk())).slideIds.at(-1)).toBe(copyId);
  });

  it("合并cell的文字入口、pointer与键盘选区归一到锚点，范围完整覆盖合并矩形", async () => {
    const { controller, edit } = await setup(tableFixture({ merged: true }));
    await edit("MERGED_ANCHOR", 1, 1);
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("MERGED_ANCHOR");
    expect(controller.getSnapshot().tableSelection).toMatchObject({
      anchor: { row: 0, column: 0 },
      focus: { row: 0, column: 0 },
    });
    expect(
      controller.tableEditing.interact({
        type: "pointer-down",
        tableId,
        target: { kind: "cell" },
        point: { x: 384, y: 288 },
      }),
    ).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.activeCell).toEqual({
      row: 0,
      column: 0,
    });
    expect(
      controller.tableEditing.interact({
        type: "navigate",
        tableId,
        direction: "right",
        extend: true,
      }),
    ).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 0,
      rowCount: 2,
      columnCount: 3,
    });
    expect(
      controller.tableEditing.interact({
        type: "navigate",
        tableId,
        direction: "down",
      }),
    ).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.activeCell).toEqual({
      row: 1,
      column: 2,
    });
    expect(
      controller.tableEditing.interact({
        type: "navigate",
        tableId,
        direction: "down",
      }),
    ).toBe(false);
    expect(
      controller.tableEditing.interact({ type: "select-all", tableId }),
    ).toBe(true);
    expect(controller.tableEditing.getSnapshot()).not.toHaveProperty("cells");
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 0,
      rowCount: 2,
      columnCount: 3,
    });
    // 旋转后的真实格内点位于未旋转外框下方；命中必须使用逆旋转坐标。
    expect(
      controller.tableEditing.interact({
        type: "pointer-down",
        tableId,
        target: { kind: "cell" },
        point: { x: 574.304, y: 386.836 },
      }),
    ).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.activeCell).toEqual({
      row: 1,
      column: 2,
    });
  });

  it("clear-cells保留表格，删除对象移除整个表格，undo依次恢复两个语义动作", async () => {
    const { controller, disk } = await setup();
    expect(
      controller.tableEditing.edit({
        type: "clear-cells",
        tableId,
        range: oneCell,
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.deleteSelectedElement()).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(
      presentationElements(controller.getSnapshot().document, slideId).some(
        (node) => node.id === tableId,
      ),
    ).toBe(false);
    expect(controller.tableEditing.getSnapshot()).toBeNull();
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("");
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(text((await cells(disk()))[0][0])).toBe("TABLE_R1C1");
  });

  it("表格公共订阅提供稳定snapshot，并能取消监听；对象选择与cell选择分离", async () => {
    const { controller } = await setup();
    const listener = vi.fn(),
      unsubscribe = controller.tableEditing.subscribe(listener);
    const selectedObject = controller.tableEditing.getSnapshot();
    expect(selectedObject?.selection).toBeNull();
    expect(controller.tableEditing.getSnapshot()).toBe(selectedObject);
    expect(
      controller.tableEditing.interact({ type: "select-all", tableId }),
    ).toBe(true);
    expect(listener).toHaveBeenCalled();
    expect(controller.tableEditing.getSnapshot()).not.toBe(selectedObject);
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 0,
      rowCount: 2,
      columnCount: 3,
    });
    unsubscribe();
    listener.mockClear();
    controller.setSelectedElementId(null);
    expect(controller.tableEditing.getSnapshot()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it("文字与样式跨保存undo/redo仍重放同一历史，dirty精确回到已保存稿", async () => {
    const { controller, edit, disk, files } = await setup();
    await edit("SAVED_CELL");
    expect(
      controller.tableEditing.edit({
        type: "set-cell-style",
        tableId,
        range: oneCell,
        style: { bold: true },
      }),
    ).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(false);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(true);
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("SAVED_CELL");
    expect(
      (await cells(controller.getSnapshot().document.sourceBytes))[0][0]
        .getElementsByTagNameNS(a, "rPr")[0]
        .getAttribute("b"),
    ).toBeNull();
    expect(await controller.flushPublicFile()).toBe(true);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("TABLE_R1C1");
    controller.redo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(false);
    controller.redo();
    expect(await controller.flushPublicFile()).toBe(true);
    const row = (await cells(disk()))[0][0];
    expect(text(row)).toBe("SAVED_CELL");
    expect(row.getElementsByTagNameNS(a, "rPr")[0].getAttribute("b")).toBe("1");
    expect(files.write).toHaveBeenCalledTimes(3);
  });

  it.each([1, 2])(
    "第%i次读盘发现外部冲突时零写入并保留两格稿，恢复文件后可保存",
    async (readIndex) => {
      const { controller, edit, files, document, disk } = await setup();
      await edit("KEEP_FIRST");
      await edit("KEEP_SECOND", 1, 2);
      if (readIndex === 2)
        files.read.mockResolvedValueOnce(document.sourceBytes.slice());
      files.read.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
      expect(await controller.flushPublicFile()).toBe(false);
      expect(controller.getSnapshot()).toMatchObject({
        dirty: true,
        failure: "fileChanged",
        saving: false,
      });
      expect(files.write).not.toHaveBeenCalled();
      const draft = await cells(controller.getSnapshot().document.sourceBytes);
      expect(text(draft[0][0])).toBe("KEEP_FIRST");
      expect(text(draft[1][2])).toBe("KEEP_SECOND");
      expect(await controller.flushPublicFile()).toBe(true);
      expect(text((await cells(disk()))[1][2])).toBe("KEEP_SECOND");
    },
  );

  it("写盘失败保稿并可重试，保存期间锁定table edit与文字入口", async () => {
    const { controller, edit, files, disk } = await setup();
    await edit("RETRY_DRAFT");
    files.write.mockRejectedValueOnce(new Error("disk unavailable"));
    const pending = controller.flushPublicFile();
    expect(controller.flushPublicFile()).toBe(pending);
    expect(
      controller.tableEditing.edit({
        type: "clear-cells",
        tableId,
        range: oneCell,
      }),
    ).toBe(false);
    expect(
      controller.textActivateBlockEnd({ tableId, row: 0, column: 1 }),
    ).toBe(false);
    expect(await pending).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "saveFailed",
      saving: false,
    });
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("RETRY_DRAFT");
    expect(await controller.flushPublicFile()).toBe(true);
    expect(text((await cells(disk()))[0][0])).toBe("RETRY_DRAFT");
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      failure: null,
    });
  });

  it("无效局部merged编辑失败不覆盖既有稿，undo后仍可继续编辑保存", async () => {
    const { controller, edit, disk, files } = await setup(
      tableFixture({ merged: true }),
    );
    await edit("KEEP_VALID_MERGED");
    expect(
      controller.tableEditing.edit({
        type: "clear-cells",
        tableId,
        range: oneCell,
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(false);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: true,
      failure: "invalidEdit",
    });
    expect(
      text((await cells(controller.getSnapshot().document.sourceBytes))[0][0]),
    ).toBe("KEEP_VALID_MERGED");
    expect(files.write).not.toHaveBeenCalled();
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    await edit("AFTER_RECOVERY", 1, 2);
    expect(await controller.flushPublicFile()).toBe(true);
    expect((await cells(disk())).map((row) => row.map(text))).toEqual([
      ["KEEP_VALID_MERGED", "", "TABLE_R1C3"],
      ["", "", "AFTER_RECOVERY"],
    ]);
  });

  it("行列结构先提交活动文字，按原序重放，跨保存撤销仍保留独立cell内容", async () => {
    const { controller, disk } = await setup();
    controller.textActivateBlockEnd({ tableId, row: 1, column: 2 });
    controller.textHandleInput("LAST_ROW_BEFORE_INSERT");
    expect(
      controller.tableEditing.edit({
        type: "insert-rows",
        tableId,
        index: 1,
        count: 2,
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    let rows = await cells(controller.getSnapshot().document.sourceBytes);
    expect(rows).toHaveLength(4);
    expect(text(rows[1][2])).toBe("");
    expect(text(rows[2][2])).toBe("");
    expect(text(rows[3][2])).toBe("LAST_ROW_BEFORE_INSERT");
    expect(
      controller.tableEditing.edit({
        type: "insert-columns",
        tableId,
        index: 1,
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      rowCount: 4,
      columnCount: 4,
    });
    expect(
      controller.tableEditing.edit({
        type: "delete-rows",
        tableId,
        index: 0,
        count: 3,
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.activeCell?.row).toBe(0);
    expect(
      controller.tableEditing.edit({
        type: "delete-columns",
        tableId,
        index: 0,
      }),
    ).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    rows = await cells(disk());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(3);
    expect(rows[0].map(text)).toEqual([
      "",
      "TABLE_R2C2",
      "LAST_ROW_BEFORE_INSERT",
    ]);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.columnCount).toBe(4);
    controller.redo();
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it("末格Tab只新增一行并定位新行首格；新格可编辑保存", async () => {
    const { controller, disk } = await setup();
    controller.textActivateBlockEnd({ tableId, row: 1, column: 2 });
    controller.cancelTextEdit();
    expect(
      controller.tableEditing.interact({
        type: "navigate",
        tableId,
        direction: "next",
      }),
    ).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      rowCount: 3,
      columnCount: 3,
      activeCell: { row: 2, column: 0 },
    });
    expect(
      controller.textActivateBlockEnd({ tableId, row: 2, column: 0 }),
    ).toBe(true);
    controller.textHandleInput("TAB_APPENDED");
    expect(await controller.flushPublicFile()).toBe(true);
    expect(text((await cells(disk()))[2][0])).toBe("TAB_APPENDED");
    expect(text((await cells(disk()))[1][2])).toBe("TABLE_R2C3");
  });

  it("合并与局部解除合并保留全部cell内容，跨保存撤销仍恢复同一格网", async () => {
    const { controller, disk } = await setup();
    const range = { row: 0, column: 0, rowCount: 2, columnCount: 2 };
    controller.textActivateBlockEnd({ tableId, row: 0, column: 0 });
    controller.textHandleInput("合并前中文");
    expect(
      controller.tableEditing.edit({ type: "merge-cells", tableId, range }),
    ).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const expected = [
      ["合并前中文", "TABLE_R1C2", "TABLE_R1C3"],
      ["TABLE_R2C1", "TABLE_R2C2", "TABLE_R2C3"],
    ];
    expect((await cells(disk())).map((row) => row.map(text))).toEqual(expected);
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      canMerge: false,
      canUnmerge: true,
      selection: { range },
    });
    expect(
      controller.tableEditing.edit({
        type: "unmerge-cells",
        tableId,
        range: oneCell,
      }),
    ).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      canMerge: false,
      canUnmerge: false,
      selection: { range: oneCell },
    });
    expect((await cells(disk())).map((row) => row.map(text))).toEqual(expected);
    controller.undo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.canUnmerge).toBe(true);
    controller.redo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.canUnmerge).toBe(false);
    expect((await cells(disk())).map((row) => row.map(text))).toEqual(expected);
  });

  it("单轨resize和均匀分布共享有序历史，保留轴总长和原格内容", async () => {
    const { controller, disk } = await setup();
    const range = { row: 0, column: 0, rowCount: 2, columnCount: 3 };
    for (const edit of [
      { type: "resize-row", index: 0, size: 120 },
      { type: "resize-column", index: 0, size: 240 },
      { type: "distribute-rows", range },
      { type: "distribute-columns", range },
    ] as const) {
      expect(controller.tableEditing.edit({ ...edit, tableId })).toBe(true);
      expect(await controller.flushEdits()).toBe(true);
    }
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      rowHeights: [108, 108],
      columnWidths: [208, 208, 208],
      frame: { width: 624, height: 216 },
    });
    controller.undo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.columnWidths).toEqual([
      240, 192, 192,
    ]);
    controller.redo();
    expect(await controller.flushPublicFile()).toBe(true);
    const reopened = presentationElements(await read(disk()), slideId).find(
      (node) => node.id === tableId,
    )!;
    expect(reopened.nodeType).toBe("table");
    if (reopened.nodeType !== "table") throw new Error("missing table");
    expect(reopened.columns).toEqual([208, 208, 208]);
    expect(reopened.rows.map((row) => row.height)).toEqual([108, 108]);
    expect(text((await cells(disk()))[1][2])).toBe("TABLE_R2C3");
  });

  it("表格缩放与平移原子同步轨道，撤销恢复原尺寸与cell内容", async () => {
    const { controller, disk } = await setup();
    const node = presentationElements(
      controller.getSnapshot().document,
      slideId,
    ).find((element) => element.id === tableId)!;
    const frame = presentationElementFrame(node);
    const resized = {
      x: frame.x + 10,
      y: frame.y + 20,
      width: frame.width * 2,
      height: frame.height / 2,
    };
    expect(controller.updateSelectedElementFrame({ ...frame, width: 0 })).toBe(
      false,
    );
    expect(controller.getSnapshot().dirty).toBe(false);
    expect(controller.updateSelectedElementFrame(resized)).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    const reopened = await read(disk());
    const moved = presentationElements(reopened, slideId).find(
      (element) => element.id === tableId,
    )!;
    expect(presentationElementFrame(moved)).toEqual(resized);
    if (moved.nodeType !== "table") throw new Error("missing moved table");
    expect(moved.columns).toEqual([384, 384, 384]);
    expect(moved.rows.map((row) => row.height)).toEqual([48, 48]);
    expect(moved.rotation).toBe(node.rotation);
    expect(text((await cells(disk()))[0][0])).toBe("TABLE_R1C1");
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    const restored = presentationElements(
      controller.getSnapshot().document,
      slideId,
    ).find((element) => element.id === tableId)!;
    expect(presentationElementFrame(restored)).toEqual(frame);
  });
});
