export interface InputbarPluginCapability {
  pluginId: string;
  displayName: string;
  description?: string;
  trigger?: string;
  defaultPrompts?: string[];
  disabled?: boolean;
  blockerCodes?: string[];
  skills?: InputbarPluginSkillCapability[];
}

export interface InputbarPluginSkillCapability {
  skillId: string;
  title: string;
  description?: string;
  trigger?: string;
  defaultPrompt?: string;
  disabled?: boolean;
  blockerCodes?: string[];
}

export interface InputbarPluginSelection {
  plugin: InputbarPluginCapability;
  skill?: InputbarPluginSkillCapability;
  trigger: string;
  text: string;
  preserveInput?: boolean;
}

export interface InputbarPluginSelectionOptions {
  inputOverride?: string;
  preserveInputOverride?: boolean;
}

export interface InputbarPluginMention {
  type: "mention";
  name: string;
  path: string;
}

export function resolveInputbarPluginDisplayName(
  plugin: Pick<InputbarPluginCapability, "displayName" | "pluginId">,
): string {
  return plugin.displayName.trim() || plugin.pluginId.trim();
}

export function buildInputbarPluginMention(
  plugin: Pick<InputbarPluginCapability, "displayName" | "pluginId">,
): InputbarPluginMention {
  const pluginId = plugin.pluginId.trim();
  if (!pluginId) {
    throw new Error(
      "pluginId is required to build a structured Plugin mention",
    );
  }
  return {
    type: "mention",
    name: resolveInputbarPluginDisplayName(plugin),
    path: `plugin://${pluginId}`,
  };
}

export function normalizeInputbarPluginTrigger(
  plugin: Pick<
    InputbarPluginCapability,
    "displayName" | "pluginId" | "trigger"
  >,
  skill?: Pick<InputbarPluginSkillCapability, "skillId" | "title" | "trigger">,
): string {
  const explicitSkillTrigger = skill?.trigger?.trim();
  if (explicitSkillTrigger) {
    return explicitSkillTrigger.startsWith("@")
      ? explicitSkillTrigger
      : `@${explicitSkillTrigger}`;
  }
  const explicitTrigger = plugin.trigger?.trim();
  if (explicitTrigger && !skill) {
    return explicitTrigger.startsWith("@")
      ? explicitTrigger
      : `@${explicitTrigger}`;
  }
  const displayName = resolveInputbarPluginDisplayName(plugin);
  const pluginTrigger = displayName ? `@${displayName}` : "@";
  const skillName = skill?.title.trim() || skill?.skillId.trim();

  return skillName ? `${pluginTrigger}:${skillName}` : pluginTrigger;
}

function normalizeInputbarPluginTriggerQuery(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  const withoutPrefix = normalized.startsWith("@")
    ? normalized.slice(1)
    : normalized;
  return withoutPrefix.toLowerCase();
}

export function isCompleteInputbarPluginTriggerQuery(params: {
  query: string;
  plugins: readonly InputbarPluginCapability[];
}): boolean {
  const normalizedQuery = normalizeInputbarPluginTriggerQuery(params.query);
  if (!normalizedQuery) {
    return false;
  }

  return params.plugins.some((plugin) => {
    if (
      normalizeInputbarPluginTriggerQuery(
        normalizeInputbarPluginTrigger(plugin),
      ) === normalizedQuery
    ) {
      return true;
    }

    return (plugin.skills ?? []).some(
      (skill) =>
        normalizeInputbarPluginTriggerQuery(
          normalizeInputbarPluginTrigger(plugin, skill),
        ) === normalizedQuery,
    );
  });
}
