import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { WorkbookController } from "./WorkbookController";
import { WorkbookEditingControls } from "./WorkbookEditingControls";
import { WorkbookGrid } from "./WorkbookGrid";
import { parseCellRange } from "./workbookRange";
import type { WorkbookSnapshot } from "./workbookSnapshot";

// 只补 jsdom 的布局/滚动边界，保留真实虚拟滚动器与 Controller。
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...actual,
    useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) =>
      actual.useVirtualizer({
        ...options,
        initialRect: { width: 600, height: 300 },
        observeElementRect: (_instance, callback) => {
          callback({ width: 600, height: 300 });
        },
        scrollToFn: () => {},
      }),
  };
});
function snapshot(): WorkbookSnapshot {
  return {
    sourceSha256: "a".repeat(64),
    sheets: [
      {
        id: "1",
        name: "Clipboard",
        rowCount: 30,
        columnCount: 10,
        rowHeights: {},
        columnWidths: {},
        merges: [],
        cells: {
          A1: { text: "SOURCE", raw: "SOURCE", style: {} },
          B1: { text: "7", raw: "7", formula: "1+1", style: {} },
          C1: { text: "", raw: "", formula: "2+2", style: {} },
          A2: { text: '  中文\t"quoted"\n한국어  ', raw: "raw", style: {} },
          B2: { text: " tail ", raw: " tail ", style: {} },
        },
      },
    ],
  };
}
function Harness({ controller }: { controller: WorkbookController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  return (
    <>
      <WorkbookEditingControls
        controller={controller}
        state={state}
        onDiscard={() => {}}
      />
      <WorkbookGrid
        sheet={state.document.sheets[0]}
        controller={controller}
        editor={state.editor}
        onSelectionChange={(range) => controller.setSelectionRect("1", range)}
      />
    </>
  );
}
function clipboard(
  type: "copy" | "paste" | "cut",
  values: Record<string, string> = {},
) {
  const data = {
    types: Object.keys(values),
    getData: vi.fn((type: string) => values[type] ?? ""),
    setData: vi.fn((type: string, value: string) => {
      values[type] = value;
    }),
  };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: data });
  return { event, data };
}

