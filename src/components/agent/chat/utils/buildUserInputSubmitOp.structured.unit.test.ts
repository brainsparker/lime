import { describe, expect, it } from "vitest";
import type { ComposerSubmission } from "@/components/input-kit/types";
import {
  buildTurnInput,
  buildUserInputSubmitOp,
} from "./buildUserInputSubmitOp";

const submission: ComposerSubmission = {
  text: "A😀@x",
  textElements: [{ byteRange: { start: 5, end: 7 }, placeholder: "@x" }],
  inputMentions: [{ type: "skill", name: "x", path: "/skills/x/SKILL.md" }],
  attachments: [
    {
      data: "",
      mediaType: "image/png",
      sourcePath: "/tmp/local.png",
      index: 2,
    },
    {
      data: "",
      mediaType: "image/png",
      sourceUri: "media://thread/image-3",
      index: 3,
    },
  ],
  pathReferences: [
    { id: "file-1", path: "/tmp/report.md", name: "report.md", isDir: false },
  ],
};

const expectedInput = [
  { type: "text", text: "A😀@x", text_elements: submission.textElements },
  ...submission.inputMentions,
  { type: "mention", name: "report.md", path: "/tmp/report.md" },
  { type: "localImage", path: "/tmp/local.png" },
  { type: "image", url: "media://thread/image-3" },
];

describe("structured Composer input projection", () => {
  it("projects typed ranges, skill and media from the submission", () => {
    expect(
      buildTurnInput({
        content: submission.text,
        images: [],
        composerSubmission: submission,
      }),
    ).toEqual(expectedInput);
  });

  it("start uses the same input projection and preserves client identity", () => {
    const op = buildUserInputSubmitOp({
      content: submission.text,
      images: [],
      composerSubmission: submission,
      threadId: "thread-1",
      clientUserMessageId: "client-1",
      eventName: "event-1",
      effectiveAccessMode: "current",
      effectiveProviderType: "openai",
      effectiveModel: "fixture-model",
    });
    expect(op.turn.input).toEqual(expectedInput);
    expect(op.turn.clientUserMessageId).toBe("client-1");
  });

  it("maps a prefix in UTF8 and rejects an unprovable command rewrite", () => {
    const prefixed = buildTurnInput({
      content: "说明\nA😀@x",
      images: [],
      composerSubmission: submission,
    });
    expect(prefixed[0]).toEqual({
      type: "text",
      text: "说明\nA😀@x",
      text_elements: [{ byteRange: { start: 12, end: 14 }, placeholder: "@x" }],
    });
    expect(() =>
      buildTurnInput({
        content: "/other rewritten",
        images: [],
        composerSubmission: submission,
      }),
    ).toThrow();
  });

  it("deduplicates supplementary path mentions without adding fake text ranges", () => {
    const input = buildTurnInput({
      content: submission.text,
      images: [],
      composerSubmission: {
        ...submission,
        inputMentions: [
          ...submission.inputMentions,
          { type: "mention", name: "report atom", path: "/tmp/report.md" },
        ],
        pathReferences: [
          ...submission.pathReferences,
          ...submission.pathReferences,
        ],
      },
    });
    expect(
      input.filter(
        (part) => part.type === "mention" && part.path === "/tmp/report.md",
      ),
    ).toEqual([
      { type: "mention", name: "report atom", path: "/tmp/report.md" },
    ]);
    expect(input[0]).toEqual({
      type: "text",
      text: submission.text,
      text_elements: submission.textElements,
    });
  });
});
