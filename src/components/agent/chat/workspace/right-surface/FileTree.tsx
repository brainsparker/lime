import {
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { ChevronDown, ChevronRight, File, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { WorkspaceFileContextMenu } from "./WorkspaceFileContextMenu";
import { FILE_TREE_ITEM_HEIGHT } from "./fileTreeViewport";
import { useFileTreeViewport } from "./useFileTreeViewport";
import type { FileSelectionOptions } from "./threadSidePanelTabs";

import type { FileTreeRow } from "./fileTreeRows";
import {
  createFileTreeSelection,
  selectFileTreePaths,
  type FileTreeSelectionAction,
} from "./fileTreeSelection";

export function FileTree({
  scope,
  cwd,
  rows,
  filePaths,
  expandedDirectories,
  selectedPath,
  resetKey,
  onToggleDirectory,
  onSelectFile,
}: {
  scope: string;
  cwd?: string;
  rows: readonly FileTreeRow[];
  filePaths: ReadonlySet<string>;
  expandedDirectories: Readonly<Record<string, boolean>>;
  selectedPath: string | null;
  resetKey?: object;
  onToggleDirectory: (path: string) => void;
  onSelectFile: (path: string, options?: FileSelectionOptions) => void;
}) {
  const { t } = useTranslation("agent");
  const positions = useMemo(
    () =>
      rows.map((row) => ({
        path: row.kind === "entry" ? row.entry.path : `${row.kind}:${row.path}`,
        depth: row.depth,
        isDirectory: row.kind === "entry" && row.entry.isDir,
      })),
    [rows],
  );
  const tree = useFileTreeViewport(scope, positions, selectedPath);
  const visiblePaths = useMemo(
    () => rows.flatMap((row) => (row.kind === "entry" ? [row.entry.path] : [])),
    [rows],
  );
  const [selection, setSelection] = useState(() => ({
    scope,
    selectedPath,
    resetKey,
    value: createFileTreeSelection(selectedPath),
  }));
  const selected =
    selection.scope === scope &&
    selection.selectedPath === selectedPath &&
    selection.resetKey === resetKey
      ? selection.value
      : createFileTreeSelection(selectedPath);
  useLayoutEffect(() => {
    setSelection((previous) =>
      previous.scope === scope &&
      previous.selectedPath === selectedPath &&
      previous.resetKey === resetKey
        ? previous
        : {
            scope,
            selectedPath,
            resetKey,
            value: createFileTreeSelection(selectedPath),
          },
    );
  }, [scope, selectedPath, resetKey]);
  const select = (action: FileTreeSelectionAction) => {
    const value = selectFileTreePaths(selected, visiblePaths, action);
    setSelection({ scope, selectedPath, resetKey, value });
    const path = [...value.paths].find((path) => filePaths.has(path));
    if (path) onSelectFile(path, { isPreview: true });
  };
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.nativeEvent.isComposing ||
      event.defaultPrevented ||
      !(event.target instanceof HTMLElement)
    )
      return;
    const row = event.target.closest<HTMLButtonElement>(
      'button[role="treeitem"]',
    );
    if (!row || !event.currentTarget.contains(row)) return;
    const index = rows.findIndex(
      (candidate) =>
        candidate.kind === "entry" &&
        candidate.entry.path === row.dataset.itemPath,
    );
    const focusRow = (start: number, direction: number, extend = false) => {
      for (
        let next = start;
        next >= 0 && next < rows.length;
        next += direction
      ) {
        const candidate = rows[next];
        if (candidate.kind === "entry") {
          if (extend)
            select({
              kind: "extend",
              from: row.dataset.itemPath!,
              to: candidate.entry.path,
            });
          tree.focusIndex(next);
          return;
        }
      }
    };
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === " " || event.key === "Spacebar" || event.code === "Space")
    ) {
      select({ kind: "toggle", path: row.dataset.itemPath! });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      select({ kind: "all", focusedPath: row.dataset.itemPath! });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        focusRow(index + 1, 1, event.shiftKey);
        break;
      case "ArrowUp":
        focusRow(index - 1, -1, event.shiftKey);
        break;
      case "ArrowRight":
        if (row.getAttribute("aria-expanded") === "false")
          onToggleDirectory(row.dataset.itemPath!);
        else focusRow(index + 1, 1);
        break;
      case "ArrowLeft":
        if (row.getAttribute("aria-expanded") === "true")
          onToggleDirectory(row.dataset.itemPath!);
        else {
          const parent = rows.findIndex(
            (candidate) =>
              candidate.kind === "entry" &&
              candidate.entry.path === row.dataset.itemParentPath,
          );
          if (parent >= 0) tree.focusIndex(parent);
        }
        break;
      case "Home":
        focusRow(0, 1);
        break;
      case "End":
        focusRow(rows.length - 1, -1);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const renderRow = (rowIndex: number, stickyTop?: number) => {
    const row = rows[rowIndex];
    const sticky = stickyTop != null;
    const parked = !sticky && tree.parked === rowIndex;
    const style: CSSProperties = {
      position: "absolute",
      insetInline: 0,
      top: sticky ? stickyTop : rowIndex * FILE_TREE_ITEM_HEIGHT,
      height: FILE_TREE_ITEM_HEIGHT,
      zIndex: sticky ? tree.viewport.stickyRows.length - row.depth : undefined,
      ...(parked ? { opacity: 0, pointerEvents: "none" } : {}),
    };
    if (row.kind === "loading")
      return (
        <p
          key={`${row.kind}:${row.path}`}
          role="status"
          style={style}
          className="flex items-center gap-2 px-3 text-xs"
        >
          <Loader2 size={14} className="animate-spin" />
          {t("agentChat.canvasWorkbench.workspace.loading")}
        </p>
      );
    if (row.kind === "error")
      return (
        <p
          key={`${row.kind}:${row.path}`}
          role="alert"
          style={style}
          className="flex items-center px-3 text-xs"
        >
          {t("agentChat.fileEditor.breadcrumb.directoryError")}
        </p>
      );
    if (row.kind === "empty")
      return (
        <p
          key={`${row.kind}:${row.path}`}
          style={style}
          className="flex items-center px-3 text-xs text-[color:var(--lime-text-muted)]"
        >
          {t("agentChat.fileEditor.breadcrumb.emptyDirectory")}
        </p>
      );
    const { entry, parentPath, depth, position, setSize } = row;
    const expanded = Boolean(expandedDirectories[entry.path]);
    const isSelected = selected.paths.has(entry.path);
    return (
      <button
        key={entry.path}
        type="button"
        role={sticky ? undefined : "treeitem"}
        tabIndex={!sticky && tree.focusedIndex === rowIndex ? 0 : -1}
        ref={
          sticky
            ? undefined
            : (element) => tree.registerButton(entry.path, element)
        }
        data-item-parked={parked || undefined}
        data-file-tree-sticky-row={sticky || undefined}
        data-file-tree-sticky-path={sticky ? entry.path : undefined}
        data-type="item"
        data-item-path={entry.path}
        data-item-parent-path={parentPath}
        data-item-type={entry.isDir ? "folder" : "file"}
        data-item-selected={isSelected || undefined}
        aria-label={entry.name}
        aria-level={sticky ? undefined : depth + 1}
        aria-posinset={sticky ? undefined : position + 1}
        aria-setsize={sticky ? undefined : setSize}
        aria-selected={sticky ? undefined : isSelected}
        aria-expanded={!sticky && entry.isDir ? expanded : undefined}
        title={entry.path}
        className={cn(
          "flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-[13px] outline-none hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:bg-[color:var(--lime-chrome-tab-hover)]",
          sticky && "bg-[color:var(--lime-surface)]",
          isSelected && "bg-[color:var(--lime-chrome-tab-active-surface)]",
        )}
        style={{ ...style, paddingInlineStart: 8 + depth * 14 }}
        onFocus={sticky ? undefined : () => tree.setFocusPath(entry.path)}
        onMouseDown={sticky ? (event) => event.preventDefault() : undefined}
        onClick={(event) => {
          tree.setFocusPath(entry.path);
          if (sticky) tree.focusIndex(rowIndex);
          const modified = event.ctrlKey || event.metaKey;
          select(
            event.shiftKey
              ? { kind: "range", path: entry.path, additive: modified }
              : { kind: modified ? "toggle" : "single", path: entry.path },
          );
          if (entry.isDir && !modified && !event.shiftKey)
            onToggleDirectory(entry.path);
        }}
        onDoubleClick={() => {
          if (!entry.isDir) onSelectFile(entry.path, { isPreview: false });
        }}
      >
        {entry.isDir ? (
          expanded ? (
            <ChevronDown size={14} className="shrink-0" aria-hidden />
          ) : (
            <ChevronRight size={14} className="shrink-0" aria-hidden />
          )
        ) : (
          <File size={14} className="shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        {row.loading ? (
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
        ) : null}
      </button>
    );
  };
  return (
    <WorkspaceFileContextMenu scope={scope} cwd={cwd}>
      <div
        role="tree"
        aria-multiselectable="true"
        tabIndex={-1}
        onKeyDown={navigate}
        className="relative h-full min-h-0 outline-none"
        data-file-tree-virtualized-root
        data-tab-preview-pin-exempt
      >
        <div
          ref={tree.scrollRef}
          onScroll={tree.updatePhysical}
          className="relative h-full overflow-auto"
          data-file-tree-virtualized-scroll
        >
          <div
            className="relative"
            style={{ height: tree.viewport.totalHeight }}
            data-file-tree-virtualized-list
          >
            {tree.indices.map((index) => renderRow(index))}
          </div>
        </div>
        {tree.viewport.stickyRows.length ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden bg-[color:var(--lime-surface)]"
            style={{ height: tree.viewport.stickyHeight }}
            data-file-tree-sticky-overlay
          >
            {tree.viewport.stickyRows.map((row) => (
              <div key={row.index} className="pointer-events-auto">
                {renderRow(row.index, row.top)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </WorkspaceFileContextMenu>
  );
}
