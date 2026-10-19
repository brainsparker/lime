import { marked, type Token, type Tokens } from "marked";
import type {
  CanonicalTurnMessageSegment,
  CanonicalTurnRenderSegment,
} from "../../projection/turnTimelineRenderProjection";
import {
  deriveAsyncQuestions,
  type AsyncQuestion,
  type QuestionReply,
} from "./questions";

export type QuestionMessageSegment = CanonicalTurnMessageSegment & {
  question?: AsyncQuestion;
};
export type QuestionRenderSegment =
  | Exclude<CanonicalTurnRenderSegment, CanonicalTurnMessageSegment>
  | QuestionMessageSegment;

/** 仅展开视图身份；canonical item 和响应注释仍归原 source item。 */
export function expandQuestionSegments(
  segments: readonly CanonicalTurnRenderSegment[],
): QuestionRenderSegment[] {
  return segments.flatMap((segment): QuestionRenderSegment[] => {
    if (segment.kind !== "message") return [segment];
    const questions = deriveAsyncQuestions(
      [segment.item],
      segment.item.thread_id,
    );
    return questions.length
      ? questions.map((question) => ({ ...segment, id: question.id, question }))
      : [segment];
  });
}

function tokenText(token: Token): string {
  if (token.type === "list")
    return (token as Tokens.List).items.map(tokenText).join(" ");
  if (token.type === "table") {
    const table = token as Tokens.Table;
    return [...table.header, ...table.rows.flat()]
      .map((cell) => cell.tokens.map(tokenText).join(""))
      .join(" ");
  }
  if ("tokens" in token && Array.isArray(token.tokens))
    return (token.tokens as Token[]).map(tokenText).join("");
  if (token.type === "html") return String(token.text).replace(/<[^>]*>/g, "");
  return "text" in token && typeof token.text === "string" ? token.text : " ";
}

export function questionTitleText(title: string): string {
  return marked
    .lexer(title.trim())
    .map(tokenText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function questionRepliesText(replies: readonly QuestionReply[]): string {
  return replies
    .map(({ question, answer }) => {
      const label = questionTitleText(question).replace(
        /[\\`*_{}[\]<>]/g,
        "\\$&",
      );
      return `**${label}**\n${answer}`;
    })
    .join("\n\n");
}
