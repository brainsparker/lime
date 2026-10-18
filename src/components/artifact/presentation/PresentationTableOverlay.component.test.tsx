import { presentationEditorText } from "./presentationTextEditor";
import { webcrypto } from "node:crypto";
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { PresentationController } from "./PresentationController";
import { PresentationTableControls } from "./PresentationTableControls";
import { usePresentationEditingOverlay } from "./usePresentationEditingOverlay";
import { importPresentationDocument } from "./presentationDocument";
import { tableFixture, tableId } from "./presentationTablePackage.testFixtures";
import {
  presentationElements,
  presentationTextBodyText,
} from "./presentationElements";

describe("真实表格文档的选区、受限iframe文字输入与控件接线", () => {
  let root: Root;
  let host: HTMLDivElement;
  let frame: HTMLIFrameElement;
  let slide: HTMLDivElement;
  let controller: PresentationController;
  let disk: Uint8Array;
  let writes: ReturnType<typeof vi.fn>;
  function Harness() {
    const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    );
    usePresentationEditingOverlay(slide, 1, controller, state);
    return (
      <PresentationTableControls
        controller={controller}
        disabled={state.saving || state.projecting}
      />
    );
  }
  const cell = (row = 0, column = 0) =>
    slide.querySelector<HTMLButtonElement>(
      `[data-presentation-cell="${row}:${column}"]`,
    )!;
  const input = () =>
    slide.querySelector<HTMLElement>("[data-presentation-text-editor]")!;
  const key = (
    target: HTMLElement,
    value: string,
    extra: ConstructorParameters<typeof KeyboardEvent>[1] = {},
  ) =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: value,
        ...extra,
      }),
    );
  const pointer = (target: HTMLElement, shiftKey = false) => {
    const event = new MouseEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      shiftKey,
    });
    target.dispatchEvent(event);
    return event;
  };
  const selectedText = () => {
    const node = presentationElements(
      controller.getSnapshot().document,
      "512",
    ).find((node) => node.id === tableId)!;
    if (node.nodeType !== "table") throw new Error("expected table");
    return node.rows.map((row) =>
      row.cells.map(
        (cell) => cell.textBody && presentationTextBodyText(cell.textBody),
      ),
    );
  };
  const settle = async () => {
    await act(async () => expect(await controller.flushEdits()).toBe(true));
  };
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", webcrypto);
    await changeLimeLocale("zh-CN");
    disk = await tableFixture();
    writes = vi.fn(async (_path: string, bytes: Uint8Array) => {
      disk = bytes.slice();
    });
    controller = new PresentationController(
      "/workspace/table.pptx",
      await importPresentationDocument(disk, new AbortController().signal),
      { read: vi.fn(async () => disk), write: writes },
    );
    controller.setEditingEnabled(true);
    controller.setSelectedElementId(tableId);
    host = document.createElement("div");
    frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    document.body.append(host, frame);
    slide = frame.contentDocument!.createElement("div");
    frame.contentDocument!.body.append(slide);
    root = createRoot(host);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    frame.remove();
    vi.unstubAllGlobals();
  });

  it("指针选中不重建按钮，双击激活单元格，重复激活不丢活动中文稿", async () => {
    const first = cell();
    await act(async () => pointer(first));
    expect(cell()).toBe(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    await act(async () =>
      first.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(presentationEditorText(input())).toBe("TABLE_R1C1");
    await act(async () => {
      input().dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      input().textContent = "单元格中文\n<&>";
      input().dispatchEvent(new Event("input", { bubbles: true }));
      key(input(), "Enter", { ctrlKey: true, isComposing: true });
      controller.textActivateBlockEnd({ tableId, row: 0, column: 0 });
    });
    expect(presentationEditorText(input())).toBe("单元格中文\n<&>");
    expect(writes).not.toHaveBeenCalled();
    expect(selectedText()[0][0]).toBe("TABLE_R1C1");
    await act(async () => {
      input().dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      );
      key(input(), "Enter", { ctrlKey: true });
    });
    await settle();
    expect(input()).toBeNull();
    expect(selectedText()[0][0]).toBe("单元格中文\n<&>");
    expect(selectedText()[0][1]).toBe("TABLE_R1C2");
    await act(async () =>
      expect(await controller.flushPublicFile()).toBe(true),
    );
    expect(writes).toHaveBeenCalledTimes(1);
  });

  it.each(["metaKey", "ctrlKey"] as const)(
    "对象指针交互完成后点击cell拥有焦点，%s+A只全选该表不扩展对象集合",
    async (modifier) => {
      await act(async () => controller.setSelectedElementId(null));
      const object = slide.querySelector<HTMLButtonElement>(
        `[data-presentation-element-id="${tableId}"]`,
      )!;
      await act(async () => pointer(object));
      expect(controller.getSnapshot().elementInteraction).not.toBeNull();
      expect(frame.contentDocument!.activeElement).toBe(object);
      expect(cell()).toBeNull();
      await act(async () => {
        frame.contentDocument!.dispatchEvent(
          new MouseEvent("pointerup", { bubbles: true, button: 0 }),
        );
      });
      expect(controller.getSnapshot().elementInteraction).toBeNull();
      const target = cell();
      expect(target).not.toBeNull();
      await act(async () => pointer(target));
      await act(async () =>
        key(frame.contentDocument!.activeElement as HTMLElement, "a", {
          [modifier]: true,
        }),
      );
      expect(controller.getSnapshot().selectedElementIds).toEqual([tableId]);
      expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
        row: 0,
        column: 0,
        rowCount: 2,
        columnCount: 3,
      });
      expect(frame.contentDocument!.activeElement).toBe(target);
      expect(
        slide.querySelectorAll('[data-presentation-cell][aria-pressed="true"]'),
      ).toHaveLength(6);
      expect(
        host.querySelector('[data-testid="presentation-table-controls"]'),
      ).not.toBeNull();
      expect(controller.getSnapshot()).toMatchObject({
        dirty: false,
        canUndo: false,
      });
      expect(writes).not.toHaveBeenCalled();
    },
  );

  it("方向键与Shift扩展选区并保留活动格焦点，清空只作用选区且可撤销", async () => {
    await act(async () => {
      pointer(cell());
      cell().focus();
    });
    await act(async () => key(cell(), "ArrowRight", { shiftKey: true }));
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 0,
      rowCount: 1,
      columnCount: 2,
    });
    expect(frame.contentDocument!.activeElement).toBe(cell(0, 1));
    await act(async () => key(cell(0, 1), "Delete"));
    await settle();
    expect(selectedText()[0]).toEqual(["", "", "TABLE_R1C3"]);
    expect(selectedText()[1][0]).toBe("TABLE_R2C1");
    await act(async () => key(cell(0, 1), "z", { ctrlKey: true }));
    await settle();
    expect(selectedText()[0]).toEqual([
      "TABLE_R1C1",
      "TABLE_R1C2",
      "TABLE_R1C3",
    ]);
    await act(async () => key(cell(0, 1), "Tab"));
    expect(frame.contentDocument!.activeElement).toBe(cell(0, 2));
  });

  it("轨道键盘调整后在新投影恢复分隔条焦点，保存与撤销仍走同一历史", async () => {
    const track = () =>
      slide.querySelector<HTMLButtonElement>(
        '[data-presentation-track="column:0"]',
      )!;
    const original = controller.tableEditing.getSnapshot()!.columnWidths[0];
    await act(async () => {
      track().focus();
      key(track(), "ArrowRight", { shiftKey: true });
    });
    await settle();
    expect(controller.tableEditing.getSnapshot()!.columnWidths[0]).toBeCloseTo(
      original + 10,
    );
    expect(frame.contentDocument!.activeElement).toBe(track());
    expect(track().getAttribute("role")).toBe("separator");
    expect(track().getAttribute("aria-valuetext")).toContain("像素");
    await act(async () => {
      key(track(), "s", { ctrlKey: true });
      expect(await controller.flushPublicFile()).toBe(true);
    });
    expect(writes).toHaveBeenCalledTimes(1);
    await act(async () => key(track(), "z", { ctrlKey: true }));
    await settle();
    expect(controller.tableEditing.getSnapshot()!.columnWidths[0]).toBeCloseTo(
      original,
    );
    expect(frame.contentDocument!.activeElement).toBe(track());
    expect(selectedText()[0][0]).toBe("TABLE_R1C1");
  });

  it("重排手柄Alt方向键后选择目标整列并恢复手柄焦点，撤销保留原格内容", async () => {
    const grip = (column: number) =>
      slide.querySelector<HTMLButtonElement>(
        `[data-presentation-reorder="column:${column}"]`,
      )!;
    await act(async () => {
      pointer(cell());
      grip(0).focus();
      key(grip(0), "ArrowRight", { altKey: true });
    });
    await settle();
    expect(selectedText()[0]).toEqual([
      "TABLE_R1C2",
      "TABLE_R1C1",
      "TABLE_R1C3",
    ]);
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 1,
      rowCount: 2,
      columnCount: 1,
    });
    expect(frame.contentDocument!.activeElement).toBe(grip(1));
    expect(grip(1).getAttribute("aria-label")).toContain("B");
    await act(async () => key(grip(1), "z", { ctrlKey: true }));
    await settle();
    expect(selectedText()[0]).toEqual([
      "TABLE_R1C1",
      "TABLE_R1C2",
      "TABLE_R1C3",
    ]);
    expect(frame.contentDocument!.activeElement).toBe(grip(1));
  });

  it("活动文字与样式共享有序历史，普通blur提交并支持取消", async () => {
    await act(async () => {
      pointer(cell());
      key(cell(), "F2");
    });
    await act(async () => {
      input().textContent = "TEXT_THEN_STYLE";
      input().dispatchEvent(new Event("input", { bubbles: true }));
      host.querySelector<HTMLButtonElement>("button[aria-pressed]")!.click();
    });
    await settle();
    expect(selectedText()[0][0]).toBe("TEXT_THEN_STYLE");
    expect(controller.tableEditing.getSnapshot()?.style.bold).toBe(true);
    await act(async () => key(cell(0, 1), "ArrowRight"));
    await act(async () => key(cell(0, 1), "Enter"));
    await act(async () => {
      input().textContent = "BLUR_COMMIT";
      input().dispatchEvent(new Event("input", { bubbles: true }));
      input().dispatchEvent(new FocusEvent("blur"));
    });
    await settle();
    expect(selectedText()[0][1]).toBe("BLUR_COMMIT");
    await act(async () => key(cell(0, 1), "F2"));
    await act(async () => {
      input().textContent = "CANCEL_ME";
      input().dispatchEvent(new Event("input", { bubbles: true }));
      key(input(), "Escape");
    });
    expect(selectedText()[0][1]).toBe("BLUR_COMMIT");
  });

  it("末格Tab新增行后保留新行首格焦点，行列控件可操作且末行删除禁用", async () => {
    await act(async () => {
      pointer(cell(1, 2));
      cell(1, 2).focus();
    });
    await act(async () => key(cell(1, 2), "Tab"));
    await settle();
    expect(cell(2, 0)).not.toBeNull();
    expect(frame.contentDocument!.activeElement).toBe(cell(2, 0));
    const openMenu = () =>
      host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    const action = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (item) => item.textContent === name,
      )!;
    await act(async () => key(openMenu(), "ArrowDown"));
    expect(action("在左侧插入列")).toBeDefined();
    await act(async () => action("在左侧插入列").click());
    await settle();
    expect(controller.tableEditing.getSnapshot()?.columnCount).toBe(4);
    await act(async () => key(cell(2, 0), "a", { ctrlKey: true }));
    await act(async () => key(openMenu(), "ArrowDown"));
    expect(action("删除所选行").getAttribute("aria-disabled")).toBe("true");
    expect(action("删除所选列").getAttribute("aria-disabled")).toBe("true");
    await act(async () => key(action("在左侧插入列"), "Escape"));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(openMenu()));
    expect(writes).not.toHaveBeenCalled();
  });

  it("菜单合并与解除后恢复独立单元格、原文与共用历史", async () => {
    await act(async () => pointer(cell()));
    await act(async () => pointer(cell(1, 1), true));
    const menu = () =>
      host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    const item = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (node) => node.textContent === name,
      )!;
    await act(async () => key(menu(), "ArrowDown"));
    expect(item("合并单元格").getAttribute("aria-disabled")).not.toBe("true");
    await act(async () => item("合并单元格").click());
    await settle();
    expect(cell(1, 1)).toBeNull();
    expect(controller.tableEditing.getSnapshot()).toMatchObject({
      canMerge: false,
      canUnmerge: true,
    });
    await act(async () => {
      expect(await controller.flushPublicFile()).toBe(true);
    });
    await act(async () => key(menu(), "ArrowDown"));
    expect(item("合并单元格").getAttribute("aria-disabled")).toBe("true");
    await act(async () => item("取消合并").click());
    await settle();
    expect(cell(1, 1)).not.toBeNull();
    expect(selectedText()[1][1]).toBe("TABLE_R2C2");
    await act(async () => controller.undo());
    await settle();
    expect(cell(1, 1)).toBeNull();
    await act(async () => controller.redo());
    await settle();
    expect(cell(1, 1)).not.toBeNull();
    expect(selectedText()[0][1]).toBe("TABLE_R1C2");
  });

  it("保存先移除旧renderer DOM仍恢复grip焦点，投影捕获不覆盖显式重排destination", async () => {
    const grip = (index: number) =>
      slide.querySelector<HTMLButtonElement>(
        `[data-presentation-reorder="column:${index}"]`,
      )!;
    await act(async () => {
      pointer(cell());
      grip(0).focus();
      key(grip(0), "ArrowRight", { altKey: true });
    });
    await settle();
    expect(frame.contentDocument!.activeElement).toBe(grip(1));
    expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
      row: 0,
      column: 1,
      rowCount: 2,
      columnCount: 1,
    });
    let rendered = controller.getSnapshot().document;
    const unsubscribe = controller.subscribe(() => {
      const next = controller.getSnapshot().document;
      if (next !== rendered) {
        rendered = next;
        slide.replaceChildren();
      }
    });
    try {
      await act(async () =>
        expect(await controller.flushPublicFile()).toBe(true),
      );
      expect(writes).toHaveBeenCalledTimes(1);
      expect(frame.contentDocument!.activeElement).toBe(grip(1));
      expect(grip(1).getAttribute("aria-pressed")).toBe("true");
      expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
        row: 0,
        column: 1,
        rowCount: 2,
        columnCount: 1,
      });
      await act(async () => key(grip(1), "ArrowLeft", { altKey: true }));
      await settle();
      expect(frame.contentDocument!.activeElement).toBe(grip(0));
      expect(controller.tableEditing.getSnapshot()?.selection?.range).toEqual({
        row: 0,
        column: 0,
        rowCount: 2,
        columnCount: 1,
      });
      expect(selectedText()[0][0]).toBe("TABLE_R1C1");
    } finally {
      unsubscribe();
    }
  });

  it("普通pointer切换cell不会用旧grip焦点覆盖用户的新焦点", async () => {
    await act(async () => pointer(cell()));
    const grip = slide.querySelector<HTMLButtonElement>(
      '[data-presentation-reorder="column:0"]',
    )!;
    await act(async () => {
      grip.click();
      grip.focus();
    });
    await act(async () => {
      cell(1, 2).focus();
      pointer(cell(1, 2));
    });
    expect(frame.contentDocument!.activeElement).toBe(cell(1, 2));
    expect(controller.tableEditing.getSnapshot()?.activeCell).toMatchObject({
      row: 1,
      column: 2,
    });
    expect(controller.getSnapshot().dirty).toBe(false);
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
    "%s 提供已翻译的单元格及动作语义，不产生空改动",
    async (locale) => {
      await act(async () => {
        pointer(cell());
      });
      await act(async () => changeLimeLocale(locale));
      expect(cell().getAttribute("aria-label")).not.toContain("workspace.");
      const controls = host.querySelector(
        '[data-testid="presentation-table-controls"]',
      )!;
      expect(controls.getAttribute("aria-label")).not.toContain("workspace.");
      expect(controls.textContent).not.toContain("workspace.");
      await act(async () =>
        key(
          host.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!,
          "ArrowDown",
        ),
      );
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      expect(menu.getAttribute("aria-label")).not.toContain("workspace.");
      expect(menu.textContent).not.toContain("workspace.");
      await act(async () => key(menu, "Escape"));
      await act(async () =>
        host
          .querySelector<HTMLInputElement>('input[type="number"]')!
          .dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
      );
      expect(controller.getSnapshot().dirty).toBe(false);
      expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
    },
  );
});
