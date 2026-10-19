import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidePanelTabActive } from "@/components/app-shell/unifiedTabStripContext";
import type { ThreadSidePanelTab } from "./threadSidePanelTabs";
import { WorkspaceFileContextMenu } from "./WorkspaceFileContextMenu";
import type {
  RightSurfaceDefinition,
  WorkspaceRightSurfaceKind,
} from "./rightSurfaceTypes";

export interface RightSurfaceTabStripProps {
  definitions: readonly RightSurfaceDefinition[];
  tabs: readonly ThreadSidePanelTab[];
  activeTabId: string | null;
  onNewTab: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  previewTabId: string | null;
  idPrefix: string;
}

const RIGHT_SURFACE_TAB_LABELS: Record<
  WorkspaceRightSurfaceKind,
  { key: string; fallback: string }
> = {
  workbench: {
    key: "agentChat.rightSurface.tabs.workbench",
    fallback: "工作台",
  },
  appSurface: {
    key: "agentChat.rightSurface.tabs.appSurface",
    fallback: "Plugin",
  },
  articleWorkspace: {
    key: "agentChat.rightSurface.tabs.articleWorkspace",
    fallback: "文章编辑器",
  },
  expertInfo: {
    key: "agentChat.rightSurface.tabs.expertInfo",
    fallback: "专家信息",
  },
  browser: {
    key: "agentChat.rightSurface.tabs.browser",
    fallback: "浏览器",
  },
  files: {
    key: "agentChat.rightSurface.tabs.files",
    fallback: "文件",
  },
  changes: { key: "agentChat.rightSurface.tabs.changes", fallback: "变更" },
  "workspace-new-tab": {
    key: "agentChat.rightSurface.tabs.newTab",
    fallback: "新建标签页",
  },
  shell: {
    key: "agentChat.rightSurface.tabs.shell",
    fallback: "Shell",
  },
  "background-terminal": {
    key: "agentChat.summary.backgroundTerminal",
    fallback: "后台终端",
  },
  harness: {
    key: "agentChat.rightSurface.tabs.harness",
    fallback: "运行",
  },
  trace: {
    key: "agentChat.rightSurface.tabs.trace",
    fallback: "Trace",
  },
};

export function RightSurfaceTabStrip({
  definitions,
  tabs,
  activeTabId,
  onNewTab,
  onSelectTab,
  onCloseTab,
  previewTabId,
  idPrefix,
}: RightSurfaceTabStripProps) {
  const { t } = useTranslation("agent");
  const panelActive = useSidePanelTabActive();
  const byKind = new Map(definitions.map((item) => [item.kind, item]));
  return (
    <div
      className="flex h-full min-w-0 items-center gap-1"
      data-testid="workspace-right-surface-tabs"
    >
      {tabs
        .filter((tab) => byKind.has(tab.kind))
        .map((tab) => {
          const { tabId, kind, filePath, title } = tab;
          const active = tabId === activeTabId && panelActive;
          const label =
            title ||
            (filePath
              ? filePath.replace(/\\/g, "/").split("/").at(-1)
              : null) ||
            byKind.get(kind)?.label?.trim() ||
            t(RIGHT_SURFACE_TAB_LABELS[kind].key, {
              defaultValue: RIGHT_SURFACE_TAB_LABELS[kind].fallback,
            });
          const content = (
            <div
              key={tabId}
              className={cn(
                "flex h-8 min-w-0 shrink-0 items-center rounded-lg",
                active && "bg-[color:var(--lime-chrome-tab-active-surface)]",
              )}
            >
              <button
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${tabId}`}
                aria-controls={`${idPrefix}-panel-${tabId}`}
                aria-selected={active}
                aria-label={label}
                title={filePath ?? label}
                data-file-path={filePath ?? undefined}
                data-tab-preview={previewTabId === tabId || undefined}
                tabIndex={active ? 0 : -1}
                data-testid={`workspace-right-surface-tab-${kind}`}
                className="h-8 max-w-48 truncate rounded-lg px-2.5 text-xs text-[color:var(--lime-text-strong)] hover:bg-[color:var(--lime-chrome-tab-hover)]"
                onClick={() => onSelectTab(tabId)}
                onKeyDown={(event) => {
                  if (event.key === "Delete") {
                    event.preventDefault();
                    onCloseTab(tabId);
                    return;
                  }
                }}
              >
                {label}
              </button>
              {onCloseTab ? (
                <button
                  type="button"
                  tabIndex={active ? 0 : -1}
                  data-testid="workspace-right-surface-tab-close"
                  aria-label={t("agentChat.canvasWorkbench.tabs.closeAria", {
                    label,
                  })}
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-chrome-tab-hover)]"
                  onClick={() => onCloseTab(tabId)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
          return kind === "files" && filePath ? (
            <WorkspaceFileContextMenu
              key={tabId}
              scope={tab}
              filePath={filePath}
            >
              {content}
            </WorkspaceFileContextMenu>
          ) : (
            content
          );
        })}
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-chrome-tab-hover)]"
        onClick={onNewTab}
        aria-label={t("agentChat.rightSurface.tabs.newTab")}
        data-testid="workspace-right-surface-new-tab"
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
