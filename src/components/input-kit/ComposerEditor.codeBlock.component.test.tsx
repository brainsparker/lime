import React, { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { loadCodeBlockParser } from "@/components/input-kit/composerCodeBlockHighlight";
import {
  ComposerEditor,
  type ComposerEditorHandle,
} from "@/components/input-kit/ComposerEditor";
import { changeLimeLocale } from "@/i18n/createI18n";

const mounted: { root: Root; container: HTMLElement }[] = [];
const rangeDescriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
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
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.restoreAllMocks();
  for (const [name, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
});

function richController() {
  return new ComposerController({
    editorDocument: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "before😀" }] },
        {
          type: "code_block",
          attrs: { language: "javascript", autoDetectLanguage: false },
          content: [
            {
              type: "text",
              text: "const value = '😀';\n  console.log(value);\n",
            },
          ],
        },
        {
          type: "code_block",
          attrs: { language: "python", autoDetectLanguage: false },
          content: [{ type: "text", text: "  print('second')\n" }],
        },
      ],
    },
    attachments: [{ data: "image", mediaType: "image/png" }],
    pathReferences: [
      { id: "brief", path: "/tmp/brief.md", name: "brief.md", isDir: false },
    ],
  });
}

function mount(controller = richController(), disabled = false) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const editorRef = createRef<ComposerEditorHandle>();
  const render = (next = controller, isDisabled = disabled) =>
    act(() => {
      root.render(
        <ComposerEditor
          controller={next}
          disabled={isDisabled}
          editorRef={editorRef}
        />,
      );
    });
  render();
  return { root, container, controller, render, editorRef };
}

describe("ComposerEditor code block production integration", () => {
  it("主编辑器为两个块建立独立 toolbar 和 PM contentDOM，不写旧data-language", () => {
    const { container } = mount();
    const blocks = container.querySelectorAll(
      '[data-composer-code-block="true"]',
    );
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      expect(block.tagName).toBe("DIV");
      expect(block.getAttribute("data-composer-code-block-wrap")).toBe("false");
      expect(
        block
          .querySelector('[data-composer-code-block-toolbar="true"]')
          ?.getAttribute("contenteditable"),
      ).toBe("false");
      expect(block.querySelector("pre")?.getAttribute("dir")).toBe("ltr");
      expect(block.querySelector("code")?.getAttribute("spellcheck")).toBe(
        "false",
      );
      expect(block.querySelector("code")?.hasAttribute("data-language")).toBe(
        false,
      );
      expect(block.querySelector("code")?.classList.contains("hljs")).toBe(
        true,
      );
      expect(block.querySelector("button")).not.toBeNull();
    }
    expect(blocks[0].querySelector("code")?.textContent).toBe(
      "const value = '😀';\n  console.log(value);\n",
    );
  });

  it("语言动作只改变当前块attrs，保留两块正文、选择区与全部资源", () => {
    const { controller } = mount();
    const registry = controller.codeBlockNodeViewRegistry;
    const before = controller.captureDraft();
    const revision = controller.getSnapshot().revision;
    const [first, second] = registry.getSnapshot();
    expect(first).not.toBe(second);
    act(() => expect(first.selectLanguage("typescript")).toBe(true));
    const after = controller.captureDraft();
    expect(after.editorDocument.content?.[1].attrs).toMatchObject({
      language: "typescript",
      autoDetectLanguage: false,
    });
    expect(after.editorDocument.content?.[2]).toEqual(
      before.editorDocument.content?.[2],
    );
    expect(after.text).toBe(before.text);
    expect(after.attachments).toEqual(before.attachments);
    expect(after.pathReferences).toEqual(before.pathReferences);
    expect([after.selectionStart, after.selectionEnd]).toEqual([
      before.selectionStart,
      before.selectionEnd,
    ]);
    expect(controller.getSnapshot().revision).toBe(revision + 1);
    act(() => expect(first.selectLanguage("typescript")).toBe(false));
    expect(controller.getSnapshot().revision).toBe(revision + 1);
  });

  it("纯plugin meta刷新View但不推进草稿revision、不使接受回执失效", () => {
    const { controller } = mount();
    const receipt = controller.submit("start");
    if (receipt.kind !== "accepted")
      throw new Error("expected accepted receipt");
    const snapshot = controller.getSnapshot();
    const previousState = controller.getEditorState();
    act(() =>
      controller.applyTransaction(
        previousState.tr.setMeta("composer-decoration-test-refresh", true),
      ),
    );
    expect(controller.getEditorState()).not.toBe(previousState);
    expect(controller.getSnapshot()).toBe(snapshot);
    act(() => expect(controller.commit(receipt)).toBe(true));
  });

  it("显式语言改变后旧接受回执不可清掉新草稿", () => {
    const { controller } = mount();
    const receipt = controller.submit("queue");
    if (receipt.kind !== "accepted")
      throw new Error("expected accepted receipt");
    act(() =>
      controller.codeBlockNodeViewRegistry
        .getSnapshot()[0]
        .selectLanguage("python"),
    );
    expect(controller.commit(receipt)).toBe(false);
    expect(controller.getDocument().text).toContain("const value");
    expect(controller.getDocument().attachments).toHaveLength(1);
  });

  it("切换Controller销毁旧View并注销entry，旧动作不能写新旧任一草稿", () => {
    const { controller, render } = mount();
    const previousEntry = controller.codeBlockNodeViewRegistry.getSnapshot()[0];
    const previousDraft = controller.captureDraft();
    const next = new ComposerController({ text: "next owner" });
    const nextDraft = next.captureDraft();
    render(next);
    expect(controller.codeBlockNodeViewRegistry.getSnapshot()).toHaveLength(0);
    expect(previousEntry.selectLanguage("python")).toBe(false);
    expect(controller.captureDraft()).toEqual(previousDraft);
    expect(next.captureDraft()).toEqual(nextDraft);
  });

  it("真实Editor disabled属性阻止toolbar动作及文档变更", () => {
    const { controller, container } = mount(richController(), true);
    const before = controller.captureDraft();
    const entry = controller.codeBlockNodeViewRegistry.getSnapshot()[0];
    expect(
      container
        .querySelector('[data-composer-code-block-toolbar="true"] button')
        ?.hasAttribute("disabled"),
    ).toBe(true);
    expect(entry.selectLanguage("typescript")).toBe(false);
    expect(controller.captureDraft()).toEqual(before);
  });

  it("真实parser通过PM Decoration显示token且保留emoji和首尾空白正文", async () => {
    const { controller, container } = mount();
    const before = controller.captureDraft();
    await act(async () => {
      await loadCodeBlockParser();
      await vi.waitFor(() =>
        expect(container.querySelector("code .hljs-keyword")?.textContent).toBe(
          "const",
        ),
      );
    });
    expect(controller.captureDraft()).toEqual(before);
    expect(container.querySelector("code")?.textContent).toBe(
      "const value = '😀';\n  console.log(value);\n",
    );
  });
});
