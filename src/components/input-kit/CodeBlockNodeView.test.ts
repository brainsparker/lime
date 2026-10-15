import { afterEach, describe, expect, it, vi } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { history, redo, undo } from "@tiptap/pm/history";
import { composerSchema } from "@/components/input-kit/composerSchema";
import { CodeBlockNodeViewRegistry } from "./CodeBlockNodeViewRegistry";

const mounted: {
  view: EditorView;
  registry: CodeBlockNodeViewRegistry;
  host: HTMLElement;
}[] = [];
afterEach(() => {
  for (const { view, registry, host } of mounted.splice(0)) {
    view.destroy();
    registry.destroy();
    host.remove();
  }
});

function mount(
  options: {
    schema?: Schema;
    language?: string | null;
    auto?: boolean;
    getPos?: () => number | undefined;
  } = {},
) {
  const schema = options.schema ?? composerSchema;
  const node = schema.node(
    "code_block",
    {
      language: options.language ?? null,
      autoDetectLanguage: options.auto ?? true,
      marker: "keep",
    },
    schema.text("\n  A😀\n"),
  );
  const doc = schema.node("doc", null, [
    node,
    schema.node("paragraph", null, schema.text("tail")),
  ]);
  const registry = new CodeBlockNodeViewRegistry();
  const host = document.createElement("div");
  document.body.append(host);
  const dispatched = vi.fn();
  const view = new EditorView(host, {
    state: EditorState.create({ doc, plugins: [history()] }),
    nodeViews: {
      code_block: (node, view, getPos) =>
        registry.createNodeView(node, view, options.getPos ?? getPos),
    },
    dispatchTransaction(tr) {
      dispatched(tr);
      view.updateState(view.state.apply(tr));
    },
  });
  mounted.push({ view, registry, host });
  const entry = () => registry.getSnapshot()[0];
  return { view, registry, entry, host, dispatched };
}

