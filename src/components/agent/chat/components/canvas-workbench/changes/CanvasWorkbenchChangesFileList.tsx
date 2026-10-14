import { type ReactNode, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CanvasWorkbenchChangeItem,
  CanvasWorkbenchChangeTreeNode,
} from "./CanvasWorkbenchChangesPanelViewModel";
import { CanvasWorkbenchChangeStatusMark } from "./CanvasWorkbenchChangeStatusMark";
import { resolveCanvasWorkbenchChangeTreeNodeMeta } from "./CanvasWorkbenchChangeTreeMeta";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

interface RenderChangeTreeNodeOptions {
  nodes: CanvasWorkbenchChangeTreeNode[];
  selectedChangeItem: CanvasWorkbenchChangeItem | undefined;
  collapsedFolderIds: Set<string>;
  onSelectChangeItem?: (item: CanvasWorkbenchChangeItem) => void;
  onToggleFolder: (nodeId: string) => void;
  translateWorkbench: CanvasWorkbenchTranslation;
}

function resolveFileIcon(path: string) {
  const normalizedPath = path.toLowerCase();
  if (normalizedPath.endsWith(".json")) {
    return FileJson;
  }
  if (
    normalizedPath.endsWith(".ts") ||
    normalizedPath.endsWith(".tsx") ||
    normalizedPath.endsWith(".js") ||
    normalizedPath.endsWith(".jsx") ||
    normalizedPath.endsWith(".css") ||
    normalizedPath.endsWith(".html")
  ) {
    return FileCode;
  }
  return FileText;
}

function resolveFileBadge(path: string): string | null {
  const extension = path.split(".").pop()?.trim().toLowerCase();
  if (!extension) {
    return null;
  }
  if (extension === "tsx" || extension === "ts") {
    return "TS";
  }
  if (extension === "jsx" || extension === "js" || extension === "mjs") {
    return "JS";
  }
  if (extension === "md" || extension === "mdx") {
    return "MD";
  }
  if (extension === "rs") {
    return "RS";
  }
  if (extension === "json") {
    return "{}";
  }
  return extension.length <= 3 ? extension.toUpperCase() : null;
}

function renderChangeTreeNodes({
  nodes,
  selectedChangeItem,
  collapsedFolderIds,
  onSelectChangeItem,
  onToggleFolder,
  translateWorkbench,
}: RenderChangeTreeNodeOptions): ReactNode {
  return nodes.map((node) => {
    const paddingLeft = 8 + node.depth * 14;
    const meta = resolveCanvasWorkbenchChangeTreeNodeMeta(node);

    if (node.type === "folder") {
      const collapsed = collapsedFolderIds.has(node.id);
      const FolderIcon = collapsed ? Folder : FolderOpen;
      return (
        <div key={node.id}>
          <button
            type="button"
            className="flex h-7 w-full items-center gap-1 rounded-[6px] pr-2 text-left text-[13px] font-medium text-[color:var(--lime-text)] transition-colors hover:bg-[color:var(--lime-surface)] hover:text-[color:var(--lime-text-strong)]"
            style={{ paddingLeft }}
            onClick={() => onToggleFolder(node.id)}
            data-testid="canvas-workbench-change-folder"
            data-change-folder-id={node.id}
            title={node.path}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
            )}
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <CanvasWorkbenchChangeStatusMark
              meta={meta}
              translateWorkbench={translateWorkbench}
              className="ml-1"
            />
          </button>
          {collapsed
            ? null
            : renderChangeTreeNodes({
                nodes: node.children,
                selectedChangeItem,
                collapsedFolderIds,
                onSelectChangeItem,
                onToggleFolder,
                translateWorkbench,
              })}
        </div>
      );
    }

    const item = node.item;
    const active = item.id === selectedChangeItem?.id;
    const FileIcon = resolveFileIcon(item.path);
    const fileBadge = resolveFileBadge(item.path);

    return (
      <button
        key={node.id}
        type="button"
        className={cn(
          "group flex min-h-8 w-full items-start gap-1.5 rounded-[6px] py-1 pr-2 text-left text-[13px] transition-colors",
          active
            ? "bg-[color:var(--lime-brand-soft)] text-[color:var(--lime-text-strong)] shadow-[inset_2px_0_0_var(--lime-brand)]"
            : "text-[color:var(--lime-text)] hover:bg-[color:var(--lime-surface-subtle)] hover:text-[color:var(--lime-text-strong)]",
        )}
        style={{ paddingLeft }}
        onClick={() => onSelectChangeItem?.(item)}
        disabled={!onSelectChangeItem}
        data-testid="canvas-workbench-change-item"
        data-change-id={item.id}
        data-review-path={item.path}
        aria-pressed={active}
        title={item.path}
      >
        {fileBadge ? (
          <span
            className={cn(
              "mt-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] bg-[color:var(--lime-info-soft)] px-0.5 font-mono text-[9px] font-bold leading-none text-[color:var(--lime-info)]",
              active &&
                "bg-[color:var(--lime-surface)] text-[color:var(--lime-info)]",
            )}
          >
            {fileBadge}
          </span>
        ) : (
          <FileIcon
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0",
              active
                ? "text-[color:var(--lime-text-strong)]"
                : "text-[color:var(--lime-text-muted)]",
            )}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{node.name}</span>
          {item.preview ? (
            <span
              className={cn(
                "mt-0.5 block truncate font-mono text-[11px]",
                active
                  ? "text-[color:var(--lime-brand)]"
                  : "text-[color:var(--lime-text-muted)]",
              )}
            >
              {item.preview}
            </span>
          ) : null}
        </span>
        <CanvasWorkbenchChangeStatusMark
          meta={meta}
          translateWorkbench={translateWorkbench}
          className="ml-1 mt-0.5"
        />
      </button>
    );
  });
}

