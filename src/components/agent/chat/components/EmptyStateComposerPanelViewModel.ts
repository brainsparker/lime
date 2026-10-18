import type { Skill } from "@/lib/api/skills";
import type { InputCapabilitySelection } from "../skill-selection/inputCapabilitySelection";
import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";

export interface EmptyStateActiveCapabilityViewModel {
  activeBuiltinCommand:
    | Extract<InputCapabilitySelection, { kind: "builtin_command" }>["command"]
    | null;
  activeRuntimeScene:
    | Extract<InputCapabilitySelection, { kind: "runtime_scene" }>["command"]
    | null;
  activeCuratedTask:
    | Extract<InputCapabilitySelection, { kind: "curated_task" }>["task"]
    | null;
  activeCuratedTaskReferenceEntries?: CuratedTaskReferenceEntry[];
  activeSkill: Skill | null;
}

export function resolveEmptyStateActiveCapability({
  activeCapability,
  fallbackActiveSkill,
}: {
  activeCapability: InputCapabilitySelection | null;
  fallbackActiveSkill: Skill | null;
}): EmptyStateActiveCapabilityViewModel {
  const activeBuiltinCommand =
    activeCapability?.kind === "builtin_command" &&
    activeCapability.command.key !== "knowledge_pack" &&
    activeCapability.command.key !== "knowledge_settle"
      ? activeCapability.command
      : null;
  const activeRuntimeScene =
    activeCapability?.kind === "runtime_scene"
      ? activeCapability.command
      : null;
  const activeCuratedTask =
    activeCapability?.kind === "curated_task" ? activeCapability.task : null;
  const activeCuratedTaskReferenceEntries =
    activeCapability?.kind === "curated_task"
      ? activeCapability.referenceEntries
      : undefined;
  const activeSkill =
    activeCapability?.kind === "installed_skill"
      ? activeCapability.skill
      : fallbackActiveSkill;

  return {
    activeBuiltinCommand,
    activeRuntimeScene,
    activeCuratedTask,
    activeCuratedTaskReferenceEntries,
    activeSkill,
  };
}
