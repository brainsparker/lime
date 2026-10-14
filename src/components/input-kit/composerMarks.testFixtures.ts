import type { ComposerEditorDocument } from "./types";

export function linkDocument(
  overrides: Record<string, unknown> = {},
): ComposerEditorDocument {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "中😀",
            marks: [
              {
                type: "link",
                attrs: {
                  href: "https://e.test",
                  title: null,
                  disabled: false,
                  isAutolink: false,
                  isGeneratedAutolink: false,
                  literalMarkdownOccurrenceId: 1,
                  literalMarkdownSource: "[中😀](https://e.test)",
                  sourceAppId: "source-app",
                  ...overrides,
                },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as ComposerEditorDocument;
}

export function codeDocument(
  body = "中😀\n````",
  language: string | null = "ts",
): ComposerEditorDocument {
  return {
    type: "doc",
    content: [
      {
        type: "code_block",
        attrs: {
          language,
          autoDetectLanguage: true,
        },
        content: body ? [{ type: "text", text: body }] : [],
      },
    ],
  } as unknown as ComposerEditorDocument;
}

export function mixedDocument(): ComposerEditorDocument {
  return {
    type: "doc",
    content: [
      ...linkDocument().content,
      ...codeDocument().content,
      {
        type: "paragraph",
        content: [
          {
            type: "paste",
            attrs: { id: "paste-1", placeholder: "[paste]", text: "长😀\n文" },
          },
          {
            type: "mention",
            attrs: {
              id: "s",
              kind: "skill",
              name: "审阅",
              path: "/skills/review",
              label: "$审阅",
            },
          },
          { type: "text", text: "尾" },
        ],
      },
    ],
  };
}
