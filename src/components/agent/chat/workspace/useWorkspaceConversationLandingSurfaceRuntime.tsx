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
import type { Character } from "@/lib/api/projectMemory";
import type { ThemeType } from "@/lib/workspace/workbenchContract";
import { EmptyState } from "../components/EmptyState";
import type { InputbarSendHandler } from "../components/Inputbar/inputbarSendPayload";
import type { InterruptedInputRestoreRequest } from "../hooks/agentStreamInputRestoreTypes";
import type { ChatToolPreferences } from "../utils/chatToolPreferences";
import type { CreationReplaySurfaceModel } from "../utils/creationReplaySurface";
import { buildWorkspaceEmptyStateProps } from "./chatSurfaceProps";
import type { useWorkspaceInputbarSceneRuntime } from "./useWorkspaceInputbarSceneRuntime";

export interface WorkspaceConversationLandingSurfaceRuntime {
  composerDraftStatusNode?: ReactNode;
  entryBannerVisible: boolean;
  entryBannerMessage?: string;
  onDismissEntryBanner: () => void;
  creationReplaySurface?: CreationReplaySurfaceModel | null;
  serviceSkillExecutionCard?: ReactNode;
  emptyStateProps: ComponentProps<typeof EmptyState>;
}

type WorkspaceConversationLandingInputbarSceneRuntime = Pick<
  ReturnType<typeof useWorkspaceInputbarSceneRuntime>,
  | "knowledgePackSelection"
  | "knowledgePackOptions"
  | "onToggleKnowledgePack"
  | "onSelectKnowledgePack"
  | "onToggleKnowledgeCompanionPack"
  | "onStartKnowledgeOrganize"
  | "onManageKnowledgePacks"
  | "onImportPathReferenceAsKnowledge"
>;

