import type { Skill } from "@/lib/api/skills";
import { skillDisplayName } from "./skillDisplayName";

export function isSkillPromptLink(href: string, label: string): boolean {
  return (
    label.trim().startsWith("$") &&
    Boolean(href.trim()) &&
    ![...href].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    }) &&
    !href.startsWith("//") &&
    (!/^[a-z][a-z\d+.-]*:/i.test(href) || /^[a-z]:[\\/]/i.test(href))
  );
}

function normalizePath(path: string): string {
  return path
    .replace(/^\\\\\?\\UNC\\/i, "\\\\")
    .replace(/^\\\\\?\\(?=[a-z]:[\\/])/i, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function skillDefinitionPath(skill: Skill): string | null {
  const directory = skill.localDirectoryPath?.replace(/[\\/]+$/, "");
  if (!directory) return null;
  return /(?:^|[\\/])SKILL\.md$/i.test(directory)
    ? directory
    : `${directory}/SKILL.md`;
}

export function resolveSkillPromptLink(
  label: string,
  href: string | null,
  skills: readonly Skill[],
) {
  const stripped = label.trim().replace(/^[$@]/, "");
  const queryIndex = stripped.indexOf("?");
  const params = new URLSearchParams(
    queryIndex < 0 ? "" : stripped.slice(queryIndex + 1),
  );
  const hasMetadata = params.has("label") || params.has("icon");
  const name = hasMetadata ? stripped.slice(0, queryIndex).trim() : stripped;
  const displayLabel = hasMetadata ? params.get("label")?.trim() : null;
  const path = href === null ? null : normalizePath(href);
  const matches = skills.filter((skill) => {
    if (!skill.installed) return false;
    if (path === null)
      return skill.name === name || skillDisplayName(skill) === name;
    const definition = skillDefinitionPath(skill);
    return definition !== null && normalizePath(definition) === path;
  });
  const skill = matches.length === 1 ? matches[0] : null;
  return {
    skill,
    displayLabel:
      displayLabel || (skill ? skillDisplayName(skill) : `$${name}`),
    tooltip: skill?.description || href || label,
    path: skill ? skillDefinitionPath(skill) : null,
  };
}

export function isAbsoluteSkillDefinition(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return (
    /(?:^|\/)SKILL\.md$/i.test(normalized) &&
    ((normalized.startsWith("/") && !normalized.startsWith("//")) ||
      /^[a-z]:\//i.test(normalized) ||
      normalized.startsWith("//"))
  );
}
