import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "./ComposerController";
import {
  ComposerEditor,
  type ComposerEditorHandle,
  type ComposerEditorProps,
} from "./ComposerEditor";
import { useComposerController } from "./useComposerController";
import type { ComposerControllerOptions, ComposerDocumentInput } from "./types";
import {
  codeBlockHighlightKey,
  loadCodeBlockParser,
} from "./composerCodeBlockHighlight";
import { changeLimeLocale } from "@/i18n/createI18n";

const mounted: { root: Root; host: HTMLElement }[] = [];
const descriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  // JSDOM does not establish native geometry or trusted input.
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 1, 1),
  });
});
afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  vi.restoreAllMocks();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

function codeDraft(
  text = "const value = '😀';\n",
  auto = false,
): ComposerDocumentInput {
  return {
    editorDocument: {
      type: "doc",
      content: [
        {
          type: "code_block",
          attrs: { language: "javascript", autoDetectLanguage: auto },
          content: [{ type: "text", text }],
        },
      ],
    },
  };
}
function createHost() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  return { root, host };
}
function mount(
  controller = new ComposerController(codeDraft()),
  props: Partial<ComposerEditorProps> = {},
) {
  const { root, host } = createHost();
  const editorRef = createRef<ComposerEditorHandle>();
  const render = (next = controller, nextProps = props) =>
    act(() =>
      root.render(
        <ComposerEditor
          {...nextProps}
          controller={next}
          editorRef={editorRef}
        />,
      ),
    );
  render();
  return { host, controller, editorRef, render };
}

