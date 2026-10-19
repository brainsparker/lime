import { undo } from "@tiptap/pm/history";
import { describe, expect, it, vi } from "vitest";
import { ComposerController } from "./ComposerController";

function type(controller: ComposerController, text: string) {
  controller.applyTransaction(controller.getEditorState().tr.insertText(text));
}

describe("Composer suggestions in the canonical EditorState", () => {
  it("opens + without editing the draft, selection, resources or submission revision", () => {
    const controller = new ComposerController({
      text: "保留草稿 😀",
      selectionStart: 2,
      selectionEnd: 4,
      attachments: [{ data: "aW1hZ2U=", mediaType: "image/png" }],
      inputCapabilityRoute: { kind: "skill" },
    });
    const before = controller.captureDraft();
    const receipt = controller.submit("start");
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.toggleContextSuggestions();

    expect(controller.getSuggestion()).toMatchObject({
      active: true,
      activation: "synthetic",
      kind: "at-mention",
      trigger: "+",
      query: "",
      range: { from: 3, to: 3 },
    });
    expect(controller.captureDraft()).toEqual(before);
    expect(controller.getSnapshot().revision).toBe(receipt.revision);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.toggleContextSuggestions();
    expect(controller.getSuggestion().active).toBe(false);
    expect(controller.captureDraft()).toEqual(before);
    if (receipt.kind !== "accepted")
      throw new Error("expected accepted receipt");
    expect(controller.commit(receipt)).toBe(true);
    expect(controller.getSuggestion().active).toBe(false);
  });

  it.each([
    ["@", "at-mention", "", "@"],
    ["(@web search", "at-mention", "web search", "@"],
    ["😀 @中文", "at-mention", "中文", "@"],
    ["/plan mode", "slash-command", "plan mode", "/"],
    ["$documents", "skill-mention", "documents", "$"],
    ["$", "skill-mention", "", "$"],
  ])("projects typed %s from a real edit", (text, kind, query, trigger) => {
    const controller = new ComposerController();
    type(controller, text);
    expect(controller.getSuggestion()).toMatchObject({
      active: true,
      activation: "typed",
      kind,
      query,
      trigger,
    });
  });

  it.each(["user@example.com", "https://example.com", "hello $ ", "@\nquery"])(
    "does not activate for literal %s",
    (text) => {
      const controller = new ComposerController();
      type(controller, text);
      expect(controller.getSuggestion().active).toBe(false);
    },
  );

  it("uses PM positions across Unicode and paragraphs, without slicing an atom label", () => {
    const controller = new ComposerController({ text: "前文 😀\n" });
    type(controller, "@报告");
    const suggestion = controller.getSuggestion();
    expect(suggestion.range).toEqual({ from: 8, to: 11 });
    controller.clearSuggestion();
    controller.insertMention({
      id: "skill:reports",
      kind: "skill",
      name: "Reports",
      path: "/skills/reports/SKILL.md",
      label: "@报告",
    });
    expect(controller.getSuggestion().active).toBe(false);
    controller.setSelection(controller.getDocument().text.length - 1);
    expect(controller.getSuggestion().active).toBe(false);
  });

  it("blocks typed activation inside a code block and a nonempty selection", () => {
    const controller = new ComposerController({
      editorDocument: {
        type: "doc",
        content: [
          { type: "code_block", content: [{ type: "text", text: "const " }] },
        ],
      },
    });
    type(controller, "@file");
    expect(controller.getSuggestion().active).toBe(false);

    const text = new ComposerController();
    type(text, "@file");
    text.setSelection(0, 3);
    expect(text.getSuggestion().active).toBe(false);
  });

  it("keeps synthetic + while filtering, then follows a newly typed @", () => {
    const controller = new ComposerController({ text: "keep " });
    controller.toggleContextSuggestions();
    type(controller, "files");
    expect(controller.getSuggestion()).toMatchObject({
      activation: "synthetic",
      trigger: "+",
      query: "files",
      range: { from: 6, to: 11 },
    });
    type(controller, " @report");
    expect(controller.getSuggestion()).toMatchObject({
      activation: "typed",
      trigger: "@",
      query: "report",
      range: { from: 12, to: 19 },
    });
    controller.clearSuggestion();
    expect(controller.getDocument().text).toBe("keep files ");
  });

  it("closes synthetic suggestions when the caret leaves their range or crosses a paragraph", () => {
    const controller = new ComposerController({ text: "prefix " });
    controller.toggleContextSuggestions();
    type(controller, "query");
    controller.setSelection(2);
    expect(controller.getSuggestion().active).toBe(false);
    controller.setSelection(controller.getDocument().text.length);
    controller.toggleContextSuggestions();
    controller.replaceRange(
      {
        start: controller.getDocument().text.length,
        end: controller.getDocument().text.length,
      },
      "\nnext",
    );
    expect(controller.getSuggestion().active).toBe(false);
  });

  it("clears only the active token and preserves the surrounding rich draft", () => {
    const controller = new ComposerController({
      text: "prefix  suffix",
      selectionStart: 7,
    });
    type(controller, "@query");
    controller.setAttachments([{ data: "cGhvdG8=", mediaType: "image/png" }]);
    controller.clearSuggestion();
    expect(controller.getDocument()).toMatchObject({
      text: "prefix  suffix",
      selectionStart: 7,
      selectionEnd: 7,
      attachments: [{ data: "cGhvdG8=", mediaType: "image/png" }],
    });
    expect(controller.getSuggestion().active).toBe(false);
    expect(
      undo(controller.getEditorState(), (transaction) =>
        controller.applyTransaction(transaction),
      ),
    ).toBe(true);
    expect(controller.getDocument().text).toBe("prefix  suffix");
  });

  it("changes a typed category by deleting its query while retaining the trigger", () => {
    const controller = new ComposerController({ text: "before " });
    type(controller, "@reports");
    const source = { kind: "at-mention-category", category: "files" } as const;
    controller.setSuggestionSource(source);
    expect(controller.getDocument().text).toBe("before @");
    expect(controller.getSuggestion()).toMatchObject({
      active: true,
      activation: "typed",
      query: "",
      source,
      range: { from: 8, to: 9 },
    });
    type(controller, "新的");
    expect(controller.getSuggestion()).toMatchObject({ query: "新的", source });
    controller.completeSuggestionQuery("最终");
    expect(controller.getDocument().text).toBe("before @最终");
    expect(controller.getSuggestion()).toMatchObject({ query: "最终", source });
  });

  it("changes a synthetic source without inserting @ or losing surrounding text", () => {
    const controller = new ComposerController({
      text: "before  after",
      selectionStart: 7,
    });
    controller.toggleContextSuggestions();
    type(controller, "find");
    controller.setSuggestionSource({
      kind: "at-mention-category",
      category: "chats",
    });
    expect(controller.getDocument().text).toBe("before  after");
    controller.completeSuggestionQuery("chat name");
    expect(controller.getDocument().text).toBe("before chat name after");
    expect(controller.getSuggestion()).toMatchObject({
      activation: "synthetic",
      query: "chat name",
      source: { kind: "at-mention-category", category: "chats" },
    });
  });

  it("does not reopen a dismissed typed query on unrelated transactions or resources", () => {
    const controller = new ComposerController();
    type(controller, "@pla");
    controller.dismissSuggestions();
    const draft = controller.captureDraft();
    controller.setAttachments([{ data: "eA==", mediaType: "image/png" }]);
    controller.applyTransaction(
      controller.getEditorState().tr.setMeta("test-only", true),
    );
    type(controller, "n");
    expect(controller.getSuggestion().active).toBe(false);
    expect(controller.getDocument().text).toBe("@plan");
    expect(draft.text).toBe("@pla");
    controller.replaceRange({ start: 3, end: 5 }, "");
    expect(controller.getSuggestion()).toMatchObject({
      active: true,
      query: "pl",
    });
  });

  it("maps an open query through edits before it", () => {
    const controller = new ComposerController({ text: "before " });
    type(controller, "@report");
    const state = controller.getEditorState();
    controller.applyTransaction(state.tr.insertText("😀 ", 1));
    expect(controller.getSuggestion()).toMatchObject({
      active: true,
      query: "report",
      range: { from: 11, to: 18 },
    });
    controller.clearSuggestion();
    expect(controller.getDocument().text).toBe("😀 before ");
  });

  it("drops ephemeral suggestions on restore and never persists them in a draft or request", () => {
    const controller = new ComposerController({ text: "keep " });
    controller.toggleContextSuggestions();
    type(controller, "query");
    const draft = controller.captureDraft();
    expect(draft).not.toHaveProperty("suggestion");
    const receipt = controller.submit("start");
    expect(receipt.submission).not.toHaveProperty("suggestion");
    controller.restoreDraft(draft);
    expect(controller.getSuggestion().active).toBe(false);
    expect(controller.captureDraft()).toEqual(draft);
  });
});
