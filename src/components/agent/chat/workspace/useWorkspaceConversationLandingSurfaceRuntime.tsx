import type { ComposerDraftCoordinator } from "@/components/input-kit/ComposerDraftCoordinator";
import type { ComposerDraftStatus as DraftStatus } from "@/components/input-kit/ComposerDraftCoordinator";
import { ComposerDraftStatus } from "./ComposerDraftStatus";
import {
  useCallback,
  useMemo,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ComposerController } from "@/components/input-kit/ComposerController";

import type { ThemeType } from "@/lib/workspace/workbenchContract";
import { EmptyState } from "../components/EmptyState";
import type { InputbarSendHandler } from "../components/Inputbar/inputbarSendPayload";
import type { InterruptedInputRestoreRequest } from "../hooks/agentStreamInputRestoreTypes";
import type { ChatToolPreferences } from "../utils/chatToolPreferences";
import type { CreationReplaySurfaceModel } from "../utils/creationReplaySurface";
import { buildWorkspaceEmptyStateProps } from "./chatSurfaceProps";

export interface WorkspaceConversationLandingSurfaceRuntime {
  composerDraftStatusNode?: ReactNode;
  entryBannerVisible: boolean;
  entryBannerMessage?: string;
  onDismissEntryBanner: () => void;
  creationReplaySurface?: CreationReplaySurfaceModel | null;
  serviceSkillExecutionCard?: ReactNode;
  emptyStateProps: ComponentProps<typeof EmptyState>;
}

interface UseWorkspaceConversationLandingSurfaceRuntimeParams {
  accessMode: ComponentProps<typeof EmptyState>["accessMode"];
  activeTheme: string;
  chatToolPreferences: ChatToolPreferences;
  creationReplaySurface?: CreationReplaySurfaceModel | null;
  emptyStateDisabled?: ComponentProps<typeof EmptyState>["disabled"];
  emptyStateIsLoading?: ComponentProps<typeof EmptyState>["isLoading"];
  emptyStateSendOnPointerDown?: ComponentProps<
    typeof EmptyState
  >["sendOnPointerDown"];
  entryBannerMessage?: string;
  entryBannerVisible: boolean;

  handleSendFromEmptyState: InputbarSendHandler;
  initialInputCapability?: ComponentProps<
    typeof EmptyState
  >["initialInputCapability"];
  input: ComponentProps<typeof EmptyState>["input"];
  composerController?: ComposerController;
  composerDraftCoordinator?: ComposerDraftCoordinator;
  composerDraftStatus?: DraftStatus | null;
  composerDraftRestoring?: boolean;
  onComposerDraftAccepted?: ComponentProps<
    typeof EmptyState
  >["onComposerDraftAccepted"];
  inputRestoreRequest?: InterruptedInputRestoreRequest | null;
  model: ComponentProps<typeof EmptyState>["model"];
  objectiveEnabled?: ComponentProps<typeof EmptyState>["objectiveEnabled"];
  onAddPathReferences?: ComponentProps<
    typeof EmptyState
  >["onAddPathReferences"];
  onClearPathReferences?: ComponentProps<
    typeof EmptyState
  >["onClearPathReferences"];
  onDismissEntryBanner: () => void;
  onInputRestoreRequestHandled?: ComponentProps<
    typeof EmptyState
  >["onInputRestoreRequestHandled"];
  onManageProviders?: ComponentProps<typeof EmptyState>["onManageProviders"];
  onObjectiveEnabledChange?: ComponentProps<
    typeof EmptyState
  >["onObjectiveEnabledChange"];
  onPluginSuggestionsNeeded?: ComponentProps<
    typeof EmptyState
  >["onPluginSuggestionsNeeded"];
  onProjectChange?: ComponentProps<typeof EmptyState>["onProjectContextChange"];
  onSkillSuggestionsNeeded?: ComponentProps<
    typeof EmptyState
  >["onSkillSuggestionsNeeded"];
  onRemovePathReference?: ComponentProps<
    typeof EmptyState
  >["onRemovePathReference"];
  onStopSending?: ComponentProps<typeof EmptyState>["onStop"];

  openedProjects?: ComponentProps<typeof EmptyState>["openedProjects"];
  pathReferences?: ComponentProps<typeof EmptyState>["pathReferences"];
  pluginSuggestions?: ComponentProps<typeof EmptyState>["pluginSuggestions"];
  pluginSuggestionsError?: ComponentProps<
    typeof EmptyState
  >["pluginSuggestionsError"];
  pluginSuggestionsLoading?: ComponentProps<
    typeof EmptyState
  >["pluginSuggestionsLoading"];
  projectId: string | null;
  providerType: ComponentProps<typeof EmptyState>["providerType"];
  reasoningEffort?: ComponentProps<typeof EmptyState>["reasoningEffort"];
  serviceSkillExecutionCard?: ReactNode;
  sessionId?: ComponentProps<typeof EmptyState>["sessionId"];
  setAccessMode?: ComponentProps<typeof EmptyState>["setAccessMode"];
  setChatToolPreferences: Dispatch<SetStateAction<ChatToolPreferences>>;
  setInput: ComponentProps<typeof EmptyState>["setInput"];
  setModel: ComponentProps<typeof EmptyState>["setModel"];
  setProviderType: ComponentProps<typeof EmptyState>["setProviderType"];
  setReasoningEffort?: ComponentProps<typeof EmptyState>["setReasoningEffort"];
  skills: NonNullable<ComponentProps<typeof EmptyState>["skills"]>;
  skillsLoading: boolean;
}