export function CanvasWorkbenchChangesFileList({
  fileTree,
  selectedChangeItem,
  fileFilter,
  disabled,
  translateWorkbench,
  onFileFilterChange,
  onSelectChangeItem,
}: {
  fileTree: CanvasWorkbenchChangeTreeNode[];
  selectedChangeItem: CanvasWorkbenchChangeItem | undefined;
  fileFilter: string;
  disabled?: boolean;
  translateWorkbench: CanvasWorkbenchTranslation;
  onFileFilterChange?: (value: string) => void;
  onSelectChangeItem?: (item: CanvasWorkbenchChangeItem) => void;
}) {
  const filterDisabled = Boolean(disabled || !onFileFilterChange);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedChangeId = selectedChangeItem?.id;
  useEffect(() => {
    if (!selectedChangeId) return;
    const ancestors = new Set<string>();
    const findSelected = (nodes: CanvasWorkbenchChangeTreeNode[]): boolean => {
      let found = false;
      for (const node of nodes) {
        if (node.type === "file") {
          found ||= node.item.id === selectedChangeId;
        } else if (findSelected(node.children)) {
          ancestors.add(node.id);
          found = true;
        }
      }
      return found;
    };
    findSelected(fileTree);
    setCollapsedFolderIds((current) => {
      if (![...ancestors].some((id) => current.has(id))) return current;
      return new Set([...current].filter((id) => !ancestors.has(id)));
    });
  }, [fileTree, selectedChangeId]);
  const handleToggleFolder = (nodeId: string) => {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <aside
      className="flex min-h-0 flex-col border-l border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-subtle)]"
      data-testid="canvas-workbench-changes-file-list"
    >
      <div className="px-2 py-2">
        <label className="flex h-8 items-center gap-2 rounded-[8px] border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] px-2.5 text-xs text-[color:var(--lime-text-muted)] shadow-sm">
          <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--lime-text-muted)]" />
          <input
            value={fileFilter}
            disabled={filterDisabled}
            onChange={(event) => onFileFilterChange?.(event.target.value)}
            placeholder={translateWorkbench(
              "agentChat.canvasWorkbench.coding.changes.filterFiles",
            )}
            className="min-w-0 flex-1 bg-transparent text-xs text-[color:var(--lime-text-strong)] outline-none placeholder:text-[color:var(--lime-text-muted)] disabled:cursor-not-allowed"
            data-testid="canvas-workbench-changes-file-filter"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {fileTree.length > 0 ? (
          <div className="space-y-px">
            {renderChangeTreeNodes({
              nodes: fileTree,
              selectedChangeItem,
              collapsedFolderIds,
              onSelectChangeItem,
              onToggleFolder: handleToggleFolder,
              translateWorkbench,
            })}
          </div>
        ) : (
          <div className="px-2 py-3 text-xs text-[color:var(--lime-text-muted)]">
            {translateWorkbench(
              "agentChat.canvasWorkbench.coding.changes.filterEmpty",
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
