import {
  isOnlyRuntimeAttachmentPlaceholderText,
  resolveRuntimeAttachmentTaskDisplayName,
} from "../utils/runtimeAttachmentPlaceholder";
import { isAssistantRuntimeErrorDisplayText } from "../utils/messageDisplaySanitizer";

export function resolveThreadTitle(
  value: string | null | undefined,
  fallbackTitle: string,
): string {
  const title = value?.trim() || "";
  if (
    isAssistantRuntimeErrorDisplayText(title, {
      allowTruncatedTitle: true,
    })
  ) {
    return fallbackTitle;
  }

  const attachmentTitle = isOnlyRuntimeAttachmentPlaceholderText(title)
    ? resolveRuntimeAttachmentTaskDisplayName(title)
    : null;
  return attachmentTitle || title || fallbackTitle;
}
