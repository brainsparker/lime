import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { DEFAULT_CANVAS_STATE } from "@/components/general-chat/bridge";
import type {
  CreationMode,
  LayoutMode,
  ThemeType,
} from "@/lib/workspace/workbenchContract";
import type { CanvasStateUnion } from "@/components/workspace/canvas/canvasUtils";
import type { TaskFile } from "../components/TaskFiles";
import type { Character } from "@/lib/api/projectMemory";
import type { Page, PageParams } from "@/types/page";
import type { ComposerDraftCoordinator } from "@/components/input-kit/ComposerDraftCoordinator";
import type { DraftScope } from "@/lib/api/persistedAtomTypes";
import type { EntryPendingResetOptions } from "./useWorkspacePendingInputRuntime";

type SetStringState = Dispatch<SetStateAction<string>>;

interface ClearMessagesOptions {
  showToast?: boolean;
}

interface UseWorkspaceResetRuntimeParams {
  clearMessages: (options?: ClearMessagesOptions) => void;
  clearPendingEntryA2UI?: (options?: EntryPendingResetOptions) => void;
  clearProjectSelectionRuntime: () => void;
  resetProjectSelection: () => void;
  resetRestoredSessionState: () => void;
  resetGuideState: () => void;
  resetComposerDraft?: () => void;
  composerDraftCoordinator?: ComposerDraftCoordinator;
  composerDraftEnabled?: boolean;
  onComposerDraftScopeCommitted?: (scope: DraftScope) => void;
  composerDraftHomeWorkspaceId?: string | null;
  hasHandledNewChatRequest: (requestKey: string) => boolean;
  markNewChatRequestHandled: (requestKey: string) => void;
  defaultTopicSidebarVisible: boolean;
  normalizedInitialTheme: ThemeType;
  initialCreationMode?: CreationMode;
  newChatAt?: number;
  externalProjectId?: string | null;
  preserveSessionRestoreOnNewChat?: boolean;
  onNavigate?: (page: Page, params?: PageParams) => void;
  onStartNewConversation?: import("@/lib/workspace/navigation").StartNewConversation;
  newConversationRequest?: import("@/lib/workspace/navigation").NewConversationRequest;
  autoCollapsedTopicSidebarRef: MutableRefObject<boolean>;
  processedMessageIdsRef: MutableRefObject<Set<string>>;
  setInput: SetStringState;
  setSelectedText: SetStringState;
  setLayoutMode: Dispatch<SetStateAction<LayoutMode>>;
  setShowSidebar: Dispatch<SetStateAction<boolean>>;
  setCanvasState: Dispatch<SetStateAction<CanvasStateUnion | null>>;
  setGeneralCanvasState: Dispatch<SetStateAction<typeof DEFAULT_CANVAS_STATE>>;
  setTaskFiles: Dispatch<SetStateAction<TaskFile[]>>;
  setSelectedFileId: Dispatch<SetStateAction<string | undefined>>;
  setMentionedCharacters: Dispatch<SetStateAction<Character[]>>;
  setActiveTheme: Dispatch<SetStateAction<string>>;
  setCreationMode: Dispatch<SetStateAction<CreationMode>>;
}

