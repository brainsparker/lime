import { history, undo, redo } from "@tiptap/pm/history";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCodeBlockAutoDetect } from "./composerCodeBlockAutoDetect";
import {
  createCodeBlockLoaders,
  loadCodeBlockParser,
} from "./composerCodeBlockHighlight";
import { detectCodeBlockLanguage } from "./composerCodeBlockLanguage";
import { codeDoc, deferred, mountCodeView } from "./composerCodeBlockTestUtils";

const mounted: ReturnType<typeof mountCodeView>[] = [];
afterEach(() => {
  mounted.splice(0).forEach((item) => item.destroy());
  vi.useRealTimers();
});
const mount = (
  source: string,
  options: Parameters<typeof createCodeBlockAutoDetect>[0] = {},
  editable = true,
) => {
  const item = mountCodeView(
    codeDoc(source),
    [history(), createCodeBlockAutoDetect(options)],
    { editable },
  );
  mounted.push(item);
  return item;
};

describe("Auto metadata lifecycle", () => {
  it("debounces to 150ms, preserves body/selection, and writes no-history attrs", async () => {
    vi.useFakeTimers();
    const detect = vi.fn(async () => "typescript");
    const item = mount("const count: number = 1", { detect });
    item.selectCode();
    const selection = item.view.state.selection;
    await vi.advanceTimersByTimeAsync(149);
    expect(detect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(detect).toHaveBeenCalledTimes(1);
    expect(item.view.state.doc.firstChild!.attrs).toMatchObject({
      language: "typescript",
      autoDetectLanguage: true,
    });
    expect(item.view.state.doc.textContent).toBe("const count: number = 1");
    expect(item.view.state.selection.eq(selection)).toBe(true);
    expect(item.transactions.filter((t) => t.docChanged)).toEqual([
      { docChanged: true, addToHistory: false },
    ]);
    await vi.advanceTimersByTimeAsync(150);
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it("runs the real default detector against source code", async () => {
    const item = mount("def hello():\n  return 1");
    await vi.waitFor(() =>
      expect(item.view.state.doc.firstChild!.attrs.language).toBe("python"),
    );
    expect(item.view.state.doc.textContent).toBe("def hello():\n  return 1");
    const source =
      "pub fn answer<'a>(value: &'a str) -> Option<&'a str> { Some(value) }";
    const unhinted = mount(source);
    await vi.waitFor(() =>
      expect(unhinted.view.state.doc.firstChild!.attrs.language).toBe("rust"),
    );
    expect(unhinted.view.state.doc.textContent).toBe(source);
  });

  it("rejects an old doc result after edits while the next generation stays usable", async () => {
    vi.useFakeTimers();
    const old = deferred<string | null>(),
      current = deferred<string | null>();
    const detect = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const item = mount("original code", { detect });
    await vi.advanceTimersByTimeAsync(150);
    item.view.dispatch(item.view.state.tr.insertText("new ", 1));
    old.resolve("javascript");
    await Promise.resolve();
    expect(item.view.state.doc.firstChild!.attrs.language).toBeNull();
    await vi.advanceTimersByTimeAsync(150);
    current.resolve("rust");
    await vi.advanceTimersByTimeAsync(0);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("rust");
  });

  it.each(["manual", "delete", "restore", "plain", "destroy"])(
    "rejects pending results after %s",
    async (action) => {
      vi.useFakeTimers();
      let enabled = true;
      const pending = deferred<string | null>();
      const item = mount("pending source", {
        detect: () => pending.promise,
        enabled: () => enabled,
      });
      await vi.advanceTimersByTimeAsync(150);
      if (action === "manual")
        item.view.dispatch(
          item.view.state.tr.setNodeMarkup(0, undefined, {
            language: "plaintext",
            autoDetectLanguage: false,
          }),
        );
      if (action === "delete")
        item.view.dispatch(
          item.view.state.tr.replaceWith(
            0,
            item.view.state.doc.content.size,
            item.view.state.schema.node("paragraph"),
          ),
        );
      if (action === "restore")
        item.view.updateState(
          EditorState.create({
            doc: codeDoc("restored", "python", false),
            plugins: item.view.state.plugins,
          }),
        );
      if (action === "plain") {
        enabled = false;
        item.view.updateState(item.view.state);
      }
      if (action === "destroy") item.destroy();
      const before = item.view.state.doc;
      pending.resolve("typescript");
      await vi.advanceTimersByTimeAsync(0);
      expect(item.view.state.doc).toBe(before);
    },
  );

  it("isolates two editor owners even at the same state revision", async () => {
    vi.useFakeTimers();
    const first = deferred<string | null>(),
      second = deferred<string | null>();
    const a = mount("same code", { detect: () => first.promise }),
      b = mount("same code", { detect: () => second.promise });
    await vi.advanceTimersByTimeAsync(150);
    first.resolve("java");
    await vi.advanceTimersByTimeAsync(0);
    expect(a.view.state.doc.firstChild!.attrs.language).toBe("java");
    expect(b.view.state.doc.firstChild!.attrs.language).toBeNull();
    second.resolve("rust");
    await vi.advanceTimersByTimeAsync(0);
    expect(b.view.state.doc.firstChild!.attrs.language).toBe("rust");
  });

  it("invalidates the pending generation when restoring state with the same document identity", async () => {
    vi.useFakeTimers();
    const pending = deferred<string | null>();
    const item = mount("same document source", {
      detect: () => pending.promise,
    });
    await vi.advanceTimersByTimeAsync(150);
    const doc = item.view.state.doc;
    item.view.updateState(
      EditorState.create({ doc, plugins: item.view.state.plugins }),
    );
    pending.resolve("rust");
    await vi.advanceTimersByTimeAsync(0);
    expect(item.view.state.doc).toBe(doc);
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("rust");
  });

  it("guards readonly and IME as Lime policy, then resumes current editable source", async () => {
    vi.useFakeTimers();
    const detect = vi.fn(async () => "javascript");
    const readonly = mount("const readonly = 1", { detect }, false);
    await vi.advanceTimersByTimeAsync(500);
    expect(detect).not.toHaveBeenCalled();
    readonly.view.setProps({ editable: () => true });
    await vi.advanceTimersByTimeAsync(150);
    expect(readonly.view.state.doc.firstChild!.attrs.language).toBe(
      "javascript",
    );
    const composing = mount("const ime = 1", { detect });
    Object.defineProperty(composing.view, "composing", {
      configurable: true,
      value: true,
    });
    const calls = detect.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(detect).toHaveBeenCalledTimes(calls);
    Object.defineProperty(composing.view, "composing", {
      configurable: true,
      value: false,
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(composing.view.state.doc.firstChild!.attrs.language).toBe(
      "javascript",
    );
  });

  it("keeps manual language and handles rejected detection as plain without changing content", async () => {
    vi.useFakeTimers();
    const item = mount("unknown content", {
      detect: () => Promise.reject(new Error("bad parser")),
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("plaintext");
    item.view.dispatch(
      item.view.state.tr.setNodeMarkup(0, undefined, {
        language: "typescript",
        autoDetectLanguage: false,
      }),
    );
    item.view.dispatch(item.view.state.tr.insertText("changed ", 1));
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("typescript");
  });

  it("clears empty Auto language and leaves user undo/redo semantics intact", async () => {
    vi.useFakeTimers();
    const item = mount("let x = 1", {
      detect: async (content) => (content.trim() ? "javascript" : null),
    });
    item.selectCode();
    await vi.advanceTimersByTimeAsync(150);
    item.view.dispatch(
      item.view.state.tr.delete(1, item.view.state.doc.content.size - 1),
    );
    expect(item.view.state.doc.firstChild!.attrs.language).toBeNull();
    expect(undo(item.view.state, item.view.dispatch)).toBe(true);
    expect(item.view.state.doc.textContent).toBe("let x = 1");
    expect(undo(item.view.state, item.view.dispatch)).toBe(false);
    expect(redo(item.view.state, item.view.dispatch)).toBe(true);
    expect(item.view.state.doc.textContent).toBe("");
  });

  it.each(["neighbor", "attrs", "delete-before", "replace", "convert"])(
    "does not clear unrelated or already empty metadata after %s",
    (action) => {
      vi.useFakeTimers();
      const empty = codeDoc("", "python").firstChild!;
      const nonempty = codeDoc("original", "javascript").firstChild!;
      const schema = empty.type.schema;
      const paragraph = schema.node("paragraph", null, schema.text("outside"));
      const blocks =
        action === "delete-before"
          ? [nonempty, empty]
          : action === "replace"
            ? [nonempty]
            : action === "convert"
              ? [schema.node("paragraph")]
              : [empty, paragraph];
      const item = mountCodeView(schema.node("doc", null, blocks), [
        createCodeBlockAutoDetect({ detect: async () => "python" }),
      ]);
      mounted.push(item);
      item.view.dispatch(
        item.view.state.tr.setSelection(
          TextSelection.create(
            item.view.state.doc,
            action === "delete-before" ? nonempty.nodeSize + 1 : 1,
          ),
        ),
      );
      let transaction = item.view.state.tr;
      if (action === "neighbor")
        transaction = transaction.insertText(
          "!",
          transaction.doc.content.size - 1,
        );
      if (action === "attrs")
        transaction = transaction.setNodeMarkup(0, undefined, {
          language: "rust",
          autoDetectLanguage: true,
        });
      if (action === "delete-before")
        transaction = transaction.delete(0, nonempty.nodeSize);
      if (action === "replace")
        transaction = transaction.replaceWith(0, nonempty.nodeSize, empty);
      if (action === "convert")
        transaction = transaction.setNodeMarkup(
          0,
          schema.nodes.code_block,
          empty.attrs,
        );
      item.view.dispatch(transaction);
      expect(item.view.state.doc.firstChild!.attrs.language).toBe(
        action === "attrs" ? "rust" : "python",
      );
      expect(
        item.transactions.filter(
          (item) => item.docChanged && item.addToHistory === false,
        ),
      ).toEqual([]);
    },
  );

  it("maps selected code through earlier structural edits when clearing its text", () => {
    vi.useFakeTimers();
    const item = mount("original", { detect: async () => "javascript" });
    item.view.dispatch(
      item.view.state.tr.setNodeMarkup(0, undefined, {
        language: "javascript",
        autoDetectLanguage: true,
      }),
    );
    item.selectCode();
    const paragraph = item.view.state.schema.node(
      "paragraph",
      null,
      item.view.state.schema.text("before"),
    );
    const transaction = item.view.state.tr.insert(0, paragraph);
    const pos = paragraph.nodeSize;
    transaction.delete(pos + 1, pos + 1 + "original".length);
    item.view.dispatch(transaction);
    expect(item.view.state.doc.lastChild!.attrs.language).toBeNull();
    expect(item.view.state.doc.firstChild!.textContent).toBe("before");
  });

  it("defers a pending result that resolves during composition and resumes without re-detecting", async () => {
    vi.useFakeTimers();
    const pending = deferred<string | null>();
    const detect = vi.fn(() => pending.promise);
    const item = mount("current source", { detect });
    await vi.advanceTimersByTimeAsync(150);
    Object.defineProperty(item.view, "composing", {
      configurable: true,
      value: true,
    });
    pending.resolve("typescript");
    await vi.advanceTimersByTimeAsync(0);
    expect(item.view.state.doc.firstChild!.attrs.language).toBeNull();
    Object.defineProperty(item.view, "composing", {
      configurable: true,
      value: false,
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("typescript");
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it("recovers detector import failure on a new code node while keeping failed-node plain metadata cached", async () => {
    const real = await loadCodeBlockParser();
    vi.useFakeTimers();
    const detector = vi
      .fn()
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValue(real);
    const owner = createCodeBlockLoaders({
      detector,
      parser: async () => real,
    });
    const source =
      "pub fn answer<'a>(value: &'a str) -> Option<&'a str> { Some(value) }";
    const item = mount(source, {
      detect: (content) =>
        detectCodeBlockLanguage(content, async (text, subset) =>
          (await owner.loadDetector()).detect(text, subset),
        ),
    });
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("plaintext");
    await vi.advanceTimersByTimeAsync(150);
    expect(detector).toHaveBeenCalledTimes(1);
    item.view.dispatch(item.view.state.tr.insertText(" ", 1));
    await vi.advanceTimersByTimeAsync(150);
    expect(item.view.state.doc.firstChild!.attrs.language).toBe("rust");
    expect(detector).toHaveBeenCalledTimes(2);
    expect(item.view.state.doc.textContent).toBe(` ${source}`);
  });

  it("updates only Auto blocks while preserving all code and the current selection", async () => {
    vi.useFakeTimers();
    const first = codeDoc("source one").firstChild!;
    const manual = codeDoc("source manual", "rust", false).firstChild!;
    const last = codeDoc("source two").firstChild!;
    const detect = vi.fn(async (content: string) =>
      content === "source one" ? "javascript" : "python",
    );
    const doc = first.type.schema.node("doc", null, [first, manual, last]);
    const item = mountCodeView(doc, [createCodeBlockAutoDetect({ detect })]);
    mounted.push(item);
    item.view.dispatch(
      item.view.state.tr.setSelection(
        TextSelection.create(doc, first.nodeSize + 2),
      ),
    );
    const selection = item.view.state.selection;
    await vi.advanceTimersByTimeAsync(150);
    expect(detect).toHaveBeenCalledTimes(2);
    expect(item.view.state.doc.child(0).attrs.language).toBe("javascript");
    expect(item.view.state.doc.child(1)).toBe(manual);
    expect(item.view.state.doc.child(2).attrs.language).toBe("python");
    expect(item.view.state.doc.textContent).toBe(doc.textContent);
    expect(item.view.state.selection.eq(selection)).toBe(true);
    expect(item.transactions.filter((item) => item.docChanged)).toEqual([
      { docChanged: true, addToHistory: false },
    ]);
  });
});
