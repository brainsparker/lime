import type { AgentThreadItem } from "@/lib/api/agentProtocol";
import { resolveTimelineArtifactNavigation } from "../utils/artifactTimelineNavigation";
import { resolveSearchResultPreviewItemsFromText } from "../utils/searchResultPreview";

/** Derived only from canonical items; no runtime state or installed-tool inventory. */
export function selectThreadSummary(items: readonly AgentThreadItem[]) {
  const plan = [...items]
    .reverse()
    .find((item) => item.type === "plan" && item.text.trim());
  const outputs = new Map<
    string,
    NonNullable<ReturnType<typeof resolveTimelineArtifactNavigation>>
  >();
  const sources = new Map<
    string,
    ReturnType<typeof resolveSearchResultPreviewItemsFromText>[number]
  >();
  for (const item of items) {
    if (item.type === "file_artifact") {
      const navigation = resolveTimelineArtifactNavigation(item);
      if (navigation) outputs.set(navigation.rootTarget.filePath, navigation);
    }
    if (item.type === "web_search") {
      const text = item.results?.length
        ? JSON.stringify({ results: item.results })
        : item.output;
      for (const source of resolveSearchResultPreviewItemsFromText(text))
        sources.set(source.url, source);
    }
  }
  return {
    plan: plan?.type === "plan" ? plan : null,
    outputs: [...outputs.values()],
    sources: [...sources.values()],
  };
}
