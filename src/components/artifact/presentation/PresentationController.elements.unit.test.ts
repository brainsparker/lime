import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElementFrame,
  presentationElements,
  presentationTextBodyText,
} from "./presentationElements";
import { elementFixture } from "./presentationElements.testFixtures";

describe("PresentationController 对象集合与原包历史", () => {
  let controller: PresentationController, disk: Uint8Array;
  let files: {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
  };
  const nodes = () =>
    presentationElements(controller.getSnapshot().document, "512");
  const frames = () =>
    nodes().map((node) => ({
      id: node.id,
      ...presentationElementFrame(node),
      rotation: node.rotation,
    }));
  const settle = async () => expect(await controller.flushEdits()).toBe(true);
  const start = (mode: "move" | "resize" | "rotate", point = { x: 0, y: 0 }) =>
    expect(
      controller.beginElementInteraction({
        elementId: "2",
        point,
        mode,
        ...(mode === "resize" ? { corner: "se" as const } : {}),
      }),
    ).toBe(true);
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    disk = await elementFixture();
    files = {
      read: vi.fn(async () => disk.slice()),
      write: vi.fn(async (_path: string, bytes: Uint8Array) => {
        disk = bytes.slice();
      }),
    };
    controller = new PresentationController(
      "/workspace/elements.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      files,
    );
    controller.setEditingEnabled(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("集合规范化和table内部格选共享一个选择owner，不保留单选state alias", () => {
    controller.setSelectedElementId("7");
    expect(controller.tableEditing.getSnapshot()?.tableId).toBe("7");
    expect(
      controller.tableEditing.interact({ type: "select-all", tableId: "7" }),
    ).toBe(true);
    expect(controller.getSnapshot().tableSelection).not.toBeNull();
    controller.toggleSelectedElementId("2");
    expect(controller.getSnapshot()).toMatchObject({
      selectedElementIds: ["7", "2"],
      primarySelectedElementId: "2",
      tableSelection: null,
    });
    expect(controller.tableEditing.getSnapshot()).toBeNull();
    expect(
      controller.tableEditing.edit({
        type: "clear-cells",
        tableId: "7",
        range: { row: 0, column: 0, rowCount: 1, columnCount: 1 },
      }),
    ).toBe(false);
    controller.toggleSelectedElementId("7");
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    controller.selectAllSlideElements();
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
    controller.setSelectedElementId("missing");
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
    expect(controller.getSnapshot()).not.toHaveProperty("selectedElementId");
  });

  it("预览不改文档或dirty，锁定保存；提交整组只增加一次历史且重复up不提交", async () => {
    controller.selectAllSlideElements();
    const original = frames(),
      document = controller.getSnapshot().document;
    start("move");
    controller.updateElementInteraction({ nextPoint: { x: 10, y: -5 } });
    expect(controller.getSnapshot().document).toBe(document);
    expect(frames()).toEqual(original);
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      canUndo: false,
      saving: false,
    });
    expect(
      controller
        .getSnapshot()
        .elementInteraction?.preview.map(({ frame }) => [frame.x, frame.y]),
    ).toEqual([
      [10, -5],
      [110, 45],
    ]);
    expect(await controller.flushPublicFile()).toBe(false);
    expect(await controller.flushEdits()).toBe(false);
    expect(files.read).not.toHaveBeenCalled();
    expect(controller.endElementInteraction({ commit: true })).toBe(true);
    expect(controller.endElementInteraction({ commit: true })).toBe(false);
    await settle();
    expect(frames()).toEqual(
      original.map((frame) => ({ ...frame, x: frame.x + 10, y: frame.y - 5 })),
    );
    expect(controller.getSnapshot()).toMatchObject({
      selectedElementIds: ["2", "7"],
      primarySelectedElementId: "7",
      canUndo: true,
    });
    controller.undo();
    await settle();
    expect(frames()).toEqual(original);
    expect(controller.getSnapshot().canUndo).toBe(false);
    controller.redo();
    await settle();
    expect(frames()[0].x).toBe(10);
  });

  it("取消/原位/拖回原点零历史，slide切换、结束编辑和undo清除暂态", async () => {
    controller.selectAllSlideElements();
    for (const cancel of [
      () => controller.endElementInteraction({ commit: false }),
      () => controller.cancelElementInteraction(),
      () => controller.setSelectedSlideIdx(0),
      () => controller.setEditingEnabled(false),
      () => controller.undo(),
    ]) {
      controller.setEditingEnabled(true);
      controller.selectAllSlideElements();
      start("move");
      controller.updateElementInteraction({ nextPoint: { x: 20, y: 30 } });
      cancel();
      expect(controller.getSnapshot()).toMatchObject({
        elementInteraction: null,
        dirty: false,
        canUndo: false,
      });
    }
    controller.setEditingEnabled(true);
    controller.selectAllSlideElements();
    start("move");
    controller.updateElementInteraction({ nextPoint: { x: 20, y: 30 } });
    controller.updateElementInteraction({ nextPoint: { x: 0, y: 0 } });
    expect(controller.endElementInteraction({ commit: true })).toBe(false);
    await settle();
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("集合等比resize与表格格网同一批次保存，保存后undo/redo保持集合和每格内容", async () => {
    controller.selectAllSlideElements();
    const original = frames();
    start("resize", { x: 160, y: 90 });
    controller.updateElementInteraction({ nextPoint: { x: 320, y: 180 } });
    expect(controller.endElementInteraction({ commit: true })).toBe(true);
    expect(await controller.flushPublicFile()).toBe(true);
    expect(frames()).toEqual(
      original.map((frame) => ({
        ...frame,
        x: frame.x * 2,
        y: frame.y * 2,
        width: frame.width * 2,
        height: frame.height * 2,
      })),
    );
    const table = nodes().find(({ id }) => id === "7")!;
    if (table.nodeType !== "table") throw new Error("fixture table missing");
    expect(table.columns).toEqual([40, 40, 40]);
    expect(table.rows.map(({ height }) => height)).toEqual([40, 40]);
    expect(presentationTextBodyText(table.rows[0].cells[0].textBody!)).toBe(
      "TABLE_R1C1",
    );
    expect(controller.getSnapshot()).toMatchObject({
      dirty: false,
      selectedElementIds: ["2", "7"],
      primarySelectedElementId: "7",
    });
    controller.undo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(frames()).toEqual(original);
    expect(controller.getSnapshot().canUndo).toBe(false);
    controller.redo();
    expect(await controller.flushPublicFile()).toBe(true);
    expect(frames()[1].width).toBe(120);
    expect(files.write).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2", "7"]);
  });

  it("集合旋转保存绕共同中心移动对象并保留原旋转/flip及表格轨道", async () => {
    controller.selectAllSlideElements();
    start("rotate", { x: 90, y: 45 });
    controller.updateElementInteraction({ nextPoint: { x: 80, y: 55 } });
    controller.endElementInteraction({ commit: true });
    expect(await controller.flushPublicFile()).toBe(true);
    expect(frames()).toEqual([
      { id: "2", x: 95, y: -25, width: 40, height: 20, rotation: 90 },
      { id: "7", x: 25, y: 75, width: 60, height: 40, rotation: 90 },
    ]);
    expect(nodes()[0].flipH).toBe(true);
    expect(nodes()[0].flipV).toBe(true);
    const table = nodes()[1];
    if (table.nodeType !== "table") throw new Error("fixture table missing");
    expect(table.columns).toEqual([20, 20, 20]);
    controller.undo();
    await settle();
    expect(frames()[0].rotation).toBe(0);
  });

  it("框选支持additive/反向拖动与取消恢复，框选期间不保存旧dirty稿", async () => {
    controller.setSelectedElementId("7");
    expect(controller.nudgeSelectedElements({ dx: 1, dy: 0 })).toBe(true);
    await settle();
    expect(
      controller.beginSelectionMarquee({
        point: { x: 50, y: 30 },
        additive: true,
      }),
    ).toBe(true);
    controller.updateSelectionMarquee({ nextPoint: { x: -1, y: -1 } });
    expect(controller.getSnapshot().selectedElementIds).toEqual(["7", "2"]);
    expect(await controller.flushPublicFile()).toBe(false);
    controller.endSelectionMarquee({ commit: false });
    expect(controller.getSnapshot().selectedElementIds).toEqual(["7"]);
    expect(controller.beginSelectionMarquee({ point: { x: 50, y: 30 } })).toBe(
      true,
    );
    controller.updateSelectionMarquee({ nextPoint: { x: -1, y: -1 } });
    controller.endSelectionMarquee({ commit: true });
    expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    controller.undo();
    await settle();
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("集合nudge/delete一次历史，表格内部键盘动作不会删除整个对象集合", async () => {
    controller.selectAllSlideElements();
    expect(controller.nudgeSelectedElements({ dx: -2, dy: 3 })).toBe(true);
    await settle();
    expect(frames().map(({ x, y }) => [x, y])).toEqual([
      [-2, 3],
      [98, 53],
    ]);
    expect(controller.deleteSelectedElement()).toBe(true);
    await settle();
    expect(nodes()).toEqual([]);
    controller.undo();
    await settle();
    expect(nodes().map(({ id }) => id)).toEqual(["2", "7"]);
    controller.undo();
    await settle();
    expect(frames()[0].x).toBe(0);
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("非法输入不启动或污染预览，真实外部版本切换取消暂态", async () => {
    controller.selectAllSlideElements();
    expect(
      controller.beginElementInteraction({
        elementId: "2",
        point: { x: NaN, y: 0 },
        mode: "move",
      }),
    ).toBe(false);
    start("move");
    controller.updateElementInteraction({ nextPoint: { x: 1, y: 2 } });
    const preview = controller.getSnapshot().elementInteraction;
    controller.updateElementInteraction({ nextPoint: { x: Infinity, y: 0 } });
    expect(controller.getSnapshot().elementInteraction).toBe(preview);
    const external = await importPresentationDocument(
      await elementFixture(),
      new AbortController().signal,
    );
    controller.receiveDocument({
      ...external,
      sourceSha256: "external-version",
    });
    expect(controller.getSnapshot()).toMatchObject({
      elementInteraction: null,
      dirty: false,
    });
  });

  it("单选z-order边界是无操作，四动作使用同一历史且多选拒绝", async () => {
    controller.setSelectedElementId("2");
    expect(controller.reorderSelectedElement("send-to-back")).toBe(false);
    expect(controller.getSnapshot().canUndo).toBe(false);
    for (const direction of [
      "bring-forward",
      "send-backward",
      "bring-to-front",
      "send-to-back",
    ] as const) {
      expect(controller.reorderSelectedElement(direction)).toBe(true);
      await settle();
      expect(nodes().map(({ id }) => id)).toEqual(
        direction.startsWith("bring-") ? ["7", "2"] : ["2", "7"],
      );
      expect(controller.getSnapshot().selectedElementIds).toEqual(["2"]);
    }
    controller.undo();
    await settle();
    expect(nodes().map(({ id }) => id)).toEqual(["7", "2"]);
    controller.selectAllSlideElements();
    expect(controller.reorderSelectedElement("send-to-back")).toBe(false);
  });
});
