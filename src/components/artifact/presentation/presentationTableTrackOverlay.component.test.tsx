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
import { installPresentationTableTrackOverlay } from "./presentationTableTrackOverlay";

describe("父文档安装的表格轨道原生separator", () => {
  let controller: PresentationController;
  let mount: HTMLDivElement;
  let frame: HTMLIFrameElement;
  let dispose = () => {};
  let writes: ReturnType<typeof vi.fn>;
  const restored = vi.fn();
  const labels = {
    row: (index: number) => `Resize row ${index + 1}`,
    column: (index: number) =>
      `Resize column ${String.fromCharCode(65 + index)}`,
    pixels: (size: number) => `${size} pixels`,
  };
  const table = () => {
    const value = presentationElements(
      controller.getSnapshot().document,
      "512",
    ).find((element) => element.id === "7");
    if (value?.nodeType !== "table") throw new Error("missing table");
    return value;
  };
  const handle = (axis: "row" | "column", index = 0) =>
    mount.querySelector<HTMLButtonElement>(
      `[data-presentation-track="${axis}:${index}"]`,
    )!;
  const install = (
    options: Partial<
      Parameters<typeof installPresentationTableTrackOverlay>[0]
    > = {},
  ) => {
    dispose();
    dispose = installPresentationTableTrackOverlay({
      mount,
      controller,
      table: table(),
      scale: 1,
      labels,
      onFocusRestore: restored,
      ...options,
    });
  };
  const key = (target: HTMLElement, value: string, shiftKey = false) => {
    const event = new KeyboardEvent("keydown", {
      key: value,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  };
  const pointer = (
    target: EventTarget,
    type: string,
    screenX: number,
    screenY: number,
    options: { pointerId?: number; clientX?: number; clientY?: number } = {},
  ) => {
    const event = new MouseEvent(type, {
      screenX,
      screenY,
      clientX: options.clientX ?? screenX,
      clientY: options.clientY ?? screenY,
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "pointerId", {
      value: options.pointerId ?? 1,
    });
    target.dispatchEvent(event);
    return event;
  };
  const setup = async (bytes: Uint8Array) => {
    let disk = bytes;
    writes = vi.fn(async (_path: string, next: Uint8Array) => {
      disk = next;
    });
    controller = new PresentationController(
      "/workspace/table.pptx",
      await importPresentationDocument(bytes, new AbortController().signal),
      { read: vi.fn(async () => disk), write: writes },
    );
    controller.setEditingEnabled(true);
    controller.setSelectedElementId("7");
  };
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

  it("每轨一个原生button，ARIA值/方向/min与静态md证据一致，不开放iframe脚本", () => {
    expect(mount.querySelectorAll('button[role="separator"]')).toHaveLength(5);
    expect(handle("column").getAttribute("aria-label")).toBe("Resize column A");
    expect(handle("column").getAttribute("aria-orientation")).toBe("vertical");
    expect(handle("column").getAttribute("aria-valuemin")).toBe("24");
    expect(handle("row").getAttribute("aria-orientation")).toBe("horizontal");
    expect(handle("row").getAttribute("aria-valuemin")).toBe("20");
    expect(handle("row").getAttribute("aria-valuenow")).toBe("96");
    expect(handle("row").getAttribute("aria-valuemax")).toBe("10000");
    expect(handle("row").getAttribute("aria-valuetext")).toBe("96 pixels");
    expect(handle("column").style.left).toBe("188px");
    expect(handle("row").style.top).toBe("92px");
    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(mount.querySelector("script")).toBeNull();
    expect(writes).not.toHaveBeenCalled();
  });

  it("键盘按当前snapshot精确1px/Shift10px修改单轨", async () => {
    const bubbled = vi.fn();
    mount.addEventListener("keydown", bubbled);
    expect(key(handle("column"), "ArrowRight").defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([193, 192, 192]);
    install();
    key(handle("column"), "ArrowLeft", true);
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([183, 192, 192]);
    install();
    key(handle("row"), "ArrowUp");
    expect(await controller.flushEdits()).toBe(true);
    expect(table().rows.map((row) => row.height)).toEqual([95, 96]);
    install();
    key(handle("row"), "ArrowDown", true);
    expect(await controller.flushEdits()).toBe(true);
    expect(table().rows.map((row) => row.height)).toEqual([105, 96]);
    expect(restored.mock.calls.map(([target]) => target)).toEqual([
      { axis: "column", index: 0 },
      { axis: "column", index: 0 },
      { axis: "row", index: 0 },
      { axis: "row", index: 0 },
    ]);
    expect(writes).not.toHaveBeenCalled();
  });

  it("键盘在row20/column24px minimum处零历史", async () => {
    controller.tableEditing.edit({
      type: "resize-column",
      tableId: "7",
      index: 0,
      size: 24,
    });
    expect(await controller.flushEdits()).toBe(true);
    controller.tableEditing.edit({
      type: "resize-row",
      tableId: "7",
      index: 0,
      size: 20,
    });
    expect(await controller.flushEdits()).toBe(true);
    install();
    const edit = vi.spyOn(controller.tableEditing, "edit");
    key(handle("column"), "ArrowLeft", true);
    key(handle("row"), "ArrowUp", true);
    expect(edit).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it("屏幕增量逆旋转/flip/scale，pointer-move只预览separator，up单次提交且可一次撤销", async () => {
    dispose();
    await setup(
      await modifyStructure(await structureFixture(), ({ transform }) => {
        transform.setAttribute("rot", "5400000");
      }),
    );
    install({ scale: 2 });
    const edit = vi.spyOn(controller.tableEditing, "edit");
    const separator = handle("column");
    pointer(separator, "pointerdown", 400, 400);
    expect(mount.ownerDocument.activeElement).toBe(separator);
    pointer(mount.ownerDocument, "pointermove", 400, 320);
    expect(table().columns).toEqual([80, 160, 240]);
    expect(separator.getAttribute("aria-valuenow")).toBe("120");
    expect(separator.style.left).toBe("116px");
    expect(edit).not.toHaveBeenCalled();
    pointer(mount.ownerDocument, "pointerup", 400, 320);
    pointer(mount.ownerDocument, "pointerup", 400, 320);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledWith({
      type: "resize-column",
      tableId: "7",
      index: 0,
      size: 120,
    });
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([120, 160, 240]);
    expect(table().size.w).toBe(520);
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([80, 160, 240]);
    expect(controller.getSnapshot().dirty).toBe(false);
    install({ scale: 2, measureMinimumRowHeights: () => [20, 20] });
    pointer(handle("row"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointerup", 140, 100);
    expect(await controller.flushEdits()).toBe(true);
    expect(table().rows.map((row) => row.height)).toEqual([92, 120]);
    expect(table().size.h).toBe(212);
    expect(writes).not.toHaveBeenCalled();
  });

  it("活动文字提交与单轨resize统一委托Controller，并共享有序可撤销历史", async () => {
    controller.textActivateBlockEnd({ tableId: "7", row: 0, column: 0 });
    controller.textHandleInput("活动中文 <&>");
    const commit = vi.spyOn(controller, "commitTextEdit");
    key(handle("column"), "ArrowRight");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([193, 192, 192]);
    expect(presentationTextBodyText(table().rows[0].cells[0].textBody!)).toBe(
      "活动中文 <&>",
    );
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(table().columns).toEqual([192, 192, 192]);
    expect(presentationTextBodyText(table().rows[0].cells[0].textBody!)).toBe(
      "活动中文 <&>",
    );
    controller.undo();
    expect(await controller.flushEdits()).toBe(true);
    expect(presentationTextBodyText(table().rows[0].cells[0].textBody!)).toBe(
      "TABLE_R1C1",
    );
    expect(controller.getSnapshot().dirty).toBe(false);
    expect(writes).not.toHaveBeenCalled();
  });

  it("pointercancel、异pointer和布局client坐标变化不制造历史；卸载清理document监听器", () => {
    const edit = vi.spyOn(controller.tableEditing, "edit");
    const separator = handle("column");
    pointer(separator, "pointerdown", 100, 100, { clientY: 10 });
    pointer(mount.ownerDocument, "pointermove", 160, 100, { pointerId: 2 });
    expect(separator.getAttribute("aria-valuenow")).toBe("192");
    pointer(mount.ownerDocument, "pointermove", 160, 100);
    expect(separator.dataset.resizing).toBe("true");
    pointer(mount.ownerDocument, "pointercancel", 160, 100);
    expect(separator.style.left).toBe("188px");
    expect(separator.getAttribute("aria-valuenow")).toBe("192");
    expect(separator.dataset.resizing).toBeUndefined();
    pointer(separator, "pointerdown", 100, 100, { clientY: 500 });
    pointer(mount.ownerDocument, "pointerup", 100, 100, { clientY: 5 });
    expect(edit).not.toHaveBeenCalled();
    pointer(separator, "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointermove", 160, 100);
    dispose();
    pointer(mount.ownerDocument, "pointerup", 160, 100);
    expect(mount.querySelector('[role="separator"]')).toBeNull();
    expect(edit).not.toHaveBeenCalled();
    expect(controller.getSnapshot().canUndo).toBe(false);
  });

  it("没有完整行内容测量时row pointer明确禁止；可信测量按当前列宽与20px最小值调用", async () => {
    const edit = vi.spyOn(controller.tableEditing, "edit");
    const row = handle("row");
    expect(row.dataset.pointerResize).toBe("unavailable");
    pointer(row, "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointermove", 100, 200);
    pointer(mount.ownerDocument, "pointerup", 100, 200);
    expect(row.dataset.resizing).toBeUndefined();
    expect(edit).not.toHaveBeenCalled();
    const measure = vi.fn(() => [70, 50]);
    install({ measureMinimumRowHeights: measure });
    pointer(handle("row"), "pointerdown", 100, 100);
    pointer(mount.ownerDocument, "pointerup", 100, -100);
    expect(measure).toHaveBeenCalledWith({
      columnWidths: [192, 192, 192],
      minimumRowHeight: 20,
    });
    expect(edit).toHaveBeenCalledWith({
      type: "resize-row",
      tableId: "7",
      index: 0,
      size: 70,
    });
    expect(await controller.flushEdits()).toBe(true);
    expect(table().rows.map((row) => row.height)).toEqual([70, 96]);
    expect(writes).not.toHaveBeenCalled();
  });

  it("投影/保存锁、陈旧document或中途变化tracks拒绝提交，并拒绝不完整row测量", () => {
    const edit = vi.spyOn(controller.tableEditing, "edit");
    const real = controller.getSnapshot();
    for (const blocked of [
      { ...real, saving: true },
      { ...real, projecting: true },
      { ...real, primarySelectedElementId: "another" },
      { ...real, document: { ...real.document } },
    ]) {
      const snapshot = vi
        .spyOn(controller, "getSnapshot")
        .mockReturnValue(blocked);
      key(handle("column"), "ArrowRight");
      pointer(handle("column"), "pointerdown", 100, 100);
      pointer(mount.ownerDocument, "pointerup", 200, 100);
      snapshot.mockRestore();
    }
    pointer(handle("column"), "pointerdown", 100, 100);
    const current = controller.tableEditing.getSnapshot()!;
    const snapshot = vi
      .spyOn(controller.tableEditing, "getSnapshot")
      .mockReturnValue({ ...current, columnWidths: [200, 192, 192] });
    pointer(mount.ownerDocument, "pointerup", 200, 100);
    snapshot.mockRestore();
    for (const heights of [null, [20], [NaN, 20], [19, 20]]) {
      install({ measureMinimumRowHeights: () => heights });
      pointer(handle("row"), "pointerdown", 100, 100);
      pointer(mount.ownerDocument, "pointerup", 100, 200);
    }
    expect(edit).not.toHaveBeenCalled();
    expect(controller.getSnapshot().canUndo).toBe(false);
  });
});
