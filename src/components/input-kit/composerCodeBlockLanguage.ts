import { parseTree, type ParseError } from "jsonc-parser";

export interface CodeBlockLanguage {
  readonly value: string;
  readonly label: string | null;
}

export const codeBlockLanguages: readonly CodeBlockLanguage[] = [
  { value: "arduino", label: "Arduino" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "diff", label: "Diff" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "ini", label: "INI" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "latex", label: "LaTeX" },
  { value: "less", label: "Less" },
  { value: "lua", label: "Lua" },
  { value: "makefile", label: "Makefile" },
  { value: "markdown", label: "Markdown" },
  { value: "math", label: null },
  { value: "mermaid", label: "Mermaid" },
  { value: "objectivec", label: "Objective-C" },
  { value: "perl", label: "Perl" },
  { value: "php", label: "PHP" },
  { value: "php-template", label: "PHP template" },
  { value: "plaintext", label: null },
  { value: "python", label: "Python" },
  { value: "python-repl", label: "Python REPL" },
  { value: "r", label: "R" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "tsrx", label: "TSRX" },
  { value: "typescript", label: "TypeScript" },
  { value: "vbnet", label: "Visual Basic .NET" },
  { value: "wasm", label: "WebAssembly" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

const canonicalLanguages = new Set(
  codeBlockLanguages.map(({ value }) => value),
);
const languageAliases: Readonly<Record<string, string>> = {
  "c#": "csharp",
  "c++": "cpp",
  cs: "csharp",
  gql: "graphql",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  objc: "objectivec",
  patch: "diff",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  tex: "latex",
  text: "plaintext",
  ts: "typescript",
  tsx: "typescript",
  vb: "vbnet",
  yml: "yaml",
  zsh: "bash",
};

export function normalizeCodeBlockLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().toLowerCase();
  const language = languageAliases[name] ?? name;
  return canonicalLanguages.has(language) ? language : null;
}

export function codeBlockHighlightLanguage(value: unknown): string | null {
  const language = normalizeCodeBlockLanguage(value);
  if (language === "math") return "latex";
  return language === "plaintext" || language === "mermaid" ? null : language;
}

export function codeBlockLanguageLabelKey(
  value: unknown,
):
  | "composer.codeBlock.language.math"
  | "composer.codeBlock.language.plaintext"
  | null {
  const language = normalizeCodeBlockLanguage(value);
  return language === "math" || language === "plaintext"
    ? `composer.codeBlock.language.${language}`
    : null;
}

export const codeBlockAutoLanguages: readonly string[] = codeBlockLanguages
  .map(({ value }) => value)
  .filter((value) => value !== "math" && value !== "mermaid");
const autoLanguages = new Set(codeBlockAutoLanguages);

export interface CodeLanguageDetection {
  readonly language: string | null;
  readonly relevance: number;
}
export type CodeLanguageDetector = (
  content: string,
  subset: readonly string[],
) => CodeLanguageDetection | Promise<CodeLanguageDetection>;

const commandPrompt =
  /^(?:[$%](?:[ \t]+\S.*)?|[^\s@]+@[^\s@]+(?:[ \t]+\S+)*[ \t]+[$%#](?:[ \t]+.*)?|PS [^>]*>.*|[A-Z]:\\[^>]*>.*)$/;
const outputHeads = [
  /^(?:(?:[\w.]*Error|[\w.]+Exception):|Exception in thread\b|Traceback \(most recent call last\):|node:internal\/|error\[[A-Z]\d+\]:)/,
  /^(?:\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}|\[\d{2}:\d{2}:\d{2}\])/,
  /^(?:\[(?:INFO|DEBUG|WARN|ERROR|TRACE|FATAL)\]|(?:INFO|DEBUG|WARN(?:ING)?|ERROR|TRACE|FATAL):?)\s+[^\s=({]/,
  /^(?:HTTP\/\d(?:\.\d)? \d{3}\b|On branch |commit [a-f\d]{7,40}$|={3,})/,
  /^\S+\.(?:c|cc|cpp|h): In (?:member )?function\b/,
  /^(?:[^:\n]+:\d+(?::\d+)?|\S+\(\d+,\d+\)): (?:error|warning|fatal)\b/i,
];
const outputDetails = [
  /^> \S+@\d\S* /,
  /^\s+at (?:\S+ \([^\n]+:\d+(?::\d+)?\)|(?:file:\/\/|\S+\.)\S+)/,
  /^\s*File "[^"]+", line \d+(?:, in .+)?$/,
  /^\s*(?:error\[[A-Z]\d+\]:|stack backtrace:|Traceback \(most recent call last\):)/,
  /^[-dlcbps][rwxstST-]{9}\s+\d+\s/,
];

function looksLikeOutput(content: string): boolean {
  if (
    /^(?:https?:\/\/)?(?:localhost|(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,})(?::\d+)?(?:[/?#]\S*)?$/i.test(
      content,
    )
  )
    return true;
  const lines = content.split(/\r?\n/);
  const headers = lines.filter((line) =>
    /^[A-Z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*:\s+\S/.test(line),
  );
  if (
    headers.length >= 3 &&
    headers.some((line) => /^[^:\n]+ [^:\n]+:/.test(line))
  )
    return true;
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (
    commandPrompt.test(first) ||
    commandPrompt.test(last) ||
    [...outputHeads, ...outputDetails].some((pattern) => pattern.test(first))
  )
    return true;
  const buildOutput =
    /^(?:Building|Built|Compil(?:ing|ed)|Download(?:ing|ed)|Install(?:ing|ed)|Check(?:ing|ed)|Verif(?:ying|ied)|Unpack(?:ing|ed)|Found|Added|Removed)\s/i.test(
      first,
    );
  if (buildOutput && !/[=({]/.test(first)) return true;
  const heading =
    !/^(?:\/\/|\/\*|#|@|\[)/.test(first) &&
    !/[=({<>]/.test(first) &&
    (first.endsWith("...") || (first.endsWith(":") && /\s/.test(first)));
  return (
    heading &&
    lines.some(
      (line) =>
        commandPrompt.test(line.trim()) ||
        outputDetails.some((pattern) => pattern.test(line)),
    )
  );
}

// Ordered metadata hints are separate from grammar registration and token production.
const syntaxHints: readonly (readonly [string, RegExp])[] = [
  ["diff", /^(?:diff\s|---\s.+\n\+\+\+\s)|^@@\s/m],
  [
    "sql",
    /^(?:SELECT\b.+\bFROM\b|INSERT\s+INTO\b|UPDATE\s+\S+\s+SET\b|CREATE\s+(?:TABLE|INDEX)\b)/im,
  ],
  [
    "graphql",
    /^(?:query|mutation|subscription|fragment|type|schema)\b[^\n{]*\{/m,
  ],
  [
    "python",
    /^(?:def\s+\w+\s*\(|from\s+[\w.]+\s+import\b|import\s+[\w.]+\s*$|class\s+\w+(?:\([^)]*\))?\s*:)|\b(?:print|range)\s*\(/m,
  ],
  [
    "csharp",
    /^(?:using\s+System(?:\.\w+)*;|namespace\s+[\w.]+)|\b(?:Console\.WriteLine|public\s+static\s+void\s+Main)\b/m,
  ],
  [
    "java",
    /^(?:package\s+[\w.]+;|import\s+java\.)|\b(?:[Ss]ystem\.out\.|public\s+static\s+void\s+main)\b/m,
  ],
  [
    "cpp",
    /^#include\s*<(?:algorithm|array|deque|filesystem|iostream|map|memory|mutex|optional|queue|set|stack|string|thread|unordered_map|unordered_set|utility|variant|vector)>|\b(?:std::|cout\s*<<|using\s+namespace\s+std)\b/m,
  ],
  [
    "c",
    /^#include\s*[<"](?:stdbool|stddef|stdint|stdio|stdlib|string)\.h[>"]|\b(?:printf|malloc|sizeof)\s*\(/m,
  ],
  [
    "tsrx",
    /^(?:(?:export(?:[ \t]+default)?|async)[ \t]+)*function\b[^\n]*\)[ \t]*(?::[^\n{]+)?[ \t]*@\{(?=\s|<)/,
  ],
  [
    "tsrx",
    /^(?:export[ \t]+)?(?:const|let)[ \t]+[$\w]+[ \t]*(?::[^=\n]+)?=[ \t]*(?:async[ \t]+)?(?:\([^\n)]*\)|[$\w]+)[ \t]*=>[ \t]*@\{(?=\s|<)/,
  ],
  [
    "typescript",
    /\b(?:interface|type)\s+[$A-Z_a-z][$\w]*|\b(?:const|let|var)\s+[$A-Z_a-z][$\w]*\s*:\s*[$A-Z_a-z<{[(]|\b(?:as\s+const|satisfies)\b/m,
  ],
  [
    "javascript",
    /^(?:import|export|const|let|var|function|class)\b|=>|\bconsole\.\w+\s*\(/m,
  ],
  [
    "swift",
    /^(?:import\s+Foundation|func\s+\w+\s*\(|struct\s+\w+\s*\{|let\s+\w+\s*:)|\bguard\s+let/m,
  ],
  ["r", /^(?:library\s*\(|\w+\s*<-\s*)/m],
  ["yaml", /^(?![\s\S]*[{};])[^\S\r\n]*[-\w.]+[^\S\r\n]*:[^\S\r\n]*\S.*$/m],
];

function syntaxLanguage(content: string): string | null {
  if (["{", "[", "//", "/*"].some((prefix) => content.startsWith(prefix))) {
    try {
      const value: unknown = JSON.parse(content);
      if (value !== null && typeof value === "object") return "json";
    } catch {
      // JSONC permits comments, while malformed input and trailing commas remain invalid.
      try {
        const errors: ParseError[] = [];
        const tree = parseTree(content, errors, {
          disallowComments: false,
          allowTrailingComma: false,
        });
        if (
          errors.length === 0 &&
          (tree?.type === "object" || tree?.type === "array")
        )
          return "json";
      } catch {
        // Deep or malformed input is left to the bounded detector contract.
      }
    }
  }
  const html =
    /^\s*(?:<!doctype\s+html\b|<\/?(?:html|head|body|base|title|meta|link|style|script|noscript|template|main|header|footer|nav|section|article|aside|address|div|span|p|a|button|form|input|textarea|select|option|label|ul|ol|li|table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col|h[1-6]|img|picture|source|video|audio|canvas|details|summary|dialog|figure|figcaption|pre|code|blockquote|hr|br|strong|em|small|mark|time)\b)/i;
  if (content.startsWith("<?xml") || html.test(content)) return "xml";
  return syntaxHints.find(([, pattern]) => pattern.test(content))?.[0] ?? null;
}

/** Syntax hints select metadata; only the parser can produce highlight tokens. */
export async function detectCodeBlockLanguage(
  content: string,
  detect: CodeLanguageDetector,
): Promise<string | null> {
  const source = content.trim();
  if (!source) return null;
  if (looksLikeOutput(source)) return "plaintext";
  const hint = syntaxLanguage(source);
  if (hint) return hint;
  if (source.length < 12) return "plaintext";
  try {
    const result = await detect(content, codeBlockAutoLanguages);
    const language = normalizeCodeBlockLanguage(result.language);
    return language && autoLanguages.has(language) && result.relevance >= 2
      ? language
      : "plaintext";
  } catch {
    return "plaintext";
  }
}
