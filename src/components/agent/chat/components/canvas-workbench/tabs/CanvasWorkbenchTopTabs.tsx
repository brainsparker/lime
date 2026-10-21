import { memo } from "react";
import { Code2, FileText, GitCompare, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasWorkbenchTab } from "../../CanvasWorkbenchLayout";

type CanvasWorkbenchTranslation = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export interface CanvasWorkbenchTopTab {
  key: CanvasWorkbenchTab;
  label: string;
  badge?: string;
  badgeTone?: "slate" | "sky" | "rose";
  disabled?: boolean;
}

interface CanvasWorkbenchTopTabsProps {
  activeTab: CanvasWorkbenchTab;
  tabs: CanvasWorkbenchTopTab[];
  translateWorkbench: CanvasWorkbenchTranslation;
  onSelectTab: (tab: CanvasWorkbenchTab) => void;
}

function resolveTabIcon(key: CanvasWorkbenchTab) {
  const Icon =
    key === "html"
      ? Globe2
      : key === "code"
        ? Code2
        : key === "changes"
          ? GitCompare
          : FileText;
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

function resolveBadgeClassName(tone?: "slate" | "sky" | "rose") {
  if (tone === "rose") return "bg-rose-50 text-rose-700";
  if (tone === "sky") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

export const CanvasWorkbenchTopTabs = memo(function CanvasWorkbenchTopTabs({
  activeTab,
  tabs,
  translateWorkbench,
  onSelectTab,
}: CanvasWorkbenchTopTabsProps) {
  if (tabs.length === 0) return null;
  return (
    <div
      role="tablist"
      data-testid="canvas-workbench-top-tabs"
      className="inline-flex h-9 max-w-full items-center gap-1"
    >
      <div
        className="flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible"
        data-testid="canvas-workbench-direct-tabs"
      >
        {tabs.map(({ key, label, badge, badgeTone, disabled = false }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={translateWorkbench(
                "agentChat.canvasWorkbench.tabs.switchAria",
                { label },
              )}
              role="tab"
              aria-selected={active}
              disabled={disabled}
              title={label}
              onClick={() => onSelectTab(key)}
              data-canvas-tab-key={key}
              data-canvas-tab-kind={key}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                active && !disabled
                  ? "border-slate-300 bg-white text-slate-950 shadow-sm shadow-slate-950/5"
                  : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white/70 hover:text-slate-950",
              )}
            >
              <span className={active ? "text-slate-500" : "text-slate-400"}>
                {resolveTabIcon(key)}
              </span>
              <span className="truncate">{label}</span>
              {badge ? (
                <span
                  className={cn(
                    "rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold",
                    resolveBadgeClassName(badgeTone),
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});

CanvasWorkbenchTopTabs.displayName = "CanvasWorkbenchTopTabs";
