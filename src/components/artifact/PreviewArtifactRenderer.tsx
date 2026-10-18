import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { Artifact } from "@/lib/artifact/types";
import type { PreviewArtifactView } from "./previewArtifactView";
import { PreviewArtifactFallbackSurface } from "./PreviewArtifactFallbackSurface";
import { PreviewMediaRenderer } from "./PreviewMediaRenderer";
import { PreviewSourceSummaryRenderer } from "./PreviewSourceSummaryRenderer";

const PdfPreviewPanel = lazy(() =>
  import("./document/PdfPreviewPanel").then((module) => ({
    default: module.PdfPreviewPanel,
  })),
);
const DocxPreviewPanel = lazy(() =>
  import("./document/DocxPreviewPanel").then((module) => ({
    default: module.DocxPreviewPanel,
  })),
);
const WorkbookPanel = lazy(() =>
  import("./workbook/WorkbookPanel").then((module) => ({
    default: module.WorkbookPanel,
  })),
);
const PresentationPanel = lazy(() =>
  import("./presentation/PresentationPanel").then((module) => ({
    default: module.PresentationPanel,
  })),
);

export function PreviewArtifactRenderer({
  artifact,
  view,
  tone,
}: {
  artifact: Artifact;
  view: PreviewArtifactView;
  tone: "dark" | "light";
}) {
  const { t } = useTranslation("workspace");
  if (view === "system_open" || view === "unsupported") {
    return (
      <PreviewArtifactFallbackSurface
        artifact={artifact}
        mode={view}
        tone={tone}
      />
    );
  }
  if (view === "url" || view === "database_record" || view === "app") {
    return (
      <PreviewSourceSummaryRenderer
        artifact={artifact}
        sourceKind={view}
        tone={tone}
      />
    );
  }
  if (
    view === "pdf" ||
    view === "docx" ||
    view === "workbook" ||
    view === "presentation"
  ) {
    const DocumentPanel =
      view === "presentation"
        ? PresentationPanel
        : view === "workbook"
          ? WorkbookPanel
          : view === "docx"
            ? DocxPreviewPanel
            : PdfPreviewPanel;
    const path = String(
      artifact.meta.filePath || artifact.meta.sourcePath || "",
    );
    const previewRequestKey =
      typeof artifact.meta.previewRequestKey === "string"
        ? artifact.meta.previewRequestKey
        : "";
    return (
      <Suspense
        fallback={
          <div role="status" className="p-4 text-sm text-muted-foreground">
            {t("workspace.artifactRenderer.loadingRenderer")}
          </div>
        }
      >
        <DocumentPanel
          key={`${artifact.id}:${path}:${previewRequestKey}`}
          path={path}
          title={artifact.title}
          previewRequestKey={previewRequestKey}
        />
      </Suspense>
    );
  }
  return (
    <PreviewMediaRenderer artifact={artifact} contentKind={view} tone={tone} />
  );
}
