import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationController } from "./PresentationController";
import { importPresentationDocument } from "./presentationDocument";
import {
  presentationElements,
  presentationTextBodyText,
} from "./presentationElements";
import { tableFixture } from "./presentationTablePackage.testFixtures";
import {
  modifyStructure,
  structureFixture,
} from "./presentationTableStructurePackage.testFixtures";
import { installPresentationTableReorderOverlay } from "./presentationTableReorderOverlay";

describe("表格行列原生reorder grip", () => {
  let controller: PresentationController;
  let frame: HTMLIFrameElement;
  let mount: HTMLDivElement;
  let dispose = () => {};
  let writes: ReturnType<typeof vi.fn>;
  const restored = vi.fn();
  const table = () => {
    const value = presentationElements(
      controller.getSnapshot().document,
      "512",
    ).find((node) => node.id === "7");
    if (value?.nodeType !== "table") throw new Error("missing table");
    return value;
  };
  const texts = () =>
    table().rows.map((row) =>
      row.cells.map((cell) => presentationTextBodyText(cell.textBody!)),
    );
  const handle = (axis: "row" | "column", index = 0) =>
    mount.querySelector<HTMLButtonElement>(
      `[data-presentation-reorder="${axis}:${index}"]`,
    )!;
  const guide = () =>
    mount.querySelector<HTMLElement>("[data-presentation-reorder-guide]");
  const setup = async (bytes: Uint8Array) => {
    let disk = bytes;
    writes = vi.fn(async (_path: string, next: Uint8Array) => {
      disk = next;
    });
    controller = new PresentationController(
      "/workspace/table.pptx",
      await importPresentationDocument(bytes, new AbortController().signal),
      {
        read: vi.fn(async () => disk),
        write: writes,
      },
    );
    controller.setEditingEnabled(true);
    controller.setSelectedElementId("7");
  };
  const install = (
    options: Partial<
      Parameters<typeof installPresentationTableReorderOverlay>[0]
    > = {},
  ) => {
    dispose();
    dispose = installPresentationTableReorderOverlay({
      mount,
      controller,
      table: table(),
      scale: 1,
      labels: {
        row: (index) => `Reorder row ${index + 1}`,
        column: (index) => `Reorder column ${String.fromCharCode(65 + index)}`,
        hint: "Drag to move. Alt + arrow keys to reorder.",
      },
      onFocusRestore: restored,
      ...options,
    });
  };
  const select = (axis: "row" | "column", index: number) => {
    controller.tableEditing.interact({
      type: "pointer-down",
      tableId: "7",
      target: { kind: axis, index },
      point: { x: 0, y: 0 },
    });
  };
  const key = (
    target: EventTarget,
    value: string,
    altKey = false,
    extra: { isComposing?: boolean } = {},
  ) => {
    const event = new KeyboardEvent("keydown", {
      key: value,
      altKey,
      bubbles: true,
      cancelable: true,
      ...extra,
    });
    target.dispatchEvent(event);
    return event;
  };
  const pointer = (
    target: EventTarget,
    type: string,
    screenX: number,
    screenY: number,
    options: {
      pointerId?: number;
      clientX?: number;
      clientY?: number;
      button?: number;
    } = {},
  ) => {
    const event = new MouseEvent(type, {
      screenX,
      screenY,
      clientX: options.clientX ?? 0,
      clientY: options.clientY ?? 0,
      button: options.button ?? 0,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "pointerId", {
      value: options.pointerId ?? 1,
    });
    target.dispatchEvent(event);
    return event;
  };
  const flush = async () => expect(await controller.flushEdits()).toBe(true);
  beforeEach(async () => {
    vi.stubGlobal("crypto", webcrypto);
    restored.mockClear();
    frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    document.body.append(frame);
    mount = frame.contentDocument!.createElement("div");
    frame.contentDocument!.body.append(mount);
    await setup(await tableFixture());
    install();
  });
  afterEach(() => {
    dispose();
    frame.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hover/active/整轨选择显示对应grip、数值/字母ARIA与零历史", () => {
    expect(mount.querySelectorAll("[data-presentation-reorder]")).toHaveLength(
      5,
    );
    expect(handle("row").hidden).toBe(true);
    expect(handle("row").style.display).toBe("none");
    expect(handle("row").getAttribute("aria-label")).toBe("Reorder row 1");
    expect(handle("column", 2).getAttribute("aria-label")).toBe(
      "Reorder column C",
    );
    expect(handle("row").title).toBe(
      "Drag to move. Alt + arrow keys to reorder.",
    );
    const cell = mount.ownerDocument.createElement("button");
    cell.dataset.presentationCell = "0:1";
    mount.append(cell);
    pointer(cell, "pointermove", 0, 0);
    expect(handle("row").hidden).toBe(false);
    expect(handle("column", 1).hidden).toBe(false);
    expect(handle("column").hidden).toBe(true);
    expect(
      mount.querySelector<HTMLElement>(
        '[data-presentation-reorder-bridge="column"]',
      )!.hidden,
    ).toBe(false);
    pointer(mount, "pointerleave", 0, 0);
    expect(handle("column", 1).hidden).toBe(true);
    select("row", 1);
    expect(handle("row", 1).hidden).toBe(false);
    expect(handle("row", 1).getAttribute("aria-pressed")).toBe("true");
    expect(handle("column", 2).hidden).toBe(false);
    expect(handle("column", 2).getAttribute("aria-pressed")).toBe("false");
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(mount.querySelector("script")).toBeNull();
  });

  it("正常pointer点击先focus再整轨选择；detail0键盘点击同选择不产生历史", () => {
    select("row", 0);
    pointer(handle("column", 2), "pointerdown", 100, 100);
    expect(mount.ownerDocument.activeElement).toBe(handle("column", 2));
    expect(controller.tableEditing.getSnapshot()!.selection!.range).toEqual({
      row: 0,
      column: 2,
      rowCount: 2,
      columnCount: 1,
    });
    pointer(mount.ownerDocument, "pointerup", 100, 100);
    handle("row", 1).dispatchEvent(
      new MouseEvent("click", { detail: 0, bubbles: true }),
    );
    expect(controller.tableEditing.getSnapshot()!.selection!.range).toEqual({
      row: 1,
      column: 0,
      rowCount: 1,
      columnCount: 3,
    });
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it("Alt轴箭头通过单一interact使用移除前边界，整轨选择destination且可一次撤销", async () => {
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    const bubbled = vi.fn();
    mount.addEventListener("keydown", bubbled);
    expect(key(handle("column"), "ArrowRight", true).defaultPrevented).toBe(
      true,
    );
    expect(interact).toHaveBeenCalledWith({
      type: "reorder",
      tableId: "7",
      axis: "column",
      index: 0,
      insertionIndex: 2,
    });
    expect(bubbled).not.toHaveBeenCalled();
    await flush();
    expect(texts()).toEqual([
      ["TABLE_R1C2", "TABLE_R1C1", "TABLE_R1C3"],
      ["TABLE_R2C2", "TABLE_R2C1", "TABLE_R2C3"],
    ]);
    expect(controller.tableEditing.getSnapshot()!.selection!.range).toEqual({
      row: 0,
      column: 1,
      rowCount: 2,
      columnCount: 1,
    });
    expect(restored).toHaveBeenLastCalledWith({ axis: "column", index: 1 });
    controller.undo();
    await flush();
    expect(texts()[0]).toEqual(["TABLE_R1C1", "TABLE_R1C2", "TABLE_R1C3"]);
    expect(controller.getSnapshot().dirty).toBe(false);
    install();
    select("row", 0);
    key(handle("row"), "ArrowDown", true);
    await flush();
    expect(texts()[0]).toEqual(["TABLE_R2C1", "TABLE_R2C2", "TABLE_R2C3"]);
    expect(restored).toHaveBeenLastCalledWith({ axis: "row", index: 1 });
    expect(writes).not.toHaveBeenCalled();
  });

  it("自动保存期间保留grip可见与焦点，拒绝新的重排且不新增写入", async () => {
    select("column", 0);
    key(handle("column"), "ArrowRight", true);
    await flush();
    install();
    const grip = handle("column", 1);
    grip.focus();
    const interact = vi.spyOn(controller.tableEditing, "interact");
    const saving = controller.flushPublicFile();
    expect(controller.getSnapshot().saving).toBe(true);
    expect(grip.hidden).toBe(false);
    expect(grip.style.display).toBe("flex");
    expect(mount.ownerDocument.activeElement).toBe(grip);
    key(grip, "ArrowRight", true);
    expect(interact).not.toHaveBeenCalled();
    expect(await saving).toBe(true);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(texts()[0]).toEqual(["TABLE_R1C2", "TABLE_R1C1", "TABLE_R1C3"]);
  });

  it("边界/非Alt/错误轴/组合输入零重排，前移边界index-1后移index+2", async () => {
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    key(handle("column"), "ArrowLeft", true);
    key(handle("column"), "ArrowRight");
    key(handle("column"), "ArrowDown", true);
    key(handle("column", 2), "ArrowRight", true);
    key(handle("row"), "ArrowDown", true, { isComposing: true });
    expect(interact).not.toHaveBeenCalled();
    key(handle("column", 2), "ArrowLeft", true);
    await flush();
    expect(interact).toHaveBeenCalledWith({
      type: "reorder",
      tableId: "7",
      axis: "column",
      index: 2,
      insertionIndex: 1,
    });
    expect(texts()[0]).toEqual(["TABLE_R1C1", "TABLE_R1C3", "TABLE_R1C2"]);
  });

  it("大于3逻辑px阈值后仅预览中点guide，pointerup单次提交且保留原格", async () => {
    dispose();
    await setup(
      await modifyStructure(await tableFixture(), ({ transform }) =>
        transform.setAttribute("rot", "0"),
      ),
    );
    install();
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    const grip = handle("column");
    pointer(grip, "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointermove", 103, 100);
    expect(grip.dataset.reordering).toBeUndefined();
    pointer(mount.ownerDocument, "pointermove", 104, 100);
    expect(guide()!.dataset.insertionIndex).toBe("1");
    expect(guide()!.style.left).toBe("191px");
    pointer(mount.ownerDocument, "pointermove", 485, 100);
    expect(guide()!.dataset.insertionIndex).toBe("3");
    expect(guide()!.hidden).toBe(false);
    expect(texts()[0]).toEqual(["TABLE_R1C1", "TABLE_R1C2", "TABLE_R1C3"]);
    expect(
      interact.mock.calls.filter(([intent]) => intent.type === "reorder"),
    ).toHaveLength(0);
    expect(writes).not.toHaveBeenCalled();
    pointer(mount.ownerDocument, "pointerup", 485, 100);
    pointer(mount.ownerDocument, "pointerup", 485, 100);
    expect(
      interact.mock.calls.filter(([intent]) => intent.type === "reorder"),
    ).toHaveLength(1);
    await flush();
    expect(texts()[0]).toEqual(["TABLE_R1C2", "TABLE_R1C3", "TABLE_R1C1"]);
    expect(restored).toHaveBeenLastCalledWith({ axis: "column", index: 2 });
    expect(guide()!.hidden).toBe(true);
    controller.undo();
    await flush();
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it("屏幕增量逆90度/双flip/scale，中点命中不受中途client布局变化影响", async () => {
    dispose();
    await setup(
      await modifyStructure(await structureFixture(), ({ transform }) =>
        transform.setAttribute("rot", "5400000"),
      ),
    );
    install({ scale: 2 });
    select("column", 0);
    pointer(handle("column"), "pointerdown", 400, 400);
    pointer(mount.ownerDocument, "pointermove", 400, -402, {
      clientX: 900,
      clientY: 900,
    });
    expect(guide()!.dataset.insertionIndex).toBe("3");
    expect(guide()!.style.left).toBe("479px");
    pointer(mount.ownerDocument, "pointerup", 400, -402, {
      clientX: 1,
      clientY: 1,
    });
    await flush();
    expect(table().columns).toEqual([160, 240, 80]);
    expect(texts()[0]).toEqual(["TABLE_R1C2", "TABLE_R1C3", "TABLE_R1C1"]);
    controller.undo();
    await flush();
    install({ scale: 2 });
    select("row", 0);
    pointer(handle("row"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointerup", 342, 100);
    await flush();
    expect(table().rows.map((row) => row.height)).toEqual([120, 72]);
  });

  it("按真实grip内部命中偏移计算起点，轨道中点相等时使用后侧insertion", async () => {
    dispose();
    await setup(
      await modifyStructure(await tableFixture(), ({ transform }) =>
        transform.setAttribute("rot", "0"),
      ),
    );
    install();
    select("column", 0);
    const grip = handle("column");
    vi.spyOn(grip, "getBoundingClientRect").mockReturnValue({
      x: 90,
      y: 90,
      left: 90,
      top: 90,
      right: 114,
      bottom: 114,
      width: 24,
      height: 24,
      toJSON: () => ({}),
    });
    pointer(grip, "pointerdown", 100, 100, { clientX: 110, clientY: 102 });
    pointer(mount.ownerDocument, "pointermove", 284, 100, {
      clientX: 800,
      clientY: 800,
    });
    expect(guide()!.dataset.insertionIndex).toBe("2");
    pointer(mount.ownerDocument, "pointerup", 284, 100);
    await flush();
    expect(texts()[0]).toEqual(["TABLE_R1C2", "TABLE_R1C1", "TABLE_R1C3"]);
  });

  it("不完整格网或无效scale不安装交互路径", () => {
    dispose();
    for (const scale of [0, -1, NaN, Infinity]) {
      install({ scale });
      expect(mount.querySelector("[data-presentation-reorder]")).toBeNull();
    }
    const invalid = table();
    install({ table: { ...invalid, columns: [NaN, 192, 192] } });
    expect(mount.querySelector("[data-presentation-reorder]")).toBeNull();
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("merged非法guide为not-allowed且不提交，未合并列可合法跨过merged块移动", async () => {
    dispose();
    await setup(
      await modifyStructure(
        await tableFixture({ merged: true }),
        ({ transform }) => transform.setAttribute("rot", "0"),
      ),
    );
    install();
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    pointer(handle("column"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointermove", 500, 100);
    expect(handle("column").style.cursor).toBe("not-allowed");
    expect(handle("column").dataset.reorderValid).toBe("false");
    expect(guide()!.hidden).toBe(true);
    pointer(mount.ownerDocument, "pointerup", 500, 100);
    key(handle("column"), "ArrowRight", true);
    expect(
      interact.mock.calls.filter(([intent]) => intent.type === "reorder"),
    ).toHaveLength(0);
    expect(controller.getSnapshot().canUndo).toBe(false);
    pointer(handle("column", 2), "pointerdown", 500, 100);
    pointer(mount.ownerDocument, "pointerup", -100, 100);
    await flush();
    expect(texts()[0]).toEqual(["TABLE_R1C3", "TABLE_R1C1", ""]);
    expect(table().rows[0].cells[1].gridSpan).toBe(2);
    expect(table().rows[0].cells[1].rowSpan).toBe(2);
    expect(restored).toHaveBeenLastCalledWith({ axis: "column", index: 0 });
    controller.undo();
    await flush();
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it("取消/Escape/错误pointer/no-op/卸载均零重排和零历史", () => {
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    for (const ending of [
      "pointercancel",
      "lostpointercapture",
      "Escape",
      "dispose",
    ]) {
      pointer(handle("column"), "pointerdown", 100, 100);
      pointer(mount.ownerDocument, "pointermove", 500, 100, { pointerId: 2 });
      expect(handle("column").dataset.reordering).toBeUndefined();
      pointer(mount.ownerDocument, "pointermove", 500, 100);
      if (ending === "Escape")
        expect(key(mount.ownerDocument, "Escape").defaultPrevented).toBe(true);
      else if (ending === "dispose") dispose();
      else
        pointer(
          ending === "lostpointercapture"
            ? handle("column")
            : mount.ownerDocument,
          ending,
          500,
          100,
        );
      pointer(mount.ownerDocument, "pointerup", 500, 100);
      if (ending !== "dispose")
        expect(handle("column").dataset.reordering).toBeUndefined();
    }
    expect(
      interact.mock.calls.filter(([intent]) => intent.type === "reorder"),
    ).toHaveLength(0);
    expect(mount.querySelector("[data-presentation-reorder]")).toBeNull();
    expect(controller.getSnapshot().canUndo).toBe(false);
    install();
    select("column", 0);
    pointer(handle("column"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointerup", 104, 100);
    expect(controller.getSnapshot().canUndo).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it("保存/投影锁、document/identity/轨道变化取消旧drag，卸载取消订阅", () => {
    select("column", 0);
    const interact = vi.spyOn(controller.tableEditing, "interact");
    const state = controller.getSnapshot();
    for (const patch of [
      { saving: true },
      { projecting: true },
      { isEditing: false },
      { selectedElementIds: ["other"], primarySelectedElementId: "other" },
      { selectedElementIds: ["7", "2"], primarySelectedElementId: "7" },
      { selectedSlideId: "900" },
      { document: { ...state.document } },
    ]) {
      pointer(handle("column"), "pointerdown", 100, 100);
      const snapshot = vi
        .spyOn(controller, "getSnapshot")
        .mockReturnValue({ ...state, ...patch });
      pointer(mount.ownerDocument, "pointerup", 500, 100);
      key(handle("column"), "ArrowRight", true);
      snapshot.mockRestore();
    }
    pointer(handle("column"), "pointerdown", 100, 100);
    const snapshot = controller.tableEditing.getSnapshot()!;
    const read = vi
      .spyOn(controller.tableEditing, "getSnapshot")
      .mockReturnValue({ ...snapshot, columnWidths: [200, 192, 192] });
    pointer(mount.ownerDocument, "pointerup", 500, 100);
    read.mockRestore();
    pointer(handle("column"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointermove", 500, 100);
    controller.setSelectedElementId(null);
    expect(handle("column").dataset.reordering).toBeUndefined();
    pointer(mount.ownerDocument, "pointerup", 500, 100);
    expect(
      interact.mock.calls.filter(([intent]) => intent.type === "reorder"),
    ).toHaveLength(0);
    expect(controller.getSnapshot().canUndo).toBe(false);
    dispose();
    controller.setSelectedElementId("7");
    expect(mount.querySelector("[data-presentation-reorder]")).toBeNull();
  });
});
