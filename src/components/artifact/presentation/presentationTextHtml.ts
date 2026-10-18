import {
  a,
  r,
  children,
  create,
  fail,
  megabyte,
  one,
  validXmlText,
} from "./presentationPackageXml";
import type { PresentationTextFragment } from "./presentationTextRange";
import {
  paragraphText,
  runText,
  textRun,
  textRuns,
  validateTextBody,
  validateTextInput,
} from "./presentationTextRangeXml";
import {
  escapeTextHtml,
  parseTextHtmlStyles,
  safePresentationHyperlink,
  textHtmlPoints,
  type TextHtmlStyles,
} from "./presentationTextHtmlStyles";
import {
  presentationTextAlignment as alignment,
  presentationTextBullets as bullets,
  presentationTextNumbering as numbered,
  presentationTextParagraphList,
  presentationTextParagraphStyles,
} from "./presentationTextParagraphStyles";

interface ListItem {
  level: number;
  type: string;
  start?: number;
  first: boolean;
}
interface Context {
  styles: TextHtmlStyles;
  language?: string;
  link?: string;
  list?: ListItem;
  level?: number;
}
const tags = new Set([
  "html",
  "body",
  "p",
  "div",
  "br",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "a",
  "ol",
  "ul",
  "li",
]);
function integer(value: string, minimum: number, maximum: number): number {
  const result = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(result) ||
    result < minimum ||
    result > maximum
  )
    fail("HTML integer");
  return result;
}
function properties(parent: Element, name: string): Element {
  const element = create(parent, a, name);
  parent.append(element);
  return element;
}

/** DOMParser 接收前排除所有资源标签和 CSS 资源语法；从不挂载解析文档。 */
function preflight(html: string) {
  if (
    new TextEncoder().encode(html).length > megabyte ||
    !validXmlText(html) ||
    /<!DOCTYPE|<!ENTITY|<\?/i.test(html)
  )
    fail("HTML input");
  for (let cursor = 0; cursor < html.length; ) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      if (end < 0) fail("HTML comment");
      const content = html.slice(start + 4, end);
      if (
        /^(?:>|->)/.test(content) ||
        content.includes("--") ||
        content.endsWith("-")
      )
        fail("HTML comment syntax");
      cursor = end + 3;
      continue;
    }
    const name = /^<\/?([a-z][\w:-]*)/i.exec(html.slice(start))?.[1];
    if (!name) {
      cursor = start + 1;
      continue;
    }
    const metadata = name.toLowerCase() === "meta";
    if (!metadata && !tags.has(name.toLowerCase())) fail("HTML tag");
    let end = start + 1,
      quote = "";
    for (; end < html.length; end++) {
      const character = html[end];
      if (character === "<") fail("HTML nested tag boundary");
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") quote = character;
      else if (character === ">") break;
    }
    if (end === html.length) fail("HTML tag boundary");
    const tag = html.slice(start, end + 1);
    if (metadata) {
      // macOS 剪贴板附加惰性编码标记；保留原字节边界，其他 meta 在 HTML 解析前拒绝。
      if (
        !/^<meta\s+charset\s*=\s*(?:"utf-8"|'utf-8'|utf-8)\s*\/?>$/i.test(tag)
      )
        fail("HTML metadata");
      cursor = end + 1;
      continue;
    }
    if (
      /\b(?:on[a-z]+|src|srcset|ping|background|manifest|poster|action|formaction)\s*=/i.test(
        tag,
      )
    )
      fail("HTML resource attribute");
    for (const match of tag.matchAll(
      /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    )) {
      const encoded = match[1] ?? match[2] ?? match[3];
      // XML parser 不创建 HTML 资源节点；先解码属性实体再确认白名单，避免实体绕过。
      const decoded = new DOMParser().parseFromString(
        `<value>${encoded.replace(/</g, "&lt;")}</value>`,
        "application/xml",
      );
      if (decoded.getElementsByTagNameNS("*", "parsererror").length)
        fail("HTML style entity");
      parseTextHtmlStyles(decoded.documentElement.textContent ?? "");
    }
    cursor = end + 1;
  }
}

