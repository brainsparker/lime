import { type ReactNode } from "react";
import {
  Copy,
  EyeOff,
  FileDiff,
  FileText,
  ListCollapse,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export interface CanvasWorkbenchReviewMenuModel {
  translateWorkbench: CanvasWorkbenchTranslation;
  reviewActionBusy?: boolean;
  copyGitApplyDisabled?: boolean;
  loadFullFileDisabled?: boolean;
  collapseDiffContext: boolean;
  loadFullFile: boolean;
  textDiffEnabled: boolean;
  showWhitespace: boolean;
  onRefreshChanges?: () => void | Promise<void>;
  onCopyGitApply?: () => void | Promise<void>;
  onToggleCollapseContext: () => void;
  onToggleLoadFullFile?: () => void;
  onToggleTextDiff: () => void;
  onToggleWhitespace: () => void;
}

interface CanvasWorkbenchReviewMenuProps extends CanvasWorkbenchReviewMenuModel {
  className?: string;
  testId?: string;
  onRequestClose: () => void;
}

function ReviewMenuItem({
  icon,
  label,
  active,
  disabled,
  onClick,
  testId,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className="group flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2 text-left text-[13px] font-medium text-[color:var(--lime-text-strong)] transition-colors hover:bg-[color:var(--lime-surface-subtle)] hover:text-[color:var(--lime-text-strong)] disabled:cursor-not-allowed disabled:text-[color:var(--lime-text-muted)]"
    >
      <span
        className={
          active
            ? "shrink-0 text-[color:var(--lime-text-strong)]"
            : "shrink-0 text-[color:var(--lime-text-muted)] group-disabled:text-[color:var(--lime-text-muted)]"
        }
      >
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

export function CanvasWorkbenchReviewMenu({
  translateWorkbench,
  reviewActionBusy = false,
  copyGitApplyDisabled = false,
  loadFullFileDisabled = false,
  collapseDiffContext,
  loadFullFile,
  textDiffEnabled,
  showWhitespace,
  onRefreshChanges,
  onCopyGitApply,
  onToggleCollapseContext,
  onToggleLoadFullFile,
  onToggleTextDiff,
  onToggleWhitespace,
  onRequestClose,
  className,
  testId = "canvas-workbench-changes-more-menu",
}: CanvasWorkbenchReviewMenuProps) {
  const runAction = (action?: () => void | Promise<void>) => {
    onRequestClose();
    void action?.();
  };

  return (
    <div
      role="menu"
      className={cn(
        "w-[220px] rounded-[12px] border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-1.5 shadow-xl shadow-[color:var(--lime-shadow-color)]",
        className,
      )}
      data-testid={testId}
    >
      <ReviewMenuItem
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.refresh",
        )}
        disabled={reviewActionBusy || !onRefreshChanges}
        onClick={() => runAction(onRefreshChanges)}
      />
      <ReviewMenuItem
        icon={<ListCollapse className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.menu.collapseContext",
        )}
        active={collapseDiffContext}
        onClick={() => runAction(onToggleCollapseContext)}
        testId="canvas-workbench-changes-collapse-toggle"
      />
      <div className="my-1.5 border-t border-[color:var(--lime-surface-border)]" />
      <ReviewMenuItem
        icon={<FileText className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.menu.unloadFullFile",
        )}
        active={!loadFullFile}
        disabled={
          reviewActionBusy || loadFullFileDisabled || !onToggleLoadFullFile
        }
        onClick={() => runAction(onToggleLoadFullFile)}
      />
      <ReviewMenuItem
        icon={<FileDiff className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.menu.enableTextDiff",
        )}
        active={textDiffEnabled}
        onClick={() => runAction(onToggleTextDiff)}
      />
      <ReviewMenuItem
        icon={<EyeOff className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.menu.hideWhitespace",
        )}
        active={!showWhitespace}
        onClick={() => runAction(onToggleWhitespace)}
        testId="canvas-workbench-changes-whitespace-toggle"
      />
      <div className="my-1.5 border-t border-[color:var(--lime-surface-border)]" />
      <ReviewMenuItem
        icon={<Copy className="h-3.5 w-3.5" />}
        label={translateWorkbench(
          "agentChat.canvasWorkbench.coding.changes.menu.copyGitApply",
        )}
        disabled={reviewActionBusy || copyGitApplyDisabled || !onCopyGitApply}
        onClick={() => runAction(onCopyGitApply)}
      />
    </div>
  );
}
