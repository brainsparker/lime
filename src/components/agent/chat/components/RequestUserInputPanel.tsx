import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionAnswerEditor } from "./QuestionAnswerEditor";
import type {
  ActionRequired,
  ConfirmResponse,
} from "@/lib/api/agentActionTypes";
import { cn } from "@/lib/utils";
import {
  buildRequestUserInputResponse,
  createRequestUserInputDrafts,
  hasQuestionIds,
  type RequestUserInputDraft,
  type RequestUserInputDraftState,
  type RequestUserInputQuestion,
} from "./requestUserInputDraft";
import {
  LOCAL_REQUEST_HOST_ID,
  requestUserInputDraftIdentity,
  requestUserInputDraftsAtom,
} from "./RequestUserInputDraftStore";

export type RequestUserInputSubmitResult = void | { accepted: boolean };

export interface RequestUserInputPanelProps {
  hostId?: string;
  request: ActionRequired;
  onSubmit: (
    response: ConfirmResponse,
  ) => RequestUserInputSubmitResult | Promise<RequestUserInputSubmitResult>;
  onDismiss?: () => Promise<{ accepted: boolean }>;
}

const CHOICE_ADVANCE_DELAY_MS = 180;

/** 同步问答只拥有 UI 草稿与焦点，不占用主 Composer 或 canonical pending。 */
export function RequestUserInputPanel(props: RequestUserInputPanelProps) {
  const { request } = props;
  const { t } = useTranslation("agent");
  const questions = request.questions ?? [];
  if (request.status === "submitted" || request.status === "queued") {
    return <p role="status">{t("agentChat.requestUserInput.submitted")}</p>;
  }
  if (!hasQuestionIds(questions)) {
    return (
      <section className="rounded-2xl border border-border bg-background p-4">
        <p role="alert">{t("agentChat.requestUserInput.invalidRequest")}</p>
      </section>
    );
  }
  const identity = JSON.stringify([
    props.hostId ?? LOCAL_REQUEST_HOST_ID,
    request.scope?.threadId,
    request.scope?.turnId,
    request.requestId,
    questions.map((question) => question.id),
  ]);
  return (
    <RequestUserInputForm key={identity} {...props} questions={questions} />
  );
}

