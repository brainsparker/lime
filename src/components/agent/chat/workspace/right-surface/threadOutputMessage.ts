import { fromMarkdown } from "mdast-util-from-markdown";
import { normalizeOutputPath } from "./threadOutputPaths";

type MarkdownNode =
  | ReturnType<typeof fromMarkdown>
  | ReturnType<typeof fromMarkdown>["children"][number];
const skipped = new Set([
  "code",
  "inlineCode",
  "html",
  "image",
  "imageReference",
  "definition",
]);
const citationPattern =
  /:codex-file-citation(?:\[[^\n]*?\])?\{((?:[^}"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*)\}/g;
const visualizationPattern =
  /^\s*::codex-(?:inline|live)-vis\{((?:[^}"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*)\}/gm;

function attributes(text: string): Record<string, string | true> {
  const result: Record<string, string | true> = {};
  for (const match of text.matchAll(
    /([\w-]+)(?:\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s{}]+)))?/g,
  )) {
    result[match[1]] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return result;
}

export function readThreadOutputMessage(text: string): {
  links: string[];
  outputs: string[];
  references: string[];
  visualizations: Set<string>;
} {
  const links: string[] = [],
    outputs: string[] = [],
    references: string[] = [];
  const visualizations = new Set<string>();
  const ignored: Array<[number, number]> = [];
  const visit = (node: MarkdownNode) => {
    const start = node.position?.start.offset,
      end = node.position?.end.offset;
    if (skipped.has(node.type)) {
      if (start !== undefined && end !== undefined) ignored.push([start, end]);
      return;
    }
    if (node.type === "link") links.push(node.url);
    if (node.type === "link" || node.type === "linkReference") {
      const labelEnd =
        text[start ?? 0] === "<"
          ? start
          : (node.children.at(-1)?.position?.end.offset ?? start);
      if (labelEnd !== undefined && end !== undefined)
        ignored.push([labelEnd, end]);
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(fromMarkdown(text));
  const isIgnored = (index: number) =>
    ignored.some(([start, end]) => index >= start && index < end);
  for (const match of text.matchAll(citationPattern)) {
    if (isIgnored(match.index) || text[match.index - 1] === ":") continue;
    let escapes = 0;
    for (let index = match.index - 1; text[index] === "\\"; index--) escapes++;
    if (escapes % 2) continue;
    const attrs = attributes(match[1]);
    if (typeof attrs.path !== "string" || attrs.mode !== undefined) continue;
    const path = attrs.path.trim();
    if (!path || /^https?:\/\//i.test(path)) continue;
    if (attrs.purpose === "source") references.push(path);
    else if (attrs.purpose === undefined || attrs.purpose === "output")
      outputs.push(path);
  }
  for (const match of text.matchAll(/【([^†】\n]+)†L\d+(?:-L\d+)?】/g))
    references.push(match[1].trim());
  for (const match of text.matchAll(visualizationPattern)) {
    if (isIgnored(match.index + match[0].indexOf("::"))) continue;
    const attrs = attributes(match[1]);
    const path = attrs.path ?? attrs.file;
    if (typeof path === "string") visualizations.add(normalizeOutputPath(path));
  }
  return { links, outputs, references, visualizations };
}