export function useWorkspaceResetRuntime({
  clearMessages,
  clearPendingEntryA2UI,
  clearProjectSelectionRuntime,
  resetProjectSelection,
  resetRestoredSessionState,
  resetGuideState,
  resetComposerDraft,
  composerDraftCoordinator,
  composerDraftEnabled = false,
  onComposerDraftScopeCommitted,
  composerDraftHomeWorkspaceId,
  hasHandledNewChatRequest,
  markNewChatRequestHandled,
  defaultTopicSidebarVisible,
  normalizedInitialTheme,
  initialCreationMode,
  newChatAt,
  externalProjectId,
  preserveSessionRestoreOnNewChat = false,
  onStartNewConversation,
  newConversationRequest,
  autoCollapsedTopicSidebarRef,
  processedMessageIdsRef,
  setInput,
  setSelectedText,
  setLayoutMode,
  setShowSidebar,
  setCanvasState,
  setGeneralCanvasState,
  setTaskFiles,
  setSelectedFileId,
  setMentionedCharacters,
  setActiveTheme,
  setCreationMode,
}: UseWorkspaceResetRuntimeParams) {
  const resetWorkbenchSurface = useCallback(() => {
    setLayoutMode("chat");
    setCanvasState(null);
    setGeneralCanvasState(DEFAULT_CANVAS_STATE);
    setTaskFiles([]);
    setSelectedFileId(undefined);
    processedMessageIdsRef.current.clear();
  }, [
    processedMessageIdsRef,
    setCanvasState,
    setGeneralCanvasState,
    setLayoutMode,
    setSelectedFileId,
    setTaskFiles,
  ]);

  const resetTopicLocalState = useCallback(() => {
    resetWorkbenchSurface();
    clearPendingEntryA2UI?.();
    resetRestoredSessionState();
    resetGuideState();
  }, [
    clearPendingEntryA2UI,
    resetGuideState,
    resetRestoredSessionState,
    resetWorkbenchSurface,
  ]);

  const handleBackHome = useCallback(() => {
    onStartNewConversation?.({
      projectId: composerDraftHomeWorkspaceId ?? null,
      freshDraft: false,
    });
  }, [composerDraftHomeWorkspaceId, onStartNewConversation]);

  useEffect(() => {
    if (!newChatAt) {
      return;
    }
    if (composerDraftEnabled && !composerDraftCoordinator) return;

    const requestKey = String(newChatAt);
    if (hasHandledNewChatRequest(requestKey)) {
      return;
    }
    markNewChatRequestHandled(requestKey);

    if (preserveSessionRestoreOnNewChat) {
      return;
    }

    if (composerDraftCoordinator && !newConversationRequest) {
      composerDraftCoordinator.prepareNavigation();
      onComposerDraftScopeCommitted?.({
        workspaceId: composerDraftHomeWorkspaceId ?? null,
        kind: "home",
        id: "new-conversation",
      });
    } else if (!composerDraftCoordinator) resetComposerDraft?.();
    clearMessages({
      showToast: false,
    });
    if (!composerDraftCoordinator) setInput("");
    setSelectedText("");
    autoCollapsedTopicSidebarRef.current = false;
    setShowSidebar(defaultTopicSidebarVisible);
    resetWorkbenchSurface();
    clearPendingEntryA2UI?.({ preserveInitialServiceSkillLaunch: true });
    setMentionedCharacters([]);
    clearProjectSelectionRuntime();
    if (!externalProjectId) {
      resetProjectSelection();
    }
    resetRestoredSessionState();
    resetGuideState();

    if (!externalProjectId) {
      setActiveTheme(normalizedInitialTheme);
      setCreationMode(initialCreationMode ?? "guided");
    }
  }, [
    autoCollapsedTopicSidebarRef,
    clearMessages,
    clearPendingEntryA2UI,
    clearProjectSelectionRuntime,
    defaultTopicSidebarVisible,
    externalProjectId,
    hasHandledNewChatRequest,
    initialCreationMode,
    markNewChatRequestHandled,
    newChatAt,
    newConversationRequest,
    normalizedInitialTheme,
    preserveSessionRestoreOnNewChat,
    resetComposerDraft,
    composerDraftCoordinator,
    composerDraftEnabled,
    composerDraftHomeWorkspaceId,
    onComposerDraftScopeCommitted,
    resetGuideState,
    resetProjectSelection,
    resetRestoredSessionState,
    resetWorkbenchSurface,
    setActiveTheme,
    setCreationMode,
    setInput,
    setMentionedCharacters,
    setSelectedText,
    setShowSidebar,
  ]);

  return {
    handleBackHome,
    resetTopicLocalState,
  };
}
