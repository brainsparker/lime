import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentSessionThreadQueue } from "../hooks/useAgentSessionThreadQueue";
import {
  deleteThreadQueue,
  reorderThreadQueue,
  startThreadQueue,
  updateThreadQueue,
} from "@/lib/api/agentRuntime/threadQueueActions";
import {
  getQueuedMessageText,
  getQueuedMessageImage,
  replaceQueuedMessageText,
} from "./queuedMessageInput";
import { MessageImageAttachments } from "./MessageImageAttachments";

function QueueActionButton({
  action,
  label,
  disabled,
  onClick,
  children,
}: {
  action: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-chrome-tab-hover)] hover:text-[color:var(--lime-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lime-info)] disabled:pointer-events-none disabled:opacity-40"
      aria-label={label}
      title={label}
      data-queue-action={action}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function QueuedMessageList({ threadId }: { threadId?: string | null }) {
  const currentThreadId = threadId?.trim();
  return currentThreadId ? (
    <QueuedMessageListForThread
      key={currentThreadId}
      threadId={currentThreadId}
    />
  ) : null;
}

function QueuedMessageListForThread({ threadId }: { threadId: string }) {
  const { t } = useTranslation("agent");
  const queue = useAgentSessionThreadQueue({ threadId });
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<{
    submissionId: string;
    text: string;
  } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const active = useRef(true);
  const pendingAction = useRef<symbol | null>(null);
  const text = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const runAction = async (
    submissionId: string,
    mutate: () => Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    if (!active.current || pendingAction.current || queue.loading) {
      return;
    }
    const request = Symbol();
    pendingAction.current = request;
    setActionId(submissionId);
    setActionError(false);
    const isCurrent = () => active.current && pendingAction.current === request;
    try {
      await mutate();
      if (isCurrent()) {
        onSuccess?.();
        queue.refresh();
      }
    } catch {
      if (isCurrent()) {
        setActionError(true);
      }
    } finally {
      if (isCurrent()) {
        pendingAction.current = null;
        setActionId(null);
      }
    }
  };

  if (
    !queue.loading &&
    !queue.error &&
    !actionError &&
    !actionId &&
    queue.submissions.length === 0
  ) {
    return null;
  }

  const busy = Boolean(actionId) || queue.loading;
  const title = text("agentChat.threadQueue.title");

  const moveMessage = (index: number, direction: -1 | 1) => {
    const ids = queue.submissions.map((item) => item.id);
    const destination = index + direction;
    if (destination < 0 || destination >= ids.length) {
      return;
    }
    [ids[index], ids[destination]] = [ids[destination], ids[index]];
    void runAction(queue.submissions[index].id, () =>
      reorderThreadQueue({ threadId, queuedSubmissionIds: ids }),
    );
  };

  return (
    <section
      aria-label={title}
      aria-busy={busy}
      className="mx-4 mb-2 border-t border-[color:var(--lime-surface-border)] px-3 py-2 text-[color:var(--lime-text-strong)]"
      data-testid="queued-message-list"
      data-thread-id={threadId}
    >
      <div className="flex min-h-7 items-center gap-2">
        <ListOrdered
          className="h-4 w-4 shrink-0 text-[color:var(--lime-text-muted)]"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold">{title}</span>
        {queue.loading ? (
          <Loader2
            aria-label={text("agentChat.threadQueue.loading")}
            className="h-3.5 w-3.5 animate-spin text-[color:var(--lime-text-muted)]"
          />
        ) : (
          <span className="text-xs text-[color:var(--lime-text-muted)]">
            {text("agentChat.threadQueue.pendingCount", {
              count: queue.submissions.length,
            })}
          </span>
        )}
        {queue.error || actionError ? (
          <span
            role="status"
            className="ml-auto inline-flex items-center gap-1 text-xs text-[color:var(--lime-danger)]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {text(
              queue.error
                ? "agentChat.threadQueue.refreshFailed"
                : "agentChat.threadQueue.actionFailed",
            )}
          </span>
        ) : null}
        <div className="ml-auto">
          <QueueActionButton
            action={expanded ? "collapse" : "expand"}
            label={text(
              expanded
                ? "agentChat.threadQueue.collapse"
                : "agentChat.threadQueue.expand",
            )}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronUp size={15} aria-hidden="true" />
            ) : (
              <ChevronDown size={15} aria-hidden="true" />
            )}
          </QueueActionButton>
        </div>
      </div>
      {expanded ? (
        <div
          className="mt-2 space-y-1"
          data-testid="queued-message-action-list"
        >
          {queue.submissions.map((submission, index) => {
            const isEditing = editing?.submissionId === submission.id;
            const textValue =
              getQueuedMessageText(submission.input) ||
              text("agentChat.threadQueue.nonTextInput");
            const image = getQueuedMessageImage(submission.input);
            return (
              <div
                key={submission.clientUserMessageId ?? submission.id}
                className="flex items-start gap-1 rounded-md border border-[color:var(--lime-surface-border)] p-1.5"
                data-testid="queued-message-item"
                data-submission-id={submission.id}
              >
                {image ? (
                  <MessageImageAttachments
                    images={[image]}
                    threadId={threadId}
                    thumbnail
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <textarea
                      value={editing.text}
                      disabled={busy}
                      onChange={(event) => {
                        if (pendingAction.current || queue.loading) {
                          return;
                        }
                        setEditing({
                          submissionId: submission.id,
                          text: event.target.value,
                        });
                      }}
                      rows={2}
                      className="w-full resize-y rounded border border-[color:var(--lime-surface-border)] bg-transparent px-2 py-1 text-xs outline-none focus:border-[color:var(--lime-info)] disabled:opacity-60"
                      aria-label={text("agentChat.threadQueue.editInput")}
                    />
                  ) : (
                    <div
                      role="group"
                      tabIndex={0}
                      data-queue-preview
                      aria-label={`${title} ${index + 1}/${queue.submissions.length}: ${textValue}`}
                      className="max-h-40 select-text overflow-auto whitespace-pre-wrap break-words rounded px-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lime-info)]"
                    >
                      {textValue}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {isEditing ? (
                    <>
                      <QueueActionButton
                        action="save"
                        label={text("agentChat.threadQueue.save")}
                        disabled={busy || !editing.text.trim()}
                        onClick={() => {
                          void runAction(
                            submission.id,
                            () =>
                              updateThreadQueue({
                                threadId,
                                queuedSubmissionId: submission.id,
                                input: replaceQueuedMessageText(
                                  submission.input,
                                  editing.text,
                                ),
                              }),
                            () =>
                              setEditing((current) =>
                                current?.submissionId === submission.id
                                  ? null
                                  : current,
                              ),
                          );
                        }}
                      >
                        <Check size={14} aria-hidden="true" />
                      </QueueActionButton>
                      <QueueActionButton
                        action="cancel"
                        label={text("agentChat.threadQueue.cancel")}
                        disabled={busy}
                        onClick={() => {
                          if (!pendingAction.current && !queue.loading) {
                            setEditing(null);
                          }
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                      </QueueActionButton>
                    </>
                  ) : (
                    <QueueActionButton
                      action="edit"
                      label={text("agentChat.threadQueue.edit")}
                      disabled={busy}
                      onClick={() => {
                        if (pendingAction.current || queue.loading) {
                          return;
                        }
                        setEditing({
                          submissionId: submission.id,
                          text: getQueuedMessageText(submission.input),
                        });
                      }}
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </QueueActionButton>
                  )}
                  <QueueActionButton
                    action="move-up"
                    label={text("agentChat.threadQueue.moveUp")}
                    disabled={busy || index === 0}
                    onClick={() => moveMessage(index, -1)}
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </QueueActionButton>
                  <QueueActionButton
                    action="move-down"
                    label={text("agentChat.threadQueue.moveDown")}
                    disabled={busy || index === queue.submissions.length - 1}
                    onClick={() => moveMessage(index, 1)}
                  >
                    <ArrowDown size={13} aria-hidden="true" />
                  </QueueActionButton>
                  <QueueActionButton
                    action="delete"
                    label={text("agentChat.threadQueue.delete")}
                    disabled={busy}
                    onClick={() => {
                      void runAction(submission.id, () =>
                        deleteThreadQueue({
                          threadId,
                          queuedSubmissionId: submission.id,
                        }),
                      );
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </QueueActionButton>
                  <QueueActionButton
                    action="start"
                    label={text("agentChat.threadQueue.sendNow")}
                    disabled={busy}
                    onClick={() => {
                      void runAction(submission.id, () =>
                        startThreadQueue({
                          threadId,
                          queuedSubmissionId: submission.id,
                        }),
                      );
                    }}
                  >
                    <Play size={13} aria-hidden="true" />
                  </QueueActionButton>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
