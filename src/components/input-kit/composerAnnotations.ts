import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  composerPositionToOffset,
  composerTextSelection,
} from "./composerPositions";
import { composerSchema } from "./composerSchema";

export function replaceComposerAnnotations(
  state: EditorState,
  kind: "mention" | "text_element",
  annotated: ProseMirrorNode,
  occupied: readonly { from: number; to: number }[] = [],
): Transaction {
  const desired: { from: number; to: number; node: ProseMirrorNode }[] = [];
  annotated.descendants((node, position) => {
    if (node.type.name !== kind) return;
    const from = composerPositionToOffset(annotated, position);
    const to = composerPositionToOffset(annotated, position + node.nodeSize);
    if (!occupied.some((span) => span.from === from && span.to === to))
      desired.push({ from, to, node });
  });
  const removals: { position: number; node: ProseMirrorNode }[] = [];
  state.doc.descendants((node, position) => {
    if (node.type.name === kind) removals.push({ position, node });
  });
  const transaction = state.tr;
  for (const { position, node } of removals.reverse()) {
    const text = kind === "mention" ? node.attrs.label : node.attrs.text;
    if (text)
      transaction.replaceWith(
        position,
        position + node.nodeSize,
        composerSchema.text(text),
      );
    else transaction.delete(position, position + node.nodeSize);
  }
  for (const range of desired.reverse()) {
    const selection = composerTextSelection(transaction.doc, {
      start: range.from,
      end: range.to,
    });
    if (
      selection.$from.parent !== selection.$to.parent ||
      selection.$from.parent.type.name !== "paragraph"
    )
      throw new Error("Invalid composer annotation block");
    let overlapsAtom = false;
    transaction.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.isInline && node.isAtom && !node.isText) overlapsAtom = true;
    });
    if (overlapsAtom) throw new Error("Overlapping composer atom annotation");
    transaction.setSelection(selection).replaceSelectionWith(range.node, false);
  }
  transaction.setSelection(
    state.selection.map(transaction.doc, transaction.mapping),
  );
  return transaction;
}
