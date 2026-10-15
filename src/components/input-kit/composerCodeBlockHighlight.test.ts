import { EditorState, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadCodeBlockParser,
  createCodeBlockHighlight,
  codeBlockHighlightKey,
  createCodeBlockLoaders,
  createTsrxGrammar,
} from "./composerCodeBlockHighlight";
import { composerSchema } from "./composerSchema";
import {
  codeBlockLanguages,
  detectCodeBlockLanguage,
} from "./composerCodeBlockLanguage";
import { codeDoc, deferred, mountCodeView } from "./composerCodeBlockTestUtils";
import referenceLanguages from "./composerCodeBlockReference.testFixtures.json";

const mounted: ReturnType<typeof mountCodeView>[] = [];
afterEach(() => mounted.splice(0).forEach((item) => item.destroy()));

describe("real parser and PM decorations", () => {
  it("places real keyword/string tokens at UTF16 pos+1 and never rewrites code", async () => {
    const parser = await loadCodeBlockParser();
    const source = '// 中😀\nconst name = "中😀";\n\n';
    const doc = codeDoc(source, "javascript", false);
    const state = EditorState.create({
      doc,
      plugins: [createCodeBlockHighlight({ parser })],
    });
    const decorations = codeBlockHighlightKey
      .getState(state)!
      .decorations.find();
    const keyword = decorations.find(
      (item) => doc.textBetween(item.from, item.to) === "const",
    );
    expect(keyword).toBeDefined();
    expect(keyword!.from).toBe(1 + source.indexOf("const"));
    expect(
      decorations.some(
        (item) => doc.textBetween(item.from, item.to) === '"中😀"',
      ),
    ).toBe(true);
    expect(state.doc).toBe(doc);
    expect(doc.textContent).toBe(source);
  });

  it("supports the confirmed grammar catalog and leaves mermaid/plain unhighlighted", async () => {
    const parser = await loadCodeBlockParser();
    for (const language of codeBlockLanguages) {
      expect(parser.supports(language.value), language.value).toBe(
        language.value !== "mermaid",
      );
    }
    expect(parser.supports("graphql")).toBe(true);
    expect(parser.supports("wasm")).toBe(true);
    expect(parser.supports("tsrx")).toBe(true);
    expect(parser.supports("mermaid")).toBe(false);
    for (const language of ["plaintext", "mermaid", "unknown"]) {
      expect(
        parser.parse({ content: "const a = 1", language, pos: 0 }),
      ).toEqual([]);
    }
    expect(
      parser.parse({
        content: "query Foo { field }",
        language: "graphql",
        pos: 7,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      parser.parse({
        content: '(module (func (export "main") (result i32) i32.const 1))',
        language: "wasm",
        pos: 0,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      parser.parse({ content: "\\frac{1}{2}", language: "math", pos: 0 })
        .length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ["dockerfile", "FROM node:24\nRUN echo hello", "FROM"],
    ["powershell", '$name = "hello"\nGet-Item $name', "Get-Item"],
    ["commonlisp", '(defun greet (name) (format t "hello ~a" name))', "defun"],
    ["wolfram", "Plot[Sin[x], {x, 0, Pi}]", "Plot"],
  ])(
    "executes the raw registered parser for %s while keeping extras out of GUI normalization",
    async (language, source, token) => {
      const parser = await loadCodeBlockParser();
      const doc = codeDoc(source, language, false);
      expect(parser.supports(language)).toBe(true);
      const decorations = parser.parse({ content: source, language, pos: 0 });
      expect(decorations.length).toBeGreaterThan(0);
      expect(
        decorations.map((decoration) =>
          doc.textBetween(decoration.from, decoration.to),
        ),
      ).toContain(token);
      const state = EditorState.create({
        doc,
        plugins: [createCodeBlockHighlight({ parser })],
      });
      expect(codeBlockHighlightKey.getState(state)!.decorations.find()).toEqual(
        [],
      );
      expect(state.doc).toBe(doc);
    },
  );

  it("registers all 53 observed raw grammars and five parser alias groups without expanding the 41-item picker", async () => {
    const parser = await loadCodeBlockParser();
    expect(referenceLanguages.registeredGrammars).toHaveLength(53);
    expect(Object.keys(referenceLanguages.parserAliases)).toHaveLength(5);
    for (const language of referenceLanguages.registeredGrammars)
      expect(parser.supports(language), language).toBe(true);
    for (const aliases of Object.values(referenceLanguages.parserAliases)) {
      for (const alias of aliases)
        expect(parser.supports(alias), alias).toBe(true);
    }
    expect(codeBlockLanguages).toHaveLength(41);
    expect(
      parser.parse({ content: "plain text", language: "plaintext", pos: 0 }),
    ).toEqual([]);
  });

  it("uses real grammar relevance for unhinted source and excludes unregistered names", async () => {
    const parser = await loadCodeBlockParser();
    const source =
      "pub fn answer<'a>(value: &'a str) -> Option<&'a str> { Some(value) }";
    const detection = parser.detect(source, [
      "rust",
      "tsrx",
      "mermaid",
      "unknown",
    ]);
    expect(detection.language).toBe("rust");
    expect(detection.relevance).toBeGreaterThanOrEqual(2);
    expect(await detectCodeBlockLanguage(source, parser.detect)).toBe("rust");
    expect(
      parser.detect("a long phrase with no registered grammar", [
        "tsrx",
        "unknown",
      ]).language,
    ).toBeNull();
  });

  it("parses TSRX directives, nested markup, expressions, and CSS with real tokens", async () => {
    const parser = await loadCodeBlockParser();
    const source =
      'const App = (props: {name: string}) => @{ <div className={props.name}><>@if (props.name) { <span>{props.name}</span> } @else { <Input value={1 > 0 ? ">" : "no"} /> }</><style>p { color: red; }</style></div> };';
    const item = mountCodeView(codeDoc(source, "tsrx", false), [
      createCodeBlockHighlight({ parser }),
    ]);
    mounted.push(item);
    const code = item.view.dom.querySelector("code")!;
    expect(code.textContent).toBe(source);
    expect(
      [...code.querySelectorAll(".hljs-keyword")].map(
        (element) => element.textContent,
      ),
    ).toEqual(expect.arrayContaining(["const", "@{", "@if", "@else"]));
    expect(
      [...code.querySelectorAll(".hljs-name")].map(
        (element) => element.textContent,
      ),
    ).toEqual(expect.arrayContaining(["div", "span", "Input", "style"]));
    expect(
      [...code.querySelectorAll(".hljs-tag")].some((element) =>
        element.textContent?.includes("className"),
      ),
    ).toBe(true);
    expect(code.querySelector(".hljs-attr")).toBeNull();
    expect(code.querySelector(".hljs-attribute")).toBeNull();
    expect(code.querySelector(".css")?.textContent).toBe("p { color: red; }");
    expect(parser.detect(source, ["tsrx"]).language).toBeNull();
  });

  it("produces nested attribute/CSS scopes in the real TSRX HAST grammar separately from PM root projection", async () => {
    const [{ createLowlight }, { default: typescript }, { default: css }] =
      await Promise.all([
        import("lowlight"),
        import("highlight.js/lib/languages/typescript"),
        import("highlight.js/lib/languages/css"),
      ]);
    const grammar = createLowlight({
      tsrx: createTsrxGrammar(typescript),
      css,
    });
    const source =
      'const App = () => @{ <div title={"中😀"}><style>p { color: red; }</style></div> };';
    const tree = grammar.highlight("tsrx", source);
    type Token = (typeof tree.children)[number];
    const scopes: string[] = [];
    const cssProperties: string[] = [];
    const read = (node: Token): string => {
      if (node.type === "text") return node.value;
      if (node.type !== "element") throw new Error("unexpected grammar token");
      const text = node.children.map(read).join("");
      const classes = node.properties.className;
      if (Array.isArray(classes)) {
        scopes.push(...classes.map(String));
        if (classes.includes("hljs-attribute")) cssProperties.push(text);
      }
      return text;
    };
    expect(tree.children.map(read).join("")).toBe(source);
    expect(scopes).toEqual(
      expect.arrayContaining([
        "hljs-keyword",
        "hljs-tag",
        "hljs-name",
        "hljs-attr",
        "css",
      ]),
    );
    expect(cssProperties).toContain("color");
  });

  it("keeps nested JavaScript callback scopes flat and does not fabricate keyword tokens inside comments or strings", async () => {
    const parser = await loadCodeBlockParser();
    const source =
      '// const fake = "comment";\nconst real = "const in string";\nconst mapped = values.map((value = "const nested") => value);';
    const item = mountCodeView(codeDoc(source, "javascript", false), [
      createCodeBlockHighlight({ parser }),
    ]);
    mounted.push(item);
    const keywords = [...item.view.dom.querySelectorAll(".hljs-keyword")].map(
      (element) => element.textContent,
    );
    expect(keywords.filter((token) => token === "const")).toHaveLength(2);
    expect(item.view.dom.querySelector(".hljs-params")).toBeNull();
    expect(
      [...item.view.dom.querySelectorAll(".hljs-string")].map(
        (element) => element.textContent,
      ),
    ).toEqual(['"const in string"']);
    expect(item.view.dom.querySelector(".hljs-function")?.textContent).toBe(
      '(value = "const nested") =>',
    );
    expect(item.view.dom.querySelector("code")!.textContent).toBe(source);
  });

  it("keeps TypeScript generics/comparisons outside TSRX markup and bounds self-closing lookahead", async () => {
    const parser = await loadCodeBlockParser();
    const generic =
      "const values: Array<Item> = []; const less = left < right;";
    const item = mountCodeView(codeDoc(generic, "tsrx", false), [
      createCodeBlockHighlight({ parser }),
    ]);
    mounted.push(item);
    expect(item.view.dom.querySelector(".hljs-tag")).toBeNull();
    expect(item.view.dom.querySelector("code")!.textContent).toBe(generic);
    for (const length of [1, 4097]) {
      const source = `const App = () => @{ <Input${" ".repeat(length)}value={1 > 0 ? ">" : "no"} />; const after = 1; };`;
      const result = mountCodeView(codeDoc(source, "tsrx", false), [
        createCodeBlockHighlight({ parser }),
      ]);
      mounted.push(result);
      expect(result.view.dom.querySelector("code")!.textContent).toBe(source);
      const keywords = [
        ...result.view.dom.querySelectorAll(".hljs-keyword"),
      ].map((element) => element.textContent);
      expect(keywords.filter((token) => token === "const")).toHaveLength(
        length === 1 ? 2 : 1,
      );
    }
  });

  it("maps unchanged moved code and invalidates changed attrs/body without stale offsets", async () => {
    const real = await loadCodeBlockParser();
    const parser = { ...real, parse: vi.fn(real.parse) };
    const plugin = createCodeBlockHighlight({ parser });
    let state = EditorState.create({
      doc: codeDoc("const value = 1;", "javascript", false),
      plugins: [plugin],
    });
    expect(parser.parse).toHaveBeenCalledTimes(1);
    const prior = codeBlockHighlightKey
      .getState(state)!
      .decorations.find()
      .map((item) => [item.from, item.to]);
    const before = composerSchema.node(
      "paragraph",
      null,
      composerSchema.text("前缀😀"),
    );
    state = state.applyTransaction(state.tr.insert(0, before)).state;
    expect(parser.parse).toHaveBeenCalledTimes(1);
    expect(
      codeBlockHighlightKey
        .getState(state)!
        .decorations.find()
        .map((item) => [item.from, item.to]),
    ).toEqual(
      prior.map(([a, b]) => [a + before.nodeSize, b + before.nodeSize]),
    );
    state = state.applyTransaction(
      state.tr.setNodeMarkup(before.nodeSize, undefined, {
        language: "plaintext",
        autoDetectLanguage: false,
      }),
    ).state;
    expect(codeBlockHighlightKey.getState(state)!.decorations.find()).toEqual(
      [],
    );
    state = state.applyTransaction(
      state.tr.setNodeMarkup(before.nodeSize, undefined, {
        language: "javascript",
        autoDetectLanguage: false,
      }),
    ).state;
    state = state.applyTransaction(
      state.tr.insertText(" // tail", state.doc.content.size - 1),
    ).state;
    expect(parser.parse).toHaveBeenCalledTimes(3);
    expect(state.doc.lastChild!.textContent).toBe("const value = 1; // tail");
  });

  it("projects real PM spans while selection/body stay PM-owned", async () => {
    const parser = await loadCodeBlockParser();
    const item = mountCodeView(
      codeDoc('const value = "😀";', "javascript", false),
      [createCodeBlockHighlight({ parser })],
    );
    mounted.push(item);
    expect(item.view.dom.querySelector("code .hljs-keyword")?.textContent).toBe(
      "const",
    );
    item.view.dispatch(
      item.view.state.tr
        .setSelection(TextSelection.create(item.view.state.doc, 6))
        .insertText(" "),
    );
    expect(item.view.dom.querySelector("code")!.textContent).toBe(
      'const  value = "😀";',
    );
    expect(item.view.state.selection.head).toBe(7);
  });

  it("refreshes the current doc after lazy load and never dispatches after destruction", async () => {
    const parser = await loadCodeBlockParser();
    const pending = deferred<typeof parser>();
    const item = mountCodeView(codeDoc("const old = 1", "javascript", false), [
      createCodeBlockHighlight({ parser: () => pending.promise }),
    ]);
    mounted.push(item);
    item.view.dispatch(
      item.view.state.tr.replaceWith(
        0,
        item.view.state.doc.content.size,
        codeDoc("const current = 2", "javascript", false).content,
      ),
    );
    pending.resolve(parser);
    await vi.waitFor(() =>
      expect(item.view.dom.querySelector(".hljs-keyword")).not.toBeNull(),
    );
    expect(item.view.state.doc.textContent).toBe("const current = 2");
    expect(
      item.transactions
        .filter((t) => !t.docChanged)
        .every((t) => t.addToHistory === false),
    ).toBe(true);
    const abandoned = deferred<typeof parser>();
    const dead = mountCodeView(codeDoc("const dead = 0", "javascript", false), [
      createCodeBlockHighlight({ parser: () => abandoned.promise }),
    ]);
    mounted.push(dead);
    dead.destroy();
    abandoned.resolve(parser);
    await Promise.resolve();
    await Promise.resolve();
    expect(dead.transactions).toEqual([]);
  });

  it("fails closed on parser rejection and respects plain mode without fabricated tokens", async () => {
    const error = new Error("unavailable"),
      onError = vi.fn();
    const item = mountCodeView(
      codeDoc("const plain = 1", "javascript", false),
      [
        createCodeBlockHighlight({
          parser: () => Promise.reject(error),
          onError,
        }),
      ],
    );
    mounted.push(item);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    expect(item.view.dom.querySelector(".hljs-keyword")).toBeNull();
    expect(item.view.state.doc.textContent).toBe("const plain = 1");
    const parser = await loadCodeBlockParser();
    const state = EditorState.create({
      doc: codeDoc("const hidden = 1", "javascript", false),
      plugins: [createCodeBlockHighlight({ parser, enabled: () => false })],
    });
    expect(codeBlockHighlightKey.getState(state)!.decorations.find()).toEqual(
      [],
    );
  });

  it("retains the surviving block cache after deleting an earlier code block", async () => {
    const real = await loadCodeBlockParser();
    const parser = { ...real, parse: vi.fn(real.parse) };
    const first = codeDoc("const first = 1", "javascript", false).firstChild!;
    const second = codeDoc("fn main() {}", "rust", false).firstChild!;
    let state = EditorState.create({
      doc: composerSchema.node("doc", null, [first, second]),
      plugins: [createCodeBlockHighlight({ parser })],
    });
    expect(parser.parse).toHaveBeenCalledTimes(2);
    state = state.apply(state.tr.delete(0, first.nodeSize));
    expect(parser.parse).toHaveBeenCalledTimes(2);
    const tokens = codeBlockHighlightKey.getState(state)!.decorations.find();
    expect(
      tokens.some(
        (token) => state.doc.textBetween(token.from, token.to) === "fn",
      ),
    ).toBe(true);
    expect(
      tokens.every(
        (token) => token.from >= 1 && token.to <= second.nodeSize - 1,
      ),
    ).toBe(true);
  });

  it("holds loaded results in plain mode and renders current code when re-enabled", async () => {
    const parser = await loadCodeBlockParser();
    const pending = deferred<typeof parser>();
    let enabled = false;
    const item = mountCodeView(
      codeDoc("const current = 1", "javascript", false),
      [
        createCodeBlockHighlight({
          parser: () => pending.promise,
          enabled: () => enabled,
        }),
      ],
    );
    mounted.push(item);
    pending.resolve(parser);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(item.transactions).toEqual([]);
    expect(item.view.dom.querySelector(".hljs-keyword")).toBeNull();
    enabled = true;
    item.view.updateState(item.view.state);
    await vi.waitFor(() =>
      expect(item.view.dom.querySelector(".hljs-keyword")?.textContent).toBe(
        "const",
      ),
    );
    expect(item.transactions).toEqual([
      { docChanged: false, addToHistory: false },
    ]);
  });

  it("retries a failed detector while preserving the first highlight fallback", async () => {
    const real = await loadCodeBlockParser();
    const detector = vi
      .fn()
      .mockRejectedValueOnce(new Error("detector chunk unavailable"))
      .mockResolvedValue(real);
    const parser = vi.fn(async () => real);
    const owner = createCodeBlockLoaders({ detector, parser });
    const plain = await owner.loadParser();
    expect(plain.supports("javascript")).toBe(false);
    expect(parser).not.toHaveBeenCalled();
    expect(await owner.loadDetector()).toBe(real);
    expect(detector).toHaveBeenCalledTimes(2);
    expect(await owner.loadParser()).toBe(plain);
    expect(parser).not.toHaveBeenCalled();
    const item = mountCodeView(
      codeDoc("const source = 1", "javascript", false),
      [createCodeBlockHighlight({ parser: owner.loadParser })],
    );
    mounted.push(item);
    await vi.waitFor(() => expect(item.transactions).toHaveLength(1));
    expect(item.view.dom.querySelector(".hljs-keyword")).toBeNull();
    expect(item.view.state.doc.textContent).toBe("const source = 1");
  });

  it("keeps detection usable after parser failure and does not retry highlight on edits or remount", async () => {
    const real = await loadCodeBlockParser();
    const detector = vi.fn(async () => real);
    const parser = vi
      .fn()
      .mockRejectedValueOnce(new Error("lowlight unavailable"))
      .mockResolvedValue(real);
    const owner = createCodeBlockLoaders({ detector, parser });
    const plain = await owner.loadParser();
    const source =
      "pub fn answer<'a>(value: &'a str) -> Option<&'a str> { Some(value) }";
    expect((await owner.loadDetector()).detect(source, ["rust"]).language).toBe(
      "rust",
    );
    const item = mountCodeView(
      codeDoc("const source = 1", "javascript", false),
      [createCodeBlockHighlight({ parser: owner.loadParser })],
    );
    mounted.push(item);
    await vi.waitFor(() => expect(item.transactions).toHaveLength(1));
    item.view.dispatch(item.view.state.tr.insertText(" ", 1));
    const another = mountCodeView(item.view.state.doc, [
      createCodeBlockHighlight({ parser: owner.loadParser }),
    ]);
    mounted.push(another);
    await vi.waitFor(() => expect(another.transactions).toHaveLength(1));
    expect(await owner.loadParser()).toBe(plain);
    expect(parser).toHaveBeenCalledTimes(1);
    expect(detector).toHaveBeenCalledTimes(1);
    expect(item.view.dom.querySelector(".hljs-keyword")).toBeNull();
    expect(another.view.dom.querySelector(".hljs-keyword")).toBeNull();
  });

  it("deduplicates concurrent successful loader requests", async () => {
    const real = await loadCodeBlockParser();
    const pending = deferred<typeof real>();
    const detector = vi.fn(() => pending.promise);
    const parser = vi.fn(async () => real);
    const owner = createCodeBlockLoaders({ detector, parser });
    const first = owner.loadDetector(),
      second = owner.loadParser(),
      third = owner.loadParser();
    await Promise.resolve();
    expect(detector).toHaveBeenCalledTimes(1);
    pending.resolve(real);
    expect(await Promise.all([first, second, third])).toEqual([
      real,
      real,
      real,
    ]);
    expect(parser).toHaveBeenCalledTimes(1);
  });

  it("fails closed if a parser throws and still projects readonly code", async () => {
    const real = await loadCodeBlockParser();
    const error = new Error("bad tokens");
    const onError = vi.fn();
    const state = EditorState.create({
      doc: codeDoc("const source = 1", "javascript", false),
      plugins: [
        createCodeBlockHighlight({
          parser: {
            ...real,
            parse: () => {
              throw error;
            },
          },
          onError,
        }),
      ],
    });
    expect(onError).toHaveBeenCalledWith(error);
    expect(codeBlockHighlightKey.getState(state)!.decorations.find()).toEqual(
      [],
    );
    expect(state.doc.textContent).toBe("const source = 1");
    const item = mountCodeView(
      state.doc,
      [createCodeBlockHighlight({ parser: real })],
      { editable: false },
    );
    mounted.push(item);
    expect(item.view.dom.querySelector(".hljs-keyword")?.textContent).toBe(
      "const",
    );
    expect(item.transactions).toEqual([]);
  });
});
