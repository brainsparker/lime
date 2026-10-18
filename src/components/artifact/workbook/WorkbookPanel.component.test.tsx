import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createStore, Provider } from "jotai";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { WorkbookPanel } from "./WorkbookPanel";
import { WorkbookImportError, type WorkbookSnapshot } from "./workbookSnapshot";
import {
  ArtifactCommentSubmissionContext,
  type ArtifactCommentSubmission,
} from "../ArtifactCommentSubmissionContext";
import { ArtifactAnnotationDraftStore } from "../annotations/ArtifactAnnotationDraftStore";
import { ArtifactAnnotationComposerAccessory } from "../annotations/ArtifactAnnotationComposerAccessory";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./loadWorkbookDocument", () => ({ loadWorkbookDocument: mocks.load }));
// 保留真实虚拟滚动器，仅补足 jsdom 缺失的窗口尺寸与原生滚动。
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
const snapshot = (name = "预算"): WorkbookSnapshot => ({
  sourceSha256: "a".repeat(64),
  sheets: [
    {
      id: "1",
      name,
      rowCount: 1200,
      columnCount: 30,
      rowHeights: { 5: 0 },
      columnWidths: { 4: 0 },
      merges: [{ start: { row: 1, column: 1 }, end: { row: 1, column: 3 } }],
      cells: {
        A1: {
          text: "年度预算",
          raw: "年度预算",
          style: { fontWeight: 700, backgroundColor: "#FDE68A" },
        },
        B4: {
          text: "$1,484.50",
          raw: "1484.5",
          formula: "SUM(B2:B3)",
          style: {},
        },
        A6: { text: "<img src=x onerror=alert(1)>", raw: "text", style: {} },
      },
    },
    {
      id: "2",
      name: "明细",
      rowCount: 30,
      columnCount: 10,
      rowHeights: {},
      columnWidths: {},
      merges: [],
      cells: { A1: { text: "真实明细", raw: "真实明细", style: {} } },
    },
  ],
});

