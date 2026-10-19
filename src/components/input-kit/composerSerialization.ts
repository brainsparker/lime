import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  composerCodeLanguage,
  composerDocumentFromJSON,
  composerSchema,
  normalizeComposerText,
} from "./composerSchema";
import { formatComposerLink, parseComposerInlineLinks } from "./composerLinks";
import type {
  ComposerInputMention,
  ComposerMentionBinding,
  ComposerPendingPaste,
  ComposerTextElement,
  ComposerBlock,
  ComposerLinkAttributes,
} from "./types";

export interface ComposerTextSpan {
  pmFrom: number;
  pmTo: number;
  from: number;
  to: number;
  atom: boolean;
}

export interface ComposerProjection {
  text: string;
  spans: ComposerTextSpan[];
  textElements: ComposerTextElement[];
  mentionBindings: ComposerMentionBinding[];
  pendingPastes: ComposerPendingPaste[];
  inputMentions: ComposerInputMention[];
}

export function projectComposerDocument(
  doc: ProseMirrorNode,
  expandPastes = false,
): ComposerProjection {
  const result: ComposerProjection = {
    text: "",
    spans: [],
    textElements: [],
    mentionBindings: [],
    pendingPastes: [],
    inputMentions: [],
  };
  const encoder = new TextEncoder();
  let byteOffset = 0;
  const append = (text: string, pmFrom: number, pmTo: number, atom = false) => {
    const from = result.text.length;
    const start = byteOffset;
    result.text += text;
    byteOffset += encoder.encode(text).length;
    result.spans.push({ pmFrom, pmTo, from, to: result.text.length, atom });
    return {
      from,
      to: result.text.length,
      byteRange: { start, end: byteOffset },
    };
  };
  let previousEnd: number | null = null;
  doc.forEach((paragraph, offset) => {
    if (previousEnd !== null) append("\n", previousEnd, offset + 1);
    paragraph.forEach((node, childOffset) => {
      const pmFrom = offset + 1 + childOffset;
      const pmTo = pmFrom + node.nodeSize;
      if (node.isText) {
        append(node.text ?? "", pmFrom, pmTo);
      } else if (node.type.name === "hard_break") {
        append("\n", pmFrom, pmTo);
      } else {
        const attrs = node.attrs;
        const isPaste = node.type.name === "paste";
        const text =
          node.type.name === "mention"
            ? (attrs.label as string)
            : isPaste
              ? expandPastes
                ? (attrs.text as string)
                : (attrs.placeholder as string)
              : (attrs.text as string);
        const range = append(text, pmFrom, pmTo, true);
        const placeholder =
          node.type.name === "mention"
            ? (attrs.label as string)
            : (attrs.placeholder as string | null | undefined);
        result.textElements.push({
          byteRange: range.byteRange,
          ...(placeholder == null ? {} : { placeholder }),
        });
        if (node.type.name === "mention") {
          result.mentionBindings.push({
            id: attrs.id,
            kind: attrs.kind,
            name: attrs.name,
            path: attrs.path,
            label: attrs.label,
            ...(attrs.displayName ? { displayName: attrs.displayName } : {}),
            from: range.from,
            to: range.to,
          });
          result.inputMentions.push({
            type: attrs.kind === "skill" ? "skill" : "mention",
            name: attrs.name,
            path: attrs.path,
          });
        } else if (isPaste) {
          result.pendingPastes.push({
            placeholder: attrs.placeholder,
            text: attrs.text,
          });
        }
      }
    });
    previousEnd = offset + 1 + paragraph.content.size;
  });
  return result;
}

export function serializeComposerDocument(
  doc: ProseMirrorNode,
  options: { preserveLiteralMarkdown?: boolean } = {},
): {
  text: string;
  textElements: ComposerTextElement[];
  inputMentions: ComposerInputMention[];
} {
  const result: {
    text: string;
    textElements: ComposerTextElement[];
    inputMentions: ComposerInputMention[];
  } = {
    text: "",
    textElements: [],
    inputMentions: [],
  };
  const encoder = new TextEncoder();
  let bytes = 0;
  const append = (text: string) => {
    const start = bytes;
    result.text += text;
    bytes += encoder.encode(text).length;
    return { start, end: bytes };
  };
  doc.forEach((block, _offset, index) => {
    if (index > 0) append("\n");
    if (block.type.name === "code_block") {
      const body = block.textContent;
      const longest = (body.match(/`+/g) ?? []).reduce(
        (length, run) => Math.max(length, run.length),
        0,
      );
      const fence = "`".repeat(Math.max(3, longest + 1));
      append(
        `${fence}${composerCodeLanguage(block.attrs) ?? ""}\n${body}\n${fence}`,
      );
      return;
    }
    if (block.type.name !== "paragraph")
      throw new Error("Invalid composer block");
    let linkRun: {
      text: string;
      mark: ProseMirrorNode["marks"][number];
    } | null = null;
    const flushLink = () => {
      if (linkRun)
        append(
          formatComposerLink(
            linkRun.text,
            linkRun.mark.attrs as ComposerLinkAttributes,
            options.preserveLiteralMarkdown,
          ),
        );
      linkRun = null;
    };
    block.forEach((node) => {
      const link = node.isText
        ? node.marks.find((mark) => mark.type.name === "link")
        : undefined;
      if (link) {
        if (linkRun && linkRun.mark.eq(link)) linkRun.text += node.text ?? "";
        else {
          flushLink();
          linkRun = { text: node.text ?? "", mark: link };
        }
        return;
      }
      flushLink();
      if (node.isText) append(node.text ?? "");
      else if (node.type.name === "hard_break") append("\n");
      else if (["mention", "paste", "text_element"].includes(node.type.name)) {
        const attrs = node.attrs;
        const isMention = node.type.name === "mention";
        const text = isMention ? attrs.label : attrs.text;
        const byteRange = append(text);
        const placeholder = isMention ? attrs.label : attrs.placeholder;
        result.textElements.push({
          byteRange,
          ...(placeholder == null ? {} : { placeholder }),
        });
        if (isMention)
          result.inputMentions.push({
            type: attrs.kind === "skill" ? "skill" : "mention",
            name: attrs.name,
            path: attrs.path,
          });
      } else throw new Error("Invalid composer inline");
    });
    flushLink();
  });
  return result;
}

export function composerDocumentFromPromptText(
  value: string,
  occurrenceStart = 1,
): ProseMirrorNode {
  const lines = normalizeComposerText(value).split("\n");
  const blocks: ComposerBlock[] = [];
  const occurrence = { next: occurrenceStart };
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^(`{3,})([^\s`]*)$/.exec(lines[index]);
    if (opening) {
      const closing = new RegExp(`^\x60{${opening[1].length},}[ \\t]*$`);
      const end = lines.findIndex(
        (line, candidate) => candidate > index && closing.test(line),
      );
      if (end > index) {
        const body = lines.slice(index + 1, end).join("\n");
        blocks.push({
          type: "code_block",
          attrs: {
            language: opening[2] || null,
            autoDetectLanguage: !opening[2],
          },
          content: body ? [{ type: "text", text: body }] : [],
        });
        index = end;
        continue;
      }
    }
    blocks.push({
      type: "paragraph",
      content: parseComposerInlineLinks(lines[index], occurrence),
    });
  }
  return composerDocumentFromJSON({ type: "doc", content: blocks });
}

