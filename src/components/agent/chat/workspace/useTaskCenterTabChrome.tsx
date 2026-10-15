import { useMemo } from "react";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import type { Topic } from "../hooks/agentChatShared";
import { TaskCenterTabStrip } from "../components/TaskCenterTabStrip";
import type { AgentChatWorkspaceProps } from "../agentChatWorkspaceContract";
import {
  resolveTaskCenterVisibleTabIds,
  shouldHideTaskCenterTabsForDetachedSession,
} from "../utils/taskCenterTabs";
import {
  buildBrowserWorkspaceHomeTabItem,
  buildTaskCenterTabItems,
  shouldRenderTaskCenterTabStrip,
} from "./taskCenterTabProjection";

type AgentEntry = NonNullable<AgentChatWorkspaceProps["agentEntry"]>;

interface UseTaskCenterTabChromeParams {
  agentEntry: AgentEntry;
  activeTheme: string;
  sessionId?: string | null;
  normalizedInitialSessionId?: string | null;
  initialSessionName?: string | null;
  detachedTopicId?: string | null;
  openTabIds: string[];
  topics: Topic[];
  previewTopicId: string | null;
  hasLocalSessionOverride: boolean;
  topicById: ReadonlyMap<string, Topic>;
  untitledTaskLabel: string;
  shouldUseBrowserWorkspaceHomeChrome: boolean;
  newConversationLabel: string;
  newChatAt?: number;
  homeMountedAt: number;
  layoutMode: LayoutMode;
  onSwitchTaskTopic: (topicId: string) => void | Promise<void>;
  onRenameTaskTopic: (topicId: string) => void | Promise<void>;
  onCloseTaskCenterTab: (topicId: string) => void | Promise<void>;
  onOpenTaskCenterNewTaskPage: () => void;
  onToggleWorkbench: () => void;
}

export function useTaskCenterTabChrome({
  agentEntry,
  activeTheme,
  sessionId,
  normalizedInitialSessionId,
  initialSessionName,
  detachedTopicId,
  openTabIds,
  topics,
  previewTopicId,
  hasLocalSessionOverride,
  topicById,
  untitledTaskLabel,
  shouldUseBrowserWorkspaceHomeChrome,
  newConversationLabel,
  newChatAt,
  homeMountedAt,
  layoutMode,
  onSwitchTaskTopic,
  onRenameTaskTopic,
  onCloseTaskCenterTab,
  onOpenTaskCenterNewTaskPage,
  onToggleWorkbench,
}: UseTaskCenterTabChromeParams) {
  const shouldHideDetachedTabs = useMemo(
    () =>
      shouldHideTaskCenterTabsForDetachedSession({
        sessionId,
        initialSessionId: normalizedInitialSessionId,
        detachedTopicId,
        openTabIds,
      }),
    [detachedTopicId, normalizedInitialSessionId, openTabIds, sessionId],
  );
  const visibleTabIds = useMemo(
    () =>
      shouldHideDetachedTabs
        ? []
        : resolveTaskCenterVisibleTabIds({
            openTabIds,
            topics,
            currentTopicId: previewTopicId,
          }),
    [openTabIds, previewTopicId, shouldHideDetachedTabs, topics],
  );
  const tabItems = useMemo(
    () =>
      activeTheme === "general"
        ? []
        : buildTaskCenterTabItems({
            sessionId,
            initialSessionId: normalizedInitialSessionId,
            initialSessionName,
            previewTopicId,
            visibleTabIds,
            topicById,
            untitledTaskLabel,
          }),
    [
      activeTheme,
      initialSessionName,
      normalizedInitialSessionId,
      previewTopicId,
      sessionId,
      topicById,
      untitledTaskLabel,
      visibleTabIds,
    ],
  );
  const shouldRenderTabs =
    activeTheme !== "general" &&
    shouldRenderTaskCenterTabStrip({
      agentEntry,
      hasLocalSessionOverride,
      tabItemCount: tabItems.length,
    });
  const taskCenterTabsNode = useMemo(() => {
    if (!shouldRenderTabs) {
      return null;
    }

    return (
      <TaskCenterTabStrip
        items={tabItems}
        onSelectTask={(topicId) => {
          void onSwitchTaskTopic(topicId);
        }}
        onRenameTask={(topicId) => {
          void onRenameTaskTopic(topicId);
        }}
        onCloseTask={(topicId) => {
          void onCloseTaskCenterTab(topicId);
        }}
        onCreateTask={onOpenTaskCenterNewTaskPage}
        showWorkbenchToggle={false}
        workbenchVisible={layoutMode !== "chat"}
        onWorkbenchToggle={onToggleWorkbench}
        embedded
      />
    );
  }, [
    layoutMode,
    onCloseTaskCenterTab,
    onOpenTaskCenterNewTaskPage,
    onRenameTaskTopic,
    onSwitchTaskTopic,
    onToggleWorkbench,
    shouldRenderTabs,
    tabItems,
  ]);
  const browserWorkspaceHomeTabsNode = useMemo(() => {
    if (activeTheme === "general" || !shouldUseBrowserWorkspaceHomeChrome) {
      return null;
    }

    return (
      <TaskCenterTabStrip
        items={[
          buildBrowserWorkspaceHomeTabItem({
            title: newConversationLabel,
            updatedAtMs: newChatAt ?? homeMountedAt,
          }),
        ]}
        onSelectTask={() => undefined}
        onCloseTask={() => undefined}
        onCreateTask={onOpenTaskCenterNewTaskPage}
      />
    );
  }, [
    activeTheme,
    homeMountedAt,
    newChatAt,
    newConversationLabel,
    onOpenTaskCenterNewTaskPage,
    shouldUseBrowserWorkspaceHomeChrome,
  ]);

  return {
    shouldHideDetachedTaskCenterTabs: shouldHideDetachedTabs,
    taskCenterVisibleTabIds: visibleTabIds,
    shouldRenderTaskCenterTabStrip: shouldRenderTabs,
    taskCenterTabsNode,
    browserWorkspaceHomeTabsNode,
  };
}
