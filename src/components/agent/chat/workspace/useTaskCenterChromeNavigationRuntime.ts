import type {
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from "react";
import type { Topic } from "../hooks/agentChatShared";
import type { TaskCenterDraftSendRequest } from "../homePendingPreview";
import type { OpenedProjectSummary } from "../hooks/useOpenedProjectSummaries";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import type { TaskCenterHomeSurfaceState } from "./agentChatWorkspaceHelpers";
import { useTaskCenterConversationNavigationRuntime } from "./useTaskCenterConversationNavigationRuntime";
import { useTaskCenterFallbackRestoreRuntime } from "./useTaskCenterFallbackRestoreRuntime";
import { useTaskCenterHomeChromeRuntime } from "./useTaskCenterHomeChromeRuntime";
import { useTaskCenterTabChrome } from "./useTaskCenterTabChrome";

interface TaskCenterFallbackRestoreState {
  topicId: string;
  startedAt: number;
}

interface OpenTaskTopicOptions {
  preferResume?: boolean;
  forceRefresh?: boolean;
  replaceOpenTabs?: boolean;
}

interface UseTaskCenterChromeNavigationRuntimeParams {
  agentEntry: "new-task" | "claw";
  activeTheme: string;
  onStartNewConversation?: import("@/lib/workspace/navigation").StartNewConversation;
  clearEmbeddedHomeSession: (sessionId: string) => void;
  detachedTopicId: string | null;
  draftSendRequest: TaskCenterDraftSendRequest | null;
  draftSurfaceActive: boolean;
  embeddedHomeSessionIds: ReadonlySet<string>;
  fallbackRestoreRef: MutableRefObject<TaskCenterFallbackRestoreState | null>;
  hasDisplayMessages: boolean;
  hasLocalSessionOverride: boolean;
  hasPendingA2UIForm: boolean;
  homeMountedAt: number;
  initialDispatchKey: string | null;
  initialSessionName?: string | null;
  initialPendingServiceSkillLaunchSignature?: string | null;
  isAutoRestoringSession: boolean;
  isBootstrapDispatchPending: boolean;
  isHomeSessionBackgroundRecovery: boolean;
  isHomePendingPreviewActive: boolean;
  isHomeSendStarting?: boolean;
  isPreparingSend: boolean;
  isSending: boolean;
  isSessionHydrating: boolean;
  isTaskCenterDraftSurfaceActive: boolean;
  layoutMode: LayoutMode;
  messagesLength: number;
  newChatAt?: number;
  newConversationLabel: string;
  normalizedInitialSessionId?: string | null;
  onCloseTaskCenterTab: (topicId: string) => void;
  onOpenTaskTopic: (
    topicId: string,
    options?: OpenTaskTopicOptions,
  ) => void | Promise<void>;
  onSwitchTaskTopic: (topicId: string) => void | Promise<void>;
  onToggleWorkbench: () => void;
  openTabIds: string[];
  openedProjects: OpenedProjectSummary[];
  projectId?: string | null;
  queuedTurnsLength: number;
  renamePromptLabel: string;
  renameTopic: (topicId: string, title: string) => void | Promise<void>;
  sessionId?: string | null;
  setHarnessPanelVisible: Dispatch<SetStateAction<boolean>>;
  shouldSuppressDraftContent: boolean;
  shouldUseBrowserWorkspaceHomeChrome: boolean;
  taskCenterWorkspaceId?: string | null;
  threadItemCount: number;
  topicById: ReadonlyMap<string, Topic>;
  topics: Topic[];
  transitionTopicId: string | null;
  untitledTaskLabel: string;
  harnessPanelVisible: boolean;
  displayMessageCount: number;
}

interface TaskCenterChromeNavigationRuntime {
  browserWorkspaceHomeTabsNode: ReactNode;
  handleOpenProjectConversation: (
    topicId: string,
    statusReason?: string,
  ) => void;
  handleOpenTaskCenterNewTaskPage: () => void;
  handleResumeRecentSession: () => void;
  hasHomeConversationActivity: boolean;
  projectConversationGroups: ReturnType<
    typeof useTaskCenterConversationNavigationRuntime
  >["projectConversationGroups"];
  recentSessionActionLabel: string;
  recentSessionTopic: Topic | null;
  shouldHideDetachedTaskCenterTabs: boolean;
  isTaskCenterDraftSendPending: boolean;
  shouldRenderTaskCenterEmbeddedHome: boolean;
  shouldRenderTaskCenterTabStrip: boolean;
  suppressHomeNavbarUtilityActions: boolean;
  taskCenterHomeSurfaceState: TaskCenterHomeSurfaceState;
  taskCenterTabsNode: ReactNode;
  taskCenterVisibleTabIds: string[];
}

export function useTaskCenterChromeNavigationRuntime({
  agentEntry,
  activeTheme,
  onStartNewConversation,
  clearEmbeddedHomeSession,
  detachedTopicId,
  displayMessageCount,
  draftSendRequest,
  draftSurfaceActive,
  embeddedHomeSessionIds,
  fallbackRestoreRef,
  hasDisplayMessages,
  hasLocalSessionOverride,
  hasPendingA2UIForm,
  harnessPanelVisible,
  homeMountedAt,
  initialDispatchKey,
  initialSessionName,
  initialPendingServiceSkillLaunchSignature,
  isAutoRestoringSession,
  isBootstrapDispatchPending,
  isHomeSessionBackgroundRecovery,
  isHomePendingPreviewActive,
  isHomeSendStarting = false,
  isPreparingSend,
  isSending,
  isSessionHydrating,
  isTaskCenterDraftSurfaceActive,
  layoutMode,
  messagesLength,
  newChatAt,
  newConversationLabel,
  normalizedInitialSessionId,
  onCloseTaskCenterTab,
  onOpenTaskTopic,
  onSwitchTaskTopic,
  onToggleWorkbench,
  openTabIds,
  openedProjects,
  projectId,
  queuedTurnsLength,
  renamePromptLabel,
  renameTopic,
  sessionId,
  setHarnessPanelVisible,
  shouldSuppressDraftContent,
  shouldUseBrowserWorkspaceHomeChrome,
  taskCenterWorkspaceId,
  threadItemCount,
  topicById,
  topics,
  transitionTopicId,
  untitledTaskLabel,
}: UseTaskCenterChromeNavigationRuntimeParams): TaskCenterChromeNavigationRuntime {
  const {
    handleRenameTaskTopic,
    taskCenterPreviewTopicId,
    hasHomeConversationActivity,
    taskCenterHomeSurfaceState,
    isTaskCenterDraftSendPending,
    shouldRenderTaskCenterEmbeddedHome,
    suppressHomeNavbarUtilityActions,
  } = useTaskCenterHomeChromeRuntime({
    agentEntry,
    sessionId,
    detachedTopicId,
    transitionTopicId,
    topicById,
    untitledTaskLabel,
    renamePromptLabel,
    renameTopic,
    draftSurfaceActive: isTaskCenterDraftSurfaceActive,
    shouldSuppressDraftContent,
    draftSendRequest,
    normalizedInitialSessionId,
    isHomeSessionBackgroundRecovery,
    displayMessageCount,
    threadItemCount,
    hasPendingA2UIForm,
    isPreparingSend,
    isSending,
    isHomePendingPreviewActive,
    isHomeSendStarting,
    queuedTurnCount: queuedTurnsLength,
    hasLocalSessionOverride,
    embeddedHomeSessionIds,
    isAutoRestoringSession,
    isSessionHydrating,
    shouldUseBrowserWorkspaceHomeChrome,
    harnessPanelVisible,
    setHarnessPanelVisible,
    clearEmbeddedHomeSession,
  });

  const {
    recentSessionTopic,
    recentSessionActionLabel,
    handleResumeRecentSession,
    projectConversationGroups,
    handleOpenProjectConversation,
  } = useTaskCenterConversationNavigationRuntime({
    topics,
    sessionId,
    projectId,
    openedProjects,
    onOpenTaskTopic,
  });

  const handleOpenTaskCenterNewTaskPage = () => {
    onStartNewConversation?.({
      projectId: taskCenterWorkspaceId ?? null,
      freshDraft: true,
    });
  };

  const {
    shouldHideDetachedTaskCenterTabs,
    taskCenterVisibleTabIds,
    shouldRenderTaskCenterTabStrip,
    taskCenterTabsNode,
    browserWorkspaceHomeTabsNode,
  } = useTaskCenterTabChrome({
    agentEntry,
    activeTheme,
    sessionId,
    normalizedInitialSessionId,
    initialSessionName,
    detachedTopicId,
    openTabIds,
    topics,
    previewTopicId: taskCenterPreviewTopicId,
    hasLocalSessionOverride,
    topicById,
    untitledTaskLabel,
    shouldUseBrowserWorkspaceHomeChrome,
    newConversationLabel,
    newChatAt,
    homeMountedAt,
    layoutMode,
    onSwitchTaskTopic,
    onRenameTaskTopic: handleRenameTaskTopic,
    onCloseTaskCenterTab,
    onOpenTaskCenterNewTaskPage: handleOpenTaskCenterNewTaskPage,
    onToggleWorkbench,
  });

  useTaskCenterFallbackRestoreRuntime({
    agentEntry,
    workspaceId: taskCenterWorkspaceId,
    isAutoRestoringSession,
    isSessionHydrating,
    draftSurfaceActive,
    initialPendingServiceSkillLaunchSignature,
    initialDispatchKey,
    isBootstrapDispatchPending,
    isHomeSessionBackgroundRecovery,
    messagesLength,
    isSending,
    queuedTurnsLength,
    shouldHideDetachedTaskCenterTabs,
    normalizedInitialSessionId,
    sessionId,
    currentSessionIsKnownTopic: Boolean(sessionId && topicById.has(sessionId)),
    hasDisplayMessages,
    switchingTopicId: transitionTopicId,
    detachedTopicId,
    openTabIds,
    visibleTabIds: taskCenterVisibleTabIds,
    topics,
    fallbackRestoreRef,
    onOpenTaskTopic,
  });

  return {
    browserWorkspaceHomeTabsNode,
    handleOpenProjectConversation,
    handleOpenTaskCenterNewTaskPage,
    handleResumeRecentSession,
    hasHomeConversationActivity,
    projectConversationGroups,
    recentSessionActionLabel,
    recentSessionTopic,
    shouldHideDetachedTaskCenterTabs,
    isTaskCenterDraftSendPending,
    shouldRenderTaskCenterEmbeddedHome,
    shouldRenderTaskCenterTabStrip,
    suppressHomeNavbarUtilityActions,
    taskCenterHomeSurfaceState,
    taskCenterTabsNode,
    taskCenterVisibleTabIds,
  };
}
