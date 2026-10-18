import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import type { QueuedSubmission } from "@limecloud/app-server-client";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
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
import { getReorderedSubmissionIds } from "./queuedMessageReorder";

const queueDragType = "application/x-thread-queue-reorder";

interface QueueDragSnapshot {
  threadId: string;
  submissionId: string;
  submissionIds: string[];
  submissions: readonly QueuedSubmission[];
  revision: number;
  payload: string;
}

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    submissionId: string;
    afterSnapshot: readonly QueuedSubmission[] | null;
    previousFocus: Element | null;
  } | null>(null);
  const active = useRef(true);
  const pendingAction = useRef<symbol | null>(null);
  const mutationRevision = useRef(0);
  const dragSequence = useRef(0);
  const dragSnapshot = useRef<QueueDragSnapshot | null>(null);
  const reorderHandles = useRef(new Map<string, HTMLButtonElement>());
  const instanceId = useId();
  const busy = Boolean(actionId) || queue.loading;
  const text = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      dragSnapshot.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !focusRequest ||
      busy ||
      (focusRequest.afterSnapshot &&
        focusRequest.afterSnapshot === queue.submissions)
    ) {
      return;
    }
    if (
      document.activeElement === document.body ||
      document.activeElement === focusRequest.previousFocus
    ) {
      reorderHandles.current.get(focusRequest.submissionId)?.focus();
    }
    setFocusRequest(null);
  }, [busy, focusRequest, queue.submissions]);

  const cancelDrag = () => {
    dragSnapshot.current = null;
    setDraggingId(null);
  };

  const runAction = async (
    submissionId: string,
    mutate: () => Promise<unknown>,
    onSuccess?: () => void,
  ): Promise<"success" | "failure" | "ignored"> => {
    if (!active.current || pendingAction.current || queue.loading) {
      return "ignored";
    }
    const request = Symbol();
    pendingAction.current = request;
    mutationRevision.current += 1;
    cancelDrag();
    setActionId(submissionId);
    setActionError(false);
    const isCurrent = () => active.current && pendingAction.current === request;
    try {
      await mutate();
      if (isCurrent()) {
        onSuccess?.();
        queue.refresh();
        return "success";
      }
    } catch {
      if (isCurrent()) {
        setActionError(true);
        return "failure";
      }
    } finally {
      if (isCurrent()) {
        pendingAction.current = null;
        setActionId(null);
      }
    }
    return "ignored";
  };

  const title = text("agentChat.threadQueue.title");

  const reorderMessage = (
    sourceId: string,
    destinationId: string,
    expectedIds?: readonly string[],
    restoreFocus = false,
  ) => {
    if (pendingAction.current || queue.loading || queue.error) {
      return;
    }
    const ids = getReorderedSubmissionIds({
      submissionIds: queue.submissions.map((item) => item.id),
      sourceId,
      destinationId,
      expectedIds,
    });
    if (!ids) return;
    const submissions = queue.submissions;
    const previousFocus = document.activeElement;
    void runAction(sourceId, () =>
      reorderThreadQueue({ threadId, queuedSubmissionIds: ids }),
    ).then((outcome) => {
      if (restoreFocus && active.current && outcome !== "ignored") {
        setFocusRequest({
          submissionId: sourceId,
          afterSnapshot: outcome === "success" ? submissions : null,
          previousFocus,
        });
      }
    });
  };

  const moveMessage = (submissionId: string, direction: -1 | 1) => {
    const index = queue.submissions.findIndex(
      (item) => item.id === submissionId,
    );
    const destination = queue.submissions[index + direction];
    if (index >= 0 && destination) {
      reorderMessage(submissionId, destination.id, undefined, true);
    }
  };

  const startDrag = (
    event: DragEvent<HTMLButtonElement>,
    submissionId: string,
  ) => {
    cancelDrag();
    const submissionIds = queue.submissions.map((item) => item.id);
    if (
      !active.current ||
      pendingAction.current ||
      queue.loading ||
      queue.error ||
      !submissionIds.includes(submissionId) ||
      submissionIds.some((id) => !id.trim()) ||
      new Set(submissionIds).size !== submissionIds.length ||
      submissionIds.length < 2
    ) {
      event.preventDefault();
      return;
    }
    const payload = JSON.stringify({
      instanceId,
      sequence: ++dragSequence.current,
      threadId,
      submissionId,
    });
    try {
      event.dataTransfer.setData(queueDragType, payload);
      event.dataTransfer.effectAllowed = "move";
    } catch {
      event.preventDefault();
      return;
    }
    dragSnapshot.current = {
      threadId,
      submissionId,
      submissionIds,
      submissions: queue.submissions,
      revision: mutationRevision.current,
      payload,
    };
    setDraggingId(submissionId);
  };

  const canDrop = (snapshot: QueueDragSnapshot, destinationId: string) =>
    active.current &&
    dragSnapshot.current === snapshot &&
    snapshot.threadId === threadId &&
    snapshot.submissions === queue.submissions &&
    snapshot.revision === mutationRevision.current &&
    !pendingAction.current &&
    !queue.loading &&
    !queue.error &&
    Boolean(
      getReorderedSubmissionIds({
        submissionIds: queue.submissions.map((item) => item.id),
        sourceId: snapshot.submissionId,
        destinationId,
        expectedIds: snapshot.submissionIds,
      }),
    );

  const dropMessage = (
    event: DragEvent<HTMLDivElement>,
    destinationId: string,
  ) => {
    const snapshot = dragSnapshot.current;
    if (!snapshot) return;
    event.preventDefault();
    event.stopPropagation();
    let valid = canDrop(snapshot, destinationId);
    try {
      valid &&= event.dataTransfer.getData(queueDragType) === snapshot.payload;
    } catch {
      valid = false;
    }
    cancelDrag();
    if (valid) {
      reorderMessage(
        snapshot.submissionId,
        destinationId,
        snapshot.submissionIds,
      );
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

  return (
    <section
      aria-label={title}
      aria-busy={busy}
      className="mx-4 mb-2 border-t border-[color:var(--lime-surface-border)] px-3 py-2 text-[color:var(--lime-text-strong)]"
      data-testid="queued-message-list"
      data-thread-id={threadId}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") cancelDrag();
      }}
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
            onClick={() => {
              cancelDrag();
              setExpanded((value) => !value);
            }}
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
                className="flex items-start gap-1 rounded-md border border-[color:var(--lime-surface-border)] p-1.5 data-[queue-dragging=true]:opacity-50"
                data-testid="queued-message-item"
                data-submission-id={submission.id}
                data-queue-dragging={draggingId === submission.id || undefined}
                onDragOver={(event) => {
                  const snapshot = dragSnapshot.current;
                  if (snapshot && canDrop(snapshot, submission.id)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => dropMessage(event, submission.id)}
              >
                <button
                  ref={(node) => {
                    if (node) reorderHandles.current.set(submission.id, node);
                    else reorderHandles.current.delete(submission.id);
                  }}
                  type="button"
                  className="inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-[color:var(--lime-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lime-info)] active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                  aria-label={`${text("agentChat.threadQueue.moveUp")} / ${text("agentChat.threadQueue.moveDown")}: ${textValue}`}
                  aria-keyshortcuts="ArrowUp ArrowDown"
                  data-queue-action="reorder"
                  disabled={
                    busy || Boolean(queue.error) || queue.submissions.length < 2
                  }
                  draggable={
                    !busy && !queue.error && queue.submissions.length > 1
                  }
                  onDragStart={(event) => startDrag(event, submission.id)}
                  onDragEnd={cancelDrag}
                  onKeyDown={(event) => {
                    if (
                      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                      !event.altKey &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      moveMessage(
                        submission.id,
                        event.key === "ArrowUp" ? -1 : 1,
                      );
                    }
                  }}
                >
                  <GripVertical size={13} aria-hidden="true" />
                </button>
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
                    disabled={busy || Boolean(queue.error) || index === 0}
                    onClick={() => moveMessage(submission.id, -1)}
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </QueueActionButton>
                  <QueueActionButton
                    action="move-down"
                    label={text("agentChat.threadQueue.moveDown")}
                    disabled={
                      busy ||
                      Boolean(queue.error) ||
                      index === queue.submissions.length - 1
                    }
                    onClick={() => moveMessage(submission.id, 1)}
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
