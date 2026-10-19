import type { ToolRequestUserInputResponse } from "@limecloud/app-server-client";
import type { Question } from "@/lib/api/agentActionTypes";

export type RequestUserInputQuestion = Question & { id: string };

export interface RequestUserInputDraft {
  selectedOptionId: string | null;
  freeformText: string;
}

export type RequestUserInputDrafts = Record<string, RequestUserInputDraft>;

export interface RequestUserInputDraftState {
  answers: RequestUserInputDrafts;
  questionIndex: number;
}

export function hasQuestionIds(
  questions: Question[],
): questions is RequestUserInputQuestion[] {
  const ids = questions.map((question) => question.id);
  return (
    ids.length > 0 &&
    ids.every((id) => typeof id === "string" && id.trim().length > 0) &&
    new Set(ids).size === ids.length
  );
}

export function createRequestUserInputDrafts(
  questions: RequestUserInputQuestion[],
): RequestUserInputDrafts {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      {
        selectedOptionId: question.options?.[0]?.label ?? null,
        freeformText: "",
      },
    ]),
  );
}

export function buildRequestUserInputResponse(
  questions: RequestUserInputQuestion[],
  drafts: RequestUserInputDrafts,
): ToolRequestUserInputResponse {
  const answers: Array<[string, { answers: string[] }]> = [];
  for (const question of questions) {
    const draft = drafts[question.id];
    if (!draft) continue;
    const hasOptions = (question.options?.length ?? 0) > 0;
    const selected = question.options?.find(
      (option) => option.label === draft.selectedOptionId,
    );
    const answer = (
      hasOptions && selected
        ? selected.label
        : !hasOptions || question.isOther
          ? draft.freeformText
          : ""
    ).trim();
    if (answer) answers.push([question.id, { answers: [answer] }]);
  }
  return { answers: Object.fromEntries(answers) };
}
