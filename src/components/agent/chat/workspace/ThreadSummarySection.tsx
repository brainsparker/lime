import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SummarySection({
  title,
  count,
  children,
  sectionKey,
  actions,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  sectionKey: string;
  actions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <section
      className="relative flex min-w-0 flex-col border-b border-[color:var(--lime-surface-border)] pb-2 last:border-0 last:pb-0"
      data-summary-section={sectionKey}
    >
      <div className="flex items-center gap-1 px-5 py-1">
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-0.5 text-left text-[13px] text-[color:var(--lime-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="truncate">{title}</span>
          {!expanded && Boolean(count) ? <span>· {count}</span> : null}
          <ChevronDown
            className={`h-3 w-3 shrink-0 ${expanded ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </button>
        {actions}
      </div>
      <div id={id} hidden={!expanded} className="min-w-0 px-5">
        {children}
      </div>
    </section>
  );
}

export function SummaryRow({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail ? (
        <span className="shrink-0 text-xs text-[color:var(--lime-text-muted)]">
          {detail}
        </span>
      ) : null}
    </>
  );
  const className =
    "flex min-h-7 w-full min-w-0 items-center gap-2 rounded-lg py-1 text-left text-[13px] text-[color:var(--lime-text-strong)]";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`${className} hover:bg-[color:var(--lime-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring`}
    >
      {content}
    </button>
  ) : (
    <div className={className} title={label}>
      {content}
    </div>
  );
}
