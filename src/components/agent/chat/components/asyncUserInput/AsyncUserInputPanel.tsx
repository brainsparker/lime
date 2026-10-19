import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuestionAnswerEditor } from "../QuestionAnswerEditor";
import type { QuestionDraftSnapshot } from "./QuestionDraftStore";
import type { AsyncQuestion } from "./questions";

interface AsyncUserInputPanelProps {
  questions: readonly AsyncQuestion[];
  snapshot: QuestionDraftSnapshot;
  failed: boolean;
  onEdit: (id: string, text: string) => void;
  onSelect: (question: AsyncQuestion) => void;
  onSkip: (id: string) => void;
  onClose: () => void;
  onSend: () => void;
}

/** 与同步问答共用编辑 primitive；这里没有 requestId、reverse reply 或 interrupt。 */
export function AsyncUserInputPanel({
  questions: allQuestions,
  snapshot,
  failed,
  onEdit,
  onSelect,
  onSkip,
  onClose,
  onSend,
}: AsyncUserInputPanelProps) {
  const { t } = useTranslation("agent");
  const selection = snapshot.selection;
  const questions =
    selection?.ids.flatMap(
      (id) =>
        allQuestions.find(
          (question) =>
            question.id === id && question.turnId === selection.turnId,
        ) ?? [],
    ) ?? [];
  const index = questions.findIndex(
    (question) => question.id === selection?.selectedId,
  );
  const question = questions[index];
  const rootRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const draft = question ? snapshot.drafts.get(question.id) : undefined;
  const submitting = questions.some(
    (question) => snapshot.drafts.get(question.id)?.submitting,
  );
  const last = index === questions.length - 1;
  const freeform =
    draft && !question?.options.includes(draft.draft) ? draft.draft : "";

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (question?.options.length) rootRef.current?.focus();
  }, [question?.id, question?.options.length]);
  if (!question || !draft) return null;

  const cancelAdvance = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAdvancing(null);
  };
  const move = (next: number) => {
    if (submitting || !questions[next]) return;
    cancelAdvance();
    onSelect(questions[next]);
  };
  const advance = () => {
    if (submitting) return;
    cancelAdvance();
    if (last) onSend();
    else move(index + 1);
  };
  const choose = (option: string) => {
    if (submitting || timer.current) return;
    onEdit(question.id, option);
    setAdvancing(option);
    timer.current = setTimeout(() => {
      timer.current = null;
      setAdvancing(null);
      if (last) onSend();
      else onSelect(questions[index + 1]);
    }, 180);
  };
  const skip = () => {
    if (submitting) return;
    cancelAdvance();
    onSkip(question.id);
    if (!last) move(index + 1);
    else if (
      questions.some(
        (other) =>
          other.id !== question.id &&
          snapshot.drafts.get(other.id)?.draft.trim(),
      )
    )
      onSend();
    else onClose();
  };
  const close = () => {
    cancelAdvance();
    onClose();
  };

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      data-async-user-input=""
      data-source-item-id={question.sourceItemId}
      aria-label={String(t("agentChat.asyncUserInput.header"))}
      className="isolate mb-2 rounded-2xl border border-border bg-background outline-none"
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
          return;
        }
        if (
          (event.target as Element).closest(
            "input,textarea,[contenteditable=true]",
          )
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(index + (event.key === "ArrowRight" ? 1 : -1));
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (submitting) return;
          const current = question.options.indexOf(draft.draft);
          const next =
            current < 0
              ? event.key === "ArrowDown"
                ? 0
                : question.options.length - 1
              : Math.max(
                  0,
                  Math.min(
                    current + (event.key === "ArrowDown" ? 1 : -1),
                    question.options.length - 1,
                  ),
                );
          if (question.options[next])
            onEdit(question.id, question.options[next]);
        } else if (
          /^[1-9]$/.test(event.key) &&
          question.options[Number(event.key) - 1]
        ) {
          event.preventDefault();
          choose(question.options[Number(event.key) - 1]);
        } else if (
          event.key === "Enter" &&
          !(event.target as Element).closest("button") &&
          draft.draft.trim()
        ) {
          event.preventDefault();
          advance();
        }
      }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle size={16} />
          {t("agentChat.asyncUserInput.header")}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {questions.length > 1 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                disabled={submitting || index === 0}
                aria-label={String(
                  t("agentChat.requestUserInput.previousQuestion"),
                )}
                onClick={() => move(index - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              <span>
                {t("agentChat.requestUserInput.progress", {
                  current: index + 1,
                  total: questions.length,
                })}
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={submitting || last}
                aria-label={String(
                  t("agentChat.requestUserInput.nextQuestion"),
                )}
                onClick={() => move(index + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={String(t("agentChat.requestUserInput.dismiss"))}
            onClick={close}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
      <p className="px-4 text-sm font-medium">{question.title}</p>
      <div className="flex flex-col gap-1 p-2">
        {question.options.map((option, optionIndex) => (
          <button
            key={optionIndex}
            type="button"
            disabled={submitting}
            aria-pressed={draft.draft === option}
            data-async-question-option={optionIndex}
            className={cn(
              "flex min-h-9 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-accent",
              draft.draft === option && "bg-accent",
              advancing === option && "animate-pulse",
            )}
            onClick={() => choose(option)}
          >
            <span className="w-4 shrink-0 text-xs text-muted-foreground">
              {draft.draft === option ? <Check size={14} /> : optionIndex + 1}
            </span>
            <span className="flex-1">{option}</span>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
          </button>
        ))}
        <div className="flex items-end gap-2 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
          <QuestionAnswerEditor
            key={question.id}
            text={freeform || ""}
            disabled={false}
            autoFocus={!question.options.length}
            label={question.title}
            placeholder={String(
              t(
                question.options.length
                  ? "agentChat.asyncUserInput.otherPlaceholder"
                  : "agentChat.asyncUserInput.placeholder",
              ),
            )}
            onFocus={() => {
              if (question.options.includes(draft.draft))
                onEdit(question.id, "");
            }}
            onChange={(text) => {
              cancelAdvance();
              onEdit(question.id, text);
            }}
            onSubmit={advance}
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 rounded-full"
            disabled={submitting}
            onClick={skip}
          >
            {t("agentChat.requestUserInput.skip")}
          </Button>
          <Button
            size="sm"
            className="shrink-0 rounded-full"
            disabled={submitting || !draft.draft.trim()}
            onClick={advance}
          >
            {t(
              submitting
                ? "agentChat.requestUserInput.submitting"
                : !last
                  ? "agentChat.requestUserInput.next"
                  : questions.length === 1 && draft.lastSubmission !== null
                    ? "agentChat.asyncUserInput.sendUpdate"
                    : "agentChat.asyncUserInput.send",
            )}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {t("agentChat.asyncUserInput.sendFailed")}
          </p>
        )}
      </div>
    </section>
  );
}
