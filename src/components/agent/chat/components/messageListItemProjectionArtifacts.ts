import {
  areArtifactProtocolPathsEquivalent,
  resolveArtifactProtocolFilePath,
} from "@/lib/artifact-protocol";
import { isArticleArtifactFrameArtifact } from "./articleArtifactProjection";
import { isHiddenConversationArtifactPath } from "../utils/internalArtifactVisibility";
import { resolveLatestProjectFileSavedSiteContentTargetFromMessage } from "../utils/latestSavedSiteContentTarget";
import {
  resolveSiteSavedContentTargetDisplayName,
  resolveSiteSavedContentTargetRelativePath,
} from "../utils/siteToolResultSummary";
import type { Message } from "../types";

interface ResolveMessageListItemArtifactProjectionParams {
  alreadyRenderedArtifactPaths: string[];
  canOpenSavedSiteContent: boolean;
  hasTrailingArtifactTimelineItems: boolean;
  message: Message;
  shouldSuppressImageProcessFlow: boolean;
}

export function resolveMessageListItemArtifactProjection({
  alreadyRenderedArtifactPaths,
  canOpenSavedSiteContent,
  hasTrailingArtifactTimelineItems,
  message,
  shouldSuppressImageProcessFlow,
}: ResolveMessageListItemArtifactProjectionParams) {
  const messageSavedSiteContentTarget =
    message.role === "assistant"
      ? resolveLatestProjectFileSavedSiteContentTargetFromMessage(message)
      : null;
  const visibleAssistantArtifacts =
    message.role === "assistant" && !shouldSuppressImageProcessFlow
      ? (message.artifacts || []).filter((artifact) => {
          const artifactPath = resolveArtifactProtocolFilePath(artifact);
          if (isHiddenConversationArtifactPath(artifactPath)) {
            return false;
          }

          return !alreadyRenderedArtifactPaths.some((renderedPath) =>
            areArtifactProtocolPathsEquivalent(artifactPath, renderedPath),
          );
        })
      : [];
  const hasArticleArtifactFrame = visibleAssistantArtifacts.some(
    isArticleArtifactFrameArtifact,
  );
  const shouldRenderMessageCanvasShortcut = Boolean(
    messageSavedSiteContentTarget &&
    canOpenSavedSiteContent &&
    !message.imageWorkbenchPreview &&
    !hasTrailingArtifactTimelineItems,
  );
  const messageCanvasShortcutTitle = messageSavedSiteContentTarget
    ? resolveSiteSavedContentTargetDisplayName(messageSavedSiteContentTarget) ||
      "导出稿"
    : "文件";
  const messageCanvasShortcutPath = messageSavedSiteContentTarget
    ? resolveSiteSavedContentTargetRelativePath(messageSavedSiteContentTarget)
    : null;

  return {
    hasArticleArtifactFrame,

    messageCanvasShortcutPath,
    messageCanvasShortcutTitle,
    messageSavedSiteContentTarget,
    shouldRenderMessageCanvasShortcut,
    visibleAssistantArtifacts,
  };
}
