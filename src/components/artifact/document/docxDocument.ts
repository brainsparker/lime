import { parseAsync, renderDocument, type HElement } from "docx-preview";
import { readFileBytes } from "@/lib/api/fileBrowser";
import { hashFileBytes } from "@/lib/artifact/fileRevision";

const options = {
  renderAltChunks: false,
  useBase64URL: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  experimental: false,
};

export interface DocxDocumentSnapshot {
  sourceSha256: string;
  pageCount: number;
  pageWidths: number[];
  hasRedlines: boolean;
  html: string;
}

const htmlTags = new Set(
  "div span section article header footer p a table colgroup col thead tbody tfoot tr td th ol ul li sup sub ins del style img br wbr h1 h2 h3 h4 h5 h6".split(
    " ",
  ),
);
const svgTags = new Set(
  "svg g path rect line polyline polygon circle ellipse image text defs clipPath".split(
    " ",
  ),
);
const mathTags = new Set(
  "math mrow mo mi mn mtext mfrac msqrt mroot msub msup msubsup mover munder munderover mtable mtr mtd mfenced mspace menclose".split(
    " ",
  ),
);

function isHttpLink(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** 所有节点先在无 browsing context 的 Document 构造，再送入禁止脚本和网络的 iframe。 */
function createInertRenderer(document: Document) {
  const create = (input: HElement | Node | string): Node => {
    if (typeof input === "string") return document.createTextNode(input);
    if (input instanceof Node) return input;
    const { tagName, ns, className, style, children } = input;
    if (tagName === "#comment") return document.createComment("");
    if (tagName === "#fragment") {
      const fragment = document.createDocumentFragment();
      for (const child of children ?? []) fragment.appendChild(create(child));
      return fragment;
    }
    const allowed =
      ns === "http://www.w3.org/2000/svg"
        ? svgTags.has(tagName)
        : ns === "http://www.w3.org/1998/Math/MathML"
          ? mathTags.has(tagName)
          : htmlTags.has(tagName);
    const element = allowed
      ? ns
        ? document.createElementNS(ns, tagName)
        : document.createElement(tagName)
      : document.createElement("span");
    if (className) element.setAttribute("class", className);
    if (style) {
      if (typeof style === "string") element.setAttribute("style", style);
      else Object.assign((element as HTMLElement).style, style);
    }
    for (const name of ["id", "colSpan", "rowSpan"] as const) {
      const value: unknown = input[name];
      if (typeof value === "string" || typeof value === "number")
        element.setAttribute(name, String(value));
    }
    if (
      tagName === "a" &&
      typeof input.href === "string" &&
      isHttpLink(input.href)
    )
      element.setAttribute("href", input.href);
    for (const child of children ?? []) element.appendChild(create(child));
    return element;
  };
  return create;
}

function inspectDocument(value: unknown): { hasRedlines: boolean } {
  if (
    !value ||
    typeof value !== "object" ||
    !("parts" in value) ||
    !Array.isArray(value.parts)
  )
    throw new Error("Invalid DOCX document");
  let hasRedlines = false;
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const entry = node as Record<string, unknown>;
    if (entry.type === "inserted" || entry.type === "deleted")
      hasRedlines = true;
    if (
      entry.type === "symbol" &&
      (typeof entry.char !== "number" ||
        !Number.isInteger(entry.char) ||
        entry.char < 0 ||
        entry.char > 0x10ffff ||
        (entry.char >= 0xd800 && entry.char <= 0xdfff))
    )
      throw new Error("Invalid DOCX symbol");
    visit(entry.children);
  };
  for (const part of value.parts) {
    if (!part || typeof part !== "object") throw new Error("Invalid DOCX part");
    const entry = part as Record<string, unknown>;
    for (const field of ["body", "rootElement", "notes", "comments"])
      visit(entry[field]);
  }
  return { hasRedlines };
}

export async function loadDocxDocument(
  path: string,
  renderChanges: boolean,
  signal: AbortSignal,
): Promise<DocxDocumentSnapshot> {
  const bytes = await readFileBytes(path);
  signal.throwIfAborted();
  const sourceSha256 = await hashFileBytes(bytes);
  signal.throwIfAborted();
  const parsed: unknown = await parseAsync(bytes, options);
  signal.throwIfAborted();
  const { hasRedlines } = inspectDocument(parsed);
  const document = window.document.implementation.createHTMLDocument("");
  const nodes = await renderDocument(parsed, {
    ...options,
    renderChanges,
    h: createInertRenderer(document),
  });
  signal.throwIfAborted();
  document.body.append(...nodes);
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        /^(?:href|xlink:href|src|srcset|action|formaction|target)$/i.test(
          attribute.name,
        )
      ) {
        const embeddedImage =
          /^(?:src|href|xlink:href)$/i.test(attribute.name) &&
          /^(?:img|image)$/i.test(element.localName) &&
          /^data:image\/(?:png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=]+$/i.test(
            attribute.value,
          );
        const externalLink =
          element.localName === "a" &&
          attribute.name === "href" &&
          isHttpLink(attribute.value);
        if (!embeddedImage && !externalLink)
          element.removeAttribute(attribute.name);
      }
    }
    // 防止文档中的字体/样式文本提前终止 srcdoc 的 style 元素。
    if (element.localName === "style")
      element.textContent = element.textContent?.replaceAll("<", "\\3c ") ?? "";
    if (element.localName === "a" && element.hasAttribute("href")) {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  }
  const pages = document.querySelectorAll("section.docx");
  if (!pages.length) throw new Error("DOCX contains no pages");
  pages.forEach((page, index) =>
    page.setAttribute("data-docx-page", String(index + 1)),
  );
  const pageWidths = Array.from(pages, (page) => {
    const width = (page as HTMLElement).style.width;
    const value = Number.parseFloat(width);
    return Number.isFinite(value) && value > 0
      ? value * (width.endsWith("pt") ? 96 / 72 : 1)
      : 816;
  });
  return {
    sourceSha256,
    pageCount: pages.length,
    pageWidths,
    hasRedlines,
    html: document.body.innerHTML,
  };
}

export function buildDocxPreviewHtml(
  snapshot: DocxDocumentSnapshot,
  page: number,
  zoom: number,
): string {
  const document = window.document.implementation.createHTMLDocument("");
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content =
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  document.head.append(policy);
  const style = document.createElement("style");
  style.id = "docx-preview-view";
  style.textContent = docxPreviewStyle(snapshot.pageCount, page, zoom);
  document.body.innerHTML = snapshot.html;
  document.body.append(style);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

export function docxPreviewStyle(
  pageCount: number,
  page: number,
  zoom: number,
): string {
  const current = Math.max(1, Math.min(pageCount, Math.trunc(page)));
  const scale = Number.isFinite(zoom) ? Math.max(0.01, Math.min(3, zoom)) : 1;
  return `html,body{margin:0;background:#fff;color:#000} .docx-wrapper{padding:0!important;background:transparent!important;align-items:flex-start!important} section.docx{display:none!important;box-shadow:none!important;margin:0!important} section.docx[data-docx-page="${current}"]{display:block!important;zoom:${scale}}`;
}