describe("Workbook Grid 原生剪贴板所有权", () => {
  let root: Root, host: HTMLDivElement;
  let controller: WorkbookController;
  let write: ReturnType<typeof vi.fn>;
  const grid = () => host.querySelector<HTMLDivElement>('[role="grid"]')!;
  const address = () => host.querySelector<HTMLInputElement>("input")!;
  const show = async (document = snapshot(), selection = "A1:C2") => {
    write = vi.fn();
    controller = new WorkbookController("/tmp/clipboard.xlsx", document, {
      read: vi.fn(),
      write,
    });
    controller.setSelectionRect("1", parseCellRange(selection)!);
    await act(async () => root.render(<Harness controller={controller} />));
  };
  const dispatch = async (
    target: Element,
    transfer: ReturnType<typeof clipboard>,
  ) => {
    await act(async () => {
      target.dispatchEvent(transfer.event);
    });
  };
  const focusGrid = async () => {
    await act(async () => grid().focus());
  };
  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    await changeLimeLocale("zh-CN");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    await changeLimeLocale("zh-CN");
  });

  it("只读矩形 copy 写 text/plain，保留显示缓存与多语言精确文本", async () => {
    await show();
    await focusGrid();
    const transfer = clipboard("copy");
    const before = controller.getSnapshot();
    await dispatch(grid(), transfer);
    expect(transfer.event.defaultPrevented).toBe(true);
    expect(transfer.data.setData).toHaveBeenCalledExactlyOnceWith(
      "text/plain",
      'SOURCE\t7\t""\n"  中文\t""quoted""\n한국어  "\t tail \t""',
    );
    expect(controller.getSnapshot()).toBe(before);
    expect(write).not.toHaveBeenCalled();
  });

  it("paste 使用 plainText 且一次更新选区，不复制选区尺寸、不读取结构 MIME", async () => {
    await show(snapshot(), "D5:E7");
    await act(async () => controller.setEditing(true));
    await focusGrid();
    const notified = vi.fn();
    controller.subscribe(notified);
    const transfer = clipboard("paste", {
      "text/plain": '"繁體\t日本語\n한국어"\t  tail  \t=1+1\nlast\t\'001\t""',
      "text/html": "<script>ignored()</script>",
      "application/x-oai-popcorn-selection+json": '{"values":[["wrong"]]}',
    });
    await dispatch(grid(), transfer);
    expect(transfer.event.defaultPrevented).toBe(true);
    expect(transfer.data.getData).toHaveBeenCalledExactlyOnceWith("text/plain");
    expect(notified).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().selections["1"]).toEqual(
      parseCellRange("D5:F6"),
    );
    expect(address().value).toBe("D5:F6");
    expect(
      host.querySelectorAll('[role="gridcell"][aria-selected="true"]'),
    ).toHaveLength(6);
    expect(controller.getSnapshot().document.sheets[0].cells.F5).toMatchObject({
      formula: "1+1",
      text: "",
    });
    expect(
      controller.getSnapshot().document.sheets[0].cells.D7,
    ).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(grid());
  });

  it("空 plainText 清除单格；未知 MIME、失焦事件和 cut 无业务副作用", async () => {
    await show(snapshot(), "A1");
    await act(async () => controller.setEditing(true));
    await focusGrid();
    const unknown = clipboard("paste", {
      "application/json": '{"values":[["x"]]}',
    });
    const before = controller.getSnapshot();
    await dispatch(grid(), unknown);
    expect(unknown.event.defaultPrevented).toBe(false);
    expect(unknown.data.getData).not.toHaveBeenCalled();
    const cut = clipboard("cut");
    await dispatch(grid(), cut);
    expect(cut.event.defaultPrevented).toBe(false);
    expect(controller.getSnapshot()).toBe(before);
    await act(async () => address().focus());
    const unfocused = clipboard("paste", { "text/plain": "ignored" });
    await dispatch(grid(), unfocused);
    expect(unfocused.event.defaultPrevented).toBe(false);
    expect(unfocused.data.getData).not.toHaveBeenCalled();
    await focusGrid();
    await dispatch(grid(), clipboard("paste", { "text/plain": "" }));
    expect(controller.getSnapshot().document.sheets[0].cells.A1.text).toBe("");
    expect(controller.getSnapshot().selections["1"]).toEqual(
      parseCellRange("A1"),
    );
  });

  it("只读 paste 被拦截但不改稿；merged copy 不覆盖剪贴板，paste 保选区", async () => {
    const source = snapshot();
    source.sheets[0].merges = [parseCellRange("A4:B4")!];
    await show(source, "A4:B4");
    await focusGrid();
    const copied = clipboard("copy");
    await dispatch(grid(), copied);
    expect(copied.event.defaultPrevented).toBe(true);
    expect(copied.data.setData).not.toHaveBeenCalled();
    const readonly = controller.getSnapshot();
    const paste = clipboard("paste", { "text/plain": "a" });
    await dispatch(grid(), paste);
    expect(paste.event.defaultPrevented).toBe(true);
    expect(controller.getSnapshot()).toBe(readonly);
    await act(async () => controller.setEditing(true));
    const before = controller.getSnapshot();
    await dispatch(grid(), clipboard("paste", { "text/plain": "a" }));
    expect(controller.getSnapshot().document).toBe(before.document);
    expect(controller.getSnapshot().selections).toBe(before.selections);
    expect(address().value).toBe("A4:B4");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "无法粘贴",
    );
  });

  it("格内与公式输入拥有自身 copy/paste，grid 不拦截或提交活跃输入", async () => {
    await show(snapshot(), "A1");
    await act(async () => {
      controller.setEditing(true);
      controller.openCellEditor("1", "A1", "native draft");
    });
    const input = host.querySelector<HTMLInputElement>(
      '[data-address="A1"] input',
    )!;
    expect(document.activeElement).toBe(input);
    const before = controller.getSnapshot();
    for (const type of ["copy", "paste"] as const) {
      const transfer = clipboard(type, { "text/plain": "native input" });
      await dispatch(input, transfer);
      expect(transfer.event.defaultPrevented).toBe(false);
      expect(transfer.data.getData).not.toHaveBeenCalled();
      expect(transfer.data.setData).not.toHaveBeenCalled();
      expect(controller.getSnapshot()).toBe(before);
    }
    const formula = host.querySelector<HTMLInputElement>(
      'input[aria-label="公式或原始值"]',
    )!;
    expect(formula).not.toBeNull();
    await act(async () => formula.focus());
    const formulaDraft = controller.getSnapshot();
    const pasted = clipboard("paste", { "text/plain": "formula input" });
    await dispatch(formula, pasted);
    expect(pasted.event.defaultPrevented).toBe(false);
    expect(pasted.data.getData).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toBe(formulaDraft);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ["zh-CN", "无法粘贴此内容。请检查矩形范围、单元格内容和合并单元格。"],
    ["zh-TW", "無法貼上此內容。請檢查矩形範圍、儲存格內容與合併儲存格。"],
    [
      "en-US",
      "Unable to paste this content. Check the rectangular range, cell contents, and merged cells.",
    ],
    [
      "ja-JP",
      "この内容を貼り付けられません。長方形の範囲、セルの内容、結合セルを確認してください。",
    ],
    [
      "ko-KR",
      "이 내용을 붙여넣을 수 없습니다. 직사각형 범위, 셀 내용, 병합된 셀을 확인하세요.",
    ],
  ] as const)(
    "%s 拒绝内容显示已翻译的稳定错误且不清草稿",
    async (locale, message) => {
      await changeLimeLocale(locale);
      await show(snapshot(), "A1");
      await act(async () => controller.setEditing(true));
      await focusGrid();
      await dispatch(grid(), clipboard("paste", { "text/plain": "kept" }));
      const before = controller.getSnapshot();
      await dispatch(grid(), clipboard("paste", { "text/plain": "a\tb\nc" }));
      const alert = host.querySelector('[role="alert"]')?.textContent;
      expect(alert).toBe(message);
      expect(controller.getSnapshot().document).toBe(before.document);
      expect(controller.getSnapshot().edits).toBe(before.edits);
      expect(controller.getSnapshot().selections).toBe(before.selections);
    },
  );
});
