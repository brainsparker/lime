import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LOCAL_REQUEST_HOST_ID } from "../RequestUserInputDraftStore";
import { MarkdownRenderer } from "../MarkdownRenderer";
import {
  questionScope,
  type QuestionDraftSnapshot,
} from "./QuestionDraftStore";
import { useQuestionDrafts } from "./useQuestionDrafts";
import type { AsyncQuestion, QuestionReply } from "./questions";
import { questionTitleText } from "./timelineProjection";

function canAnswer(snapshot: QuestionDraftSnapshot, id: string): boolean {
  const draft = snapshot.drafts.get(id);
  return Boolean(
    draft &&
    draft.lastSubmission === null &&
    !snapshot.selection?.ids.includes(id),
  );
}

export function QuestionAnswerButton({
  question,
  threadId,
  active,
}: {
  question: AsyncQuestion;
  threadId: string;
  active: boolean;
}) {
  const { t } = useTranslation("agent");
  const scope = questionScope(LOCAL_REQUEST_HOST_ID, threadId);
  const { store, snapshot } = useQuestionDrafts(scope);
  if (!active || !canAnswer(snapshot, question.id)) return null;
  return (
    <button
      type="button"
      className="mt-3 inline-flex h-8 items-center gap-2 rounded-full border border-border bg-transparent px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        if (active && canAnswer(store.read(scope), question.id))
          store.select(scope, question);
      }}
    >
      <MessageCircle aria-hidden="true" size={14} />
      {t("agentChat.asyncUserInput.answer")}
    </button>
  );
}

export function QuestionReplies({
  replies,
}: {
  replies: readonly QuestionReply[];
}) {
  return (
    <div className="flex flex-col gap-3 text-sm" data-question-replies="">
      {replies.map(({ questionItemId, question, answer }) => {
        const label = questionTitleText(question);
        return (
          <div key={questionItemId} className="flex min-w-0 flex-col gap-1">
            <span className="truncate opacity-70" title={label}>
              {label}
            </span>
            <MarkdownRenderer content={answer} readOnlyA2UI={true} />
          </div>
        );
      })}
    </div>
  );
}
