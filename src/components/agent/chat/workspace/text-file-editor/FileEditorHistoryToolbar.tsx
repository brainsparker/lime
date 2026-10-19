import { AlertCircle, Loader2, Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FileEditorHistoryToolbar({
  canRedo,
  canUndo,
  hasSaveError,
  isSaving,
  onRedo,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  hasSaveError: boolean;
  isSaving: boolean;
  onRedo: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation("agent");
  if (!canRedo && !canUndo && !isSaving && !hasSaveError) return null;
  const buttonClassName =
    "flex h-7 w-7 items-center justify-center rounded-md hover:bg-[color:var(--lime-chrome-tab-hover)] disabled:opacity-40";
  return (
    <div
      data-testid="file-editor-history-toolbar"
      className="absolute right-4 bottom-4 z-10 flex items-center gap-px rounded-lg border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-1 shadow-sm"
    >
      <button
        type="button"
        aria-label={t("agentChat.fileEditor.undo")}
        title={t("agentChat.fileEditor.undo")}
        disabled={!canUndo}
        className={buttonClassName}
        onClick={onUndo}
      >
        <Undo2 size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("agentChat.fileEditor.redo")}
        title={t("agentChat.fileEditor.redo")}
        disabled={!canRedo}
        className={buttonClassName}
        onClick={onRedo}
      >
        <Redo2 size={14} aria-hidden="true" />
      </button>
      <span role="status" className="text-xs leading-none">
        {isSaving ? (
          <span className="flex items-center gap-1 px-2 text-[color:var(--lime-text-muted)]">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {t("agentChat.fileEditor.saving")}
          </span>
        ) : hasSaveError ? (
          <span className="flex items-center gap-1 px-2 text-[color:var(--lime-danger)]">
            <AlertCircle size={12} aria-hidden="true" />
            {t("agentChat.fileEditor.saveError")}
          </span>
        ) : null}
      </span>
    </div>
  );
}
