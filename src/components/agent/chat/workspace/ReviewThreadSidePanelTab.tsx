import { FileText } from "lucide-react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CanvasWorkbenchChangesPanel } from "../components/canvas-workbench/changes/CanvasWorkbenchChangesPanel";
import { ReviewThreadSidePanelProjectionContext } from "./ReviewThreadSidePanelProjection";

export interface ReviewThreadSidePanelTarget {
  relativePath: string;
  title?: string | null;
}

interface ReviewThreadSidePanelTabProps {
  target?: ReviewThreadSidePanelTarget | null;
  projectRootPath?: string | null;
  onOpenResultFile?: (relativePath: string) => void | Promise<void>;
}

export function ReviewThreadSidePanelTab({
  target,
  projectRootPath,
  onOpenResultFile,
}: ReviewThreadSidePanelTabProps) {
  const { t } = useTranslation("agent");
  const projection = useContext(ReviewThreadSidePanelProjectionContext);
  const [filesPanelOpen, setFilesPanelOpen] = useState(true);
  const relativePath = target?.relativePath?.trim() || "";
  const workspaceRoot = projection?.workspaceRoot ?? projectRootPath;
  const changeView = projection?.changeView;

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-[color:var(--lime-surface)] text-[color:var(--lime-text)]"
      data-testid="workspace-changes-surface"
      data-review-thread-id={changeView?.reviewThreadId ?? undefined}
    >
      {relativePath ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--lime-surface-border)] px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-[color:var(--lime-text-muted)]" />
          <span
            className="min-w-0 flex-1 truncate text-xs"
            title={relativePath}
            data-testid="workspace-changes-surface-path"
          >
            {target?.title?.trim() || relativePath}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!onOpenResultFile}
            onClick={() => void onOpenResultFile?.(relativePath)}
            data-testid="workspace-changes-surface-open"
          >
            {t("agentChat.fileChangesSummary.openFile")}
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <CanvasWorkbenchChangesPanel
          key={`${changeView?.reviewThreadId ?? ""}:${workspaceRoot ?? ""}`}
          changeView={changeView}
          workspaceRoot={workspaceRoot}
          loadFilePreview={projection?.loadFilePreview}
          documentContext={null}
          documentDiffLines={[]}
          selectedPath={relativePath}
          initialBase={
            !changeView?.items.length && workspaceRoot?.trim()
              ? "unstaged"
              : "previousConversation"
          }
          filesPanelOpen={filesPanelOpen}
          onToggleFilesPanel={() => setFilesPanelOpen((open) => !open)}
          translateWorkbench={(key, options) => t(key, options ?? {})}
          panelClassName="h-full min-h-0 bg-[color:var(--lime-surface)]"
          mutedPanelClassName="p-4 text-xs text-[color:var(--lime-text-muted)]"
        />
      </div>
    </section>
  );
}
