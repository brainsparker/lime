import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";

export type InputbarComposerSectionCopyKey =
  | "agentChat.inputbar.suggestions.planMode"
  | "agentChat.inputbar.suggestions.goal"
  | "agentChat.inputbar.planStatus.label"
  | "agentChat.inputbar.planStatus.model"
  | "agentChat.inputbar.planStatus.modelFallback"
  | "agentChat.inputbar.planStatus.reasoning"
  | "agentChat.inputbar.planStatus.reasoning.default"
  | "agentChat.inputbar.planStatus.reasoning.none"
  | "agentChat.inputbar.planStatus.reasoning.minimal"
  | "agentChat.inputbar.planStatus.reasoning.low"
  | "agentChat.inputbar.planStatus.reasoning.medium"
  | "agentChat.inputbar.planStatus.reasoning.high"
  | "agentChat.inputbar.planStatus.reasoning.xhigh"
  | "agentChat.inputbar.planStatus.reasoning.max"
  | "agentChat.inputbar.planStatus.reasoning.ultra"
  | "agentChat.inputbar.planStatus.reasoning.persistent"
  | "agentChat.inputbar.composer.workspacePlaceholder.waiting"
  | "agentChat.inputbar.composer.workspacePlaceholder.taskCenter"
  | "agentChat.inputbar.composer.workspacePlaceholder.default";

type InputbarComposerSectionCopyValue = number | string;

export type InputbarComposerSectionCopyTranslate = (
  key: InputbarComposerSectionCopyKey,
  values?: Record<string, InputbarComposerSectionCopyValue>,
) => string;

export interface InputbarComposerSectionCopy {
  planStatus: {
    label: string;
    model: (model: string) => string;
    modelFallback: string;
    reasoning: (level: string) => string;
    reasoningDefault: string;
    reasoningLevels: Record<ModelReasoningEffortLevel, string>;
  };
  contextCommands: {
    planMode: string;
    goal: string;
  };
  workspacePlaceholder: {
    waiting: string;
    taskCenter: string;
    default: string;
  };
}

export function buildInputbarComposerSectionCopy(
  translate: InputbarComposerSectionCopyTranslate,
): InputbarComposerSectionCopy {
  return {
    planStatus: {
      label: translate("agentChat.inputbar.planStatus.label"),
      model: (model) =>
        translate("agentChat.inputbar.planStatus.model", { model }),
      modelFallback: translate("agentChat.inputbar.planStatus.modelFallback"),
      reasoning: (level) =>
        translate("agentChat.inputbar.planStatus.reasoning", { level }),
      reasoningDefault: translate(
        "agentChat.inputbar.planStatus.reasoning.default",
      ),
      reasoningLevels: {
        none: translate("agentChat.inputbar.planStatus.reasoning.none"),
        minimal: translate("agentChat.inputbar.planStatus.reasoning.minimal"),
        low: translate("agentChat.inputbar.planStatus.reasoning.low"),
        medium: translate("agentChat.inputbar.planStatus.reasoning.medium"),
        high: translate("agentChat.inputbar.planStatus.reasoning.high"),
        xhigh: translate("agentChat.inputbar.planStatus.reasoning.xhigh"),
        max: translate("agentChat.inputbar.planStatus.reasoning.max"),
        ultra: translate("agentChat.inputbar.planStatus.reasoning.ultra"),
        persistent: translate(
          "agentChat.inputbar.planStatus.reasoning.persistent",
        ),
      },
    },
    contextCommands: {
      planMode: translate("agentChat.inputbar.suggestions.planMode"),
      goal: translate("agentChat.inputbar.suggestions.goal"),
    },
    workspacePlaceholder: {
      waiting: translate(
        "agentChat.inputbar.composer.workspacePlaceholder.waiting",
      ),
      taskCenter: translate(
        "agentChat.inputbar.composer.workspacePlaceholder.taskCenter",
      ),
      default: translate(
        "agentChat.inputbar.composer.workspacePlaceholder.default",
      ),
    },
  };
}
