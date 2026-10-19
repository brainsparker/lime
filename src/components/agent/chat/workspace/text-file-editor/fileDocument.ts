export const MAX_EDITABLE_FILE_BYTES = 10 * 1024 * 1024;

export type FileDocument =
  | { kind: "ready"; baseContent: string }
  | { kind: "conflict"; baseContent: string; diskContent: string };

export function applyDiskContent(
  document: FileDocument,
  localContent: string,
  diskContent: string,
): FileDocument {
  if (diskContent === document.baseContent)
    return { kind: "ready", baseContent: diskContent };
  if (localContent === diskContent)
    return { kind: "ready", baseContent: diskContent };
  return { kind: "conflict", baseContent: document.baseContent, diskContent };
}

export function getExternalReview(document: FileDocument, content: string) {
  if (document.kind !== "conflict") return null;
  return content === document.baseContent
    ? { oldContent: content, newContent: document.diskContent }
    : { oldContent: document.diskContent, newContent: content };
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

export function preserveLineEndings(content: string, base: string): string {
  if (content === normalizeLineEndings(base)) return base;
  return base.includes("\r\n")
    ? content.replace(/\n/g, "\r\n")
    : base.includes("\r")
      ? content.replace(/\n/g, "\r")
      : content;
}