function appendCharacterProperties(run: Element, context: Context) {
  const styles = context.styles;
  const attributes: Record<string, string | undefined> = {
    b:
      styles["font-weight"] === undefined
        ? undefined
        : styles["font-weight"] === "bold"
          ? "1"
          : "0",
    i:
      styles["font-style"] === undefined
        ? undefined
        : styles["font-style"] === "italic"
          ? "1"
          : "0",
    sz:
      styles["font-size"] === undefined
        ? undefined
        : String(Math.round(textHtmlPoints(styles["font-size"]) * 100)),
    lang: context.language,
  };
  const decoration =
    styles["text-decoration-line"] ?? styles["text-decoration"];
  if (decoration !== undefined) {
    attributes.u = decoration.includes("underline") ? "sng" : "none";
    attributes.strike = decoration.includes("line-through")
      ? "sngStrike"
      : "noStrike";
  }
  if (
    !Object.values(attributes).some((value) => value !== undefined) &&
    !styles.color &&
    !styles["font-family"] &&
    !context.link
  )
    return;
  const property = create(run, a, "rPr");
  run.insertBefore(property, run.firstChild);
  for (const [key, value] of Object.entries(attributes))
    if (value !== undefined) property.setAttribute(key, value);
  if (styles.color)
    properties(properties(property, "solidFill"), "srgbClr").setAttribute(
      "val",
      styles.color.slice(1),
    );
  if (styles["font-family"])
    properties(property, "latin").setAttribute(
      "typeface",
      styles["font-family"],
    );
  if (context.link)
    properties(property, "hlinkClick").setAttributeNS(r, "r:id", context.link);
}

function appendParagraphProperties(paragraph: Element, context: Context) {
  const property = properties(paragraph, "pPr"),
    styles = context.styles;
  if (styles["text-align"])
    property.setAttribute(
      "algn",
      alignment[styles["text-align"] as keyof typeof alignment],
    );
  for (const [css, attribute] of [
    ["margin-left", "marL"],
    ["margin-right", "marR"],
    ["text-indent", "indent"],
  ])
    if (styles[css] !== undefined)
      property.setAttribute(
        attribute,
        String(Math.round(textHtmlPoints(styles[css]) * 12700)),
      );
  for (const [css, name] of [
    ["margin-top", "spcBef"],
    ["margin-bottom", "spcAft"],
  ]) {
    const value = styles[css];
    if (value !== undefined) {
      const percent = value.endsWith("lh");
      properties(
        properties(property, name),
        percent ? "spcPct" : "spcPts",
      ).setAttribute(
        "val",
        String(
          Math.round(
            percent
              ? Number(value.slice(0, -2)) * 100000
              : textHtmlPoints(value) * 100,
          ),
        ),
      );
    }
  }
  const level = context.list?.level ?? context.level;
  if (level !== undefined) property.setAttribute("lvl", String(level));
  if (context.list) {
    const list = context.list;
    if (!list.first) properties(property, "buNone");
    else if (list.start === undefined)
      properties(property, "buChar").setAttribute("char", list.type);
    else {
      const bullet = properties(property, "buAutoNum");
      bullet.setAttribute("type", list.type);
      bullet.setAttribute("startAt", String(list.start));
    }
    list.first = false;
  } else properties(property, "buNone");
}

