import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { composerSchema } from "@/components/input-kit/composerSchema";
import { CodeBlockNodeViewRegistry } from "@/components/input-kit/CodeBlockNodeViewRegistry";
import {
  createCodeBlockHighlight,
  loadCodeBlockParser,
} from "@/components/input-kit/composerCodeBlockHighlight";
import { detectCodeBlockLanguage } from "@/components/input-kit/composerCodeBlockLanguage";
import { readComposerEditorTextDom } from "../lib/composer-editor-dom.mjs";
import {
  placeComposerCodeCaretAtEndDom,
  readComposerMarksDom,
} from "./claw-chat-current-fixture-composer-marks.mjs";
const BODY = "  const value = '中😀';\n````";
const cleanups = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
// Actual PM, NodeView and grammar output in JSDOM; not trusted native input/Gate B.
async function mount(language) {
  const parser = await loadCodeBlockParser();
  const doc = composerSchema.node("doc", null, [
    composerSchema.node("paragraph", null, composerSchema.text("before中😀")),
    composerSchema.node(
      "code_block",
      { language, autoDetectLanguage: false },
      composerSchema.text(BODY),
    ),
    composerSchema.node("paragraph", null, composerSchema.text("after")),
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const registry = new CodeBlockNodeViewRegistry();
  const view = new EditorView(host, {
    state: EditorState.create({
      doc,
      plugins: [createCodeBlockHighlight({ parser })],
    }),
    nodeViews: { code_block: registry.createNodeView },
  });
  registry.getSnapshot()[0].toolbarPortalContainer.textContent =
    "TypeScript toolbar search";
  cleanups.push(() => {
    view.destroy();
    registry.destroy();
    host.remove();
  });
  return view;
}
describe("actual parser to modern NodeView fixture observations", () => {
  it.each(["javascript", "typescript"])(
    "reads real %s spans, preserving source, emoji, whitespace and fences",
    async (language) => {
      const view = await mount(language);
      const marks = readComposerMarksDom(view.dom);
      expect(marks.codeBlocks).toEqual([
        {
          language,
          body: BODY,
          validStructure: true,
          hardBreakCount: 0,
          keywordTokens: ["const"],
        },
      ]);
      expect(marks.blockTags).toEqual(["P", "DIV", "P"]);
      expect(view.dom.querySelector(".hljs-keyword")?.textContent).toBe(
        "const",
      );
      expect(view.dom.querySelector(".hljs-string")?.textContent).toContain(
        "中😀",
      );
      expect(readComposerEditorTextDom(view.dom)).toBe(
        `before中😀\n${BODY}\nafter`,
      );
      expect(view.state.doc.textContent).toBe(`before中😀${BODY}after`);
      placeComposerCodeCaretAtEndDom(view.dom);
      const leaf = window.getSelection().anchorNode;
      expect(leaf.nodeType).toBe(Node.TEXT_NODE);
      expect(leaf.parentElement.closest("code.hljs")).not.toBeNull();
      expect(window.getSelection().anchorOffset).toBe(leaf.nodeValue.length);
    },
  );
  it("the immutable literal detects JavaScript independently of final TypeScript selection", async () => {
    expect(
      await detectCodeBlockLanguage(BODY, () => {
        throw new Error("syntax hint should answer");
      }),
    ).toBe("javascript");
    const view = await mount("plaintext");
    expect(readComposerMarksDom(view.dom).codeBlocks).toEqual([
      {
        language: "plaintext",
        body: BODY,
        validStructure: true,
        hardBreakCount: 0,
        keywordTokens: [],
      },
    ]);
    expect(view.dom.querySelectorAll("code span.hljs-keyword")).toHaveLength(0);
  });
});
