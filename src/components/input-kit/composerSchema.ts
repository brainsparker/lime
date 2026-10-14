import { Schema, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ComposerEditorDocument } from "./types";
import { composerLinkDefaults, normalizeComposerHref } from "./composerLinks";

export function normalizeComposerCodeLanguage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && !/[\s`]/.test(value)
    ? value
    : null;
}

export function composerCodeLanguage(attrs: {
  language?: unknown;
  autoDetectLanguage?: unknown;
}): string | null {
  const language = normalizeComposerCodeLanguage(attrs.language);
  return language === "plaintext" && attrs.autoDetectLanguage !== false
    ? null
    : language;
}

function readCodeLanguage(code: HTMLElement, pre: HTMLElement): string | null {
  const value =
    code.getAttribute("data-language") ??
    code.getAttribute("data-lang") ??
    pre.getAttribute("data-language") ??
    pre.getAttribute("data-lang") ??
    [...code.classList, ...pre.classList]
      .find((name) => /^(language-|lang-)/.test(name))
      ?.replace(/^(language-|lang-)/, "");
  return normalizeComposerCodeLanguage(value);
}

function linkAttrs(element: HTMLElement, span = false) {
  const href = normalizeComposerHref(
    element.getAttribute(span ? "text-link-href" : "href"),
  );
  if (!href) return false;
  const flag = (name: string) =>
    element.hasAttribute(name) && element.getAttribute(name) !== "false";
  return {
    ...composerLinkDefaults,
    href,
    title: element.getAttribute(span ? "text-link-title" : "title"),
    isAutolink: flag(span ? "data-breakable-url" : "data-rich-text-autolink"),
    isGeneratedAutolink: flag("data-rich-text-generated-autolink"),
  };
}

export const composerSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
    code_block: {
      content: "text*",
      group: "block",
      code: true,
      defining: true,
      marks: "",
      attrs: {
        autoDetectLanguage: { default: true, validate: "boolean" },
        language: { default: null, validate: "string|null" },
      },
      parseDOM: [
        {
          tag: "pre",
          preserveWhitespace: "full",
          getAttrs: (element) => {
            const code = Array.from(element.children).find(
              (child) => child.tagName === "CODE",
            );
            return code instanceof HTMLElement
              ? { language: readCodeLanguage(code, element) }
              : false;
          },
          contentElement: (element) =>
            Array.from(element.children).find(
              (child) => child.tagName === "CODE",
            ) as HTMLElement,
        },
      ],
      toDOM: (node) => [
        "pre",
        { "data-composer-code-block": "", dir: "ltr" },
        [
          "code",
          {
            class: "hljs",
            ...(composerCodeLanguage(node.attrs)
              ? { "data-language": composerCodeLanguage(node.attrs) }
              : {}),
          },
          0,
        ],
      ],
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
    mention: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: { id: {}, kind: {}, name: {}, path: {}, label: {} },
      toDOM: (node) => [
        "span",
        {
          "data-composer-token": node.attrs.kind,
          "data-composer-id": node.attrs.id,
          "data-composer-name": node.attrs.name,
          "data-composer-path": node.attrs.path,
          contenteditable: "false",
        },
        node.attrs.label,
      ],
    },
    paste: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: { id: {}, placeholder: {}, text: {} },
      toDOM: (node) => [
        "span",
        {
          "data-composer-token": "paste",
          "data-composer-id": node.attrs.id,
          contenteditable: "false",
        },
        node.attrs.placeholder,
      ],
    },
    text_element: {
      inline: true,
      group: "inline",
      atom: true,
      attrs: { text: {}, placeholder: { default: null } },
      toDOM: (node) => [
        "span",
        { "data-composer-token": "element", contenteditable: "false" },
        node.attrs.text,
      ],
    },
  },
  marks: {
    link: {
      inclusive: false,
      attrs: {
        href: { default: null, validate: "string|null" },
        title: { default: null, validate: "string|null" },
        disabled: { default: false, validate: "boolean" },
        isAutolink: { default: false, validate: "boolean" },
        isGeneratedAutolink: { default: false, validate: "boolean" },
        literalMarkdownOccurrenceId: { default: null, validate: "number|null" },
        literalMarkdownSource: { default: null, validate: "string|null" },
        sourceAppId: { default: null, validate: "string|null" },
      },
      parseDOM: [
        { tag: "a[href]", getAttrs: (element) => linkAttrs(element) },
        {
          tag: "span[text-link-href]",
          getAttrs: (element) => linkAttrs(element, true),
        },
      ],
      toDOM: (mark) => [
        "span",
        {
          "text-link-href": mark.attrs.href,
          ...(mark.attrs.title === null
            ? {}
            : { "text-link-title": mark.attrs.title }),
          ...(mark.attrs.isAutolink ? { "data-breakable-url": "true" } : {}),
          ...(mark.attrs.isGeneratedAutolink
            ? { "data-rich-text-generated-autolink": "true" }
            : {}),
          ...(mark.attrs.sourceAppId === null
            ? {}
            : { "data-source-app-id": mark.attrs.sourceAppId }),
          role: "link",
          "aria-disabled": mark.attrs.disabled ? "true" : "false",
        },
        0,
      ],
    },
  },
});

export function normalizeComposerText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function composerDocumentFromText(text: string): ProseMirrorNode {
  return composerSchema.node(
    "doc",
    null,
    normalizeComposerText(text)
      .split("\n")
      .map((line) =>
        composerSchema.node(
          "paragraph",
          null,
          line ? composerSchema.text(line) : undefined,
        ),
      ),
  );
}

export function composerDocumentFromJSON(
  json: ComposerEditorDocument,
): ProseMirrorNode {
  const doc = composerSchema.nodeFromJSON(json);
  if (doc.type !== composerSchema.nodes.doc)
    throw new Error("Invalid composer document root");
  doc.check();
  doc.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type !== composerSchema.marks.link || !node.isText)
        throw new Error("Invalid composer mark");
      if (
        mark.attrs.href !== null &&
        normalizeComposerHref(mark.attrs.href) === null
      )
        throw new Error("Invalid composer link href");
      if (
        mark.attrs.literalMarkdownOccurrenceId !== null &&
        !Number.isFinite(mark.attrs.literalMarkdownOccurrenceId)
      )
        throw new Error("Invalid composer literal occurrence");
    }
    const attrs = node.attrs;
    const requireStrings = (keys: readonly string[]) => {
      if (keys.some((key) => typeof attrs[key] !== "string")) {
        throw new Error(`Invalid composer ${node.type.name} attributes`);
      }
    };
    if (node.type.name === "code_block") {
      if (
        attrs.language !== null &&
        normalizeComposerCodeLanguage(attrs.language) === null
      )
        throw new Error("Invalid composer code language");
    } else if (node.type.name === "mention") {
      requireStrings(["id", "kind", "name", "path", "label"]);
      if (!["file", "skill", "plugin"].includes(attrs.kind)) {
        throw new Error("Invalid composer mention kind");
      }
    } else if (node.type.name === "paste") {
      requireStrings(["id", "placeholder", "text"]);
    } else if (node.type.name === "text_element") {
      requireStrings(["text"]);
      if (attrs.placeholder != null && typeof attrs.placeholder !== "string") {
        throw new Error("Invalid composer element placeholder");
      }
    }
  });
  return doc;
}