export function useWorkspaceConversationLandingSurfaceRuntime({
  accessMode,
  activeTheme,
  chatToolPreferences,
  creationReplaySurface,
  emptyStateDisabled = false,
  emptyStateIsLoading = false,
  emptyStateSendOnPointerDown = false,
  entryBannerMessage,
  entryBannerVisible,

  handleSendFromEmptyState,
  initialInputCapability,
  input,
  composerController,
  composerDraftCoordinator,
  composerDraftStatus = null,
  composerDraftRestoring = false,
  onComposerDraftAccepted,
  inputRestoreRequest,
  model,
  objectiveEnabled,
  onAddPathReferences,
  onClearPathReferences,
  onDismissEntryBanner,
  onInputRestoreRequestHandled,
  onManageProviders,
  onObjectiveEnabledChange,
  onPluginSuggestionsNeeded,
  onProjectChange,
  onSkillSuggestionsNeeded,
  onRemovePathReference,
  onStopSending,

  openedProjects,
  pathReferences,
  pluginSuggestions,
  pluginSuggestionsError,
  pluginSuggestionsLoading,
  projectId,
  providerType,
  reasoningEffort,
  serviceSkillExecutionCard,
  sessionId,
  setAccessMode,
  setChatToolPreferences,
  setInput,
  setModel,
  setProviderType,
  setReasoningEffort,
  skills,
  skillsLoading,
}: UseWorkspaceConversationLandingSurfaceRuntimeParams): WorkspaceConversationLandingSurfaceRuntime {
  const handleToolPreferenceChange = useCallback(
    (key: keyof ChatToolPreferences, enabled: boolean) =>
      setChatToolPreferences((previous) => ({
        ...previous,
        [key]: enabled,
      })),
    [setChatToolPreferences],
  );

  const emptyStateProps = useMemo(
    () =>
      buildWorkspaceEmptyStateProps({
        input,
        composerController,
        composerDraftCoordinator,
        onComposerDraftAccepted,
        setInput,
        onSendMessage: handleSendFromEmptyState,
        onStopSending,
        sendOnPointerDown: emptyStateSendOnPointerDown,
        isLoading: emptyStateIsLoading,
        disabled: emptyStateDisabled,
        providerType,
        setProviderType,
        model,
        setModel,
        reasoningEffort,
        setReasoningEffort,
        accessMode,
        setAccessMode,
        onManageProviders,
        toolPreferences: chatToolPreferences,
        onToolPreferenceChange: handleToolPreferenceChange,
        objectiveEnabled,
        onObjectiveEnabledChange,
        activeTheme: activeTheme as ThemeType,
        skills,
        isSkillsLoading: skillsLoading,
        onSkillSuggestionsNeeded,
        projectId,
        openedProjects,
        onProjectChange,
        sessionId,
        pluginSuggestions,
        pluginSuggestionsError,
        pluginSuggestionsLoading,
        onPluginSuggestionsNeeded,
        initialInputCapability,
        pathReferences,
        onAddPathReferences,
        inputRestoreRequest,
        onInputRestoreRequestHandled,
        onRemovePathReference,
        onClearPathReferences,
      }),
    [
      accessMode,
      activeTheme,
      chatToolPreferences,
      emptyStateDisabled,
      emptyStateIsLoading,
      emptyStateSendOnPointerDown,
      handleSendFromEmptyState,
      handleToolPreferenceChange,
      initialInputCapability,
      input,
      composerController,
      composerDraftCoordinator,
      onComposerDraftAccepted,
      inputRestoreRequest,
      model,
      objectiveEnabled,
      onAddPathReferences,
      onClearPathReferences,
      onInputRestoreRequestHandled,
      onManageProviders,
      onObjectiveEnabledChange,
      onPluginSuggestionsNeeded,
      onProjectChange,
      onSkillSuggestionsNeeded,
      onRemovePathReference,
      onStopSending,
      openedProjects,
      pathReferences,
      pluginSuggestions,
      pluginSuggestionsError,
      pluginSuggestionsLoading,
      projectId,
      providerType,
      reasoningEffort,
      sessionId,
      setAccessMode,
      setInput,
      setModel,
      setProviderType,
      setReasoningEffort,
      skills,
      skillsLoading,
    ],
  );

  return useMemo(
    () => ({
      composerDraftStatusNode: composerDraftCoordinator ? (
        <ComposerDraftStatus
          status={composerDraftStatus}
          restoring={composerDraftRestoring}
        />
      ) : undefined,
      entryBannerVisible,
      entryBannerMessage,
      onDismissEntryBanner,
      creationReplaySurface,
      serviceSkillExecutionCard,
      emptyStateProps,
    }),
    [
      composerDraftCoordinator,
      composerDraftStatus,
      composerDraftRestoring,
      creationReplaySurface,
      emptyStateProps,
      entryBannerMessage,
      entryBannerVisible,
      onDismissEntryBanner,
      serviceSkillExecutionCard,
    ],
  );
}
