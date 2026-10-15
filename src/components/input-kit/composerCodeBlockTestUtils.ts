import { EditorState, TextSelection, type Plugin } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { composerSchema } from "./composerSchema";

export function codeDoc(
  text: string,
  language: string | null = null,
  autoDetectLanguage = true,
) {
  return composerSchema.node("doc", null, [
    composerSchema.node(
      "code_block",
      { language, autoDetectLanguage },
      text ? composerSchema.text(text) : undefined,
    ),
  ]);
}

export function mountCodeView(
  doc: ProseMirrorNode,
  plugins: Plugin[],
  options: { editable?: boolean } = {},
) {
  const container = document.createElement("div");
  document.body.append(container);
  const transactions: { docChanged: boolean; addToHistory: unknown }[] = [];
  const view = new EditorView(container, {
    state: EditorState.create({ doc, plugins }),
    editable: () => options.editable !== false,
    dispatchTransaction(transaction) {
      const next = view.state.applyTransaction(transaction);
      for (const item of next.transactions)
        transactions.push({
          docChanged: item.docChanged,
          addToHistory: item.getMeta("addToHistory"),
        });
      view.updateState(next.state);
    },
  });
  return {
    view,
    transactions,
    selectCode() {
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)),
      );
    },
    destroy() {
      if (!view.isDestroyed) view.destroy();
      container.remove();
    },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
