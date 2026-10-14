import type { ReactNode } from "react";

type DiffCodeTokenKind =
  | "comment"
  | "keyword"
  | "number"
  | "operator"
  | "property"
  | "selector"
  | "string"
  | "tag"
  | "type";

interface DiffCodeToken {
  kind: DiffCodeTokenKind;
  value: string;
}

const CODE_EXTENSION_PATTERN =
  /\.(?:c|cc|cpp|css|go|h|hpp|html|java|js|jsx|json|md|mdx|mjs|py|rs|sh|sql|ts|tsx|yaml|yml)$/i;

const KEYWORD_PATTERN = new Set([
  "async",
  "await",
  "break",
  "catch",
  "class",
  "const",
  "continue",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "fn",
  "for",
  "from",
  "function",
  "if",
  "impl",
  "import",
  "interface",
  "let",
  "match",
  "mod",
  "new",
  "null",
  "pub",
  "return",
  "struct",
  "throw",
  "true",
  "try",
  "type",
  "undefined",
  "use",
  "var",
  "while",
]);

const TOKEN_PATTERN =
  /(\/\/.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][\w:-]*|#[A-Za-z0-9_-]+|\b[A-Z][A-Za-z0-9_]*\b|\b[A-Za-z_$][\w$]*(?=\s*:)|\b[A-Za-z_$][\w$]*\b|\b\d+(?:\.\d+)?\b|[{}()[\].,;:+\-*/%=!<>|&?]+)/g;

function isCodeLikePath(filePath?: string): boolean {
  return CODE_EXTENSION_PATTERN.test(filePath || "");
}

function classifyToken(value: string): DiffCodeTokenKind | null {
  if (value.startsWith("//") || value.startsWith("/*")) {
    return "comment";
  }
  if (value.startsWith('"') || value.startsWith("'") || value.startsWith("`")) {
    return "string";
  }
  if (value.startsWith("<")) {
    return "tag";
  }
  if (value.startsWith("#")) {
    return "selector";
  }
  if (/^\d/.test(value)) {
    return "number";
  }
  if (KEYWORD_PATTERN.has(value)) {
    return "keyword";
  }
  if (/^[A-Z]/.test(value)) {
    return "type";
  }
  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    return "property";
  }
  if (/^[{}()[\].,;:+\-*/%=!<>|&?]+$/.test(value)) {
    return "operator";
  }
  return null;
}

function tokenizeCodeLine(value: string): Array<string | DiffCodeToken> {
  const tokens: Array<string | DiffCodeToken> = [];
  let cursor = 0;

  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const tokenValue = match[0];
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push(value.slice(cursor, index));
    }

    const kind = classifyToken(tokenValue);
    tokens.push(kind ? { kind, value: tokenValue } : tokenValue);
    cursor = index + tokenValue.length;
  }

  if (cursor < value.length) {
    tokens.push(value.slice(cursor));
  }

  return tokens;
}

function resolveTokenClassName(kind: DiffCodeTokenKind): string {
  switch (kind) {
    case "comment":
      return "text-[color:var(--lime-text-muted)] italic";
    case "keyword":
      return "text-[color:var(--lime-brand)]";
    case "number":
      return "text-[color:var(--lime-info)]";
    case "operator":
      return "text-[color:var(--lime-text-muted)]";
    case "property":
      return "text-[color:var(--lime-warning)]";
    case "selector":
      return "text-[color:var(--lime-warning)]";
    case "string":
      return "text-[color:var(--lime-brand)]";
    case "tag":
      return "text-[color:var(--lime-danger)]";
    case "type":
      return "text-[color:var(--lime-info)]";
    default:
      return "";
  }
}

export function renderCanvasWorkbenchDiffCodeLine(
  value: string,
  filePath?: string,
): ReactNode {
  if (!value) {
    return null;
  }

  if (!isCodeLikePath(filePath)) {
    return value;
  }

  return tokenizeCodeLine(value).map((token, index) => {
    if (typeof token === "string") {
      return token;
    }
    return (
      <span
        key={`${token.kind}-${index}`}
        className={resolveTokenClassName(token.kind)}
      >
        {token.value}
      </span>
    );
  });
}
