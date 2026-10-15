import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { WorkspaceProjectSelectionSource } from "../hooks/useWorkspaceProjectSelection";
import type { useWorkspaceComposerDraftRuntime } from "./useWorkspaceComposerDraftRuntime";

type ComposerDraftRuntime = Pick<
  ReturnType<typeof useWorkspaceComposerDraftRuntime>,
  | "composerDraftCoordinator"
  | "prepareComposerDraftNavigation"
  | "commitComposerDraftScope"
  | "getComposerDraftNavigationEpoch"
  | "getComposerDraftTarget"
  | "commitNewConversationRequest"
>;

interface WorkspaceComposerDraftNavigationParams {
  newConversationRequest?: import("@/lib/workspace/navigation").NewConversationRequest;
  composerDraftRuntime: ComposerDraftRuntime;
  workspaceId: string | null;
  projectSelectionSource: WorkspaceProjectSelectionSource;
  normalizedInitialSessionId: string | null;
  sessionId?: string | null;
  onTopicSwitchCommitted: (topicId: string) => void;
}

/** Workspace navigation commits scopes; the root runtime alone binds documents. */
export function useWorkspaceComposerDraftNavigation({
  newConversationRequest,
  composerDraftRuntime: {
    composerDraftCoordinator,
    prepareComposerDraftNavigation,
    commitComposerDraftScope,
    getComposerDraftNavigationEpoch,
    getComposerDraftTarget,
    commitNewConversationRequest,
  },
  workspaceId,
  projectSelectionSource,
  normalizedInitialSessionId,
  sessionId,
  onTopicSwitchCommitted,
}: WorkspaceComposerDraftNavigationParams) {
  const processedRequest = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (
      !newConversationRequest ||
      normalizedInitialSessionId ||
      workspaceId !== newConversationRequest.workspaceId ||
      processedRequest.current === newConversationRequest.id
    )
      return;
    processedRequest.current = newConversationRequest.id;
    onTopicSwitchCommitted("");
    commitNewConversationRequest(newConversationRequest);
  }, [
    newConversationRequest,
    normalizedInitialSessionId,
    workspaceId,
    onTopicSwitchCommitted,
    commitNewConversationRequest,
  ]);
  const previousWorkspace = useRef(workspaceId);
  useLayoutEffect(() => {
    if (previousWorkspace.current === workspaceId || !composerDraftCoordinator)
      return;
    previousWorkspace.current = workspaceId;
    // A same-event draft activation or acceptance has already chosen its target.
    if (
      getComposerDraftTarget()?.workspaceId === workspaceId ||
      projectSelectionSource === "topic-switch" ||
      normalizedInitialSessionId
    )
      return;
    prepareComposerDraftNavigation();
    onTopicSwitchCommitted("");
    commitComposerDraftScope({
      workspaceId,
      kind: "home",
      id: "new-conversation",
    });
  }, [
    workspaceId,
    projectSelectionSource,
    normalizedInitialSessionId,
    composerDraftCoordinator,
    getComposerDraftTarget,
    prepareComposerDraftNavigation,
    commitComposerDraftScope,
    onTopicSwitchCommitted,
  ]);

  const [pendingTopic, setPendingTopic] = useState<{
    id: string;
    workspaceId: string | null;
    epoch: number;
  } | null>(null);
  const handleTopicSwitchCommitted = useCallback(
    (
      topicId: string,
      targetWorkspaceId: string | null,
      capturedEpoch?: number,
    ) => {
      const epoch = capturedEpoch ?? getComposerDraftNavigationEpoch();
      if (getComposerDraftNavigationEpoch() !== epoch) return;
      setPendingTopic({ id: topicId, workspaceId: targetWorkspaceId, epoch });
    },
    [getComposerDraftNavigationEpoch],
  );
  useEffect(() => {
    if (!pendingTopic) return;
    if (getComposerDraftNavigationEpoch() !== pendingTopic.epoch) {
      setPendingTopic(null);
      return;
    }
    if (
      sessionId !== pendingTopic.id ||
      workspaceId !== pendingTopic.workspaceId
    )
      return;
    onTopicSwitchCommitted(pendingTopic.id);
    commitComposerDraftScope({
      workspaceId: pendingTopic.workspaceId,
      kind: "local",
      id: pendingTopic.id,
    });
    setPendingTopic(null);
  }, [
    pendingTopic,
    sessionId,
    workspaceId,
    onTopicSwitchCommitted,
    commitComposerDraftScope,
    getComposerDraftNavigationEpoch,
  ]);

  return { handleTopicSwitchCommitted };
}
