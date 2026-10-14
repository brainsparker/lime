import { describe, expect, it } from "vitest";
import type { ComposerSubmission } from "@/components/input-kit/types";
import { remapComposerSubmission } from "./composerSubmission";

function createSubmission(): ComposerSubmission {
  return {
    text: "  A😀@x\n",
    textElements: [{ byteRange: { start: 7, end: 9 }, placeholder: "@x" }],
    inputMentions: [{ type: "mention", name: "x", path: "plugin://x" }],
    attachments: [
      {
        data: "",
        mediaType: "image/png",
        sourceUri: "media://1",
        index: 4,
        metadata: { item_id: "item-1" },
      },
    ],
    pathReferences: [{ id: "file-1", path: "/tmp/x", name: "x", isDir: false }],
  };
}

describe("Composer submission text mapping", () => {
  it("maps trim and a Unicode prefix in UTF8 without mutating the source", () => {
    const source = createSubmission();
    const result = remapComposerSubmission(source, "前言\nA😀@x\n后文");
    expect(result.textElements).toEqual([
      { byteRange: { start: 12, end: 14 }, placeholder: "@x" },
    ]);
    expect(source.textElements).toEqual([
      { byteRange: { start: 7, end: 9 }, placeholder: "@x" },
    ]);
    expect(result.attachments).toEqual(source.attachments);
    expect(result.pathReferences).toEqual(source.pathReferences);
    expect(result.inputMentions).toEqual(source.inputMentions);
  });

  it("keeps text elements for exact text and copies nested ranges", () => {
    const source = createSubmission();
    const result = remapComposerSubmission(source, source.text);
    expect(result).toEqual(source);
    expect(result.textElements[0].byteRange).not.toBe(
      source.textElements[0].byteRange,
    );
  });

  it("rejects repeated bodies and arbitrary rewrites", () => {
    const source = createSubmission();
    expect(() => remapComposerSubmission(source, "A😀@x A😀@x")).toThrow(
      "Cannot map",
    );
    expect(() => remapComposerSubmission(source, "/command rewritten")).toThrow(
      "Cannot map",
    );
  });

  it("rejects byte boundaries inside emoji and invalid element order", () => {
    const source = createSubmission();
    source.textElements = [{ byteRange: { start: 4, end: 9 } }];
    expect(() => remapComposerSubmission(source, source.text)).toThrow("UTF8");
    source.textElements = [
      { byteRange: { start: 7, end: 9 } },
      { byteRange: { start: 3, end: 7 } },
    ];
    expect(() => remapComposerSubmission(source, source.text)).toThrow("UTF8");
  });

  it("rejects trimming an atomic element", () => {
    const source = createSubmission();
    source.textElements = [{ byteRange: { start: 0, end: 3 } }];
    expect(() => remapComposerSubmission(source, source.text.trim())).toThrow(
      "removes",
    );
  });

  it("allows ordinary command rewriting when no atomic ranges are present", () => {
    const source = createSubmission();
    source.textElements = [];
    const result = remapComposerSubmission(source, "/command transformed");
    expect(result.text).toBe("/command transformed");
    expect(result.inputMentions).toEqual(source.inputMentions);
    expect(result.attachments).toEqual(source.attachments);
  });
});
