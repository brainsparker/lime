import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ComposerController,
  ComposerEditor,
  type ComposerEditorHandle,
} from "@/components/input-kit";
import { AdaptiveFooter } from "./ComposerLayout";
import { useComposerLayout } from "./useComposerLayout";

let container: HTMLDivElement;
let root: Root;
const resizeCallbacks = new Set<() => void>();
let disconnects: number;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  disconnects = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        resizeCallbacks.add(this.callback);
      }
      unobserve() {}
      disconnect() {
        disconnects++;
        resizeCallbacks.delete(this.callback);
      }
    },
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resizeCallbacks.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountLayout() {
  const controller = new ComposerController({ text: "同一份草稿 😀" });
  const editorRef = createRef<ComposerEditorHandle>();
  function Harness({
    transcript,
    attachments = false,
    awaiting = false,
  }: {
    transcript?: boolean;
    attachments?: boolean;
    awaiting?: boolean;
  }) {
    const state = useComposerLayout({
      controller,
      editorRef,
      hasVisibleAttachments: attachments,
      dictationShowTranscript: transcript,
      isAwaitingInput: awaiting,
    });
    return (
      <div data-body-layout={state.bodyLayout}>
        <AdaptiveFooter
          inputRef={state.inputRef}
          layout={state.layout}
          isComposing={state.isComposing}
          input={
            <ComposerEditor
              controller={controller}
              editorRef={editorRef}
              onCompositionStateChange={state.onCompositionStateChange}
            />
          }
          leadingControls={<button>添加附件</button>}
          trailingControls={<button>发送</button>}
          dictation={
            transcript === undefined
              ? undefined
              : {
                  showTranscript: transcript,
                  controls: <button data-recording="">停止听写</button>,
                }
          }
        />
      </div>
    );
  }
  const render = (
    transcript?: boolean,
    attachments = false,
    awaiting = false,
  ) =>
    act(() =>
      root.render(
        <Harness
          transcript={transcript}
          attachments={attachments}
          awaiting={awaiting}
        />,
      ),
    );
  render();
  const editor = editorRef.current!.getElement()!;
  const input = container.querySelector<HTMLElement>(
    "[data-composer-footer-input]",
  )!;
  const footer = input.parentElement!;
  return { controller, editor, editorRef, input, footer, render };
}

