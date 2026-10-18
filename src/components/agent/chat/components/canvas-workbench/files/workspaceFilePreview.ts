import { createPreviewArtifactFromFile } from "@/lib/artifact/previewArtifact";
import type {
  CanvasWorkbenchCopy,
  CanvasWorkbenchPreviewTarget,
  WorkspaceFileSelection,
} from "../../CanvasWorkbenchLayoutViewModel";

export function resolveWorkspaceFilePreviewTarget(
  file: WorkspaceFileSelection,
  copy: CanvasWorkbenchCopy,
): CanvasWorkbenchPreviewTarget {
  const location = {
    title: file.title,
    filePath: file.path,
    absolutePath: file.path,
  };
  if (file.status === "loading") return { kind: "loading", ...location };
  if (file.status === "error" || file.error) {
    return {
      kind: "unsupported",
      reason: file.error || copy.workspaceFile.readFailed,
      ...location,
    };
  }
  const preview = createPreviewArtifactFromFile({
    filePath: file.path,
    title: file.title,
    content: file.content,
    isBinary: file.status === "binary",
    size: file.size,
    // 当前只读选择的投影要稳定；重新读取经过 loading 卸载原面板。
    now: 0,
  });
  if (
    preview.renderMode === "document_pages" ||
    preview.renderMode === "workbook" ||
    preview.renderMode === "presentation"
  ) {
    return {
      kind: "synthetic-artifact",
      artifact: preview.artifact,
      ...location,
    };
  }
  if (file.status === "binary") {
    return {
      kind: "unsupported",
      reason: copy.workspaceFile.binaryUnsupported,
      ...location,
    };
  }
  return { kind: "default-canvas", content: file.content || "", ...location };
}
