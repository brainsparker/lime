import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidePanelTabActive } from "@/components/app-shell/unifiedTabStripContext";
import type {
  RightSurfaceDefinition,
  WorkspaceRightSurfaceKind,
} from "./rightSurfaceTypes";

export interface RightSurfaceTabStripProps {
  activeSurface: WorkspaceRightSurfaceKind;
  definitions: readonly RightSurfaceDefinition[];
  openSurfaces?: readonly WorkspaceRightSurfaceKind[];
  onSelectSurface?: (kind: WorkspaceRightSurfaceKind) => void;
  onCloseSurface?: (kind: WorkspaceRightSurfaceKind) => void;
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
  shell: {
    key: "agentChat.rightSurface.tabs.shell",
    fallback: "Shell",
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
  activeSurface,
  definitions,
  openSurfaces,
  onSelectSurface,
  onCloseSurface,
  idPrefix,
}: RightSurfaceTabStripProps) {
  const { t } = useTranslation("agent");
  const panelActive = useSidePanelTabActive();
  const byKind = new Map(definitions.map((item) => [item.kind, item]));
  const tabs = [...new Set([...(openSurfaces ?? []), activeSurface])].filter(
    (kind) => byKind.has(kind),
  );
  return (
    <div
      className="flex h-full min-w-0 items-center gap-1"
      data-testid="workspace-right-surface-tabs"
    >
      {tabs.map((kind) => {
        const active = kind === activeSurface && panelActive;
        const label =
          byKind.get(kind)?.label?.trim() ||
          t(RIGHT_SURFACE_TAB_LABELS[kind].key, {
            defaultValue: RIGHT_SURFACE_TAB_LABELS[kind].fallback,
          });
        return (
          <div
            key={kind}
            className={cn(
              "flex h-8 min-w-0 shrink-0 items-center rounded-lg",
              active && "bg-[color:var(--lime-chrome-tab-active-surface)]",
            )}
          >
            <button
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${kind}`}
              aria-controls={`${idPrefix}-panel`}
              aria-selected={active}
              aria-label={label}
              tabIndex={active ? 0 : -1}
              data-testid={`workspace-right-surface-tab-${kind}`}
              className="h-8 max-w-48 truncate rounded-lg px-2.5 text-xs text-[color:var(--lime-text-strong)] hover:bg-[color:var(--lime-chrome-tab-hover)]"
              onClick={() => onSelectSurface?.(kind)}
              onKeyDown={(event) => {
                if (event.key === "Delete") {
                  event.preventDefault();
                  onCloseSurface?.(kind);
                  return;
                }
              }}
            >
              {label}
            </button>
            {onCloseSurface ? (
              <button
                type="button"
                tabIndex={active ? 0 : -1}
                aria-label={t("agentChat.canvasWorkbench.tabs.closeAria", {
                  label,
                })}
                className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-chrome-tab-hover)]"
                onClick={() => onCloseSurface(kind)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
