import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { readProjectGitDiff } from "@/lib/api/projectGit";
import {
  selectGitPatchChangePaths,
  uniqueWorkspaceFilePaths,
} from "./workspaceFiles";

export interface WorkspaceFilesSurfaceTarget {
  relativePath: string;
  title?: string | null;
}

interface WorkspaceFilesSurfaceProps {
  target?: WorkspaceFilesSurfaceTarget | null;
  changedPaths?: readonly string[];
  projectRootPath?: string | null;
  readGitDiff?: typeof readProjectGitDiff;
  onOpenResultFile?: (relativePath: string) => void | Promise<void>;
}

export function WorkspaceFilesSurface({
  target,
  changedPaths = [],
  projectRootPath,
  readGitDiff = readProjectGitDiff,
  onOpenResultFile,
}: WorkspaceFilesSurfaceProps) {
  const { t } = useTranslation("agent");
  const relativePath = target?.relativePath?.trim() || "";
  const rootPath = projectRootPath?.trim() || "";
  const title =
    target?.title?.trim() || relativePath.split("/").filter(Boolean).at(-1);
  const openFileLabel = t("agentChat.fileChangesSummary.openFile");
  const [gitPaths, setGitPaths] = useState<string[]>([]);
  const [gitStatus, setGitStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const listedPaths = uniqueWorkspaceFilePaths([...changedPaths, ...gitPaths]);

  useEffect(() => {
    if (!rootPath) {
      setGitPaths([]);
      setGitStatus("idle");
      return;
    }
    let cancelled = false;
    setGitStatus("loading");
    void readGitDiff(rootPath)
      .then((diff) => {
        if (cancelled) {
          return;
        }
        setGitPaths(
          diff.hasGitRepository ? selectGitPatchChangePaths(diff.patch) : [],
        );
        setGitStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setGitStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readGitDiff, reloadKey, rootPath]);

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-[color:var(--lime-surface)] text-[color:var(--lime-text)]"
      data-testid="workspace-files-surface"
    >
      <div className="shrink-0 border-b border-[color:var(--lime-surface-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-subtle)] text-[color:var(--lime-text-muted)]">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-[color:var(--lime-text-strong)]">
              {t("agentChat.canvasWorkbench.tabs.files")}
            </h2>
            {relativePath ? (
              <p
                className="mt-0.5 truncate text-xs text-[color:var(--lime-text-muted)]"
                title={relativePath}
              >
                {relativePath}
              </p>
            ) : null}
          </div>
          {rootPath ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              disabled={gitStatus === "loading"}
              onClick={() => setReloadKey((current) => current + 1)}
              data-testid="workspace-files-surface-git-refresh"
            >
              {t("agentChat.filesSurface.gitChangesRefresh")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        {relativePath ? (
          <>
            <div className="rounded-2xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-subtle)] p-3">
              <div className="min-w-0 text-sm font-medium text-[color:var(--lime-text-strong)]">
                {title || t("agentChat.canvasWorkbench.tabs.files")}
              </div>
              <div
                className="mt-1 break-all text-xs leading-5 text-[color:var(--lime-text-muted)]"
                data-testid="workspace-files-surface-path"
              >
                {relativePath}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              disabled={!onOpenResultFile}
              onClick={() => {
                void onOpenResultFile?.(relativePath);
              }}
              data-testid="workspace-files-surface-open"
            >
              {openFileLabel}
            </Button>
          </>
        ) : null}
        {gitStatus === "loading" && listedPaths.length === 0 ? (
          <p className="text-xs text-[color:var(--lime-text-muted)]">
            {t("agentChat.filesSurface.gitChangesLoading")}
          </p>
        ) : null}
        {gitStatus === "error" ? (
          <p
            className="text-xs text-rose-600"
            data-testid="workspace-files-surface-git-error"
          >
            {t("agentChat.filesSurface.gitChangesError")}
          </p>
        ) : null}
        {gitStatus === "ready" && listedPaths.length === 0 ? (
          <p
            className="text-xs text-[color:var(--lime-text-muted)]"
            data-testid="workspace-files-surface-git-empty"
          >
            {t("agentChat.filesSurface.gitChangesEmpty")}
          </p>
        ) : null}
        {listedPaths.length > 0 ? (
          <div className="min-h-0 flex-1">
            <h3 className="mb-2 text-xs font-medium text-[color:var(--lime-text-muted)]">
              {t("agentChat.activityPanel.changes")}
            </h3>
            <ul
              className="space-y-2 overflow-y-auto"
              data-testid="workspace-files-surface-changes"
            >
              {listedPaths.map((path) => (
                <li
                  key={path}
                  className="truncate rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-subtle)] px-3 py-2 text-xs text-[color:var(--lime-text-strong)]"
                  data-testid="workspace-files-surface-change"
                  title={path}
                >
                  {path}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
