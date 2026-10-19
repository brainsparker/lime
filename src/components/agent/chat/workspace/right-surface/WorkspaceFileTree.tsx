import { useEffect, useState } from "react";
import { File, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  searchProjectFiles,
  type ProjectFileSearchResult,
} from "@/lib/api/fuzzyFileSearch";
import type { CanvasWorkbenchFileTreeState } from "../../components/canvas-workbench/files/useCanvasWorkbenchFileTreeState";
import { WorkspaceDirectoryTree } from "./WorkspaceDirectoryTree";
import type { FileSelectionOptions } from "./threadSidePanelTabs";

export function WorkspaceFileTree({
  root,
  state,
  selectedPath,
  onSelectFile,
}: {
  root: string;
  state: CanvasWorkbenchFileTreeState;
  selectedPath: string | null;
  onSelectFile: (path: string, options?: FileSelectionOptions) => void;
}) {
  const { t } = useTranslation("agent");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly ProjectFileSearchResult[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let current = true;
    setSearching(true);
    setSearchError(null);
    void searchProjectFiles({
      query,
      rootPath: root,
      cancellationToken: crypto.randomUUID(),
    })
      .then(
        (files) => {
          if (current) setResults(files);
        },
        (error: unknown) => {
          if (current) {
            setResults([]);
            setSearchError(
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      )
      .finally(() => {
        if (current) setSearching(false);
      });
    return () => {
      current = false;
    };
  }, [query, root]);
  const row =
    "flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs outline-none hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:bg-[color:var(--lime-chrome-tab-hover)]";
  return (
    <aside
      data-file-tree-panel
      data-testid="workspace-file-tree"
      className="flex min-h-0 min-w-0 flex-col border-l border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] text-[color:var(--lime-text)]"
    >
      <label className="m-2 flex items-center gap-2 rounded-lg border border-[color:var(--lime-surface-border)] px-2">
        <Search
          size={14}
          className="shrink-0 text-[color:var(--lime-text-muted)]"
        />
        <input
          autoFocus={!selectedPath}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("agentChat.rightSurface.files.search")}
          aria-label={t("agentChat.rightSurface.files.search")}
          className="h-8 w-full min-w-0 bg-transparent text-xs outline-none"
        />
      </label>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-2"
        data-tab-preview-pin-exempt
      >
        {searching ? (
          <p role="status" className="flex items-center gap-2 p-3 text-xs">
            <Loader2 size={14} className="animate-spin" />
            {t("agentChat.canvasWorkbench.workspace.loading")}
          </p>
        ) : null}
        {searchError ? (
          <p role="alert" className="break-words p-3 text-xs">
            {searchError}
          </p>
        ) : null}
        {query.trim() ? (
          <div className="min-h-0 flex-1 overflow-auto">
            {results.map((file) => {
              const path = `${file.root.replace(/[\\/]$/, "")}/${file.path}`;
              return (
                <button
                  key={path}
                  type="button"
                  className={row}
                  onClick={() => onSelectFile(path, { isPreview: true })}
                  onDoubleClick={() => onSelectFile(path, { isPreview: false })}
                  title={file.path}
                >
                  <File size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">{file.path}</span>
                </button>
              );
            })}
            {!searching && !results.length && !searchError ? (
              <p className="p-3 text-xs text-[color:var(--lime-text-muted)]">
                {t("agentChat.rightSurface.files.noResults")}
              </p>
            ) : null}
          </div>
        ) : (
          <WorkspaceDirectoryTree
            directoryPath={root}
            state={state}
            expandedDirectories={state.expandedDirectories}
            selectedPath={selectedPath}
            onToggleDirectory={state.toggleDirectory}
            onSelectFile={onSelectFile}
          />
        )}
      </div>
    </aside>
  );
}
