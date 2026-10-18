import type { Artifact } from "@/lib/artifact/types";

export type PreviewArtifactView =
  | "system_open"
  | "unsupported"
  | "url"
  | "database_record"
  | "app"
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "docx"
  | "workbook"
  | "presentation";

export function resolvePreviewArtifactView(
  artifact: Artifact,
): PreviewArtifactView | null {
  if (artifact.meta.previewArtifact !== true) return null;
  const { renderMode, source, contentKind } = artifact.meta;
  if (renderMode === "system_open" || renderMode === "unsupported") {
    return renderMode;
  }
  if (source === "url" || source === "database_record") return source;
  if (source === "app" || contentKind === "app_shell") return "app";
  if (contentKind === "workbook" && renderMode === "workbook")
    return "workbook";
  if (contentKind === "presentation" && renderMode === "presentation")
    return "presentation";
  if (contentKind === "document" && renderMode === "document_pages") {
    if (
      String(artifact.meta.fileKind).toLowerCase() === "docx" ||
      artifact.meta.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "docx";
    return "pdf";
  }
  if (
    contentKind === "image" ||
    contentKind === "audio" ||
    contentKind === "video"
  ) {
    return contentKind;
  }
  return null;
}
