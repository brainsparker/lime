import { describe, expect, it } from "vitest";
import { Lexer } from "marked";
import { DOMParser } from "@tiptap/pm/model";
import { ComposerController } from "./ComposerController";
import { composerSchema, composerDocumentFromJSON } from "./composerSchema";
import {
  composerDocumentFromPromptText,
  serializeComposerDocument,
} from "./composerSerialization";
import type { ComposerEditorDocument } from "./types";
import {
  codeDocument,
  linkDocument,
  mixedDocument,
} from "./composerMarks.testFixtures";

describe("Composer link and code edge contracts", () => {
  it.each(["javascript:alert(1)", "data:text/html,x", "file:///a"])(
    "null attrs href cannot authorize unsafe literal %s",
    (href) => {
      const json = linkDocument({
        href: null,
        literalMarkdownSource: `[x](${href})`,
      });
      (json.content[0].content![0] as { text: string }).text = "x";
      expect(
        serializeComposerDocument(composerDocumentFromJSON(json), {
          preserveLiteralMarkdown: true,
        }).text,
      ).toBe("x");
    },
  );

  it.each([
    "data:text/html,x",
    "javascript:alert(1)",
    "file:///a",
    "https://e.test/a\tb",
    "https://e.test/\u0000x",
  ])("rejects ordinary href %s before it enters state", (href) => {
    expect(
      () => new ComposerController({ editorDocument: linkDocument({ href }) }),
    ).toThrow(/href/);
    const controller = new ComposerController({ text: "label" });
    const before = controller.captureDraft();
    expect(() => controller.setLink({ start: 0, end: 5 }, href)).toThrow(
      /href/,
    );
    expect(controller.captureDraft()).toEqual(before);
  });

  it("has explicit typed defaults and permits a finite noninteger occurrence ID", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "label",
              marks: [{ type: "link", attrs: { href: "https://e.test" } }],
            },
          ],
        },
      ],
    } as unknown as ComposerEditorDocument;
    expect(
      composerDocumentFromJSON(json).firstChild!.firstChild!.marks[0].attrs,
    ).toEqual({
      href: "https://e.test",
      title: null,
      disabled: false,
      isAutolink: false,
      isGeneratedAutolink: false,
      literalMarkdownOccurrenceId: null,
      literalMarkdownSource: null,
      sourceAppId: null,
    });
    expect(() =>
      composerDocumentFromJSON(
        linkDocument({ literalMarkdownOccurrenceId: 1.25 }),
      ),
    ).not.toThrow();
  });

  it.each([
    { disabled: 1 },
    { isAutolink: "true" },
    { href: 1 },
    { sourceAppId: {} },
    { literalMarkdownSource: 1 },
    { literalMarkdownOccurrenceId: Infinity },
  ])("rejects malformed known link attribute %j", (attrs) => {
    expect(() => composerDocumentFromJSON(linkDocument(attrs))).toThrow();
  });

  it.each(["bad language", "bad`lang", ""])(
    "rejects invalid code language in JSON %j",
    (language) => {
      expect(() =>
        composerDocumentFromJSON(codeDocument("x", language)),
      ).toThrow(/language/);
    },
  );

  it.each(["hard_break", "paste", "mention"])(
    "rejects %s inside text-only code",
    (type) => {
      const json = codeDocument();
      (json.content[0] as unknown as { content: unknown[] }).content = [
        {
          type,
          attrs: {
            id: "p",
            placeholder: "p",
            text: "p",
            kind: "file",
            name: "p",
            path: "/p",
            label: "p",
          },
        },
      ];
      expect(() => composerDocumentFromJSON(json)).toThrow();
    },
  );

  it("rejects link marks inside code rather than dropping them on restore", () => {
    const json = codeDocument();
    (json.content[0] as unknown as { content: unknown[] }).content = [
      ...linkDocument().content[0].content!,
    ];
    expect(() => composerDocumentFromJSON(json)).toThrow();
  });

  it.each([
    {
      source: "prefix [中😀](https://e.test)",
      href: "https://e.test",
      title: null,
    },
    {
      source: "[中😀](https://e.test) trailing",
      href: "https://e.test",
      title: null,
    },
    {
      source: "[中😀](https://other.test)",
      href: "https://e.test",
      title: null,
    },
    { source: "[旧](https://e.test)", href: "https://e.test", title: null },
    {
      source: "[中😀](https://e.test '旧标题')",
      href: "https://e.test",
      title: "新标题",
    },
  ])(
    "does not replay stale or nonexact literal source %j",
    ({ source, href, title }) => {
      const doc = composerDocumentFromJSON(
        linkDocument({ literalMarkdownSource: source, href, title }),
      );
      const expected = title
        ? '[中😀](https://e.test "新标题")'
        : "[中😀](https://e.test)";
      expect(
        serializeComposerDocument(doc, { preserveLiteralMarkdown: true }).text,
      ).toBe(expected);
    },
  );

  it.each([
    { href: "https://new.test" },
    { href: "https://e.test", title: "新标题" },
    { href: "https://e.test", label: "新😀" },
  ])(
    "editing href/title/label invalidates literal and autolink attrs %j",
    (update) => {
      const controller = new ComposerController({
        editorDocument: linkDocument({
          isAutolink: true,
          isGeneratedAutolink: true,
        }),
      });
      expect(controller.updateLink({ start: 0, end: 3 }, update)).toBe(true);
      const attrs =
        controller.getEditorState().doc.firstChild!.firstChild!.marks[0].attrs;
      expect(attrs).toMatchObject({
        isAutolink: false,
        isGeneratedAutolink: false,
        literalMarkdownOccurrenceId: null,
        literalMarkdownSource: null,
        sourceAppId: "source-app",
      });
      expect(
        serializeComposerDocument(controller.getEditorState().doc, {
          preserveLiteralMarkdown: true,
        }).text,
      ).not.toBe("[中😀](https://e.test)");
    },
  );

  it("native label edits cannot replay the old source even when attrs remain", () => {
    const controller = new ComposerController({
      editorDocument: linkDocument(),
    });
    controller.applyTransaction(
      controller.getEditorState().tr.insertText("新增", 2),
    );
    expect(
      serializeComposerDocument(controller.getEditorState().doc, {
        preserveLiteralMarkdown: true,
      }).text,
    ).toBe("[中新增😀](https://e.test)");
  });

  it("formats title-bearing links with safe quoting and independent phrasing escaping", () => {
    const title = "a\\b \"double\" 'single'";
    const controller = new ComposerController({ text: "[x]*_`" });
    expect(
      controller.setLink({ start: 0, end: 6 }, "https://e.test/a)b", title),
    ).toBe(true);
    const text = controller.submit("start").submission.text;
    const tokens = Lexer.lexInline(text, { gfm: false });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "link",
      href: "https://e.test/a)b",
      title,
    });
    const html = document.createElement("div");
    html.innerHTML =
      '<p><span text-link-href="https://e.test" text-link-title="标题" data-breakable-url="true" data-rich-text-generated-autolink="true">label</span></p>';
    expect(
      DOMParser.fromSchema(composerSchema).parse(html).firstChild!.firstChild!
        .marks[0].attrs,
    ).toMatchObject({
      title: "标题",
      isAutolink: true,
      isGeneratedAutolink: true,
      literalMarkdownSource: null,
      sourceAppId: null,
    });
  });

  it("formats basic label/destination escapes and merges consecutive same-link text", () => {
    const doc = linkDocument({
      href: "https://e.test/a)b",
      literalMarkdownSource: null,
    });
    const first = doc.content[0].content![0] as unknown as {
      text: string;
      marks: unknown[];
    };
    first.text = "a\\](b]";
    (doc.content[0] as unknown as { content: unknown[] }).content.push({
      ...first,
      text: "尾",
    });
    expect(serializeComposerDocument(composerDocumentFromJSON(doc)).text).toBe(
      "[a\\\\\\]\\(b\\]尾](https://e.test/a\\)b)",
    );
  });

  it("preserves plain Markdown outside the confirmed feature set and closed code bodies", () => {
    const plain = "**粗体**\n[a **b**](https://e.test)\n\n尾\n";
    const controller = new ComposerController();
    controller.ingestPaste(plain);
    expect(controller.getDocument().text).toBe(plain);
    expect(
      controller.getEditorState().doc.firstChild!.firstChild!.marks,
    ).toEqual([]);
    const code = composerDocumentFromPromptText("````ts\nx\n```\ny\n````");
    expect(code.firstChild!.textContent).toBe("x\n```\ny");
    expect(serializeComposerDocument(code).text).toBe(
      "````ts\nx\n```\ny\n````",
    );
  });

  it("annotation changes preserve code/link/paste identity and rebase final send bytes", () => {
    const controller = new ComposerController({
      editorDocument: mixedDocument(),
    });
    const before = controller.captureDraft();
    controller.setTextElements([
      ...before.textElements,
      { byteRange: { start: 35, end: 38 }, placeholder: "tail" },
    ]);
    expect(controller.getDocument().text).toBe(before.text);
    expect(controller.getDocument().editorDocument.content.slice(0, 2)).toEqual(
      before.editorDocument.content.slice(0, 2),
    );
    expect(
      controller.getEditorState().doc.lastChild!.firstChild!.attrs.id,
    ).toBe("paste-1");
    expect(controller.submit("queue").submission.textElements[2]).toEqual({
      byteRange: { start: 71, end: 74 },
      placeholder: "tail",
    });
    controller.setMentionBindings([]);
    expect(controller.getDocument().mentionBindings).toEqual([]);
    expect(controller.submit("queue").submission.inputMentions).toEqual([]);
    expect(controller.getDocument().editorDocument.content.slice(0, 2)).toEqual(
      before.editorDocument.content.slice(0, 2),
    );
  });

  it("code refuses atom annotations without mutating the existing document", () => {
    const controller = new ComposerController({
      editorDocument: codeDocument("中😀"),
    });
    const before = controller.captureDraft();
    controller.insertMention(
      { id: "s", kind: "skill", name: "s", path: "/s", label: "$s" },
      { start: 0, end: 3 },
    );
    expect(controller.captureDraft()).toEqual(before);
    expect(() =>
      controller.setTextElements([
        { byteRange: { start: 0, end: 7 }, placeholder: "code" },
      ]),
    ).toThrow(/block/);
    expect(controller.captureDraft()).toEqual(before);
  });
});
