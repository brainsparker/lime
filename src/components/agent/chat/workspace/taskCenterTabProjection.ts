import type { Topic } from "../hooks/agentChatShared";
import type { TaskCenterTabItem } from "../components/TaskCenterTabStrip";
import {
  isOnlyRuntimeAttachmentPlaceholderText,
  resolveRuntimeAttachmentTaskDisplayName,
} from "../utils/runtimeAttachmentPlaceholder";
import { isAssistantRuntimeErrorDisplayText } from "../utils/messageDisplaySanitizer";
import { MAX_TASK_CENTER_OPEN_TABS } from "../utils/taskCenterTabs";

export const TASK_CENTER_HOME_TAB_ID = "new-task-home";

interface BuildTaskCenterTabItemsParams {
  sessionId?: string | null;
  initialSessionId?: string | null;
  initialSessionName?: string | null;
  previewTopicId: string | null;
  visibleTabIds: string[];
  topicById: ReadonlyMap<string, Topic>;
  untitledTaskLabel: string;
  maxCount?: number;
}

interface BuildBrowserWorkspaceHomeTabItemParams {
  title: string;
  updatedAtMs: number;
}

interface ShouldRenderTaskCenterTabStripParams {
  agentEntry: "claw" | "new-task";
  hasLocalSessionOverride: boolean;
  tabItemCount: number;
}

function resolveTopicUpdatedAt(topic: Topic): Date {
  return topic.updatedAt instanceof Date
    ? topic.updatedAt
    : new Date(topic.updatedAt ?? topic.createdAt ?? Date.now());
}

export function resolveTaskCenterTopicTitle(
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

export function buildTaskCenterTabItems({
  sessionId,
  initialSessionId,
  initialSessionName,
  previewTopicId,
  visibleTabIds,
  topicById,
  untitledTaskLabel,
  maxCount = MAX_TASK_CENTER_OPEN_TABS,
}: BuildTaskCenterTabItemsParams): TaskCenterTabItem[] {
  const topicItems = visibleTabIds
    .map((topicId) => topicById.get(topicId))
    .filter((topic): topic is Topic => Boolean(topic))
    .map((topic) => {
      const initialTitleFallback =
        topic.id === initialSessionId ? initialSessionName?.trim() : null;
      return {
        id: topic.id,
        title: resolveTaskCenterTopicTitle(
          topic.title,
          initialTitleFallback || untitledTaskLabel,
        ),
        status: topic.status ?? "done",
        updatedAt: resolveTopicUpdatedAt(topic),
        isActive: topic.id === (previewTopicId ?? sessionId),
        hasUnread: Boolean(topic.hasUnread),
        renamable: true,
      };
    });

  return topicItems.slice(0, maxCount);
}

export function buildBrowserWorkspaceHomeTabItem({
  title,
  updatedAtMs,
}: BuildBrowserWorkspaceHomeTabItemParams): TaskCenterTabItem {
  return {
    id: TASK_CENTER_HOME_TAB_ID,
    title,
    status: "draft",
    updatedAt: new Date(updatedAtMs),
    isActive: true,
    hasUnread: false,
    renamable: false,
    closable: false,
  };
}

export function shouldRenderTaskCenterTabStrip({
  agentEntry,
  hasLocalSessionOverride,
  tabItemCount,
}: ShouldRenderTaskCenterTabStripParams): boolean {
  return (
    agentEntry === "claw" ||
    (agentEntry === "new-task" && (hasLocalSessionOverride || tabItemCount > 0))
  );
}
