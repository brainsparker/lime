import { describe, expect, it } from "vitest";
import type { Skill } from "@/lib/api/skills";
import type { InputCapabilitySelection } from "../skill-selection/inputCapabilitySelection";
import type { CuratedTaskTemplateItem } from "../utils/curatedTaskTemplates";
import { resolveEmptyStateActiveCapability } from "./EmptyStateComposerPanelViewModel";

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    key: "writer",
    name: "写作助手",
    description: "处理写作任务。",
    directory: "writer",
    installed: true,
    sourceKind: "other",
    ...overrides,
  };
}

function curatedTask(
  overrides: Partial<CuratedTaskTemplateItem> = {},
): CuratedTaskTemplateItem {
  return {
    id: "task",
    title: "周报",
    summary: "整理周报。",
    outputHint: "一份周报",
    resultDestination: "聊天结果",
    categoryLabel: "写作",
    prompt: "请整理周报。",
    requiredInputs: [],
    requiredInputFields: [],
    optionalReferences: [],
    outputContract: [],
    followUpActions: [],
    badge: "模板",
    actionLabel: "开始",
    statusLabel: "可用",
    statusTone: "emerald",
    recentUsedAt: null,
    isRecent: false,
    ...overrides,
  };
}

describe("EmptyStateComposerPanelViewModel", () => {
  it("应派生当前能力 badge，且过滤知识包内置命令", () => {
    const fallbackSkill = skill({ key: "fallback" });
    const knowledgePackCapability: InputCapabilitySelection = {
      kind: "builtin_command",
      command: {
        key: "knowledge_pack",
        label: "知识包",
        mentionLabel: "知识包",
        commandPrefix: "@knowledge",
        description: "",
        aliases: [],
      },
    };

    expect(
      resolveEmptyStateActiveCapability({
        activeCapability: knowledgePackCapability,
        fallbackActiveSkill: fallbackSkill,
      }),
    ).toMatchObject({
      activeBuiltinCommand: null,
      activeSkill: fallbackSkill,
    });

    const taskCapability: InputCapabilitySelection = {
      kind: "curated_task",
      task: curatedTask({ id: "weekly" }),
      referenceEntries: [
        {
          id: "ref",
          category: "experience",
          categoryLabel: "经验",
          title: "参考资料",
          summary: "资料摘要",
          tags: [],
        },
      ],
    };
    const taskState = resolveEmptyStateActiveCapability({
      activeCapability: taskCapability,
      fallbackActiveSkill: fallbackSkill,
    });

    expect(taskState.activeCuratedTask?.id).toBe("weekly");
    expect(taskState.activeCuratedTaskReferenceEntries).toHaveLength(1);
    expect(taskState.activeSkill).toBe(fallbackSkill);
  });
});