describe("WorkbookPanel 只读交互与生命周期", () => {
  let root: Root, container: HTMLDivElement;
  let appStore: ReturnType<typeof createStore>;
  let submission: ArtifactCommentSubmission | null;
  const show = (path = "/tmp/current.xlsx", key = "1") =>
    act(async () => {
      root.render(
        <Provider store={appStore}>
          <ArtifactCommentSubmissionContext.Provider value={submission}>
            <WorkbookPanel
              path={path}
              title="Report.xlsx"
              previewRequestKey={key}
            />
            <ArtifactAnnotationComposerAccessory />
          </ArtifactCommentSubmissionContext.Provider>
        </Provider>,
      );
    });
  const cell = (address: string) =>
    container.querySelector<HTMLDivElement>(`[data-address="${address}"]`)!;
  const button = () => container.querySelector<HTMLButtonElement>("button")!;
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    submission = null;
    appStore = createStore();
    await changeLimeLocale("zh-CN");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.load.mockReset().mockImplementation(() => ({
      promise: Promise.resolve(snapshot()),
      destroy: vi.fn(),
    }));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    await changeLimeLocale("zh-CN");
  });

  it("显式编辑、IME确认、Enter提交和Escape取消；卸载后保留草稿与原sheet/选区", async () => {
    await show();
    const controls = () =>
      container.querySelector('[data-testid="workbook-editing-controls"]')!;
    await act(async () =>
      controls().querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(
      container.querySelector('[role="grid"]')?.getAttribute("aria-readonly"),
    ).toBe("false");
    await act(async () =>
      cell("B4").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    let editor = cell("B4").querySelector<HTMLInputElement>("input")!;
    expect(editor.value).toBe("=SUM(B2:B3)");
    const change = async (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(editor, value);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await change("123.5");
    await act(async () =>
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
        }),
      ),
    );
    expect(cell("B4").querySelector("input")).toBe(editor);
    await act(async () =>
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(cell("B4").textContent).toBe("123.5");
    expect(
      container
        .querySelector('[role="grid"]')
        ?.getAttribute("aria-activedescendant"),
    ).toBe("workbook-1-B6");
    await act(async () =>
      cell("B4").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    editor = cell("B4").querySelector<HTMLInputElement>("input")!;
    await change("canceled");
    await act(async () =>
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(cell("B4").textContent).toBe("123.5");
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click(),
    );
    await act(async () =>
      cell("B2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    );
    await act(async () =>
      cell("B2").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    editor = cell("B2").querySelector<HTMLInputElement>("input")!;
    await change("survive unmount");
    await act(async () => root.render(null));
    await show();
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe("明细");
    expect(cell("B2").querySelector<HTMLInputElement>("input")?.value).toBe(
      "survive unmount",
    );
    expect(controls().getAttribute("data-dirty")).toBe("true");
  });

  it("真实虚拟滚动下显示合并和缓存值、公式栏，脚本样文本不执行", async () => {
    await show();
    expect(container.querySelector("section")?.dataset.status).toBe("ready");
    expect(cell("A1").getAttribute("aria-colspan")).toBe("3");
    expect(cell("A1").style.backgroundColor).toBe("rgb(253, 230, 138)");
    expect(cell("A1").classList.contains("bg-background")).toBe(false);
    expect(cell("B4").classList.contains("bg-background")).toBe(true);
    expect(cell("B1")).toBeNull();
    expect(cell("B4").textContent).toBe("$1,484.50");
    await act(async () =>
      cell("B4").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    );
    expect(container.querySelector("[role=textbox]")?.textContent).toBe(
      "=SUM(B2:B3)",
    );
    expect(container.querySelector("input")?.value).toBe("B4");
    expect(container.querySelector("img,script,a")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(container.querySelectorAll("[role=gridcell]").length).toBeLessThan(
      200,
    );
    expect(
      container.querySelector("[role=grid]")?.getAttribute("aria-readonly"),
    ).toBe("true");
  });

  it("键盘跳过合并与隐藏列/行，位置输入校验不抢其他控件焦点", async () => {
    await show();
    const grid = container.querySelector<HTMLDivElement>("[role=grid]")!;
    await act(async () =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(container.querySelector("input")?.value).toBe("E1");
    const input = container.querySelector<HTMLInputElement>("input")!;
    const change = (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await change("B4");
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(container.querySelector("[role=textbox]")?.textContent).toBe(
      "=SUM(B2:B3)",
    );
    await act(async () =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    expect(input.value).toBe("B6");
    await change("XFE1");
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>("[role=tab]")[1].click(),
    );
    expect(container.textContent).toContain("真实明细");
    expect(input).not.toBe(container.querySelector("input"));
    expect(mocks.load).toHaveBeenCalledOnce();
  });

  it("真实范围选择、跨页签回原位置与失败保稿共用 Composer 草稿 owner", async () => {
    const drafts = new ArtifactAnnotationDraftStore();
    const submit = vi
      .fn<ArtifactCommentSubmission["submit"]>()
      .mockResolvedValue("rejected");
    submission = {
      scopeKey: "s1:t1:1",
      draftScopeKey: "s1:t1",
      drafts,
      submit,
    };
    await show();
    const input = container.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "B2:C3");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(
      container.querySelectorAll('[role="gridcell"][aria-selected="true"]'),
    ).toHaveLength(4);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="添加批注"]')!
        .click(),
    );
    const draft = drafts.getSnapshot()[0];
    expect(draft.comment).toMatchObject({
      format: "workbook",
      sourceFormat: "xlsx",
      sheetName: "预算",
      sheetId: "1",
      address: "B2:C3",
      sourceSha256: "a".repeat(64),
    });
    expect(draft.comment).not.toHaveProperty("pageNumber");
    await act(async () => draft.controller.setText("请调整这一区域"));
    await act(async () =>
      container
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0]).toMatchObject({
      comment: { address: "B2:C3", sheetId: "1", body: "请调整这一区域" },
    });
    expect(drafts.getSnapshot()[0].failure).toBe("submitFailed");
    expect(draft.controller.getDocument().text).toBe("请调整这一区域");
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="关闭批注"]')!
        .click(),
    );
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click(),
    );
    expect(
      container.querySelector('[role="grid"]')?.getAttribute("aria-label"),
    ).toBe("明细");
    await act(async () => {
      drafts.focus(draft.comment.id, "1");
    });
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe("预算");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
      "B2:C3",
    );
    expect(container.querySelector("form")?.textContent).toContain(
      "预算 · B2:C3",
    );
    expect(
      container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("请调整这一区域");
  });

  it("Shift 方向键扩选保留锚点，普通方向键恢复单格选择", async () => {
    await show();
    await act(async () =>
      cell("B4").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    );
    const grid = container.querySelector('[role="grid"]')!;
    await act(async () =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    await act(async () =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
      "B3:C4",
    );
    await act(async () =>
      grid.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      ),
    );
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe(
      "C2",
    );
  });

  it.each([
    ["zh-CN", "编辑", "单元格位置"],
    ["zh-TW", "編輯", "儲存格位置"],
    ["en-US", "Edit", "Cell address"],
    ["ja-JP", "編集", "セルの位置"],
    ["ko-KR", "편집", "셀 주소"],
  ] as const)(
    "%s 显示真实文案、页签和失败重试",
    async (locale, edit, address) => {
      await changeLimeLocale(locale);
      mocks.load.mockReturnValueOnce({
        promise: Promise.reject(new WorkbookImportError("tooLarge")),
        destroy: vi.fn(),
      });
      await show();
      expect(container.querySelector("[role=alert]")?.textContent).toBeTruthy();
      expect(container.textContent).not.toContain("workspace.workbookPreview.");
      await act(async () => button().click());
      expect(container.textContent).toContain(edit);
      expect(
        container.querySelector("[role=grid]")?.getAttribute("aria-readonly"),
      ).toBe("true");
      expect(container.querySelector("input")?.getAttribute("aria-label")).toBe(
        address,
      );
      const tabs = container.querySelectorAll<HTMLButtonElement>("[role=tab]");
      await act(async () =>
        tabs[0].dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        ),
      );
      expect(tabs[1].getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(tabs[1]);
      expect(container.textContent).toContain("真实明细");
    },
  );

  it("换文件和卸载取消旧导入，迟到成功或错误都不覆盖当前内容", async () => {
    let resolve!: (value: WorkbookSnapshot) => void;
    const destroy = vi.fn();
    mocks.load.mockReturnValueOnce({
      promise: new Promise<WorkbookSnapshot>((done) => {
        resolve = done;
      }),
      destroy,
    });
    await show("/tmp/old.xlsx");
    await show();
    expect(destroy).toHaveBeenCalledOnce();
    await act(async () => resolve(snapshot("OLD")));
    expect(container.textContent).not.toContain("OLD");
    const currentDestroy = mocks.load.mock.results.at(-1)!.value.destroy;
    await act(async () => root.render(null));
    expect(currentDestroy).toHaveBeenCalledOnce();
    await show("relative.xlsx");
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
});
