import { describe, expect, it } from "vitest";
import { ComposerController } from "./ComposerController";
import type { ComposerEditorDocument, ComposerSubmitTarget } from "./types";

describe("Composer resource submission", () => {
  it.each<ComposerSubmitTarget>(["start", "steer", "queue"])(
    "%s serializes resource paths while preserving the editable draft and typed identity",
    (target) => {
      const document: ComposerEditorDocument = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "中😀 " },
              {
                type: "mention",
                attrs: {
                  id: "skill-1",
                  kind: "skill",
                  name: "review",
                  label: "$review",
                  displayName: "审阅变更",
                  path: "/work tree/review (copy)/SKILL.md",
                },
              },
              { type: "text", text: " " },
              {
                type: "paste",
                attrs: { id: "paste-1", placeholder: "[paste]", text: "尾😀" },
              },
            ],
          },
        ],
      };
      const controller = new ComposerController({ editorDocument: document });
      const draft = controller.captureDraft();
      const receipt = controller.submit(target);
      expect(receipt.submission).toMatchObject({
        text: "中😀 [$review](/work tree/review (copy\\)/SKILL.md) 尾😀",
        inputMentions: [
          {
            type: "skill",
            name: "review",
            path: "/work tree/review (copy)/SKILL.md",
          },
        ],
      });
      const bytes = new TextEncoder().encode(receipt.submission.text);
      expect(receipt.submission.textElements).toEqual([
        {
          byteRange: { start: bytes.length - 7, end: bytes.length },
          placeholder: "[paste]",
        },
      ]);
      expect(controller.captureDraft()).toEqual(draft);
      controller.clear();
      controller.restoreDraft(draft);
      expect(controller.submit(target).submission).toEqual(receipt.submission);
      expect(controller.getDocument().text).toBe("中😀 $review [paste]");
    },
  );

  it("escapes resource labels and Windows paths without applying ordinary URL normalization", () => {
    const controller = new ComposerController({
      editorDocument: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "mention",
                attrs: {
                  id: "file-1",
                  kind: "file",
                  name: "a]b",
                  label: "@a](b]",
                  path: "C:\\work tree\\a)b.ts",
                },
              },
              { type: "text", text: " " },
              {
                type: "mention",
                attrs: {
                  id: "plugin-1",
                  kind: "plugin",
                  name: "search",
                  label: "@Search",
                  path: "plugin://search?app=desktop",
                },
              },
            ],
          },
        ],
      },
    });
    expect(controller.submit("start").submission).toMatchObject({
      text: "[@a\\]\\(b\\]](C:\\\\work tree\\\\a\\)b.ts) [@Search](plugin://search?app=desktop)",
      textElements: [],
      inputMentions: [
        { type: "mention", name: "a]b", path: "C:\\work tree\\a)b.ts" },
        {
          type: "mention",
          name: "search",
          path: "plugin://search?app=desktop",
        },
      ],
    });
  });
});
