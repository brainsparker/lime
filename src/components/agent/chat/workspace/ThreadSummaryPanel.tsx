import { useId, useState, type ReactNode } from "react";
import { Bot, ChevronDown, FileText, Globe, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageListProps } from "../components/MessageList.types";
import type { CanonicalChildThreadSummary } from "../projection/canonicalChildThreadSummary";
import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { selectThreadSummary } from "./threadSummaryProjection";

interface ThreadSummaryPanelProps extends Pick<
  MessageListProps,
  | "onOpenSubagentSession"
  | "onFileClick"
  | "onOpenArtifactFromTimeline"
  | "onOpenUrlPreview"
> {
  threadItems?: readonly AgentThreadItem[];
  canonicalChildren?: readonly CanonicalChildThreadSummary[];
  persistenceError?: boolean;
}

function SummarySection({
  title,
  count,
  children,
  sectionKey,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  sectionKey: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const id = useId();
  return (
    <section
      className="relative flex min-w-0 flex-col border-b border-[color:var(--lime-surface-border)] pb-2 last:border-0 last:pb-0"
      data-summary-section={sectionKey}
    >
      <div className="px-5 py-1">
        <button
          type="button"
          className="group flex w-full min-w-0 items-center gap-1.5 rounded-lg py-0.5 text-left text-[13px] text-[color:var(--lime-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
      </div>
      <div id={id} hidden={!expanded} className="min-w-0 px-5">
        {children}
      </div>
    </section>
  );
}

function SummaryRow({
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

export function ThreadSummaryPanel({
  threadItems = [],
  canonicalChildren = [],
  persistenceError,
  onOpenSubagentSession,
  onFileClick,
  onOpenArtifactFromTimeline,
  onOpenUrlPreview,
}: ThreadSummaryPanelProps) {
  const { t } = useTranslation("agent");
  const summary = selectThreadSummary(threadItems);
  const plan = summary.plan;
  const text = (key: string) => String(t(`agentChat.summary.${key}`));
  return (
    <div
      className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] shadow-sm"
      data-testid="thread-summary-panel"
      data-summary-panel-variant="summary"
    >
      <div className="flex min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto py-2.5">
        {persistenceError ? (
          <p
            role="status"
            className="px-5 text-xs text-[color:var(--lime-text-muted)]"
          >
            {text("saveError")}
          </p>
        ) : null}
        {summary.outputs.length ? (
          <SummarySection
            sectionKey="outputs"
            title={text("outputs")}
            count={summary.outputs.length}
          >
            {summary.outputs.map(({ rootTarget, title }) => (
              <SummaryRow
                key={rootTarget.filePath}
                icon={
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                }
                label={title || rootTarget.filePath}
                onClick={
                  onOpenArtifactFromTimeline
                    ? () => onOpenArtifactFromTimeline(rootTarget)
                    : onFileClick
                      ? () =>
                          onFileClick(rootTarget.filePath, rootTarget.content)
                      : undefined
                }
              />
            ))}
          </SummarySection>
        ) : null}
        {plan ? (
          <SummarySection sectionKey="plan" title={text("plan")}>
            <SummaryRow
              icon={
                <ListChecks className="h-4 w-4 shrink-0" aria-hidden="true" />
              }
              label={text("plan")}
              onClick={
                onFileClick
                  ? () => onFileClick("plan.md", plan.text)
                  : undefined
              }
            />
          </SummarySection>
        ) : null}
        {canonicalChildren.length ? (
          <SummarySection
            sectionKey="background-subagents"
            title={text("subagents")}
            count={canonicalChildren.length}
          >
            {canonicalChildren.map((child) => (
              <SummaryRow
                key={child.threadId}
                icon={<Bot className="h-4 w-4 shrink-0" aria-hidden="true" />}
                label={child.name}
                detail={String(t(`agentChat.summary.status.${child.status}`))}
                onClick={
                  onOpenSubagentSession
                    ? () => onOpenSubagentSession(child.threadId)
                    : undefined
                }
              />
            ))}
          </SummarySection>
        ) : null}
        {summary.sources.length ? (
          <SummarySection
            sectionKey="tool-sources"
            title={text("sources")}
            count={summary.sources.length}
          >
            {summary.sources.map((source) => (
              <SummaryRow
                key={source.url}
                icon={<Globe className="h-4 w-4 shrink-0" aria-hidden="true" />}
                label={source.title || source.hostname}
                onClick={
                  onOpenUrlPreview ? () => onOpenUrlPreview(source) : undefined
                }
              />
            ))}
          </SummarySection>
        ) : null}
      </div>
    </div>
  );
}