interface UseWorkspaceConversationLandingSurfaceRuntimeParams {
  accessMode: ComponentProps<typeof EmptyState>["accessMode"];
  activeTheme: string;
  chatToolPreferences: ChatToolPreferences;
  creationReplaySurface?: CreationReplaySurfaceModel | null;
  defaultCuratedTaskReferenceEntries?: ComponentProps<
    typeof EmptyState
  >["defaultCuratedTaskReferenceEntries"];
  defaultCuratedTaskReferenceMemoryIds?: ComponentProps<
    typeof EmptyState
  >["defaultCuratedTaskReferenceMemoryIds"];
  emptyStateDisabled?: ComponentProps<typeof EmptyState>["disabled"];
  emptyStateIsLoading?: ComponentProps<typeof EmptyState>["isLoading"];
  emptyStateSendOnPointerDown?: ComponentProps<
    typeof EmptyState
  >["sendOnPointerDown"];
  entryBannerMessage?: string;
  entryBannerVisible: boolean;
  fileManagerOpen?: ComponentProps<typeof EmptyState>["fileManagerOpen"];
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
  inputbarScene: WorkspaceConversationLandingInputbarSceneRuntime;
  inputRestoreRequest?: InterruptedInputRestoreRequest | null;
  lockTheme: boolean;
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
  onLaunchBrowserAssist?: ComponentProps<
    typeof EmptyState
  >["onLaunchBrowserAssist"];
  onManageProviders?: ComponentProps<typeof EmptyState>["onManageProviders"];
  onNavigateToSettings?: ComponentProps<
    typeof EmptyState
  >["onNavigateToSettings"];
  onObjectiveEnabledChange?: ComponentProps<
    typeof EmptyState
  >["onObjectiveEnabledChange"];
  onPluginSuggestionsNeeded?: ComponentProps<
    typeof EmptyState
  >["onPluginSuggestionsNeeded"];
  onProjectChange?: ComponentProps<typeof EmptyState>["onProjectContextChange"];
  onRefreshSkills?: ComponentProps<typeof EmptyState>["onRefreshSkills"];
  onSkillSuggestionsNeeded?: ComponentProps<
    typeof EmptyState
  >["onSkillSuggestionsNeeded"];
  onRemovePathReference?: ComponentProps<
    typeof EmptyState
  >["onRemovePathReference"];
  onSelectServiceSkill?: ComponentProps<
    typeof EmptyState
  >["onSelectServiceSkill"];
  onStopSending?: ComponentProps<typeof EmptyState>["onStop"];
  onToggleFileManager?: ComponentProps<
    typeof EmptyState
  >["onToggleFileManager"];
  openedProjects?: ComponentProps<typeof EmptyState>["openedProjects"];
  pathReferences?: ComponentProps<typeof EmptyState>["pathReferences"];
  pluginSuggestions?: ComponentProps<typeof EmptyState>["pluginSuggestions"];
  pluginSuggestionsError?: ComponentProps<
    typeof EmptyState
  >["pluginSuggestionsError"];
  pluginSuggestionsLoading?: ComponentProps<
    typeof EmptyState
  >["pluginSuggestionsLoading"];
  projectCharacters: Character[];
  projectId: string | null;
  providerType: ComponentProps<typeof EmptyState>["providerType"];
  reasoningEffort?: ComponentProps<typeof EmptyState>["reasoningEffort"];
  serviceSkillExecutionCard?: ReactNode;
  serviceSkillGroups: NonNullable<
    ComponentProps<typeof EmptyState>["serviceSkillGroups"]
  >;
  serviceSkills: NonNullable<
    ComponentProps<typeof EmptyState>["serviceSkills"]
  >;
  sessionId?: ComponentProps<typeof EmptyState>["sessionId"];
  setAccessMode?: ComponentProps<typeof EmptyState>["setAccessMode"];
  setActiveTheme: Dispatch<SetStateAction<string>>;
  setChatToolPreferences: Dispatch<SetStateAction<ChatToolPreferences>>;
  setInput: ComponentProps<typeof EmptyState>["setInput"];
  setModel: ComponentProps<typeof EmptyState>["setModel"];
  setProviderType: ComponentProps<typeof EmptyState>["setProviderType"];
  setReasoningEffort?: ComponentProps<typeof EmptyState>["setReasoningEffort"];
  skills: NonNullable<ComponentProps<typeof EmptyState>["skills"]>;
  skillsLoading: boolean;
  selectedText: ComponentProps<typeof EmptyState>["selectedText"];
}

