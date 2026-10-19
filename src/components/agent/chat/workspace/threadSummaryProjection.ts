import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { resolveTimelineArtifactNavigation } from "../utils/artifactTimelineNavigation";

function hasWebSearchSource(item: AgentThreadItem): boolean {
  if (item.type !== "web_search") return false;
  const action =
    item.action_data &&
    typeof item.action_data === "object" &&
    !Array.isArray(item.action_data)
      ? (item.action_data as Record<string, unknown>)
      : null;
  const hasQuery = (query: unknown) =>
    typeof query === "string" && query.trim().length > 0;
  if (!action) return hasQuery(item.query);
  if (action.type === "search") {
    const queries =
      Array.isArray(action.queries) && action.queries.length
        ? action.queries
        : [action.query];
    return queries.some(hasQuery);
  }
  if (action.type === "openPage" || action.type === "findInPage") {
    if (typeof action.url !== "string") return false;
    try {
      const url = new URL(action.url);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }
  return hasQuery(item.query);
}

/** Derived only from canonical items; no runtime state or installed-tool inventory. */
export function selectThreadSummary(items: readonly AgentThreadItem[]) {
  const plan = [...items]
    .reverse()
    .find((item) => item.type === "plan" && item.text.trim());
  const outputs = new Map<
    string,
    NonNullable<ReturnType<typeof resolveTimelineArtifactNavigation>>
  >();
  for (const item of items) {
    if (item.type === "file_artifact") {
      const navigation = resolveTimelineArtifactNavigation(item);
      if (navigation) outputs.set(navigation.rootTarget.filePath, navigation);
    }
  }
  return {
    plan: plan?.type === "plan" ? plan : null,
    outputs: [...outputs.values()],
    hasWebSearch: items.some(hasWebSearchSource),
  };
}
