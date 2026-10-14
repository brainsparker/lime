import { useId, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import "./ApprovalCard.css";

export interface ApprovalCardProps {
  requestId: string;
  title: string;
  headerContent?: ReactNode;
  subtitle?: ReactNode;
  reason?: ReactNode;
  details?: ReactNode;
  body?: ReactNode;
  actions: ReactNode;
}

/** 展示审批请求；授权事实与请求生命周期由共享 App Server owner 持有。 */
export function ApprovalCard({
  requestId,
  title,
  headerContent,
  subtitle,
  reason,
  details,
  body,
  actions,
}: ApprovalCardProps) {
  const titleId = useId();

  return (
    <section
      role="alert"
      aria-atomic="true"
      aria-labelledby={titleId}
      data-testid="approval-card"
      data-approval-surface="pending-request"
      data-request-id={requestId}
      className="approval-card w-full min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="flex min-w-0 items-start gap-2.5 px-4 pt-3">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm font-medium">
            {title}
          </h3>
          {subtitle && (
            <div className="mt-1 break-all text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {headerContent}
      </div>
      <div className="space-y-2 px-4 pb-3 pt-2">
        {reason && (
          <p
            className="whitespace-pre-wrap break-words text-sm"
            data-testid="approval-reason"
          >
            {reason}
          </p>
        )}
        {details}
        {body}
      </div>
      <div className="approval-card-actions flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-2.5">
        {actions}
      </div>
    </section>
  );
}
