import { describe, expect, it } from "vitest";
import type { ComposerDraftSnapshot } from "@/components/input-kit/types";
import { resolveInterruptedInputRestorePlan } from "./agentStreamInputRestorePlan";

describe("structured interrupted draft recovery", () => {
  it("retains the folded document, selection, mentions and pending paste", () => {
    const draft: ComposerDraftSnapshot = {
      editorDocument: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "paste",
                attrs: {
                  id: "paste-1",
                  placeholder: "[paste]",
                  text: "完整粘贴文本",
                },
              },
            ],
          },
        ],
      },
      text: "[paste]",
      selectionStart: 2,
      selectionEnd: 5,
      textElements: [
        { byteRange: { start: 0, end: 7 }, placeholder: "[paste]" },
      ],
      mentionBindings: [],
      attachments: [
        {
          data: "",
          mediaType: "image/png",
          sourceUri: "media://1",
          metadata: { media_id: "1" },
        },
      ],
      pathReferences: [],
      pendingPastes: [{ placeholder: "[paste]", text: "完整粘贴文本" }],
    };
    const plan = resolveInterruptedInputRestorePlan({
      submittedDraft: { ...draft, inputCapabilityRoute: undefined },
    });
    expect(plan.shouldRestoreComposer).toBe(true);
    expect(plan.draft).toMatchObject(draft);
    expect(plan.draft?.editorDocument).not.toBe(draft.editorDocument);
    expect(plan.draft?.textElements?.[0]?.byteRange).not.toBe(
      draft.textElements[0].byteRange,
    );
  });
});
