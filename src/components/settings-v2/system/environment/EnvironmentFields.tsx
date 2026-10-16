import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";

interface SurfacePanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tipAriaLabel: string;
  aside?: ReactNode;
  children: ReactNode;
}

interface FieldBlockProps {
  label: string;
  htmlFor: string;
  hint?: string;
  tipAriaLabel?: string;
  children: ReactNode;
}

export function SurfacePanel({
  icon: Icon,
  title,
  description,
  tipAriaLabel,
  aside,
  children,
}: SurfacePanelProps) {
  return (
    <article className="rounded-[26px] border border-border bg-background p-5 shadow-sm ">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon className="h-4 w-4 text-primary" />
            {title}
            <WorkbenchInfoTip
              ariaLabel={tipAriaLabel}
              content={description}
              tone="slate"
            />
          </div>
        </div>
        {aside ? (
          <div className="flex flex-wrap items-center gap-2">{aside}</div>
        ) : null}
      </div>

      <div className="mt-5">{children}</div>
    </article>
  );
}

export function FieldBlock({
  label,
  htmlFor,
  hint,
  tipAriaLabel,
  children,
}: FieldBlockProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <span>{label}</span>
        {hint ? (
          <WorkbenchInfoTip
            ariaLabel={tipAriaLabel || label}
            content={hint}
            tone="slate"
          />
        ) : null}
      </label>
      {children}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="h-[132px] animate-pulse rounded-[26px] border border-border bg-background" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
        <div className="space-y-6">
          <div className="h-[290px] animate-pulse rounded-[26px] border border-border bg-background" />
          <div className="h-[360px] animate-pulse rounded-[26px] border border-border bg-background" />
        </div>
        <div className="space-y-6">
          <div className="h-[240px] animate-pulse rounded-[26px] border border-border bg-background" />
          <div className="h-[220px] animate-pulse rounded-[26px] border border-border bg-background" />
        </div>
      </div>
      <div className="h-[360px] animate-pulse rounded-[26px] border border-border bg-background" />
    </div>
  );
}
