import { useMemo, useState } from "react";
import { WrapText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildCanvasWorkbenchDiff } from "../../utils/canvasWorkbenchDiff";
import { CanvasWorkbenchDiffState } from "../../components/canvas-workbench/changes/CanvasWorkbenchDiffState";

export type FileReviewAction = "edit" | "reject" | "accept";

interface ReviewFile {
  name: string;
  contents: string;
}

function exceedsPreviewLimit(content: string) {
  return content.length > 262144 || content.split("\n", 5001).length > 5000;
}

export function InlineFileDiffReview({
  oldFile,
  newFile,
  canEdit,
  canAccept = true,
  onAction,
}: {
  oldFile: ReviewFile;
  newFile: ReviewFile;
  canEdit: boolean;
  canAccept?: boolean;
  onAction: (action: FileReviewAction) => void;
}) {
  const { t } = useTranslation("agent");
  const [wrapLines, setWrapLines] = useState(true);
  const tooLarge =
    exceedsPreviewLimit(oldFile.contents) ||
    exceedsPreviewLimit(newFile.contents);
  const diffLines = useMemo(
    () =>
      tooLarge
        ? []
        : buildCanvasWorkbenchDiff(oldFile.contents, newFile.contents),
    [tooLarge, oldFile.contents, newFile.contents],
  );
  const buttonClass =
    "inline-flex h-7 items-center justify-center rounded-lg border border-[color:var(--lime-surface-border)] px-2 text-xs hover:bg-[color:var(--lime-chrome-tab-hover)] disabled:opacity-40";
  const wrapLabel = t(
    wrapLines
      ? "agentChat.canvasWorkbench.coding.changes.menu.disableWrap"
      : "agentChat.canvasWorkbench.coding.changes.menu.enableWrap",
  );
  return (
    <div
      data-testid="file-editor-conflict"
      aria-label={t("agentChat.fileEditor.diskChanged")}
      className="relative flex h-full min-h-0 flex-col"
    >
      <div
        data-inline-file-diff-review-viewport
        className="min-h-0 flex-1 overflow-auto py-4 pr-4"
      >
        {tooLarge ? (
          <p className="flex h-full items-center justify-center px-4 text-sm text-[color:var(--lime-text-muted)]">
            {t("agentChat.fileEditor.changeTooLarge")}
          </p>
        ) : (
          <CanvasWorkbenchDiffState
            diffLines={diffLines}
            panelClassName="min-h-full"
            filePath={newFile.name}
            variant="inline"
            wordWrapEnabled={wrapLines}
          />
        )}
      </div>
      <div className="flex shrink-0 justify-end border-t border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {!tooLarge ? (
            <button
              type="button"
              aria-label={wrapLabel}
              title={wrapLabel}
              aria-pressed={wrapLines}
              className={buttonClass}
              onClick={() => setWrapLines((previous) => !previous)}
            >
              <WrapText size={14} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            data-testid="file-editor-conflict-edit"
            className={buttonClass}
            disabled={!canEdit}
            onClick={() => onAction("edit")}
          >
            {t("agentChat.fileEditor.edit")}
          </button>
          <button
            type="button"
            data-testid="file-editor-conflict-reject"
            className={`${buttonClass} text-[color:var(--lime-danger)]`}
            onClick={() => onAction("reject")}
          >
            {t("agentChat.fileEditor.reject")}
          </button>
          <button
            type="button"
            data-testid="file-editor-conflict-accept"
            className={`${buttonClass} text-[color:var(--lime-brand)]`}
            disabled={!canAccept}
            onClick={() => onAction("accept")}
          >
            {t("agentChat.fileEditor.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
