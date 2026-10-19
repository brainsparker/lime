import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { redo, undo } from "@codemirror/commands";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { CodeMirrorFileEditor } from "./CodeMirrorFileEditor";
import { FileEditorController } from "./FileEditorController";

let root: Root;
let host: HTMLDivElement;
let controller: FileEditorController;
const rangeMethods = ["getClientRects", "getBoundingClientRect"] as const;
const originalRangeMethods = rangeMethods.map((name) =>
  Object.getOwnPropertyDescriptor(Range.prototype, name),
);
beforeAll(() => {
  // 无布局的DOM夹具补齐CodeMirror测量API；真实尺寸由Electron场景验证。
  for (const name of rangeMethods)
    Object.defineProperty(Range.prototype, name, {
      configurable: true,
      value: name === "getClientRects" ? () => [] : () => new DOMRect(),
    });
});
afterAll(() => {
  rangeMethods.forEach((name, index) => {
    const original = originalRangeMethods[index];
    if (original) Object.defineProperty(Range.prototype, name, original);
    else Reflect.deleteProperty(Range.prototype, name);
  });
});
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  controller = new FileEditorController({
    read: async () => ({ content: "base", mtimeMs: 1, sizeBytes: 4 }),
    write: async () => ({ outcome: "saved", mtimeMs: 2 }),
  });
  await controller.load();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  controller.discard();
  host.remove();
  await changeLimeLocale("en-US");
});

describe("file editor language and state", () => {
  it("浮动工具条按真实历史启用撤销重做，干净文件不显示工具条", async () => {
    act(() =>
      root.render(
        <CodeMirrorFileEditor
          controller={controller}
          path="notes.txt"
          label="notes.txt"
        />,
      ),
    );
    expect(
      host.querySelector('[data-testid="file-editor-history-toolbar"]'),
    ).toBeNull();
    const view = EditorView.findFromDOM(
      host.querySelector<HTMLElement>(".cm-editor")!,
    )!;
    act(() => view.dispatch({ changes: { from: 4, insert: " changed" } }));
    const undoButton = () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')!;
    const redoButton = () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Redo"]')!;
    expect(undoButton().disabled).toBe(false);
    expect(redoButton().disabled).toBe(true);
    await act(async () => controller.saveUntilClean());
    expect(undoButton().disabled).toBe(false);
    act(() => undoButton().click());
    expect(controller.getContent()).toBe("base");
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(false);
    act(() => redoButton().click());
    expect(controller.getContent()).toBe("base changed");
    expect(redoButton().disabled).toBe(true);
    expect(host.querySelector(".cm-editor")).toBe(view.dom);
  });

  it("保存后的标签草稿保留撤销历史，重建编辑器后仍可撤销和重做", async () => {
    act(() =>
      root.render(
        <CodeMirrorFileEditor
          controller={controller}
          path="notes.txt"
          label="notes.txt"
        />,
      ),
    );
    const view = EditorView.findFromDOM(
      host.querySelector<HTMLElement>(".cm-editor")!,
    )!;
    act(() => view.dispatch({ changes: { from: 4, insert: " changed" } }));
    await act(async () => {
      await controller.saveUntilClean();
    });
    expect(controller.getSnapshot().hasUnsavedChanges).toBe(false);
    act(() => root.render(null));
    const draft = controller.getDraft();
    expect(draft?.content).toBe("base changed");
    expect(draft?.history).toBeDefined();
    controller.discard();
    controller = new FileEditorController({
      read: async () => ({
        content: "base changed",
        mtimeMs: 2,
        sizeBytes: 12,
      }),
      write: async () => ({ outcome: "saved", mtimeMs: 3 }),
    });
    await controller.load(draft);
    act(() =>
      root.render(
        <CodeMirrorFileEditor
          controller={controller}
          path="notes.txt"
          label="notes.txt"
        />,
      ),
    );
    const restored = EditorView.findFromDOM(
      host.querySelector<HTMLElement>(".cm-editor")!,
    )!;
    act(() => {
      expect(undo(restored)).toBe(true);
    });
    expect(controller.getContent()).toBe("base");
    act(() => {
      expect(redo(restored)).toBe(true);
    });
    expect(controller.getContent()).toBe("base changed");
  });

  it("updates search labels in place across all locales and preserves selection and undo", async () => {
    act(() =>
      root.render(
        <CodeMirrorFileEditor
          controller={controller}
          path="notes.txt"
          label="notes.txt"
        />,
      ),
    );
    const element = host.querySelector<HTMLElement>(".cm-editor")!;
    const view = EditorView.findFromDOM(element)!;
    act(() => {
      view.dispatch({
        changes: { from: 4, insert: " changed" },
        selection: { anchor: 6 },
      });
      openSearchPanel(view);
    });
    for (const [locale, expected, undoLabel] of [
      ["zh-CN", "查找", "撤销"],
      ["zh-TW", "尋找", "復原"],
      ["ja-JP", "検索", "元に戻す"],
      ["ko-KR", "찾기", "실행 취소"],
      ["en-US", "Find", "Undo"],
    ] as const) {
      await act(async () => {
        await changeLimeLocale(locale);
      });
      expect(host.querySelector(".cm-editor")).toBe(element);
      expect(view.state.selection.main.anchor).toBe(6);
      expect(
        host
          .querySelector<HTMLInputElement>('input[name="search"]')
          ?.getAttribute("aria-label"),
      ).toBe(expected);
      expect(controller.getContent()).toBe("base changed");
      expect(
        host.querySelector(`button[aria-label="${undoLabel}"]`),
      ).not.toBeNull();
    }
    act(() => {
      undo(view);
    });
    expect(controller.getContent()).toBe("base");
  });
});
