import { Lexer, type Tokens } from "marked";

// REA98/99: native titled links precede the Composer path scanner.
export function parseComposerLink(source: string) {
  if (!source.startsWith("[")) return null;
  const native = Lexer.lexInline(source, { gfm: false })[0];
  if (native?.type === "link" && (native as Tokens.Link).title != null) {
    const link = native as Tokens.Link;
    return {
      end: link.raw.length,
      label: link.text,
      href: link.href,
      title: link.title,
    };
  }
  let labelEnd = 1;
  while (labelEnd < source.length) {
    const character = source[labelEnd];
    const next = source[labelEnd + 1];
    if (character === "\n" || character === "\r") return null;
    if (
      character === "\\" &&
      (next === "\\" || (next === "]" && source[labelEnd + 2] !== "("))
    ) {
      labelEnd += 2;
      continue;
    }
    if (character === "]") break;
    labelEnd += 1;
  }
  if (labelEnd === 1 || source[labelEnd + 1] !== "(") return null;
  let pathEnd = labelEnd + 2;
  while (pathEnd < source.length) {
    const character = source[pathEnd];
    const next = source[pathEnd + 1];
    if (character === "\n" || character === "\r") return null;
    if (character === "\\" && next !== undefined) {
      if (next === "\n" || next === "\r") return null;
      pathEnd += 2;
      continue;
    }
    if (character === ")") {
      if (pathEnd === labelEnd + 2) return null;
      return {
        end: pathEnd + 1,
        label: source.slice(1, labelEnd).replace(/\\([\\[\]()])/g, "$1"),
        href: source
          .slice(labelEnd + 2, pathEnd)
          .replace(/\\([!-/:-@[-`{-~])/g, "$1"),
      };
    }
    pathEnd += 1;
  }
  return null;
}
