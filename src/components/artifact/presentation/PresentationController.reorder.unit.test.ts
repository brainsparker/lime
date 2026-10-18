import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationTextBodyText,
} from "./presentationElements";
import { tableFixture, tableId } from "./presentationTablePackage.testFixtures";

describe("表格reorder输入与原包历史的同一Controller", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());
  async function setup(merged = false) {
    let disk = await tableFixture({ merged });
    const write = vi.fn(async (_path: string, value: Uint8Array) => {
      disk = value.slice();
    });
    const controller = new PresentationController(
      "/workspace/reorder.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      { read: async () => disk, write },
    );
    controller.setEditingEnabled(true);
    controller.setSelectedElementId(tableId);
    const texts = () => {
      const table = presentationElements(
        controller.getSnapshot().document,
        "512",
      ).find((node) => node.id === tableId);
      if (table?.nodeType !== "table") throw new Error("missing table");
      return table.rows.map((row) =>
        row.cells.map((cell) =>
          cell.textBody ? presentationTextBodyText(cell.textBody) : "",
        ),
      );
    };
    const interact = (index: number, insertionIndex: number) =>
      controller.tableEditing.interact({
        type: "reorder",
        tableId,
        axis: "column",
        index,
        insertionIndex,
      });
    return { controller, write, texts, interact };
  }

  it("全轨选择/Shift扩展不记历史，reorder保原文并在新位置选整轨，跨保存一次undo恢复", async () => {
    const { controller, write, texts, interact } = await setup();
    const original = texts();
    for (const [index, shiftKey] of [
      [1, false],
      [0, true],
    ] as const)
      expect(
        controller.tableEditing.interact({
          type: "pointer-down",
          tableId,
          point: { x: 0, y: 0 },
          target: { kind: "row", index },
          shiftKey,
        }),
      ).toBe(true);
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 0,
      rowCount: 2,
      columnCount: 3,
    });
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(interact(0, 3)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(texts()).toEqual(original.map((row) => [row[1], row[2], row[0]]));
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 2,
      rowCount: 2,
      columnCount: 1,
    });
    expect(await controller.flushPublicFile()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(texts()).toEqual(original);
    expect(await controller.flushPublicFile()).toBe(true);
    controller.redo();
    expect(await controller.flushEdits()).toBe(true);
    expect(texts()).toEqual(original.map((row) => [row[1], row[2], row[0]]));
  });

  it("合并跨度非法移动、同位与越界零历史；合法移到merged前保持原序", async () => {
    const { controller, write, texts, interact } = await setup(true);
    const original = texts();
    for (const [index, insertionIndex] of [
      [0, 0],
      [0, 1],
      [0, 3],
      [1, 0],
      [-1, 0],
      [2, 4],
    ])
      expect(interact(index, insertionIndex)).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      projecting: false,
      canUndo: false,
      failure: null,
    });
    expect(write).not.toHaveBeenCalled();
    expect(interact(2, 0)).toBe(true);
    expect(await controller.flushEdits()).toBe(true);
    expect(texts()).toEqual(original.map((row) => [row[2], row[0], row[1]]));
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      canMerge: true,
      canUnmerge: false,
      selection: { range: { row: 0, column: 0, rowCount: 2, columnCount: 1 } },
    });
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(texts()).toEqual(original);
    expect(controller.getSnapshot().dirty).toBe(false);
  });
});
