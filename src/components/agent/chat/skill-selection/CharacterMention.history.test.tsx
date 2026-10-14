import { act } from "react";
import { describe, expect, it } from "vitest";
import type { ComposerInline } from "@/components/input-kit/types";
import {
  getComposerController,
  getComposerEditor,
  getMentionPopoverContent,
  renderHarness,
} from "./CharacterMention.testFixtures";

const atoms: Array<{ name: string; node: ComposerInline }> = [
  {
    name: "skill",
    node: {
      type: "mention",
      attrs: { id: "user:fixture", kind: "skill", name: "fixture", path: "/fixture/SKILL.md", label: "/user:fixture" },
    },
  },
  {
    name: "file",
    node: {
      type: "mention",
      attrs: { id: "file:fixture", kind: "file", name: "fixture.md", path: "/fixture.md", label: "@fixture.md" },
    },
  },
  {
    name: "plugin",
    node: {
      type: "mention",
      attrs: { id: "plugin:fixture", kind: "plugin", name: "fixture", path: "/plugins/fixture", label: "@fixture" },
    },
  },
  { name: "paste", node: { type: "paste", attrs: { id: "paste:fixture", placeholder: "/hidden", text: "完整粘贴内容" } } },
  { name: "element", node: { type: "text_element", attrs: { text: "@element", placeholder: "元素内容" } } },
];

describe("CharacterMention structured history", () => {
  it.each(atoms)("恢复 $name atom 后不得把标签当成提及并拦截历史键", async ({ node }) => {
    const container = renderHarness();
    const editor = getComposerEditor(container);
    const controller = getComposerController(editor);
    await act(async () => {
      await import("./CharacterMentionPanel");
      controller.replaceHistory([{ editorDocument: { type: "doc", content: [{ type: "paragraph", content: [node] }] } }]);
      editor.focus();
      editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(controller.getDocument().editorDocument.content[0]?.content).toEqual([node]);
    expect(getMentionPopoverContent()).toBeNull();

    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    act(() => { editor.dispatchEvent(down); });
    expect(down.defaultPrevented).toBe(true);
    expect(controller.getDocument().text).toBe("");
    expect(getMentionPopoverContent()).toBeNull();
  });

  it.each(["@", "/"])("atom 后新输入的 %s 仍应打开面板并保留 atom", async (trigger) => {
    const container = renderHarness();
    const editor = getComposerEditor(container);
    const controller = getComposerController(editor);
    act(() => {
      controller.replaceDocument({ editorDocument: { type: "doc", content: [{ type: "paragraph", content: [atoms[0].node] }] } });
    });
    await act(async () => {
      await import("./CharacterMentionPanel");
      editor.focus();
      const end = controller.getDocument().text.length;
      controller.replaceRange({ start: end, end }, ` ${trigger}`);
    });
    expect(controller.getDocument().editorDocument.content[0]?.content?.[0]).toEqual(atoms[0].node);
    expect(editor.querySelector('[data-composer-token="skill"]')).not.toBeNull();
    expect(getMentionPopoverContent()).not.toBeNull();
  });

  it("补全查询不得跨过没有触发字符的不可编辑元素", async () => {
    const container = renderHarness();
    const editor = getComposerEditor(container);
    const controller = getComposerController(editor);
    await act(async () => {
      await import("./CharacterMentionPanel");
      controller.replaceDocument({
        editorDocument: { type: "doc", content: [{ type: "paragraph", content: [
          { type: "text", text: "😀 @" },
          { type: "text_element", attrs: { text: "fixture", placeholder: "元素" } },
        ] }] },
      });
      editor.focus();
      controller.setSelection(controller.getDocument().text.length);
    });
    expect(getMentionPopoverContent()).toBeNull();
    expect(controller.getDocument().text).toBe("😀 @fixture");
    expect(editor.querySelector('[data-composer-token="element"]')).not.toBeNull();
  });
});