describe("Composer layout with the current editor and dictation projection", () => {
  it("selected async question forces single-line even with multiline text; attachments and dictation retain their own layouts", () => {
    const state = mountLayout();
    act(() => state.controller.setText("first\nsecond"));
    const original = state.controller.captureDraft();
    state.render(undefined, false, true);
    expect(state.footer.dataset.composerLayout).toBe("single-line");
    expect(state.footer.dataset.composerRows).toBe("responsive");
    expect(state.editorRef.current!.getElement()).toBe(state.editor);
    expect(state.controller.captureDraft()).toEqual(original);
    state.render(undefined, true, true);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    state.render(true, false, true);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    state.render(undefined, false, false);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
  });
  it("听写切换使用同一个编辑器，附件保持多行主体，IME结束后才释放布局", () => {
    const state = mountLayout();
    act(() => {
      state.editor.focus();
      state.controller.setSelection(1, 4);
    });
    const draft = state.controller.captureDraft();
    act(() =>
      state.editor.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      ),
    );
    state.render(false, true);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(state.footer.dataset.composerComposing).toBe("true");
    expect(state.input.getAttribute("aria-hidden")).toBe("true");
    expect(state.input.hasAttribute("inert")).toBe(true);
    expect(
      container
        .querySelector("[data-body-layout]")
        ?.getAttribute("data-body-layout"),
    ).toBe("multiline");
    expect(
      container
        .querySelector("[data-composer-leading-controls]")
        ?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      container.querySelector("[data-composer-dictation-controls]")
        ?.textContent,
    ).toBe("停止听写");
    act(() => {
      state.controller.setText("中文输入\n第二段");
      state.controller.setSelection(2, 5);
      resizeCallbacks.forEach((callback) => callback());
    });
    const composingDraft = state.controller.captureDraft();
    expect(state.controller.getEditorState().doc.childCount).toBe(2);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(state.footer.dataset.composerComposing).toBe("true");
    expect(state.editorRef.current!.getElement()).toBe(state.editor);

    act(() =>
      state.editor.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
    expect(state.footer.dataset.composerLayout).toBe("single-line");
    expect(state.footer.hasAttribute("data-composer-composing")).toBe(false);
    state.render(true);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(state.input.hasAttribute("aria-hidden")).toBe(false);
    expect(state.input.hasAttribute("inert")).toBe(false);
    expect(state.controller.captureDraft()).toEqual(composingDraft);
    state.render();
    act(() => state.controller.setText(""));
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(state.footer.dataset.composerRows).toBe("stacked");
    expect(state.editorRef.current!.getElement()).toBe(state.editor);
    act(() => state.controller.restoreDraft(draft));
    expect(state.controller.captureDraft()).toEqual(draft);
  });

  it("无文字听写结束恢复编辑焦点，并尊重用户已切走的焦点", () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const state = mountLayout();
    state.render(false);
    container.querySelector<HTMLButtonElement>("[data-recording]")!.focus();
    state.render();
    expect(document.activeElement).toBe(state.editor);

    const unrelated = document.createElement("button");
    document.body.append(unrelated);
    state.render(false);
    unrelated.focus();
    state.render();
    expect(document.activeElement).toBe(unrelated);
    unrelated.remove();
  });

  it("没有ResizeObserver时仍测量真实输入并响应Controller事务", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const state = mountLayout();
    let scrollHeight = 80;
    Object.defineProperties(state.input, {
      clientWidth: { get: () => 320 },
      clientHeight: { get: () => 32 },
      scrollHeight: { get: () => scrollHeight },
    });
    act(() => state.controller.setText("中文输入\n第二段"));
    expect(state.input.hasAttribute("data-overflowing")).toBe(true);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(state.editorRef.current!.getElement()).toBe(state.editor);
    scrollHeight = 32;
    act(() => state.controller.setText(""));
    expect(state.input.hasAttribute("data-overflowing")).toBe(false);
    expect(state.footer.dataset.composerLayout).toBe("multiline");
    expect(resizeCallbacks.size).toBe(0);
    act(() => root.render(null));
    scrollHeight = 80;
    act(() => state.controller.setText("卸载后"));
    expect(state.input.hasAttribute("data-overflowing")).toBe(false);
  });

  it("尺寸、字体及Controller事务重新测量溢出，卸载释放观察者", () => {
    const fonts = new EventTarget();
    const previousFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: fonts,
    });
    const removeFontListener = vi.spyOn(fonts, "removeEventListener");
    try {
      const state = mountLayout();
      let scrollHeight = 32;
      Object.defineProperties(state.input, {
        clientWidth: { get: () => 320 },
        clientHeight: { get: () => 32 },
        scrollHeight: { get: () => scrollHeight },
      });
      act(() => resizeCallbacks.forEach((callback) => callback()));
      expect(state.input.hasAttribute("data-overflowing")).toBe(false);
      scrollHeight = 80;
      act(() => resizeCallbacks.forEach((callback) => callback()));
      expect(state.input.hasAttribute("data-overflowing")).toBe(true);
      scrollHeight = 32;
      act(() => state.controller.setText("短文本"));
      expect(state.input.hasAttribute("data-overflowing")).toBe(false);
      scrollHeight = 80;
      act(() => fonts.dispatchEvent(new Event("loadingdone")));
      expect(state.input.hasAttribute("data-overflowing")).toBe(true);
      act(() => root.render(null));
      expect(resizeCallbacks.size).toBe(0);
      expect(disconnects).toBeGreaterThan(0);
      expect(removeFontListener).toHaveBeenCalledWith(
        "loadingdone",
        expect.any(Function),
      );
      scrollHeight = 32;
      act(() => state.controller.setText("卸载后"));
      expect(state.input.hasAttribute("data-overflowing")).toBe(true);
    } finally {
      if (previousFonts)
        Object.defineProperty(document, "fonts", previousFonts);
      else Reflect.deleteProperty(document, "fonts");
    }
  });
});