function RequestUserInputForm({
  hostId = LOCAL_REQUEST_HOST_ID,
  request,
  onSubmit,
  onDismiss,
  questions,
}: RequestUserInputPanelProps & { questions: RequestUserInputQuestion[] }) {
  const { t } = useTranslation("agent");
  const sharedDrafts = useAtomValue(requestUserInputDraftsAtom);
  const draftIdentity = requestUserInputDraftIdentity(
    hostId,
    request,
    questions,
  );
  const [{ answers: drafts, questionIndex }, setDraftState] =
    useState<RequestUserInputDraftState>(() => {
      const initial = sharedDrafts.read(draftIdentity);
      return {
        answers: initial?.answers ?? createRequestUserInputDrafts(questions),
        questionIndex:
          initial && Number.isInteger(initial.questionIndex)
            ? Math.max(0, Math.min(initial.questionIndex, questions.length - 1))
            : 0,
      };
    });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [advancingChoiceId, setAdvancingChoiceId] = useState<string | null>(
    null,
  );
  const rootRef = useRef<HTMLElement>(null);
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const question = questions[questionIndex];
  const draft = drafts[question.id];
  const options = question.options ?? [];
  const hasOptions = options.length > 0;
  const hasFreeform = !hasOptions || question.isOther === true;
  const isLastQuestion = questionIndex === questions.length - 1;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (hasOptions) rootRef.current?.focus();
  }, [hasOptions, question.id]);

  const clearChoiceAdvance = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    setAdvancingChoiceId(null);
  };

  const saveDraft = (answers = drafts, index = questionIndex) => {
    const next = { answers, questionIndex: index };
    setDraftState(next);
    sharedDrafts.save(draftIdentity, next);
  };

  const clearSharedDraft = () => {
    if (draftIdentity)
      sharedDrafts.clear(draftIdentity.key, draftIdentity.requestId);
  };

  const updateDraft = (next: RequestUserInputDraft) => {
    clearChoiceAdvance();
    setFailed(false);
    saveDraft({ ...drafts, [question.id]: next });
  };

  const submit = async (nextDrafts = drafts) => {
    if (submittingRef.current || !mountedRef.current) return;
    submittingRef.current = true;
    clearChoiceAdvance();
    setSubmitting(true);
    setFailed(false);
    clearSharedDraft();
    try {
      const result = await onSubmit({
        requestId: request.requestId,
        actionType: "ask_user",
        confirmed: true,
        userData: buildRequestUserInputResponse(questions, nextDrafts),
      });
      if (!mountedRef.current) return;
      if (result && !result.accepted) {
        setFailed(true);
      } else {
        setSubmitted(true);
      }
    } catch {
      if (mountedRef.current) setFailed(true);
    } finally {
      if (mountedRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const dismiss = async () => {
    if (submittingRef.current || !mountedRef.current) return;
    submittingRef.current = true;
    clearChoiceAdvance();
    setSubmitting(true);
    setFailed(false);
    clearSharedDraft();
    let accepted = false;
    try {
      accepted = (await onDismiss?.())?.accepted === true;
      if (!accepted && mountedRef.current) setFailed(true);
    } catch {
      if (mountedRef.current) setFailed(true);
    } finally {
      // 中断应答不是问答终态；成功后等待 canonical owner 移除请求。
      if (!accepted && mountedRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const goToQuestion = (index: number, nextDrafts = drafts) => {
    if (submittingRef.current) return;
    clearChoiceAdvance();
    saveDraft(nextDrafts, Math.max(0, Math.min(index, questions.length - 1)));
  };

  const advance = (nextDrafts = drafts) => {
    if (submittingRef.current) return;
    if (isLastQuestion) void submit(nextDrafts);
    else goToQuestion(questionIndex + 1, nextDrafts);
  };

  const selectOption = (label: string) => {
    if (submittingRef.current || timerRef.current !== null) return;
    const next = {
      ...drafts,
      [question.id]: { ...draft, selectedOptionId: label },
    };
    saveDraft(next);
    setFailed(false);
    setAdvancingChoiceId(label);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setAdvancingChoiceId(null);
      if (mountedRef.current) advance(next);
    }, CHOICE_ADVANCE_DELAY_MS);
  };

  const skip = () => {
    if (submittingRef.current) return;
    const next = {
      ...drafts,
      [question.id]: { selectedOptionId: null, freeformText: "" },
    };
    saveDraft(next);
    clearChoiceAdvance();
    advance(next);
  };

  if (submitted) {
    return <p role="status">{t("agentChat.requestUserInput.submitted")}</p>;
  }

  return (
    <section
      ref={rootRef}
      tabIndex={0}
      className="w-full min-w-0 rounded-2xl border border-border bg-background outline-none"
      data-testid="request-user-input-panel"
      data-request-id={request.requestId}
      data-question-id={question.id}
      aria-label={question.question}
      aria-busy={submitting}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229 ||
          submitting
        )
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          void dismiss();
          return;
        }
        const target = event.target as HTMLElement;
        if (target.closest('[contenteditable="true"], input, textarea')) return;
        if (timerRef.current !== null) {
          event.preventDefault();
          return;
        }
        if (/^[1-9]$/.test(event.key)) {
          const option = options[Number(event.key) - 1];
          if (option) {
            event.preventDefault();
            selectOption(option.label);
          }
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          goToQuestion(questionIndex + (event.key === "ArrowRight" ? 1 : -1));
        } else if (
          hasOptions &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          const current = options.findIndex(
            (option) => option.label === draft.selectedOptionId,
          );
          const index = Math.max(
            0,
            Math.min(
              options.length - 1,
              current + (event.key === "ArrowDown" ? 1 : -1),
            ),
          );
          updateDraft({ ...draft, selectedOptionId: options[index].label });
        } else if (event.key === "Enter" && !target.closest("button")) {
          event.preventDefault();
          advance();
        }
      }}
    >
      <header className="flex items-start justify-between gap-3 pb-2 pl-4 pr-3 pt-4">
        <p className="min-w-0 text-sm font-medium whitespace-pre-wrap break-words">
          {question.question}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {questions.length > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={submitting || questionIndex === 0}
                aria-label={String(
                  t("agentChat.requestUserInput.previousQuestion"),
                )}
                onClick={() => goToQuestion(questionIndex - 1)}
              >
                <ChevronLeft className="size-3" />
              </Button>
              <span>
                {t("agentChat.requestUserInput.progress", {
                  current: questionIndex + 1,
                  total: questions.length,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={submitting || isLastQuestion}
                aria-label={String(
                  t("agentChat.requestUserInput.nextQuestion"),
                )}
                onClick={() => goToQuestion(questionIndex + 1)}
              >
                <ChevronRight className="size-3" />
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={submitting}
            aria-label={String(t("agentChat.requestUserInput.dismiss"))}
            onClick={() => void dismiss()}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-1 px-2 pb-2 pt-1">
        {hasOptions && (
          <div
            role="radiogroup"
            aria-label={question.question}
            className="flex flex-col gap-1"
          >
            {options.map((option, index) => {
              const selected = draft.selectedOptionId === option.label;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  key={option.label}
                  disabled={submitting}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    (selected || advancingChoiceId === option.label) &&
                      "bg-muted",
                  )}
                  onClick={() => selectOption(option.label)}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-5 shrink-0 items-center justify-center rounded border border-border text-xs text-muted-foreground"
                  >
                    {advancingChoiceId === option.label ? (
                      <Check className="size-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-medium break-words">
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="text-muted-foreground break-words">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </button>
              );
            })}
          </div>
        )}
        <div
          className={cn(
            "flex items-end gap-2",
            hasOptions && hasFreeform
              ? "rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring"
              : "px-2 py-1.5",
          )}
        >
          {hasFreeform && (
            <QuestionAnswerEditor
              key={question.id}
              text={draft.freeformText}
              disabled={submitting}
              autoFocus={!hasOptions}
              label={String(t("agentChat.requestUserInput.answer"))}
              placeholder={String(
                t(
                  hasOptions
                    ? "agentChat.requestUserInput.otherPlaceholder"
                    : "agentChat.requestUserInput.placeholder",
                ),
              )}
              onFocus={() => {
                if (hasOptions && draft.selectedOptionId !== null)
                  updateDraft({ ...draft, selectedOptionId: null });
              }}
              onChange={(freeformText) =>
                updateDraft({ selectedOptionId: null, freeformText })
              }
              onSubmit={() => advance()}
            />
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto shrink-0 rounded-full"
            disabled={submitting}
            onClick={() => (draft.freeformText.trim() ? advance() : skip())}
          >
            {submitting
              ? t("agentChat.requestUserInput.submitting")
              : draft.freeformText.trim()
                ? t(
                    isLastQuestion
                      ? "agentChat.requestUserInput.submit"
                      : "agentChat.requestUserInput.next",
                  )
                : t("agentChat.requestUserInput.skip")}
          </Button>
        </div>
        {failed && (
          <p role="alert" className="px-2 text-xs text-destructive">
            {t("agentChat.requestUserInput.submitFailed")}
          </p>
        )}
      </div>
    </section>
  );
}
