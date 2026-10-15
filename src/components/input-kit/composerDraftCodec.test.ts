import { describe, expect, it, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { buildMessageImageDataUrl } from "@/components/agent/chat/utils/imageAttachments";
import type {
  ComposerDocument,
  ComposerEditorDocument,
} from "@/components/input-kit/types";
import { PERSISTED_ATOM_LIMITS } from "@/lib/api/persistedAtomProtocol";
import {
  ComposerDraftCodecError,
  decodeComposerDraft,
  encodeComposerDraft,
} from "./composerDraftCodec";

// Small test budget injected at the shared owner; production has no override.
vi.mock("@/lib/api/persistedAtomProtocol", async (original) => {
  const actual =
    await original<typeof import("@/lib/api/persistedAtomProtocol")>();
  return {
    ...actual,
    PERSISTED_ATOM_LIMITS: {
      ...actual.PERSISTED_ATOM_LIMITS,
      maxDraftBytes: 16_384,
    },
  };
});

const editorDocument: ComposerEditorDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "前😀字 `原样` ",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://example.test/中文?key=1",
                title: "标题 `😀`",
                disabled: true,
                isAutolink: false,
                isGeneratedAutolink: false,
                literalMarkdownOccurrenceId: 7,
                literalMarkdownSource:
                  "[前😀字 `原样` ](https://example.test/中文?key=1)",
                sourceAppId: "test-app",
              },
            },
          ],
        },
        {
          type: "mention",
          attrs: {
            id: "file-1",
            kind: "file",
            name: "source.ts",
            path: "/fixture/source.ts",
            label: "@source.ts",
          },
        },
        { type: "text", text: " " },
        {
          type: "mention",
          attrs: {
            id: "skill-1",
            kind: "skill",
            name: "review",
            path: "/fixture/review/SKILL.md",
            label: "$review",
          },
        },
        { type: "text", text: " " },
        {
          type: "mention",
          attrs: {
            id: "plugin-1",
            kind: "plugin",
            name: "plugin",
            path: "/fixture/plugin",
            label: "@plugin",
          },
        },
        { type: "hard_break" },
        {
          type: "paste",
          attrs: {
            id: "paste-1",
            placeholder: "[Pasted 中文😀]",
            text: "第一行\n`raw` 😀\n第二行",
          },
        },
        {
          type: "text_element",
          attrs: { text: "👩‍💻元素", placeholder: "[element]" },
        },
      ],
    },
    {
      type: "code_block",
      attrs: { language: "typescript", autoDetectLanguage: false },
      content: [{ type: "text", text: "const 名称 = `😀`;\n```保留```\t\n" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "末尾 é\r未改写" }] },
  ],
};

function controller(plainTextMode = false) {
  return new ComposerController(
    {
      editorDocument,
      selectionStart: 1,
      selectionEnd: 3,
      attachments: [
        {
          data: "aW1hZ2U=",
          mediaType: "image/png",
          sourceUri: "https://example.test/image.png",
          sourcePath: "/fixture/image.png",
          previewUrl: "blob:old-process-preview",
          metadata: {
            generated: false,
            nested: { caption: "示例😀", values: [1, null, true] },
          },
          index: 4,
        },
      ],
      pathReferences: [
        {
          id: "path-1",
          path: "/fixture/missing.ts",
          name: "missing.ts",
          isDir: false,
          size: 12,
          mimeType: "text/plain",
          source: "file_manager",
        },
        {
          id: "path-2",
          path: "C:\\fixture\\folder",
          name: "folder",
          isDir: true,
          size: null,
          mimeType: null,
          source: "system_drop",
        },
      ],
      inputCapabilityRoute: {
        kind: "installed_skill",
        skillId: "review",
        config: { array: ["😀", 1, null] },
      },
    },
    { plainTextMode },
  );
}

function wire(draft = controller().captureDraft(), mode = false) {
  return JSON.parse(JSON.stringify(encodeComposerDraft(draft, mode)));
}

function withoutPreview(draft: ComposerDocument): ComposerDocument {
  return {
    ...draft,
    attachments: draft.attachments.map(
      ({ previewUrl: _preview, ...rest }) => rest,
    ),
  };
}