export function utf8ByteOffsetToUtf16(text: string, offset: number): number {
  if (!Number.isInteger(offset) || offset < 0)
    throw new Error("Invalid UTF-8 offset");
  let bytes = 0;
  let units = 0;
  const encoder = new TextEncoder();
  if (offset === 0) return 0;
  for (const character of text) {
    bytes += encoder.encode(character).length;
    units += character.length;
    if (bytes === offset) return units;
    if (bytes > offset) break;
  }
  throw new Error("Composer range is not on a UTF-8 boundary");
}

interface AnnotatedRange {
  from: number;
  to: number;
  node: ProseMirrorNode;
}

export function composerDocumentFromAnnotations(input: {
  text?: string;
  textElements?: readonly ComposerTextElement[];
  mentionBindings?: readonly ComposerMentionBinding[];
  pendingPastes?: readonly ComposerPendingPaste[];
}): ProseMirrorNode {
  const originalText = input.text ?? "";
  const text = normalizeComposerText(originalText);
  const utf16Boundaries = new Set([0]);
  let units = 0;
  for (const character of originalText) {
    units += character.length;
    utf16Boundaries.add(units);
  }
  const normalizedOffset = (offset: number): number => {
    if (!utf16Boundaries.has(offset))
      throw new Error("Composer range is not on a UTF-16 boundary");
    return normalizeComposerText(originalText.slice(0, offset)).length;
  };
  const ranges: AnnotatedRange[] = (input.mentionBindings ?? []).map(
    (binding) => {
      const { from, to, ...attrs } = binding;
      return {
        from: normalizedOffset(from),
        to: normalizedOffset(to),
        node: composerSchema.node("mention", attrs),
      };
    },
  );
  for (const element of input.textElements ?? []) {
    const from = normalizedOffset(
      utf8ByteOffsetToUtf16(originalText, element.byteRange.start),
    );
    const to = normalizedOffset(
      utf8ByteOffsetToUtf16(originalText, element.byteRange.end),
    );
    if (ranges.some((range) => range.from === from && range.to === to))
      continue;
    ranges.push({
      from,
      to,
      node: composerSchema.node("text_element", {
        text: text.slice(from, to),
        placeholder: element.placeholder ?? null,
      }),
    });
  }
  for (const [index, paste] of (input.pendingPastes ?? []).entries()) {
    let from = text.indexOf(paste.placeholder);
    if (!paste.placeholder) throw new Error("Invalid paste placeholder");
    while (from >= 0) {
      const to = from + paste.placeholder.length;
      const existing = ranges.findIndex(
        (range) => range.from === from && range.to === to,
      );
      if (existing >= 0) ranges.splice(existing, 1);
      ranges.push({
        from,
        to,
        node: composerSchema.node("paste", {
          id: `restored-paste-${index}-${from}`,
          placeholder: paste.placeholder,
          text: normalizeComposerText(paste.text),
        }),
      });
      from = text.indexOf(paste.placeholder, to);
    }
  }
  ranges.sort((left, right) => left.from - right.from);
  const paragraphs: ProseMirrorNode[] = [];
  let inline: ProseMirrorNode[] = [];
  const appendText = (value: string) => {
    const lines = value.split("\n");
    lines.forEach((line, index) => {
      if (index > 0) {
        paragraphs.push(composerSchema.node("paragraph", null, inline));
        inline = [];
      }
      if (line) inline.push(composerSchema.text(line));
    });
  };
  let cursor = 0;
  for (const range of ranges) {
    if (
      !Number.isInteger(range.from) ||
      !Number.isInteger(range.to) ||
      range.from < cursor ||
      range.to <= range.from ||
      range.to > text.length
    ) {
      throw new Error("Invalid or overlapping composer annotations");
    }
    appendText(text.slice(cursor, range.from));
    inline.push(range.node);
    cursor = range.to;
  }
  appendText(text.slice(cursor));
  paragraphs.push(composerSchema.node("paragraph", null, inline));
  return composerSchema.node("doc", null, paragraphs);
}
