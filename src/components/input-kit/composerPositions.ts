import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { projectComposerDocument } from "./composerSerialization";
import type { ComposerSelection } from "./types";

export function clampComposerOffset(text: string, value: number, bias: -1 | 1 = 1): number {
  let offset = Number.isFinite(value) ? Math.max(0, Math.min(Math.trunc(value), text.length)) : text.length;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) offset += bias;
  return offset;
}

export function composerOffsetToPosition(doc: ProseMirrorNode, value: number, bias: -1 | 1 = 1): number {
  const { text, spans } = projectComposerDocument(doc);
  const offset = clampComposerOffset(text, value, bias);
  for (const span of spans) {
    if (offset < span.from || offset > span.to) continue;
    if (offset === span.from) return span.pmFrom;
    if (offset === span.to) return span.pmTo;
    if (span.atom) return bias < 0 ? span.pmFrom : span.pmTo;
    if (span.to - span.from !== span.pmTo - span.pmFrom) return bias < 0 ? span.pmFrom : span.pmTo;
    return span.pmFrom + offset - span.from;
  }
  return Math.max(1, doc.content.size - 1);
}

export function composerPositionToOffset(doc: ProseMirrorNode, position: number): number {
  const { text, spans } = projectComposerDocument(doc);
  for (const span of spans) {
    if (position < span.pmFrom) return span.from;
    if (position > span.pmTo) continue;
    if (position === span.pmFrom) return span.from;
    if (position === span.pmTo) return span.to;
    if (span.atom || span.to - span.from !== span.pmTo - span.pmFrom) return span.from;
    return clampComposerOffset(text, span.from + position - span.pmFrom);
  }
  return text.length;
}

export function composerTextSelection(doc: ProseMirrorNode, range: ComposerSelection): TextSelection {
  const collapsed = range.start === range.end;
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);
  return TextSelection.create(
    doc,
    composerOffsetToPosition(doc, start, collapsed ? 1 : -1),
    composerOffsetToPosition(doc, end, 1),
  );
}