describe("renderer rich draft JSON codec", () => {
  it.each([false, true])(
    "round trips full captured PM/resources through JSON and real Controller restore with explicit mode %s",
    (plainTextMode) => {
      const original = controller(plainTextMode),
        draft = original.captureDraft();
      const before = original.submit("start");
      const decoded = decodeComposerDraft(wire(draft, plainTextMode));
      expect(decoded.plainTextMode).toBe(plainTextMode);
      expect(decoded.document).toEqual(withoutPreview(draft));
      const restored = new ComposerController(
        {},
        { plainTextMode: decoded.plainTextMode },
      );
      restored.restoreDraft(decoded.document);
      expect(restored.captureDraft()).toEqual(decoded.document);
      const after = restored.submit("start");
      expect(after.kind).toBe(before.kind);
      expect(after.submission).toEqual({
        ...before.submission,
        attachments: before.submission.attachments.map(
          ({ previewUrl: _preview, ...rest }) => rest,
        ),
      });
      expect(after.submission.text).toContain("第一行\n`raw` 😀\n第二行");
      expect(after.submission.inputMentions).toHaveLength(3);
      expect(after.submission.textElements).toEqual(
        before.submission.textElements,
      );
      expect(decoded.document.editorDocument.content[1]).toEqual(
        draft.editorDocument.content[1],
      );
      expect(decoded.document.editorDocument.content[0]).toEqual(
        draft.editorDocument.content[0],
      );
      expect(decoded.document.selectionStart).toBe(1);
      expect(decoded.document.selectionEnd).toBe(3);
      expect(buildMessageImageDataUrl(decoded.document.attachments[0])).toBe(
        "data:image/png;base64,aW1hZ2U=",
      );
      expect(JSON.stringify(decoded.document)).not.toContain(
        "blob:old-process-preview",
      );
    },
  );

  it("preserves empty drafts and uses the current typed schema rather than a text fallback", () => {
    const empty = new ComposerController(
      {},
      { plainTextMode: true },
    ).captureDraft();
    expect(decodeComposerDraft(wire(empty, true))).toEqual({
      document: empty,
      plainTextMode: true,
    });
    const restored = new ComposerController({}, { plainTextMode: true });
    restored.restoreDraft(decodeComposerDraft(wire(empty, true)).document);
    expect(restored.submit("start").kind).toBe("empty");
  });

  it("preserves valid atom boundary selections and refuses to clamp malformed offsets", () => {
    const original = controller();
    const mention = original.captureDraft().mentionBindings[0];
    original.setSelection(mention.from, mention.to);
    const decoded = decodeComposerDraft(wire(original.captureDraft()));
    expect([
      decoded.document.selectionStart,
      decoded.document.selectionEnd,
    ]).toEqual([mention.from, mention.to]);
    for (const [selectionStart, selectionEnd] of [
      [2, 2],
      [mention.from + 1, mention.to - 1],
      [-1, 0],
      [0, 9999],
      [3, 1],
      [0.5, 1],
    ]) {
      const input = wire();
      Object.assign(input.document, { selectionStart, selectionEnd });
      expect(() => decodeComposerDraft(input)).toThrow(ComposerDraftCodecError);
    }
  });

  it("accepts property order changes without dropping unknown schema fields", () => {
    const original = wire();
    const reordered = Object.fromEntries(Object.entries(original).reverse());
    reordered.document = Object.fromEntries(
      Object.entries(original.document).reverse(),
    );
    expect(decodeComposerDraft(reordered)).toEqual(
      decodeComposerDraft(original),
    );
    const changed = wire();
    changed.document.editorDocument.content[0].content[0].marks[0].attrs.extra =
      "unknown";
    expect(() => decodeComposerDraft(changed)).toThrow(ComposerDraftCodecError);
  });

  it("uses one source document: contradictory text/annotations fail instead of rebuilding from plain text", () => {
    for (const field of [
      "text",
      "textElements",
      "mentionBindings",
      "pendingPastes",
    ]) {
      const input = wire();
      input.document[field] = field === "text" ? "replacement" : [];
      expect(() => decodeComposerDraft(input)).toThrow(ComposerDraftCodecError);
    }
  });

  it.each([
    (input: any) => {
      input.version = 2;
    },
    (input: any) => {
      input.format = "old-composer";
    },
    (input: any) => {
      delete input.plainTextMode;
    },
    (input: any) => {
      input.plainTextMode = "true";
    },
    (input: any) => {
      input.extra = true;
    },
    (input: any) => {
      delete input.document.editorDocument;
    },
    (input: any) => {
      input.document.editorDocument.type = "paragraph";
    },
    (input: any) => {
      input.document.editorDocument.content = [];
    },
    (input: any) => {
      input.document.editorDocument.content[0].content[0].type = "unsupported";
    },
    (input: any) => {
      input.document.editorDocument.content[0].content[0].marks[0].type =
        "bold";
    },
    (input: any) => {
      input.document.editorDocument.content[0].content[0].marks[0].attrs.href =
        "javascript:private";
    },
    (input: any) => {
      input.document.editorDocument.content[1].attrs.language = "bad language";
    },
    (input: any) => {
      input.document.editorDocument.content[1].attrs.autoDetectLanguage =
        "false";
    },
    (input: any) => {
      input.document.editorDocument.content[0].content[1].attrs.kind = "remote";
    },
    (input: any) => {
      input.document.editorDocument.content[0].content[7].attrs.text = 7;
    },
  ])(
    "rejects unknown versions and invalid current PM schemas as a whole",
    (mutate) => {
      const input = wire();
      mutate(input);
      expect(() => decodeComposerDraft(input)).toThrow(ComposerDraftCodecError);
    },
  );

  it.each([
    (input: any) => {
      input.document.attachments[0].previewUrl = "blob:stale";
    },
    (input: any) => {
      input.document.attachments[0].data = 1;
    },
    (input: any) => {
      input.document.attachments[0].mediaType = "";
    },
    (input: any) => {
      input.document.attachments[0].metadata = [];
    },
    (input: any) => {
      input.document.attachments[0].index = -1;
    },
    (input: any) => {
      input.document.attachments[0].sourceUri = "blob:stale";
    },
    (input: any) => {
      input.document.attachments[0].unknown = "private";
    },
    (input: any) => {
      input.document.pathReferences[0].isDir = 1;
    },
    (input: any) => {
      input.document.pathReferences[0].path = 7;
    },
    (input: any) => {
      input.document.pathReferences[0].size = -1;
    },
    (input: any) => {
      input.document.pathReferences[0].mimeType = 7;
    },
    (input: any) => {
      input.document.pathReferences[0].source = "remote";
    },
  ])(
    "rejects invalid resource shapes and serialized transient previews",
    (mutate) => {
      const input = wire();
      mutate(input);
      expect(() => decodeComposerDraft(input)).toThrow(ComposerDraftCodecError);
    },
  );

  it("retains original URI/path references without disk/network access and rejects blob-only backing", () => {
    const original = controller();
    original.setAttachments([
      {
        data: "",
        mediaType: "image/jpeg",
        sourceUri: "https://example.test/only-source.jpg",
      },
      {
        data: "",
        mediaType: "image/png",
        sourcePath: "C:\\missing\\image.png",
      },
    ]);
    expect(
      decodeComposerDraft(wire(original.captureDraft())).document.attachments,
    ).toEqual(original.captureDraft().attachments);
    original.setAttachments([
      { data: "", mediaType: "image/png", previewUrl: "blob:only-backing" },
    ]);
    expect(() => encodeComposerDraft(original.captureDraft(), false)).toThrow(
      ComposerDraftCodecError,
    );
  });

  it("rejects non-JSON resources, getters, sparse arrays, cycles and hidden metadata without executing them", () => {
    let called = false;
    const getter = Object.defineProperty({}, "secret", {
      enumerable: true,
      get() {
        called = true;
        return "private";
      },
    });
    const cycle: any = {};
    cycle.self = cycle;
    for (const route of [
      undefined,
      () => "private",
      BigInt(1),
      NaN,
      new Date(),
      new Map(),
      new Blob(["private"]),
      getter,
      cycle,
      Array(1),
      { [Symbol("secret")]: "private" },
      Object.defineProperty({}, "hidden", { value: "private" }),
    ]) {
      const input = controller().captureDraft();
      input.inputCapabilityRoute = route;
      expect(() => encodeComposerDraft(input, false)).toThrow(
        ComposerDraftCodecError,
      );
    }
    expect(called).toBe(false);
    const input = wire();
    input.document.attachments[0].metadata = {
      toJSON() {
        called = true;
        return "private";
      },
    };
    expect(() => decodeComposerDraft(input)).toThrow(ComposerDraftCodecError);
    expect(called).toBe(false);
  });

  it("detaches encoded/decoded resources from the live Controller and retains all valid metadata", () => {
    const original = controller(),
      before = original.captureDraft();
    const encoded: any = encodeComposerDraft(before, false);
    encoded.document.attachments[0].metadata.nested.caption = "mutated";
    expect(original.captureDraft()).toEqual(before);
    const input = wire(),
      decoded = decodeComposerDraft(input);
    input.document.attachments[0].metadata.nested.caption = "mutated";
    input.document.inputCapabilityRoute.config.array[0] = "mutated";
    expect(decoded.document.attachments[0].metadata).toMatchObject({
      nested: { caption: "示例😀" },
    });
    expect(decoded.document.inputCapabilityRoute).toMatchObject({
      config: { array: ["😀", 1, null] },
    });
  });

  it("checks complete UTF8 JSON against the shared budget and rejects whole rich drafts without truncation or mutation", () => {
    const original = new ComposerController(
      { text: "中".repeat(PERSISTED_ATOM_LIMITS.maxDraftBytes) },
      { plainTextMode: true },
    );
    const before = original.captureDraft();
    expect(() => encodeComposerDraft(before, true)).toThrow(
      expect.objectContaining({ code: "capacity_exceeded" }),
    );
    expect(original.captureDraft()).toEqual(before);
    const input = wire();
    input.document.inputCapabilityRoute = {
      text: "中".repeat(PERSISTED_ATOM_LIMITS.maxDraftBytes),
    };
    expect(() => decodeComposerDraft(input)).toThrow(
      expect.objectContaining({ code: "capacity_exceeded" }),
    );
  });

  it("uses sanitized errors and requires an explicit real surface mode", () => {
    expect(() =>
      encodeComposerDraft(
        controller().captureDraft(),
        undefined as unknown as boolean,
      ),
    ).toThrow(ComposerDraftCodecError);
    try {
      decodeComposerDraft({ text: "private error content" });
    } catch (error) {
      expect(error).toBeInstanceOf(ComposerDraftCodecError);
      expect(String(error)).not.toContain("private error content");
      expect((error as Error).cause).toBeUndefined();
    }
  });
});