export function useWorkspaceConversationLandingSurfaceRuntime({
  accessMode,
  activeTheme,
  chatToolPreferences,
  creationReplaySurface,
  defaultCuratedTaskReferenceEntries,
  defaultCuratedTaskReferenceMemoryIds,
  emptyStateDisabled = false,
  emptyStateIsLoading = false,
  emptyStateSendOnPointerDown = false,
  entryBannerMessage,
  entryBannerVisible,
  fileManagerOpen,
  handleSendFromEmptyState,
  initialInputCapability,
  input,
  composerController,
  composerDraftCoordinator,
  composerDraftStatus = null,
  composerDraftRestoring = false,
  onComposerDraftAccepted,
  inputbarScene,
  inputRestoreRequest,
  lockTheme,
  model,
  objectiveEnabled,
  onAddPathReferences,
  onClearPathReferences,
  onDismissEntryBanner,
  onInputRestoreRequestHandled,
  onLaunchBrowserAssist,
  onManageProviders,
  onNavigateToSettings,
  onObjectiveEnabledChange,
  onPluginSuggestionsNeeded,
  onProjectChange,
  onRefreshSkills,
  onSkillSuggestionsNeeded,
  onRemovePathReference,
  onSelectServiceSkill,
  onStopSending,
  onToggleFileManager,
  openedProjects,
  pathReferences,
  pluginSuggestions,
  pluginSuggestionsError,
  pluginSuggestionsLoading,
  projectCharacters,
  projectId,
  providerType,
  reasoningEffort,
  serviceSkillExecutionCard,
  serviceSkillGroups,
  serviceSkills,
  sessionId,
  setAccessMode,
  setActiveTheme,
  setChatToolPreferences,
  setInput,
  setModel,
  setProviderType,
  setReasoningEffort,
  skills,
  skillsLoading,
  selectedText,
}: UseWorkspaceConversationLandingSurfaceRuntimeParams): WorkspaceConversationLandingSurfaceRuntime {
  const {
    knowledgePackOptions,
    knowledgePackSelection,
    onImportPathReferenceAsKnowledge,
    onManageKnowledgePacks,
    onSelectKnowledgePack,
    onStartKnowledgeOrganize,
    onToggleKnowledgeCompanionPack,
    onToggleKnowledgePack,
  } = inputbarScene;
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
        onThemeChange: setActiveTheme,
        themeLocked: lockTheme,
        selectedText,
        characters: projectCharacters,
        skills,
        serviceSkills,
        serviceSkillGroups,
        isSkillsLoading: skillsLoading,
        onSelectServiceSkill,
        onNavigateToSettings,
        onRefreshSkills,
        onSkillSuggestionsNeeded,
        onLaunchBrowserAssist,
        projectId,
        openedProjects,
        onProjectChange,
        sessionId,
        pluginSuggestions,
        pluginSuggestionsError,
        pluginSuggestionsLoading,
        onPluginSuggestionsNeeded,
        initialInputCapability,
        knowledgePackSelection,
        knowledgePackOptions,
        onToggleKnowledgePack,
        onSelectKnowledgePack,
        onToggleKnowledgeCompanionPack,
        onStartKnowledgeOrganize,
        onManageKnowledgePacks,
        creationReplaySurface,
        defaultCuratedTaskReferenceMemoryIds,
        defaultCuratedTaskReferenceEntries,
        pathReferences,
        onAddPathReferences,
        inputRestoreRequest,
        onInputRestoreRequestHandled,
        onImportPathReferenceAsKnowledge,
        onRemovePathReference,
        onClearPathReferences,
        fileManagerOpen,
        onToggleFileManager,
      }),
    [
      accessMode,
      activeTheme,
      chatToolPreferences,
      creationReplaySurface,
      defaultCuratedTaskReferenceEntries,
      defaultCuratedTaskReferenceMemoryIds,
      emptyStateDisabled,
      emptyStateIsLoading,
      emptyStateSendOnPointerDown,
      fileManagerOpen,
      handleSendFromEmptyState,
      handleToolPreferenceChange,
      initialInputCapability,
      input,
      composerController,
      composerDraftCoordinator,
      onComposerDraftAccepted,
      inputRestoreRequest,
      lockTheme,
      model,
      objectiveEnabled,
      onAddPathReferences,
      onClearPathReferences,
      onImportPathReferenceAsKnowledge,
      onInputRestoreRequestHandled,
      onLaunchBrowserAssist,
      onManageKnowledgePacks,
      onManageProviders,
      onNavigateToSettings,
      onObjectiveEnabledChange,
      onPluginSuggestionsNeeded,
      onProjectChange,
      onRefreshSkills,
      onSkillSuggestionsNeeded,
      onRemovePathReference,
      onSelectKnowledgePack,
      onSelectServiceSkill,
      onStartKnowledgeOrganize,
      onStopSending,
      onToggleFileManager,
      onToggleKnowledgeCompanionPack,
      onToggleKnowledgePack,
      openedProjects,
      pathReferences,
      pluginSuggestions,
      pluginSuggestionsError,
      pluginSuggestionsLoading,
      projectCharacters,
      projectId,
      providerType,
      reasoningEffort,
      serviceSkillGroups,
      serviceSkills,
      sessionId,
      setAccessMode,
      setActiveTheme,
      setInput,
      setModel,
      setProviderType,
      setReasoningEffort,
      skills,
      skillsLoading,
      selectedText,
      knowledgePackOptions,
      knowledgePackSelection,
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
