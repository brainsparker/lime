import type { AgentThreadItem } from "@/lib/api/agentProtocol";

export interface AsyncQuestion {
  id: string;
  sourceItemId: string;
  turnId: string;
  title: string;
  options: string[];
}

export interface QuestionReply {
  questionItemId: string;
  question: string;
  answer: string;
}

const OPEN = "<send_user_message_question_reply>";
const CLOSE = "</send_user_message_question_reply>";

export function questionItemId(sourceItemId: string, index: number): string {
  return JSON.stringify(["request_user_input_async", sourceItemId, index]);
}

export function deriveAsyncQuestions(
  items: readonly AgentThreadItem[],
  threadId: string,
): AsyncQuestion[] {
  return items.flatMap((item) =>
    item.thread_id === threadId && item.type === "agent_message" && item.turn_id
      ? (item.questions ?? []).map((question, index) => ({
          id: questionItemId(item.id, index),
          sourceItemId: item.id,
          turnId: item.turn_id,
          title: question.title,
          options: question.options ?? [],
        }))
      : [],
  );
}

export function parseQuestionReplies(text: string): QuestionReply[] | null {
  const content = text.trim();
  if (!content.startsWith(OPEN) || !content.endsWith(CLOSE)) return null;
  try {
    const parsed: unknown = JSON.parse(
      content.slice(OPEN.length, -CLOSE.length),
    );
    const replies = Array.isArray(parsed) ? parsed : [parsed];
    if (
      !replies.length ||
      !replies.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof entry.questionItemId === "string" &&
          typeof entry.question === "string" &&
          typeof entry.answer === "string",
      )
    )
      return null;
    return replies.map(({ questionItemId, question, answer }) => ({
      questionItemId,
      question,
      answer,
    }));
  } catch {
    return null;
  }
}

export function serializeQuestionReplies(
  replies: readonly QuestionReply[],
): string {
  const answers = replies
    .map((reply) => ({ ...reply, answer: reply.answer.trim() }))
    .filter((reply) => reply.answer);
  if (!answers.length)
    throw new Error("Question reply requires a nonempty answer");
  return `${OPEN}\n${JSON.stringify(answers)}\n${CLOSE}`;
}

export function readQuestionReplies(
  item: AgentThreadItem,
): QuestionReply[] | null {
  if (item.type !== "user_message") return null;
  if (
    item.content_parts &&
    (item.content_parts.length !== 1 || item.content_parts[0].type !== "text")
  )
    return null;
  return parseQuestionReplies(
    item.content_parts?.[0]?.type === "text"
      ? item.content_parts[0].text
      : item.content,
  );
}

/** 只关联真实同线程题目；未接受的乐观消息不构成答案。 */
export function deriveQuestionAnswers(
  items: readonly AgentThreadItem[],
  threadId: string,
  questions: readonly AsyncQuestion[],
): Map<string, string> {
  const ids = new Set(questions.map((question) => question.id));
  const answers = new Map<string, string>();
  for (const item of items) {
    if (
      item.thread_id !== threadId ||
      item.type !== "user_message" ||
      item.status !== "completed"
    )
      continue;
    for (const reply of readQuestionReplies(item) ?? []) {
      if (ids.has(reply.questionItemId))
        answers.set(reply.questionItemId, reply.answer);
    }
  }
  return answers;
}