/** undefined 是显式 plain fallback；不修改 owner 的 DOM，也不负责 package relationships。 */
export function parsePresentationTextHtml(
  html: string,
  owner: Document,
):
  | {
      fragment: PresentationTextFragment;
      hyperlinks: readonly { id: string; url: string }[];
    }
  | undefined {
  try {
    if (typeof html !== "string" || !html.trim()) return;
    preflight(html);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (parsed.querySelectorAll("*").length > 20000) return;
    for (const element of Array.from(parsed.querySelectorAll("*"))) {
      if (
        !["head", "meta", ...tags].includes(element.localName) ||
        (element.localName === "head" &&
          Array.from(element.children).some(
            (child) => child.localName !== "meta",
          )) ||
        (element.localName === "meta" &&
          (element.attributes.length !== 1 ||
            element.getAttribute("charset")?.toLowerCase() !== "utf-8"))
      )
        return;
      for (const attribute of Array.from(element.attributes))
        if (
          /^on/i.test(attribute.name) ||
          ["src", "srcset", "ping", "background"].includes(attribute.name)
        )
          return;
    }
    const body = owner.createElementNS(a, "a:txBody");
    body.append(create(body, a, "bodyPr"));
    const paragraphs: Element[] = [],
      links: { id: string; url: string }[] = [],
      contexts = new Map<Element, Context>();
    let current: Element | undefined;
    function ensure(context: Context) {
      if (!current) {
        if (paragraphs.length >= 10000) fail("HTML paragraph count");
        current = create(body, a, "p");
        appendParagraphProperties(current, context);
        contexts.set(current, context);
        paragraphs.push(current);
        body.append(current);
      }
      return current;
    }
    function append(value: string, context: Context, lineBreak = false) {
      if (!lineBreak && !value) return;
      if (
        !lineBreak &&
        !["pre", "pre-wrap", "break-spaces"].includes(
          context.styles["white-space"],
        )
      ) {
        value = value.replace(/[\t\r\n\f ]+/g, " ");
        if (!current && value === " ") return;
        if (current && paragraphText(current).endsWith(" "))
          value = value.replace(/^ /, "");
        if (!value) return;
      }
      const paragraph = ensure(context),
        run = lineBreak ? create(body, a, "br") : textRun(body, value);
      appendCharacterProperties(run, context);
      paragraph.append(run);
    }
    function contextFor(element: Element, context: Context): Context {
      const tag = element.localName,
        styles = { ...context.styles };
      if (["b", "strong"].includes(tag)) styles["font-weight"] = "bold";
      if (["i", "em"].includes(tag)) styles["font-style"] = "italic";
      if (["u", "s", "strike", "del"].includes(tag))
        styles["text-decoration-line"] = [
          ...new Set(
            (styles["text-decoration-line"] ?? styles["text-decoration"] ?? "")
              .split(/\s+/)
              .filter((item) => item && item !== "none")
              .concat(tag === "u" ? "underline" : "line-through"),
          ),
        ].join(" ");
      Object.assign(
        styles,
        parseTextHtmlStyles(element.getAttribute("style") ?? ""),
      );
      const next = { ...context, styles };
      if (element.hasAttribute("lang")) {
        const language = element.getAttribute("lang")!;
        if (!/^[a-z]{2,8}(?:-[a-z\d]{1,8})*$/i.test(language))
          fail("HTML language");
        next.language = language;
      }
      if (element.hasAttribute("data-presentation-list-level"))
        next.level = integer(
          element.getAttribute("data-presentation-list-level")!,
          0,
          8,
        );
      if (tag === "a" && element.hasAttribute("href")) {
        const url = safePresentationHyperlink(element.getAttribute("href")!);
        if (!url) fail("HTML hyperlink");
        const id = `rHtml${crypto.randomUUID().replace(/-/g, "")}`;
        links.push({ id, url });
        next.link = id;
      }
      return next;
    }
    function visit(node: Node, context: Context, depth: number) {
      if (depth > 64) fail("HTML nesting");
      if (node.nodeType === 3) {
        append(node.textContent ?? "", context);
        return;
      }
      if (node.nodeType !== 1) return;
      const element = node as Element,
        tag = element.localName;
      const next = contextFor(element, context);
      if (tag === "br") {
        append("", next, true);
        return;
      }
      if (tag === "ol" || tag === "ul") {
        current = undefined;
        const level = next.level ?? (context.list ? context.list.level + 1 : 0);
        if (level > 8) fail("HTML list level");
        let start = integer(element.getAttribute("start") ?? "1", 1, 32767);
        const type =
          tag === "ol"
            ? numbered[
                (element.getAttribute("type") ?? "1") as keyof typeof numbered
              ]
            : bullets[
                (element.getAttribute("type") ?? "disc") as keyof typeof bullets
              ];
        if (!type) fail("HTML list type");
        for (const child of Array.from(element.childNodes)) {
          if (
            child.nodeType === 8 ||
            (child.nodeType === 3 && !child.textContent?.trim())
          )
            continue;
          if (child.nodeType !== 1 || (child as Element).localName !== "li")
            fail("HTML list item");
          const item = child as Element;
          if (item.hasAttribute("value"))
            start = integer(item.getAttribute("value")!, 1, 32767);
          if (start > 32767) fail("HTML list start");
          visit(
            item,
            {
              ...next,
              list: {
                level,
                type,
                start: tag === "ol" ? start++ : undefined,
                first: true,
              },
            },
            depth + 1,
          );
        }
        current = undefined;
        return;
      }
      if (tag === "li" && !context.list) fail("HTML orphan list item");
      const block = ["p", "div", "li"].includes(tag),
        before = paragraphs.length;
      if (block) current = undefined;
      for (const child of Array.from(element.childNodes)) {
        if (
          tag === "li" &&
          next.list?.first &&
          child.nodeType === 1 &&
          ["ol", "ul"].includes((child as Element).localName)
        )
          ensure(next);
        visit(child, next, depth + 1);
      }
      if (block) {
        if (paragraphs.length === before) ensure(next);
        current = undefined;
      }
    }
    const rootContext = contextFor(
      parsed.body,
      contextFor(parsed.documentElement, { styles: {} }),
    );
    for (const child of Array.from(parsed.body.childNodes))
      visit(child, rootContext, 0);
    if (!paragraphs.length) return;
    for (const paragraph of paragraphs)
      if (!textRuns(paragraph).length) {
        const run = textRun(body, "");
        appendCharacterProperties(run, contexts.get(paragraph)!);
        paragraph.append(run);
      }
    validateTextBody(body);
    validateTextInput(paragraphs.map(paragraphText).join("\n"));
    const used = new Set(
      Array.from(body.getElementsByTagNameNS(a, "hlinkClick"), (link) =>
        link.getAttributeNS(r, "id"),
      ),
    );
    return {
      fragment: { paragraphs },
      hyperlinks: links.filter(({ id }) => used.has(id)),
    };
  } catch {
    return undefined;
  }
}

