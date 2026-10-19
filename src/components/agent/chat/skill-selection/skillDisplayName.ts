import type { Skill } from "@/lib/api/skills";

const acronyms = new Set([
  "GH",
  "IA",
  "MCP",
  "API",
  "CI",
  "CLI",
  "LLM",
  "PDF",
  "PR",
  "RCS",
  "UI",
  "URL",
  "SQL",
  "TW",
  "GPU",
  "CPU",
]);
const names = new Map([
  ["openai", "OpenAI"],
  ["openaideveloperdocs", "OpenAI Developer Docs"],
  ["openapi", "OpenAPI"],
  ["github", "GitHub"],
  ["imessage", "iMessage"],
  ["pagerduty", "PagerDuty"],
  ["datadog", "DataDog"],
  ["sharepoint", "SharePoint"],
  ["sqlite", "SQLite"],
  ["fastapi", "FastAPI"],
]);
const conjunctions = new Set(["and", "or", "to", "up", "with"]);

function displayWord(word: string, index: number): string {
  const upper = word.toUpperCase();
  if (acronyms.has(upper)) return upper;
  if (word.toLowerCase().endsWith("s") && acronyms.has(upper.slice(0, -1)))
    return `${upper.slice(0, -1)}s`;
  const lower = word.toLowerCase();
  return (
    names.get(lower) ??
    (index > 0 && conjunctions.has(lower)
      ? lower
      : `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`)
  );
}

export function skillDisplayName(
  skill: Pick<Skill, "name" | "displayName">,
): string {
  return (
    skill.displayName?.trim() ||
    skill.name
      .split(":")
      .map((part) =>
        part
          .replace(/[_-]+/g, " ")
          .split(/\s+/)
          .filter(Boolean)
          .map(displayWord)
          .join(" "),
      )
      .join(": ")
  );
}