describe("Composer code block integration", () => {
  it("defaults enable one Controller registry, two independent plugins and code NodeView", () => {
    const { controller, host } = mount();
    expect(Object.keys(controller.createNodeViews())).toEqual(["code_block"]);
    expect(controller.getEditorState().plugins).toHaveLength(5);
    expect(
      codeBlockHighlightKey.getState(controller.getEditorState()),
    ).toBeDefined();
    expect(controller.codeBlockNodeViewRegistry.getSnapshot()).toHaveLength(1);
    expect(
      host.querySelector('[data-composer-code-block="true"]')?.tagName,
    ).toBe("DIV");
  });

  it.each([
    { enableRichText: false },
    { enableCodeBlocks: false },
    { plainTextMode: true },
  ] as ComposerControllerOptions[])(
    "effective constructor options %j disable both plugins and NodeView",
    (options) => {
      const controller = new ComposerController(codeDraft(), options);
      const { host, render } = mount(controller);
      expect(controller.createNodeViews()).toEqual({});
      expect(controller.getEditorState().plugins).toHaveLength(3);
      expect(
        codeBlockHighlightKey.getState(controller.getEditorState()),
      ).toBeUndefined();
      expect(controller.codeBlockNodeViewRegistry.getSnapshot()).toHaveLength(
        0,
      );
      expect(
        host.querySelector("[data-composer-code-block-toolbar]"),
      ).toBeNull();
      render(controller, { disabled: false });
      expect(controller.getEditorState().plugins).toHaveLength(3);
      expect(controller.createNodeViews()).toEqual({});
    },
  );

  it("mutating constructor option objects and Editor props cannot change fixed capability gating", () => {
    const options = { plainTextMode: true };
    const controller = new ComposerController(codeDraft(), options);
    const { render } = mount(controller);
    options.plainTextMode = false;
    act(() => controller.restoreDraft(codeDraft()));
    render(controller, { disabled: false, autoFocus: true });
    expect(controller.createNodeViews()).toEqual({});
    expect(controller.getEditorState().plugins).toHaveLength(3);
  });

  it("clear and each identical restore get new EditorState/plugin arrays without a second document owner", () => {
    const { controller } = mount();
    const registry = controller.codeBlockNodeViewRegistry;
    const first = controller.getEditorState();
    const draft = controller.captureDraft();
    act(() => controller.restoreDraft(draft));
    const restored = controller.getEditorState();
    expect(restored).not.toBe(first);
    expect(restored.plugins).not.toBe(first.plugins);
    restored.plugins.forEach((plugin, index) =>
      expect(plugin).not.toBe(first.plugins[index]),
    );
    act(() => controller.restoreDraft(draft));
    expect(controller.getEditorState().plugins).not.toBe(restored.plugins);
    expect(controller.captureDraft()).toEqual(draft);
    act(() => controller.clear());
    expect(controller.getEditorState().plugins).not.toBe(restored.plugins);
    expect(controller.codeBlockNodeViewRegistry).toBe(registry);
    expect(registry.getSnapshot()).toHaveLength(0);
  });

  it("pure meta notifies View subscribers while document snapshot/revision and accepted receipt stay current", () => {
    const controller = new ComposerController({ text: "keep receipt" });
    const receipt = controller.submit("start");
    if (receipt.kind !== "accepted")
      throw new Error("Expected accepted receipt");
    const before = controller.getSnapshot();
    const state = controller.getEditorState();
    const notify = vi.fn();
    const unsubscribe = controller.subscribe(notify);
    expect(
      controller.applyTransaction(state.tr.setMeta("decoration-refresh", true)),
    ).toBe(true);
    expect(controller.getEditorState()).not.toBe(state);
    expect(controller.getSnapshot()).toBe(before);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(controller.commit(receipt)).toBe(true);
    unsubscribe();
  });

  it("automatic no-history attrs advance revision and reject stale receipt while keeping history navigation", () => {
    const controller = new ComposerController({ text: "base draft" });
    controller.replaceHistory([
      codeDraft("older", true),
      codeDraft("newer", true),
    ]);
    expect(controller.recallHistory("previous")?.text).toBe("newer");
    const receipt = controller.submit("queue");
    if (receipt.kind !== "accepted")
      throw new Error("Expected accepted receipt");
    const before = controller.getSnapshot();
    const state = controller.getEditorState();
    controller.applyTransaction(
      state.tr
        .setNodeMarkup(0, undefined, {
          ...state.doc.firstChild!.attrs,
          language: "python",
        })
        .setMeta("addToHistory", false),
    );
    expect(controller.getSnapshot().revision).toBe(before.revision + 1);
    expect(controller.commit(receipt)).toBe(false);
    expect(controller.recallHistory("previous")?.text).toBe("older");
    expect(controller.recallHistory("next")?.text).toBe("newer");
    expect(controller.recallHistory("next")?.text).toBe("base draft");
  });

  it("manual document edits reset history navigation; actual selection changes advance revision", () => {
    const controller = new ComposerController({ text: "base" });
    controller.replaceHistory([{ text: "older" }, { text: "newer" }]);
    controller.recallHistory("previous");
    const before = controller.getSnapshot();
    controller.setSelection(0);
    expect(controller.getSnapshot().revision).toBe(before.revision + 1);
    controller.applyTransaction(
      controller.getEditorState().tr.insertText("!", 1),
    );
    expect(controller.recallHistory("next")).toBeNull();
  });

  it("same-attrs docChanged steps are View updates without a draft revision", () => {
    const controller = new ComposerController(codeDraft());
    const before = controller.getSnapshot();
    const state = controller.getEditorState();
    const transaction = state.tr.setNodeMarkup(
      0,
      undefined,
      state.doc.firstChild!.attrs,
    );
    expect(transaction.docChanged).toBe(true);
    controller.applyTransaction(transaction);
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getEditorState()).not.toBe(state);
  });

  it("root composition guard blocks language actions before PM composing and preserves contentDOM/highlight updates", async () => {
    const controller = new ComposerController(codeDraft());
    let blockedBeforePm = false;
    const { host, editorRef } = mount(controller, {
      onCompositionStateChange: (composing) => {
        if (composing)
          blockedBeforePm = !controller.codeBlockNodeViewRegistry
            .getSnapshot()[0]
            .selectLanguage("python");
      },
    });
    await loadCodeBlockParser();
    await act(async () => {
      await vi.waitFor(() =>
        expect(host.querySelector("code .hljs-keyword")?.textContent).toBe(
          "const",
        ),
      );
    });
    const dom = editorRef.current!.getElement()!;
    const contentDOM = host.querySelector("pre > code");
    act(() =>
      dom.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      ),
    );
    expect(blockedBeforePm).toBe(true);
    expect(editorRef.current!.isComposing()).toBe(true);
    expect(
      host
        .querySelector("[data-composer-code-block-toolbar] button")
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(dom.getAttribute("contenteditable")).toBe("true");
    act(() =>
      controller.applyTransaction(
        controller.getEditorState().tr.insertText(" ", 1),
      ),
    );
    expect(host.querySelector("pre > code")).toBe(contentDOM);
    expect(contentDOM?.textContent).toBe(" const value = '😀';\n");
    expect(contentDOM?.querySelector(".hljs-keyword")?.textContent).toBe(
      "const",
    );
    expect(
      controller.codeBlockNodeViewRegistry
        .getSnapshot()[0]
        .selectLanguage("python"),
    ).toBe(false);
    act(() =>
      dom.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true }),
      ),
    );
    await act(async () => {
      await vi.waitFor(() =>
        expect(
          controller.codeBlockNodeViewRegistry
            .getSnapshot()[0]
            .selectLanguage("typescript"),
        ).toBe(true),
      );
    });
    expect(
      host
        .querySelector("[data-composer-code-block-toolbar] button")
        ?.hasAttribute("disabled"),
    ).toBe(false);
  });

  it("hook honors external Controller configuration and omits duplicate document callbacks on pure meta", () => {
    const controller = new ComposerController(codeDraft());
    const changed = vi.fn();
    const { root } = createHost();
    function Probe() {
      useComposerController({
        controller,
        controllerOptions: { plainTextMode: true },
        onDocumentChange: changed,
      });
      return null;
    }
    act(() => root.render(<Probe />));
    expect(Object.keys(controller.createNodeViews())).toEqual(["code_block"]);
    act(() =>
      controller.applyTransaction(
        controller.getEditorState().tr.setMeta("pure-plugin-meta", true),
      ),
    );
    expect(changed).not.toHaveBeenCalled();
    act(() => controller.setSelection(0));
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