function characterStyles(
  property: Element | undefined,
): Record<string, string> {
  if (!property) return {};
  const styles: Record<string, string> = {};
  for (const [attribute, css, on, off] of [
    ["b", "font-weight", "bold", "normal"],
    ["i", "font-style", "italic", "normal"],
  ]) {
    const value = property.getAttribute(attribute);
    if (["1", "true", "0", "false"].includes(value ?? ""))
      styles[css] = value === "1" || value === "true" ? on : off;
  }
  const size = Number(property.getAttribute("sz"));
  if (Number.isInteger(size) && size > 0 && size <= 400000)
    styles["font-size"] = `${size / 100}pt`;
  const solid = one(property, a, "solidFill"),
    color = solid && one(solid, a, "srgbClr")?.getAttribute("val");
  if (color && /^[a-f\d]{6}$/i.test(color))
    styles.color = `#${color.toUpperCase()}`;
  const family = one(property, a, "latin")?.getAttribute("typeface");
  if (
    family &&
    family.length <= 256 &&
    !/[<>"'()]/u.test(family) &&
    !Array.from(family).some((character) => character.codePointAt(0)! < 32)
  )
    styles["font-family"] = `'${family}'`;
  return styles;
}
const styleAttribute = (styles: TextHtmlStyles) =>
  Object.keys(styles).length
    ? ` style="${escapeTextHtml(
        Object.entries(styles)
          .map(([key, value]) => `${key}:${value}`)
          .join(";"),
      )}"`
    : "";

/** HTML 只表达已确认的属性；未知 OOXML 留在原 fragment，不借主题推算色值。 */
export function serializePresentationTextFragment(
  fragment: PresentationTextFragment,
  resolveHyperlink?: (id: string) => string | undefined,
): string {
  if (
    !fragment ||
    !Array.isArray(fragment.paragraphs) ||
    fragment.paragraphs.length > 10000
  )
    fail("HTML fragment");
  if (!fragment.paragraphs.length) return "";
  const first = fragment.paragraphs[0];
  if (!first?.ownerDocument) fail("HTML fragment paragraph");
  const body = create(first, a, "txBody");
  body.append(create(body, a, "bodyPr"));
  for (const paragraph of fragment.paragraphs) {
    if (paragraph?.namespaceURI !== a || paragraph.localName !== "p")
      fail("HTML fragment paragraph");
    body.append(paragraph.cloneNode(true));
  }
  validateTextBody(body);
  validateTextInput(children(body, a, "p").map(paragraphText).join("\n"));
  const output = children(body, a, "p")
    .map((paragraph) => {
      const property = one(paragraph, a, "pPr"),
        defaults = property && one(property, a, "defRPr");
      const content = textRuns(paragraph)
        .map((run) => {
          const own = one(run, a, "rPr");
          const localStyles = characterStyles(own);
          const styles: Record<string, string> = {
            ...characterStyles(defaults),
            ...localStyles,
            "white-space": "pre-wrap",
          };
          const underline =
              own?.getAttribute("u") ?? defaults?.getAttribute("u"),
            strike =
              own?.getAttribute("strike") ?? defaults?.getAttribute("strike");
          if (underline || strike)
            styles["text-decoration-line"] =
              [
                underline && underline !== "none" ? "underline" : "",
                strike && strike !== "noStrike" ? "line-through" : "",
              ]
                .filter(Boolean)
                .join(" ") || "none";
          if (
            own &&
            Array.from(own.children).some(
              (child) =>
                child.namespaceURI === a &&
                [
                  "noFill",
                  "solidFill",
                  "gradFill",
                  "blipFill",
                  "pattFill",
                  "grpFill",
                ].includes(child.localName),
            ) &&
            !localStyles.color
          )
            delete styles.color;
          const hyperlink =
            (own && one(own, a, "hlinkClick")) ??
            (defaults && one(defaults, a, "hlinkClick"));
          const id = hyperlink?.getAttributeNS(r, "id"),
            language =
              own?.getAttribute("lang") ?? defaults?.getAttribute("lang");
          let content =
            run.localName === "br" ? "<br>" : escapeTextHtml(runText(run));
          content = `<span${styleAttribute(styles)}${language ? ` lang="${escapeTextHtml(language)}"` : ""}>${content}</span>`;
          const url =
            id && resolveHyperlink
              ? safePresentationHyperlink(resolveHyperlink(id) ?? "")
              : undefined;
          return url
            ? `<a href="${escapeTextHtml(url)}">${content}</a>`
            : content;
        })
        .join("");
      const level = property?.getAttribute("lvl"),
        levelAttribute =
          level && /^[0-8]$/.test(level)
            ? ` data-presentation-list-level="${level}"`
            : "";
      const styles = presentationTextParagraphStyles(property),
        list = presentationTextParagraphList(property);
      if (list?.kind === "number")
        return `<ol type="${list.htmlType}" start="${list.start ?? 1}"${levelAttribute}><li${styleAttribute(styles)}>${content}</li></ol>`;
      if (list?.kind === "bullet")
        return `<ul type="${list.htmlType}"${levelAttribute}><li${styleAttribute(styles)}>${content}</li></ul>`;
      return `<p${styleAttribute(styles)}${levelAttribute}>${content}</p>`;
    })
    .join("");
  if (new TextEncoder().encode(output).length > 4 * megabyte)
    fail("HTML output size");
  return output;
}
