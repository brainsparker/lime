import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { LanguageFn, Mode } from "highlight.js";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  codeBlockHighlightLanguage,
  type CodeLanguageDetection,
} from "./composerCodeBlockLanguage";

export interface CodeBlockParseInput {
  readonly content: string;
  readonly language: string | null;
  readonly pos: number;
}
export interface CodeBlockDetector {
  detect(content: string, subset: readonly string[]): CodeLanguageDetection;
}
export interface CodeBlockParser extends CodeBlockDetector {
  parse(input: CodeBlockParseInput): Decoration[];
  supports(language: string): boolean;
}

const grammarLoaders = {
  arduino: () => import("highlight.js/lib/languages/arduino"),
  bash: () => import("highlight.js/lib/languages/bash"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  css: () => import("highlight.js/lib/languages/css"),
  diff: () => import("highlight.js/lib/languages/diff"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  dos: () => import("highlight.js/lib/languages/dos"),
  go: () => import("highlight.js/lib/languages/go"),
  graphql: () => import("highlight.js/lib/languages/graphql"),
  ini: () => import("highlight.js/lib/languages/ini"),
  java: () => import("highlight.js/lib/languages/java"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  latex: () => import("highlight.js/lib/languages/latex"),
  less: () => import("highlight.js/lib/languages/less"),
  lua: () => import("highlight.js/lib/languages/lua"),
  makefile: () => import("highlight.js/lib/languages/makefile"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  objectivec: () => import("highlight.js/lib/languages/objectivec"),
  perl: () => import("highlight.js/lib/languages/perl"),
  php: () => import("highlight.js/lib/languages/php"),
  "php-template": () => import("highlight.js/lib/languages/php-template"),
  plaintext: () => import("highlight.js/lib/languages/plaintext"),
  powershell: () => import("highlight.js/lib/languages/powershell"),
  python: () => import("highlight.js/lib/languages/python"),
  "python-repl": () => import("highlight.js/lib/languages/python-repl"),
  r: () => import("highlight.js/lib/languages/r"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  rust: () => import("highlight.js/lib/languages/rust"),
  scss: () => import("highlight.js/lib/languages/scss"),
  shell: () => import("highlight.js/lib/languages/shell"),
  sql: () => import("highlight.js/lib/languages/sql"),
  swift: () => import("highlight.js/lib/languages/swift"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  vbnet: () => import("highlight.js/lib/languages/vbnet"),
  wasm: () => import("highlight.js/lib/languages/wasm"),
  xml: () => import("highlight.js/lib/languages/xml"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  clojure: () => import("highlight.js/lib/languages/clojure"),
  dart: () => import("highlight.js/lib/languages/dart"),
  haskell: () => import("highlight.js/lib/languages/haskell"),
  lisp: () => import("highlight.js/lib/languages/lisp"),
  mathematica: () => import("highlight.js/lib/languages/mathematica"),
  matlab: () => import("highlight.js/lib/languages/matlab"),
  nginx: () => import("highlight.js/lib/languages/nginx"),
  ocaml: () => import("highlight.js/lib/languages/ocaml"),
  pgsql: () => import("highlight.js/lib/languages/pgsql"),
  scala: () => import("highlight.js/lib/languages/scala"),
  verilog: () => import("highlight.js/lib/languages/verilog"),
};
type Lowlight = ReturnType<typeof import("lowlight").createLowlight>;
type TokenNode = ReturnType<Lowlight["highlight"]>["children"][number];
let definitionsPromise: Promise<Record<string, LanguageFn>> | undefined;

/** A TypeScript grammar extension for template directives and markup expressions. */
export function createTsrxGrammar(typescript: LanguageFn): LanguageFn {
  return (api) => {
    const base = typescript(api);
    const directive: Mode = {
      scope: "keyword",
      match:
        /@\{|@(?:if|else|for|empty|switch|case|default|try|pending|catch)\b/,
      relevance: 0,
    };
    const expression: Mode = {
      begin: /\{/,
      end: /\}/,
      keywords: base.keywords,
      relevance: 0,
      contains: [],
    };
    const attributes: Mode = {
      begin: /(?<=<[A-Za-z][\w.:-]*)(?=[\s/>])/,
      end: /\/?>/,
      scope: "tag",
      relevance: 0,
      contains: [
        expression,
        { scope: "attr", match: /[A-Za-z_$][\w$:.-]*/, relevance: 0 },
        api.APOS_STRING_MODE,
        api.QUOTE_STRING_MODE,
      ],
    };
    const openTag = [/<(?=[A-Za-z])/, /[A-Za-z][\w.:-]*(?=[\s/>])/];
    const closeTag = [/<\/(?=[A-Za-z])/, /[A-Za-z][\w.:-]*/, /\s*>/];
    const selfClosing: Mode = {
      begin: openTag,
      beginScope: { 1: "tag", 2: "name" },
      end: /\/>/,
      endScope: "tag",
      relevance: 0,
      contains: [
        { ...attributes, begin: /(?<=<[A-Za-z][\w.:-]*)\s+/, end: /(?=\/>)/ },
      ],
      "on:begin": (match, response) => {
        const source = match.input ?? "";
        const start = (match.index ?? 0) + match[0].length;
        const limit = Math.min(source.length, start + 4096);
        let quote = "",
          depth = 0;
        for (let offset = start; offset < limit; offset += 1) {
          const character = source[offset];
          if (quote) {
            if (character === "\\") offset += 1;
            else if (character === quote) quote = "";
          } else if (
            character === "'" ||
            character === '"' ||
            character === "`"
          )
            quote = character;
          else if (character === "{") depth += 1;
          else if (character === "}" && depth > 0) depth -= 1;
          else if (character === ">" && depth === 0) {
            if (source[offset - 1] !== "/") response.ignoreMatch();
            return;
          }
        }
        response.ignoreMatch();
      },
    };
    const paired: Mode = {
      begin: openTag,
      beginScope: { 1: "tag", 2: "name" },
      end: closeTag,
      endScope: { 1: "tag", 2: "name", 3: "tag" },
      relevance: 0,
      contains: [],
      "on:begin": (match, response) => {
        if (/[\w$]/.test((match.input ?? "")[(match.index ?? 0) - 1] ?? ""))
          response.ignoreMatch();
      },
    };
    const nested: Mode = { ...paired, "on:begin": undefined, contains: [] };
    const fragment: Mode = {
      begin: /<>/,
      end: /<\/>/,
      beginScope: "tag",
      endScope: "tag",
      relevance: 0,
      contains: [],
    };
    const style: Mode = {
      begin: [/<(?=style[\s>])/, /style(?=[\s>])/],
      beginScope: { 1: "tag", 2: "name" },
      end: [/<\/(?=style\s*>)/, /style/, /\s*>/],
      endScope: { 1: "tag", 2: "name", 3: "tag" },
      relevance: 0,
      contains: [
        attributes,
        {
          begin: /(?<=>)(?!<\/style\s*>)/,
          end: /(?=<\/style\s*>)/,
          subLanguage: "css",
          relevance: 0,
        },
      ],
    };
    const templates = [
      directive,
      style,
      selfClosing,
      fragment,
      paired,
      expression,
    ];
    const children = templates.map((mode) => (mode === paired ? nested : mode));
    paired.contains = [attributes, ...children];
    nested.contains = paired.contains;
    fragment.contains = children;
    expression.contains = [
      "self",
      ...templates.filter((mode) => mode !== expression),
      ...base.contains,
    ];
    const contains = base.contains.map((mode) =>
      mode.contains?.some(
        (child) => child !== "self" && child.subLanguage === "xml",
      )
        ? { ...mode, contains: [...templates, ...mode.contains] }
        : mode,
    );
    return {
      ...base,
      name: "TSRX",
      aliases: [],
      disableAutodetect: true,
      contains: [...templates, ...contains],
    };
  };
}

function parseTokens(
  parser: Lowlight,
  input: CodeBlockParseInput,
): Decoration[] {
  const language = codeBlockParserLanguage(input.language);
  if (!language || !parser.registered(language) || !input.content) return [];
  const result = parser.highlight(language, input.content);
  const decorations: Decoration[] = [];
  let offset = input.pos + 1;
  let text = "";
  const tokenText = (node: TokenNode): string => {
    if (node.type === "text") return node.value;
    if (node.type === "element") return node.children.map(tokenText).join("");
    throw new Error("Unexpected code parser token");
  };
  // Each root scope spans its complete text; nested HAST scopes do not add PM decorations.
  for (const node of result.children) {
    const value = tokenText(node);
    const end = offset + value.length;
    if (node.type === "element" && end > offset) {
      const { className, ...properties } = node.properties;
      const attrs: Record<string, string> = { nodeName: node.tagName };
      Object.entries(properties).forEach(([name, property]) => {
        if (property != null) attrs[name] = String(property);
      });
      if (className != null)
        attrs.class = Array.isArray(className)
          ? className.join(" ")
          : String(className);
      decorations.push(Decoration.inline(offset, end, attrs));
    }
    offset = end;
    text += value;
  }
  if (text !== input.content)
    throw new Error("Code parser changed source content");
  return decorations;
}

function codeBlockParserLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const language = value.trim().toLowerCase();
  if (language === "math") return "latex";
  return language === "mermaid" ? null : language;
}

function loadGrammarDefinitions(): Promise<Record<string, LanguageFn>> {
  definitionsPromise ??= Promise.all(
    Object.entries(grammarLoaders).map(
      async ([name, load]) => [name, (await load()).default] as const,
    ),
  )
    .then((grammars) => {
      const typescript = grammars.find(([name]) => name === "typescript")![1];
      return {
        ...Object.fromEntries(grammars),
        tsrx: createTsrxGrammar(typescript),
      };
    })
    .catch((error: unknown) => {
      definitionsPromise = undefined;
      throw error;
    });
  return definitionsPromise;
}

export interface CodeBlockLoaders {
  loadParser(): Promise<CodeBlockParser>;
  loadDetector(): Promise<CodeBlockDetector>;
}

/** Highlight failure stays plain; a detector import failure can retry on later input. */
export function createCodeBlockLoaders(load: {
  parser: (detector: CodeBlockDetector) => Promise<CodeBlockParser>;
  detector: () => Promise<CodeBlockDetector>;
}): CodeBlockLoaders {
  let parserPromise: Promise<CodeBlockParser> | undefined;
  let detectorPromise: Promise<CodeBlockDetector> | undefined;
  const fallback: CodeBlockParser = {
    parse: () => [],
    supports: () => false,
    detect: () => ({ language: null, relevance: 0 }),
  };
  const loadDetector = () => {
    detectorPromise ??= Promise.resolve()
      .then(load.detector)
      .catch((error: unknown) => {
        detectorPromise = undefined;
        throw error;
      });
    return detectorPromise;
  };
  return {
    loadDetector,
    loadParser: () => {
      parserPromise ??= loadDetector()
        .then(load.parser)
        .catch(() => fallback);
      return parserPromise;
    },
  };
}

const codeBlockLoaders = createCodeBlockLoaders({
  detector: async () => {
    const [{ default: highlight }, definitions] = await Promise.all([
      import("highlight.js/lib/core"),
      loadGrammarDefinitions(),
    ]);
    const detector = highlight.newInstance();
    Object.entries(definitions).forEach(([name, grammar]) =>
      detector.registerLanguage(name, grammar),
    );
    detector.registerAliases("threejs", { languageName: "javascript" });
    detector.registerAliases("commonlisp", { languageName: "lisp" });
    detector.registerAliases("wolfram", { languageName: "mathematica" });
    detector.registerAliases("recharts", { languageName: "typescript" });
    detector.registerAliases("vue", { languageName: "xml" });
    return {
      detect: (content, subset) => {
        const result = detector.highlightAuto(
          content,
          subset.filter((language) => detector.getLanguage(language)),
        );
        return {
          language: result.language ?? null,
          relevance: result.relevance,
        };
      },
    };
  },
  parser: async (detector) => {
    const [{ createLowlight }, definitions] = await Promise.all([
      import("lowlight"),
      loadGrammarDefinitions(),
    ]);
    const parser = createLowlight(definitions);
    parser.registerAlias({
      javascript: "threejs",
      lisp: "commonlisp",
      mathematica: "wolfram",
      typescript: "recharts",
      xml: "vue",
    });
    return {
      parse: (input) => parseTokens(parser, input),
      supports: (value) => {
        const language = codeBlockParserLanguage(value);
        return language !== null && parser.registered(language);
      },
      detect: detector.detect,
    };
  },
});

export function loadCodeBlockParser(): Promise<CodeBlockParser> {
  return codeBlockLoaders.loadParser();
}
export function loadCodeBlockDetector(): Promise<CodeBlockDetector> {
  return codeBlockLoaders.loadDetector();
}

interface CodeBlockHighlightCache {
  readonly node: ProseMirrorNode;
  readonly decorations: DecorationSet;
}
export interface CodeBlockHighlightState {
  readonly decorations: DecorationSet;
  readonly cache: ReadonlyMap<number, CodeBlockHighlightCache>;
}
export interface CodeBlockHighlightOptions {
  readonly parser?: CodeBlockParser | (() => Promise<CodeBlockParser>);
  readonly enabled?: () => boolean;
  readonly onError?: (error: unknown) => void;
}
export const codeBlockHighlightKey = new PluginKey<CodeBlockHighlightState>(
  "composer-code-highlight",
);

export function createCodeBlockHighlight(
  options: CodeBlockHighlightOptions = {},
): Plugin<CodeBlockHighlightState> {
  let parser = typeof options.parser === "object" ? options.parser : undefined;
  const enabled = () => options.enabled?.() !== false;
  const project = (
    doc: ProseMirrorNode,
    previous?: CodeBlockHighlightState,
    transaction?: Transaction,
  ): CodeBlockHighlightState => {
    const cache = new Map<number, CodeBlockHighlightCache>();
    if (!enabled() || !parser)
      return { cache, decorations: DecorationSet.empty };
    const mappedCache = new Map<number, CodeBlockHighlightCache>();
    if (previous && transaction) {
      previous.cache.forEach((entry, pos) => {
        const mapped = transaction.mapping.mapResult(pos, 1);
        if (!mapped.deleted)
          mappedCache.set(mapped.pos, {
            node: entry.node,
            decorations: entry.decorations.map(transaction.mapping, doc),
          });
      });
    }
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (!node.type.spec.code) return;
      const prior = mappedCache.get(pos);
      let set = prior?.node.eq(node) ? prior.decorations : undefined;
      if (!set) {
        try {
          const language = codeBlockHighlightLanguage(node.attrs.language);
          set =
            language && parser!.supports(language)
              ? DecorationSet.create(
                  doc,
                  parser!.parse({
                    content: node.textContent,
                    language: node.attrs.language,
                    pos,
                  }),
                )
              : DecorationSet.empty;
        } catch (error) {
          options.onError?.(error);
          set = DecorationSet.empty;
        }
      }
      cache.set(pos, { node, decorations: set });
      decorations.push(...set.find());
      return false;
    });
    return { cache, decorations: DecorationSet.create(doc, decorations) };
  };
  return new Plugin({
    key: codeBlockHighlightKey,
    state: {
      init: (_, state) => project(state.doc),
      apply: (transaction, state) =>
        transaction.docChanged || transaction.getMeta(codeBlockHighlightKey)
          ? project(transaction.doc, state, transaction)
          : state,
    },
    props: {
      decorations: (state) =>
        enabled()
          ? codeBlockHighlightKey.getState(state)!.decorations
          : DecorationSet.empty,
    },
    view: (view) => {
      let destroyed = false;
      let wasEnabled = enabled();
      const refresh = () => {
        if (!destroyed && !view.isDestroyed && enabled()) {
          view.dispatch(
            view.state.tr
              .setMeta(codeBlockHighlightKey, true)
              .setMeta("addToHistory", false),
          );
        }
      };
      if (!parser) {
        Promise.resolve()
          .then(() =>
            typeof options.parser === "function"
              ? options.parser()
              : loadCodeBlockParser(),
          )
          .then((ready) => {
            parser = ready;
            refresh();
          })
          .catch((error: unknown) => {
            if (!destroyed) options.onError?.(error);
          });
      }
      return {
        update: () => {
          const currentEnabled = enabled();
          if (wasEnabled !== currentEnabled) {
            wasEnabled = currentEnabled;
            if (parser) refresh();
          }
        },
        destroy: () => {
          destroyed = true;
        },
      };
    },
  });
}
