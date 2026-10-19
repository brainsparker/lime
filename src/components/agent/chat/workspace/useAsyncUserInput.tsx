import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentThreadItem, AgentThreadTurn } from "@/lib/api/agentProtocol";
import type { ModeKind } from "@limecloud/app-server-client";
import type { SendMessageFn } from "../hooks/agentChatShared";
import { LOCAL_REQUEST_HOST_ID } from "../components/RequestUserInputDraftStore";
import { questionScope } from "../components/asyncUserInput/QuestionDraftStore";
import { useQuestionDrafts } from "../components/asyncUserInput/useQuestionDrafts";
import {
  deriveAsyncQuestions,
  deriveQuestionAnswers,
  serializeQuestionReplies,
} from "../components/asyncUserInput/questions";
import { AsyncUserInputPanel } from "../components/asyncUserInput/AsyncUserInputPanel";

interface AsyncUserInputOptions {
  threadId?: string | null;
  sessionId?: string | null;
  items: readonly AgentThreadItem[];
  turns: readonly AgentThreadTurn[];
  enabled: boolean;
  sendMessage?: SendMessageFn;
  collaborationMode?: ModeKind;
}

export function useAsyncUserInput({
  threadId,
  sessionId,
  items,
  turns,
  enabled,
  sendMessage,
  collaborationMode,
}: AsyncUserInputOptions) {
  const scope = questionScope(LOCAL_REQUEST_HOST_ID, threadId ?? "");
  const { store, snapshot } = useQuestionDrafts(scope);
  const [failedScope, setFailedScope] = useState<string | null>(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const questions = useMemo(
    () => deriveAsyncQuestions(items, threadId ?? ""),
    [items, threadId],
  );
  const answers = useMemo(
    () => deriveQuestionAnswers(items, threadId ?? "", questions),
    [items, threadId, questions],
  );
  const activeTurns = useMemo(
    () =>
      new Set(
        turns
          .filter(
            (turn) => turn.thread_id === threadId && turn.status === "running",
          )
          .map((turn) => turn.id),
      ),
    [turns, threadId],
  );
  useEffect(() => {
    if (threadId && enabled)
      store.reconcile(scope, questions, answers, activeTurns);
  }, [store, scope, threadId, enabled, questions, answers, activeTurns]);

  const send = async () => {
    if (
      !threadId ||
      !sessionId ||
      !enabled ||
      !sendMessage ||
      currentScope.current !== scope
    )
      return;
    const state = store.read(scope);
    const replies = store.submission(scope, questions);
    if (
      replies.some(
        (reply) => state.drafts.get(reply.questionItemId)?.submitting,
      ) ||
      !replies.some((reply) => reply.answer)
    )
      return;
    store.setSubmitting(scope, replies, true);
    setFailedScope(null);
    try {
      const result = await sendMessage(
        serializeQuestionReplies(replies),
        [],
        false,
        false,
        false,
        undefined,
        undefined,
        undefined,
        {
          targetSessionId: sessionId,
          shouldSendPermissionOverrides: false,
          collaborationMode,
          requestMetadata: { turnTrigger: "send_user_message_async_question" },
          executionScopeIsCurrent: () => currentScope.current === scope,
        },
      );
      if (
        result.kind !== "runtime-accepted" ||
        result.receipt.threadId !== threadId
      )
        throw new Error(
          "Question reply was not accepted by the current thread",
        );
      store.accepted(scope, replies);
    } catch {
      setFailedScope(scope);
    } finally {
      store.setSubmitting(scope, replies, false);
    }
  };
  const selected =
    enabled && Boolean(snapshot.selection) && Boolean(sendMessage);
  return {
    selected,
    node: selected ? (
      <AsyncUserInputPanel
        questions={questions}
        snapshot={snapshot}
        failed={failedScope === scope}
        onEdit={(id, text) => {
          setFailedScope(null);
          store.edit(scope, id, text);
        }}
        onSelect={(question) => store.select(scope, question)}
        onSkip={(id) => store.skip(scope, id)}
        onClose={() => store.close(scope)}
        onSend={() => {
          void send();
        }}
      />
    ) : null,
  };
}