describe("CodeBlockNodeView", () => {
  it("uses toolbar + pre[dir=ltr] > code as PM contentDOM and no old data-language", () => {
    const { host, entry } = mount({ language: "js", auto: false });
    const block = host.querySelector('[data-composer-code-block="true"]')!;
    expect(block.tagName).toBe("DIV");
    expect(block.getAttribute("data-composer-code-block-wrap")).toBe("false");
    const toolbar = block.children[0];
    expect(toolbar).toBe(entry().toolbarPortalContainer);
    expect(toolbar.getAttribute("contenteditable")).toBe("false");
    expect(block.children[1].getAttribute("dir")).toBe("ltr");
    const code = block.querySelector("pre > code")!;
    expect(code.getAttribute("spellcheck")).toBe("false");
    expect(code.className).toBe("hljs language-javascript");
    expect(code.hasAttribute("data-language")).toBe(false);
    expect(code.textContent).toBe("\n  A😀\n");
    expect(entry().getContent()).toBe("\n  A😀\n");
  });

  it("language changes preserve body, other attrs and code selection; undo/redo use the same PM state", () => {
    const codeSpec = composerSchema.spec.nodes.get("code_block")!;
    const schema = new Schema({
      nodes: composerSchema.spec.nodes.update("code_block", {
        ...codeSpec,
        attrs: { ...codeSpec.attrs, marker: { default: "keep" } },
      }),
      marks: composerSchema.spec.marks,
    });
    const { view, entry, dispatched } = mount({ schema });
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 3, 6)),
    );
    const before = view.state.doc;
    dispatched.mockClear();
    expect(entry().selectLanguage(" TS ")).toBe(true);
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(view.state.doc.firstChild?.attrs).toMatchObject({
      language: "typescript",
      autoDetectLanguage: false,
      marker: "keep",
    });
    expect(view.state.doc.firstChild?.textContent).toBe("\n  A😀\n");
    expect(view.state.doc.lastChild).toBe(before.lastChild);
    expect([view.state.selection.from, view.state.selection.to]).toEqual([
      3, 6,
    ]);
    expect(undo(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.eq(before)).toBe(true);
    expect(redo(view.state, view.dispatch)).toBe(true);
    expect(view.state.doc.firstChild?.attrs.language).toBe("typescript");
  });

  it("Auto/null, explicit plaintext and unchanged language have distinct transaction contracts", () => {
    const { view, entry, dispatched } = mount();
    expect(entry().selectLanguage("auto")).toBe(false);
    expect(dispatched).not.toHaveBeenCalled();
    expect(entry().selectLanguage(null)).toBe(true);
    expect(view.state.doc.firstChild?.attrs).toMatchObject({
      language: "plaintext",
      autoDetectLanguage: false,
    });
    dispatched.mockClear();
    expect(entry().selectLanguage("plaintext")).toBe(false);
    expect(dispatched).not.toHaveBeenCalled();
    expect(entry().selectLanguage("auto")).toBe(true);
    expect(view.state.doc.firstChild?.attrs).toMatchObject({
      language: null,
      autoDetectLanguage: true,
    });
  });

  it("schema without auto attr supports Plain and explicit language but has no Auto action", () => {
    const codeSpec = composerSchema.spec.nodes.get("code_block")!;
    const schema = new Schema({
      nodes: composerSchema.spec.nodes.update("code_block", {
        ...codeSpec,
        attrs: { language: { default: null } },
      }),
      marks: composerSchema.spec.marks,
    });
    const { view, entry, dispatched } = mount({ schema, language: "python" });
    expect(entry().autoDetectLanguage).toBe(null);
    expect(entry().selectLanguage("auto")).toBe(false);
    expect(dispatched).not.toHaveBeenCalled();
    expect(entry().selectLanguage(null)).toBe(true);
    expect(view.state.doc.firstChild?.attrs.language).toBe(null);
    expect(
      Object.hasOwn(view.state.doc.firstChild!.attrs, "autoDetectLanguage"),
    ).toBe(false);
  });

  it.each([undefined, -1, 0.5, 999, Number.NaN])(
    "rejects invalid/stale getPos %s",
    (position) => {
      const { entry, dispatched } = mount({ getPos: () => position });
      expect(entry().selectLanguage("python")).toBe(false);
      expect(entry().getContent()).toBe("");
      expect(dispatched).not.toHaveBeenCalled();
    },
  );

  it("rejects throwing getPos and same-type wrong node identity without editing another block", () => {
    const first = mount({
      getPos: () => {
        throw new Error("deleted");
      },
    });
    expect(first.entry().selectLanguage("python")).toBe(false);
    expect(first.dispatched).not.toHaveBeenCalled();
    const second = mount();
    const original = second.view.state.doc.firstChild!;
    const other = composerSchema.node(
      "code_block",
      null,
      composerSchema.text("other"),
    );
    let pos = 0;
    const stale = second.registry.createNodeView(
      original,
      second.view,
      () => pos,
    );
    second.view.dispatch(second.view.state.tr.insert(original.nodeSize, other));
    pos = original.nodeSize;
    second.dispatched.mockClear();
    expect(stale.selectLanguage("python")).toBe(false);
    expect(second.view.state.doc.nodeAt(pos)?.textContent).toBe("other");
    expect(second.dispatched).not.toHaveBeenCalled();
  });

  it("disabled/composing/destroyed or unregistered entry never dispatches or focuses", () => {
    const { view, entry, registry, dispatched } = mount();
    const oldEntry = entry();
    const focus = vi.spyOn(view, "focus");
    view.setProps({ editable: () => false });
    expect(oldEntry.selectLanguage("python")).toBe(false);
    oldEntry.focusEditor();
    expect(focus).not.toHaveBeenCalled();
    view.setProps({ editable: () => true });
    const composing = vi.spyOn(view, "composing", "get").mockReturnValue(true);
    expect(oldEntry.selectLanguage("python")).toBe(false);
    composing.mockRestore();
    registry.unregisterNodeView(oldEntry.id);
    expect(oldEntry.selectLanguage("python")).toBe(false);
    expect(oldEntry.getContent()).toBe("");
    view.destroy();
    expect(oldEntry.selectLanguage("python")).toBe(false);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it("unknown saved language is displayed safely, unknown manual selection cannot write", () => {
    const { entry, host, dispatched } = mount({
      language: "custom-lang",
      auto: false,
    });
    expect(entry().language).toBe("custom-lang");
    expect(host.querySelector("code")?.className).toBe(
      "hljs language-custom-lang",
    );
    expect(entry().selectLanguage("custom-lang")).toBe(false);
    expect(dispatched).not.toHaveBeenCalled();
  });

  it("metadata update preserves PM code text nodes and isolates only presentation mutations/events", () => {
    const { view, registry } = mount();
    const nodeView = registry.createNodeView(
      view.state.doc.firstChild!,
      view,
      () => 0,
    );
    const text = document.createTextNode("sentinel");
    nodeView.contentDOM.append(text);
    const node = view.state.doc.firstChild!.type.create(
      { language: "python", autoDetectLanguage: false },
      view.state.doc.firstChild!.content,
    );
    expect(nodeView.update(node)).toBe(true);
    expect(nodeView.contentDOM.firstChild).toBe(text);
    expect(nodeView.contentDOM.textContent).toBe("sentinel");
    const mutation = (type: string, target: Node) =>
      ({ type, target }) as unknown as MutationRecord;
    expect(nodeView.ignoreMutation(mutation("characterData", text))).toBe(
      false,
    );
    expect(
      nodeView.ignoreMutation(mutation("childList", nodeView.contentDOM)),
    ).toBe(false);
    expect(
      nodeView.ignoreMutation(mutation("attributes", nodeView.contentDOM)),
    ).toBe(true);
    expect(nodeView.ignoreMutation({ type: "selection", target: text })).toBe(
      false,
    );
    const button = document.createElement("button");
    nodeView.toolbarPortalContainer.append(button);
    expect(nodeView.ignoreMutation(mutation("childList", button))).toBe(true);
    const toolbarEvent = new Event("keydown");
    Object.defineProperty(toolbarEvent, "target", { value: button });
    expect(nodeView.stopEvent(toolbarEvent)).toBe(true);
    const codeEvent = new Event("keydown");
    Object.defineProperty(codeEvent, "target", { value: text });
    expect(nodeView.stopEvent(codeEvent)).toBe(false);
    expect(nodeView.update(composerSchema.node("paragraph"))).toBe(false);
    nodeView.destroy();
    nodeView.destroy();
    expect(nodeView.update(node)).toBe(false);
  });
});
