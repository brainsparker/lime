import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentI18nKey } from "@/i18n/agentResources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  ActionRequired,
  ApprovalDecision,
  ConfirmResponse,
} from "../types";
import { ApprovalCard } from "./ApprovalCard";
import {
  availableApprovalDecisions,
  pendingApprovalDetails,
} from "./pendingRequestItemPanelModel";

interface PendingRequestItemPanelProps {
  request: ActionRequired;
  onSubmit?: (response: ConfirmResponse) => void | Promise<void>;
}

const decisionCopy: Record<
  ApprovalDecision,
  { label: AgentI18nKey; response: AgentI18nKey }
> = {
  allow_once: {
    label: "agentChat.inputbar.approval.action.allowOnce",
    response: "agentChat.inputbar.approval.response.allowOnce",
  },
  allow_for_session: {
    label: "agentChat.inputbar.approval.action.allowForSession",
    response: "agentChat.inputbar.approval.response.allowForSession",
  },
  decline: {
    label: "agentChat.inputbar.approval.action.decline",
    response: "agentChat.inputbar.approval.response.decline",
  },
  cancel: {
    label: "agentChat.inputbar.approval.action.cancel",
    response: "agentChat.inputbar.approval.response.cancel",
  },
};

/** 与 Desktop 的 PendingRequestItemPanel 对齐，消费现有 pending request 投影。 */
export function PendingRequestItemPanel({
  request,
  onSubmit,
}: PendingRequestItemPanelProps) {
  const { t } = useTranslation("agent");
  const [submissionKind, setSubmissionKind] = useState<ApprovalDecision | null>(
    null,
  );
  const submissionRef = useRef(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeTriggerRef = useRef<HTMLButtonElement>(null);
  const scopeId = useId();
  const commandId = useId();
  const decisions = useMemo(
    () => availableApprovalDecisions(request),
    [request],
  );
  const details = useMemo(() => pendingApprovalDetails(request), [request]);
  const isSubmitting = submissionKind !== null;
  const canSubmit =
    Boolean(onSubmit) && !isSubmitting && request.status !== "submitted";
  const hasScopedApproval =
    decisions.includes("allow_once") && decisions.includes("allow_for_session");
  const commandNeedsExpansion = Boolean(
    details.command &&
    (details.command.length > 180 || details.command.split("\n").length > 3),
  );
  const reason =
    request.prompt?.trim() || t("agentChat.inputbar.approval.defaultPrompt");

  const submit = async (decision: ApprovalDecision) => {
    if (!onSubmit || !canSubmit || submissionRef.current) return;
    submissionRef.current = true;
    setSubmissionKind(decision);
    setSubmissionFailed(false);
    setScopeOpen(false);
    try {
      await onSubmit({
        requestId: request.requestId,
        decision,
        response: t(decisionCopy[decision].response),
        actionType: "tool_confirmation",
      });
    } catch {
      setSubmissionFailed(true);
    } finally {
      submissionRef.current = false;
      setSubmissionKind(null);
    }
  };

  const decisionButton = (decision: ApprovalDecision, menuItem = false) => (
    <button
      key={decision}
      type="button"
      role={menuItem ? "menuitem" : undefined}
      autoFocus={menuItem}
      disabled={!canSubmit}
      data-decision={decision}
      onClick={() => void submit(decision)}
      className={cn(
        "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        menuItem
          ? "w-full justify-start hover:bg-accent"
          : decision === "allow_once" || decision === "allow_for_session"
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border bg-background hover:bg-accent",
        hasScopedApproval && decision === "allow_once" && "rounded-r-none",
        decision === "cancel" && "mr-auto",
      )}
    >
      {submissionKind === decision && (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      )}
      {submissionKind === decision
        ? t("agentChat.inputbar.approval.action.submitting")
        : t(decisionCopy[decision].label)}
    </button>
  );

  return (
    <ApprovalCard
      requestId={request.requestId}
      title={t(
        details.networkHost
          ? "agentChat.inputbar.approval.networkTitle"
          : request.toolName === "apply_patch"
            ? "agentChat.inputbar.approval.fileTitle"
            : details.command
              ? "agentChat.inputbar.approval.commandTitle"
              : "agentChat.inputbar.approval.title",
      )}
      subtitle={request.toolName}
      reason={reason}
      details={
        <>
          {request.detail?.trim() && request.detail.trim() !== reason && (
            <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {request.detail}
            </p>
          )}
          {(details.cwd || details.grantRoot || details.networkHost) && (
            <dl
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 break-all text-xs"
              data-testid="approval-details"
            >
              {details.cwd && (
                <>
                  <dt className="text-muted-foreground">
                    {t("agentChat.inputbar.approval.directory")}
                  </dt>
                  <dd>{details.cwd}</dd>
                </>
              )}
              {details.grantRoot && (
                <>
                  <dt className="text-muted-foreground">
                    {t("agentChat.inputbar.approval.grantRoot")}
                  </dt>
                  <dd>{details.grantRoot}</dd>
                </>
              )}
              {details.networkHost && (
                <>
                  <dt className="text-muted-foreground">
                    {t("agentChat.inputbar.approval.networkHost")}
                  </dt>
                  <dd>{details.networkHost}</dd>
                </>
              )}
              {details.networkProtocol && (
                <>
                  <dt className="text-muted-foreground">
                    {t("agentChat.inputbar.approval.networkProtocol")}
                  </dt>
                  <dd>{details.networkProtocol}</dd>
                </>
              )}
            </dl>
          )}
        </>
      }
      body={
        <>
          {details.command && (
            <div className="rounded-lg border border-border bg-muted/50 p-2.5">
              <pre
                id={commandId}
                data-testid="approval-command"
                className={cn(
                  "max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs",
                  commandNeedsExpansion && !expanded && "line-clamp-3",
                )}
              >
                {details.command}
              </pre>
              {commandNeedsExpansion && (
                <button
                  type="button"
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={expanded}
                  aria-controls={commandId}
                  onClick={() => setExpanded(!expanded)}
                >
                  {t(
                    expanded
                      ? "agentChat.inputbar.approval.collapse"
                      : "agentChat.inputbar.approval.expand",
                  )}
                </button>
              )}
            </div>
          )}
          {submissionFailed && (
            <p role="status" className="text-xs text-destructive">
              {t("agentChat.inputbar.approval.submissionError")}
            </p>
          )}
        </>
      }
      actions={
        <>
          {decisions.includes("cancel") && decisionButton("cancel")}
          {decisions.includes("decline") && decisionButton("decline")}
          {hasScopedApproval ? (
            <DropdownMenu open={scopeOpen} onOpenChange={setScopeOpen}>
              {decisionButton("allow_once")}
              <DropdownMenuTrigger asChild>
                <button
                  ref={scopeTriggerRef}
                  type="button"
                  disabled={!canSubmit}
                  data-testid="approval-scope-trigger"
                  aria-label={t("agentChat.inputbar.approval.scopeOptions")}
                  aria-haspopup="menu"
                  aria-expanded={scopeOpen}
                  aria-controls={scopeId}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setScopeOpen(true);
                    }
                  }}
                  className="min-h-8 rounded-r-md border-l border-primary-foreground/20 bg-primary px-2 text-primary-foreground disabled:opacity-60"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                style={{ top: "auto", bottom: "100%", marginBottom: "4px" }}
              >
                <div
                  id={scopeId}
                  role="menu"
                  aria-label={t("agentChat.inputbar.approval.scopeOptions")}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setScopeOpen(false);
                      scopeTriggerRef.current?.focus();
                    }
                  }}
                  onBlur={(event) => {
                    if (
                      event.relatedTarget &&
                      !event.currentTarget.contains(event.relatedTarget as Node)
                    ) {
                      setScopeOpen(false);
                    }
                  }}
                >
                  {decisionButton("allow_for_session", true)}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              {decisions.includes("allow_once") && decisionButton("allow_once")}
              {decisions.includes("allow_for_session") &&
                decisionButton("allow_for_session")}
            </>
          )}
        </>
      }
    />
  );
}
