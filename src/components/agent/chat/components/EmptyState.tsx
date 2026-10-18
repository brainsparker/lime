import {
  canRestoreComposerSubmission,
  useComposerSubmissionRestoreState,
  createComposerSubmissionSettlement,
} from "./composerSubmissionSettlement";
import { runRuntimeSubmissionEffect } from "../hooks/agentSendResult";
import { restoreComposerDraft } from "../hooks/composerDraftRestore";
import type { ComposerDraftSnapshot } from "@/components/input-kit";
import {
  claimComposerCapabilityInitialization,
  useComposerCapabilitySelection,
} from "../skill-selection/useComposerCapabilitySelection";
import { insertComposerSkill } from "../skill-selection/composerCapabilityMention";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { appendSelectedText } from "../utils/promptContext";
import {
  buildCuratedTaskLaunchPrompt,
  buildCuratedTaskTemplateCopy,
  findCuratedTaskTemplateById,
  recordCuratedTaskTemplateUsage,
  replaceCuratedTaskLaunchPromptInInput,
  type CuratedTaskInputValues,
  type CuratedTaskTemplateItem,
} from "../utils/curatedTaskTemplates";
import type {
  CuratedTaskReferenceEntry,
  CuratedTaskReferenceSelection,
} from "../utils/curatedTaskReferenceSelection";
import { CuratedTaskLauncherDialog } from "./CuratedTaskLauncherDialog";
import { EmptyStateComposerPanel } from "./EmptyStateComposerPanel";
import { EmptyStateComposerFrame, EmptyStateLayout } from "./EmptyStateLayout";
import { buildSkillSelectionProps } from "../skill-selection/skillSelectionBindings";
import { isGeneralResearchTheme } from "../utils/generalAgentPrompt";
import type { MessagePathReference } from "../types";
import {
  mergePathReferences,
  buildPathReferenceRequestMetadata,
} from "../utils/pathReferences";
import { buildKnowledgeRequestMetadata } from "@/features/knowledge/agent/knowledgeMetadata";
import {
  resolveInputCapabilityDispatch,
  resolveInputCapabilitySelectionFromRoute,
  type InputCapabilitySelection,
  type InputCapabilitySendRoute,
} from "../skill-selection/inputCapabilitySelection";
import { buildHomeSurfaceCopy } from "../home/homeSurfaceCopy";
import { buildInputbarCoreCopy } from "./Inputbar/components/inputbarCoreCopy";
import { buildInputbarToolPreferencesOverride } from "./Inputbar/utils/inputbarModeRequestMetadata";
import { resolveEffectiveCuratedTaskReferences } from "./EmptyStateViewModel";
import { useEmptyStateAttachments } from "./useEmptyStateAttachments";
import { useEmptyStateRecommendationPreferences } from "./useEmptyStateRecommendationPreferences";
import { useCuratedTaskLauncherState } from "./useCuratedTaskLauncherState";
import type { AgentI18nKey, EmptyStateProps } from "./EmptyState.types";
import {
  type BaseComposerSendMetadata,
  useComposerController,
  type ComposerSubmitTarget,
} from "@/components/input-kit";
import { AppServerClient } from "@/lib/api/appServer";
import { readPromptHistory } from "@/lib/api/promptHistory";
import { recordAgentUiPerformanceMetric } from "@/lib/agentUiPerformanceMetrics";
import { getLimeSkinCopy } from "@/lib/appearance/skinContent";
import { useHomeSkinPresentation } from "./homeSkinPresentation";

const CREATION_THEMES: string[] = [];

export const EmptyState: React.FC<EmptyStateProps> = ({
  composerController: externalComposerController,
  composerDraftCoordinator,
  onComposerDraftAccepted,
  input,
  setInput,
  onSend,
  onStop,
  sendOnPointerDown = false,
  creationMode = "guided",
  onCreationModeChange,
  activeTheme = "general",
  onThemeChange,
  providerType,
  setProviderType,
  model,
  setModel,
  reasoningEffort,
  setReasoningEffort,
  accessMode,
  setAccessMode,
  onManageProviders,
  taskEnabled = false,
  onTaskEnabledChange,
  objectiveEnabled: objectiveEnabledProp,
  onObjectiveEnabledChange: onObjectiveEnabledChangeProp,
  subagentEnabled = false,
  onSubagentEnabledChange,
  selectedText = "",
  characters = [],
  skills,
  serviceSkills,
  serviceSkillGroups,
  isSkillsLoading,
  onSelectServiceSkill,
  onNavigateToSettings,
  onImportSkill,
  onRefreshSkills,
  onSkillSuggestionsNeeded,
  onLaunchBrowserAssist,
  projectId = null,
  openedProjects = [],
  onProjectContextChange,
  sessionId = null,
  pluginSuggestions = [],
  pluginSuggestionsError = null,
  pluginSuggestionsLoading = false,
  onPluginSuggestionsNeeded,
  isLoading = false,
  disabled = false,
  initialInputCapability,
  creationReplaySurface = null,
  defaultCuratedTaskReferenceMemoryIds,
  defaultCuratedTaskReferenceEntries,
  knowledgePackSelection = null,
  knowledgePackOptions = [],
  onToggleKnowledgePack,
  onSelectKnowledgePack,
  onToggleKnowledgeCompanionPack,
  onStartKnowledgeOrganize,
  onManageKnowledgePacks,
  pathReferences: initialPathReferences = [],
  onAddPathReferences,
  inputRestoreRequest = null,
  onInputRestoreRequestHandled,
  onImportPathReferenceAsKnowledge,
  onRemovePathReference,
  onClearPathReferences,
  fileManagerOpen = false,
  onToggleFileManager,
}) => {
  const { t, i18n } = useTranslation("agent");
  const {
    controller: composerController,
    snapshot: composerSnapshot,
    setText: setComposerControllerText,
  } = useComposerController({
    controller: externalComposerController,
    initialDocument: {
      text: input,
      pathReferences: initialPathReferences,
    },
  });
  const mounted = useRef(true);
  const surface = useRef({
    composerController,
    composerDraftCoordinator,
    projectId,
    sessionId,
  });
  surface.current = {
    composerController,
    composerDraftCoordinator,
    projectId,
    sessionId,
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pathReferences = useMemo(
    () => [...composerSnapshot.document.pathReferences],
    [composerSnapshot.document.pathReferences],
  );
  const handleAddPathReferences = useCallback(
    (references: MessagePathReference[]) => {
      composerController.setPathReferences(
        mergePathReferences(
          [...composerController.getDocument().pathReferences],
          references,
        ),
      );
      onAddPathReferences?.(references);
    },
    [composerController, onAddPathReferences],
  );
  const handleRemovePathReference = useCallback(
    (id: string) => {
      composerController.setPathReferences(
        composerController
          .getDocument()
          .pathReferences.filter((reference) => reference.id !== id),
      );
      onRemovePathReference?.(id);
    },
    [composerController, onRemovePathReference],
  );
  const promptHistoryClientRef = useRef<AppServerClient | null>(null);
  if (!promptHistoryClientRef.current) {
    promptHistoryClientRef.current = new AppServerClient();
  }
  useEffect(() => {
    let cancelled = false;
    void readPromptHistory(promptHistoryClientRef.current ?? undefined)
      .then((entries) => {
        if (!cancelled) {
          composerController.mergeHistory(
            entries.reverse().map((entry) => ({ text: entry.text })),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [composerController]);
  const setComposerText = useCallback(
    (value: string) => {
      setComposerControllerText(value);
      setInput(value);
    },
    [setComposerControllerText, setInput],
  );
  useEffect(() => {
    setComposerControllerText(input);
  }, [input, setComposerControllerText]);
  const emittedComposerTextRef = useRef(input);
  useEffect(() => {
    if (emittedComposerTextRef.current === composerSnapshot.document.text)
      return;
    emittedComposerTextRef.current = composerSnapshot.document.text;
    setInput(composerSnapshot.document.text);
  }, [composerSnapshot.document.text, setInput]);
  const homeSkinPresentation = useHomeSkinPresentation();
  const translateAgentCopyKey = useCallback(
    (key: string, values?: Record<string, number | string>) =>
      t(key as AgentI18nKey, values ?? {}),
    [t],
  );
  const curatedTaskTemplateCopy = useMemo(
    () => buildCuratedTaskTemplateCopy(translateAgentCopyKey),
    [translateAgentCopyKey],
  );
  const skinCopy = useMemo(
    () => getLimeSkinCopy(homeSkinPresentation.skinId, i18n.language),
    [homeSkinPresentation.skinId, i18n.language],
  );
  const homeSurfaceCopy = useMemo(
    () => buildHomeSurfaceCopy(translateAgentCopyKey, skinCopy),
    [skinCopy, translateAgentCopyKey],
  );
  const inputbarCoreCopy = useMemo(
    () => buildInputbarCoreCopy(translateAgentCopyKey),
    [translateAgentCopyKey],
  );
  const inputRestoreTokenState = useComposerSubmissionRestoreState(
    inputRestoreRequest?.composerRestoreToken,
  );
  const inputRestoreEpochRef = useRef(0);
  const [activeCapability, setActiveCapability] =
    useComposerCapabilitySelection(composerController, skills);
  const [knowledgeHubOpenRequestKey, setKnowledgeHubOpenRequestKey] =
    useState(0);
  const [localObjectiveEnabled, setLocalObjectiveEnabled] = useState(false);
  const objectiveEnabled = objectiveEnabledProp ?? localObjectiveEnabled;
  const handleObjectiveEnabledChange = useCallback(
    (enabled: boolean) => {
      if (onObjectiveEnabledChangeProp) {
        onObjectiveEnabledChangeProp(enabled);
        return;
      }
      setLocalObjectiveEnabled(enabled);
    },
    [onObjectiveEnabledChangeProp],
  );
  const activeCuratedTaskCapability =
    activeCapability?.kind === "curated_task" ? activeCapability : null;
  const activeCuratedTask = activeCuratedTaskCapability?.task ?? null;
  const activeCuratedTaskLaunchInputValues =
    activeCuratedTaskCapability?.launchInputValues;
  const activeCuratedTaskReferenceMemoryIds =
    activeCuratedTaskCapability?.referenceMemoryIds;
  const activeCuratedTaskReferenceEntries =
    activeCuratedTaskCapability?.referenceEntries;
  const {
    effectiveDefaultCuratedTaskReferenceMemoryIds,
    effectiveDefaultCuratedTaskReferenceEntries,
  } = resolveEffectiveCuratedTaskReferences({
    defaultCuratedTaskReferenceMemoryIds,
    defaultCuratedTaskReferenceEntries,
    creationReplaySurface,
  });
  const currentSkill =
    activeCapability?.kind === "installed_skill"
      ? activeCapability.skill
      : null;
  const activeBuiltinCommandKey =
    activeCapability?.kind === "builtin_command"
      ? activeCapability.command.key
      : null;
  const clearSelectedSkill = useCallback(() => {
    setActiveCapability(null);
  }, [setActiveCapability]);
  const initialInputCapabilitySignature = useMemo(() => {
    const route = initialInputCapability?.capabilityRoute;
    if (!route) {
      return "";
    }

    return JSON.stringify({
      requestKey: initialInputCapability.requestKey ?? 0,
      route,
    });
  }, [initialInputCapability]);

  useEffect(() => {
    const route = initialInputCapability?.capabilityRoute;
    if (
      !route ||
      !claimComposerCapabilityInitialization(
        composerController,
        initialInputCapabilitySignature,
      )
    ) {
      return;
    }

    const resolvedCapability = resolveInputCapabilitySelectionFromRoute({
      route,
      skills,
    });

    if (
      route.kind === "curated_task" &&
      !input.trim() &&
      route.prompt.trim().length > 0
    ) {
      setComposerText(route.prompt);
    }

    if (resolvedCapability.kind === "installed_skill") {
      insertComposerSkill(composerController, resolvedCapability.skill);
      setInput(composerController.getDocument().text);
    }
    setActiveCapability(resolvedCapability);
  }, [
    initialInputCapability,
    initialInputCapabilitySignature,
    composerController,
    setInput,
    input,
    setComposerText,
    setActiveCapability,
    skills,
  ]);
  const handleSelectInputCapability = useCallback(
    (capability: InputCapabilitySelection) => {
      if (capability.kind === "installed_skill") {
        insertComposerSkill(composerController, capability.skill);
        setInput(composerController.getDocument().text);
      }
      if (capability.kind === "service_skill") {
        setActiveCapability(null);
        onSelectServiceSkill?.(capability.skill);
        return;
      }
      if (capability.kind === "builtin_command") {
        if (capability.command.key === "knowledge_pack") {
          if (!knowledgePackSelection && !onStartKnowledgeOrganize) {
            onManageKnowledgePacks?.();
          } else {
            setKnowledgeHubOpenRequestKey((current) => current + 1);
          }
          setActiveCapability(null);
          return;
        }

        if (capability.command.key === "knowledge_settle") {
          onStartKnowledgeOrganize?.();
          setActiveCapability(null);
          return;
        }
      }
      setActiveCapability(capability);
    },
    [
      composerController,
      setInput,
      knowledgePackSelection,
      onManageKnowledgePacks,
      onSelectServiceSkill,
      onStartKnowledgeOrganize,
      setActiveCapability,
    ],
  );
  useEffect(() => {
    if (activeBuiltinCommandKey !== "knowledge_pack") {
      return;
    }
    setActiveCapability(null);
    if (!knowledgePackSelection && !onStartKnowledgeOrganize) {
      onManageKnowledgePacks?.();
      return;
    }
    setKnowledgeHubOpenRequestKey((current) => current + 1);
  }, [
    activeBuiltinCommandKey,
    knowledgePackSelection,
    onManageKnowledgePacks,
    onStartKnowledgeOrganize,
    setActiveCapability,
  ]);
  const skillSelection = buildSkillSelectionProps({
    skills,
    serviceSkills,
    serviceSkillGroups,
    isSkillsLoading,
    activeSkill: currentSkill,
    onSelectInputCapability: handleSelectInputCapability,
    onClearSkill: clearSelectedSkill,
    onNavigateToSettings,
    onImportSkill,
    onRefreshSkills,
    onSkillSuggestionsNeeded,
  });
  const { appendSelectedTextToRecommendation } =
    useEmptyStateRecommendationPreferences();
  const {
    applyReviewSuggestion: applyLauncherReviewSuggestion,
    handleOpenChange: handleCuratedTaskLauncherOpenChange,
    initialInputValues: curatedTaskLauncherInitialInputValues,
    initialReferenceEntries: curatedTaskLauncherInitialReferenceEntries,
    initialReferenceMemoryIds: curatedTaskLauncherInitialReferenceMemoryIds,
    open: openCuratedTaskLauncher,
    prefillHint: curatedTaskLauncherPrefillHint,
    reset: resetCuratedTaskLauncher,
    task: curatedTaskLauncherTask,
  } = useCuratedTaskLauncherState({
    effectiveDefaultCuratedTaskReferenceEntries,
    effectiveDefaultCuratedTaskReferenceMemoryIds,
    reviewSuggestionPrefillHint:
      homeSurfaceCopy.curatedTaskReviewSuggestionPrefillHint,
  });

  // 使用外部传入的 activeTheme，如果有 onThemeChange 则使用受控模式
  const handleThemeChange = useCallback(
    (theme: string) => {
      if (onThemeChange) {
        onThemeChange(theme === "general" ? theme : "general");
      }
    },
    [onThemeChange],
  );

  // 判断当前主题是否需要显示创作模式选择器
  const showCreationModeSelector = CREATION_THEMES.includes(activeTheme);

  const isGeneralTheme = isGeneralResearchTheme(activeTheme);
  const isComposerBusy = isLoading || disabled;
  const {
    clearPendingImages,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handlePaste,
    handleRemoveImage,
    pendingImages,
  } = useEmptyStateAttachments({
    toastCopy: homeSurfaceCopy.toast,
    onAddPathReferences: handleAddPathReferences,
    controller: composerController,
  });

  useEffect(() => {
    if (!inputRestoreRequest || isComposerBusy) {
      return;
    }

    if (inputRestoreTokenState === "pending") return;
    if (
      !canRestoreComposerSubmission({
        controller: composerController,
        coordinator: composerDraftCoordinator,
        token: inputRestoreRequest.composerRestoreToken,
        scope: { projectId, sessionId },
      })
    ) {
      onInputRestoreRequestHandled?.(inputRestoreRequest.requestId);
      return;
    }
    if (!restoreComposerDraft(composerController, inputRestoreRequest)) return;
    inputRestoreEpochRef.current += 1;
    const { requestId } = inputRestoreRequest;
    setInput(composerController.getDocument().text);
    onInputRestoreRequestHandled?.(requestId);
  }, [
    inputRestoreRequest,
    inputRestoreTokenState,
    composerController,
    composerDraftCoordinator,
    projectId,
    sessionId,
    setInput,
    isComposerBusy,
    onAddPathReferences,
    onClearPathReferences,
    onInputRestoreRequestHandled,
    setComposerText,
    setActiveCapability,
    skills,
  ]);

  const handleSend = async (
    inputOverride = input,
    modeState?: {
      goalEnabled?: boolean;
      planEnabled?: boolean;
      subagentEnabled?: boolean;
    },
    triggerMetadata?: BaseComposerSendMetadata,
  ) => {
    const currentDraft = composerController.getDocument();
    const pendingImages = [...currentDraft.attachments];
    const pathReferences = [...currentDraft.pathReferences];
    const submissionCapability = currentDraft.inputCapabilityRoute
      ? resolveInputCapabilitySelectionFromRoute({
          route: currentDraft.inputCapabilityRoute as InputCapabilitySendRoute,
          skills,
        })
      : null;
    const composerInputOverride =
      inputOverride === input
        ? composerController.getDocument().text
        : inputOverride;
    const handlerEnteredAt = Date.now();
    const triggeredAt =
      typeof triggerMetadata?.triggeredAt === "number" &&
      Number.isFinite(triggerMetadata.triggeredAt)
        ? triggerMetadata.triggeredAt
        : handlerEnteredAt;
    const triggerSource = triggerMetadata?.triggerSource ?? "adapter";
    recordAgentUiPerformanceMetric("inputbar.send.enter", {
      durationMs: Math.max(0, handlerEnteredAt - triggeredAt),
      hasTriggerMetadata: Boolean(triggerMetadata),
      imageCount: pendingImages.length,
      inputLength: composerInputOverride.trim().length,
      pathReferenceCount: pathReferences.length,
      sessionId: sessionId ?? null,
      source: "empty-state",
      triggerSource,
      workspaceId: projectId ?? null,
    });
    const sendRestoreEpoch = inputRestoreEpochRef.current;
    const hasPathReferences = currentDraft.pathReferences.length > 0;
    if (
      isComposerBusy ||
      (!composerInputOverride.trim() &&
        currentDraft.attachments.length === 0 &&
        !hasPathReferences)
    ) {
      return { kind: "rejected" as const };
    }
    const capabilityDispatch = {
      ...resolveInputCapabilityDispatch(
        submissionCapability,
        composerInputOverride,
      ),
      capabilityRoute: currentDraft.inputCapabilityRoute as
        | InputCapabilitySendRoute
        | undefined,
    };
    const submitTarget: ComposerSubmitTarget =
      triggerMetadata?.submitTarget ?? (isLoading ? "steer" : "start");
    setComposerControllerText(composerInputOverride);
    const settlement = createComposerSubmissionSettlement({
      controller: composerController,
      coordinator: composerDraftCoordinator,
      target: submitTarget,
      onDraftAccepted: onComposerDraftAccepted,
      scope: { projectId, sessionId },
      canApplyUi: () =>
        mounted.current &&
        surface.current.composerController === composerController &&
        surface.current.composerDraftCoordinator === composerDraftCoordinator &&
        (!!composerDraftCoordinator ||
          (surface.current.projectId === projectId &&
            surface.current.sessionId === sessionId)) &&
        inputRestoreEpochRef.current === sendRestoreEpoch,
      onAccepted: (result, draft) => {
        if (draft?.text.trim()) {
          runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () => {
            void promptHistoryClientRef.current
              ?.appendPromptHistory({
                threadId: result.receipt.threadId,
                text: draft.text,
              })
              .catch(() => undefined);
          });
        }
      },
      onCommitted: (result) => {
        runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
          setComposerText(""),
        );
        runRuntimeSubmissionEffect(
          result.receipt,
          "accepted_submit",
          clearPendingImages,
        );
        runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
          onClearPathReferences?.(),
        );
        runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
          clearSelectedSkill?.(),
        );
      },
    });
    const composerReceipt = settlement.receipt;
    if (!composerReceipt) return { kind: "rejected" as const };
    if (composerReceipt.kind === "empty") {
      return { kind: "rejected" as const };
    }
    const imagesToSend =
      composerReceipt.submission.attachments.length > 0
        ? [...composerReceipt.submission.attachments]
        : undefined;
    const baseRequestMetadata = buildPathReferenceRequestMetadata(
      capabilityDispatch.requestMetadata,
      [...composerReceipt.submission.pathReferences],
    );
    const knowledgeRequestMetadata =
      knowledgePackSelection?.enabled &&
      knowledgePackSelection.packName.trim() &&
      knowledgePackSelection.workingDir.trim()
        ? {
            ...(baseRequestMetadata || {}),
            ...buildKnowledgeRequestMetadata({
              workingDir: knowledgePackSelection.workingDir.trim(),
              packName: knowledgePackSelection.packName.trim(),
              packs: knowledgePackSelection.companionPacks,
              source: "inputbar",
            }),
          }
        : baseRequestMetadata;
    const inputbarModeState = {
      planEnabled: modeState?.planEnabled ?? taskEnabled,
      subagentEnabled: modeState?.subagentEnabled ?? subagentEnabled,
    };
    const requestMetadata = knowledgeRequestMetadata;
    const threadGoal =
      (modeState?.goalEnabled ?? objectiveEnabled) &&
      composerInputOverride.trim()
        ? { objective: composerInputOverride.trim() }
        : undefined;
    const toolPreferencesOverride =
      buildInputbarToolPreferencesOverride(inputbarModeState);
    const collaborationMode = inputbarModeState.planEnabled
      ? ("plan" as const)
      : undefined;
    const effectiveInput = composerReceipt.submission.text.trim()
      ? composerReceipt.submission.text
      : hasPathReferences
        ? homeSurfaceCopy.composerPathReferenceFallbackPrompt
        : composerInputOverride;
    const inputRestoreDraft = {
      ...composerReceipt.draft,
      images: [...composerReceipt.draft.attachments],
      inputCapabilityRoute: composerReceipt.draft.inputCapabilityRoute as
        | InputCapabilitySendRoute
        | undefined,
    };
    const shouldAttachInputRestoreDraft = true;
    const sendOptions =
      capabilityDispatch.capabilityRoute ||
      capabilityDispatch.displayContent ||
      requestMetadata ||
      threadGoal ||
      toolPreferencesOverride ||
      collaborationMode ||
      shouldAttachInputRestoreDraft
        ? {
            ...(capabilityDispatch.capabilityRoute
              ? { capabilityRoute: capabilityDispatch.capabilityRoute }
              : {}),
            ...(shouldAttachInputRestoreDraft ? { inputRestoreDraft } : {}),
            ...(capabilityDispatch.displayContent
              ? { displayContent: capabilityDispatch.displayContent }
              : {}),
            ...(requestMetadata ? { requestMetadata } : {}),
            ...(threadGoal ? { threadGoal } : {}),
            ...(toolPreferencesOverride ? { toolPreferencesOverride } : {}),
            ...(collaborationMode ? { collaborationMode } : {}),
          }
        : undefined;

    try {
      const result = await onSend({
        onRuntimeAccepted: settlement.onRuntimeAccepted,
        composerRestoreToken: settlement.composerRestoreToken,
        composerDraftCapture: settlement.composerDraftCapture,
        images: imagesToSend,
        textOverride: effectiveInput,
        sendOptions,
        composerIntent: composerReceipt.intent,
        composerTarget: composerReceipt.target,
        composerDraft: composerReceipt.draft,
        composerSubmission: composerReceipt.submission,
        ...(triggerMetadata
          ? {
              triggeredAt: triggerMetadata.triggeredAt,
              triggerSource: triggerMetadata.triggerSource,
            }
          : {}),
      });
      return settlement.finish(result);
    } catch (error) {
      return settlement.reject(error);
    }
  };

  const handleComposerHistoryRecall = (draft: ComposerDraftSnapshot) => {
    setInput(draft.text);
  };

  const handleCuratedTaskLauncherRequest = useCallback(
    (
      template: CuratedTaskTemplateItem,
      initialInputValues?: CuratedTaskInputValues | null,
      initialReferenceMemoryIds?: string[] | null,
      initialReferenceEntries?: CuratedTaskReferenceEntry[] | null,
      prefillHint?: string | null,
    ) => {
      openCuratedTaskLauncher(
        template,
        initialInputValues,
        initialReferenceMemoryIds,
        initialReferenceEntries,
        prefillHint,
      );
    },
    [openCuratedTaskLauncher],
  );

  const handleApplyLauncherReviewSuggestion = useCallback(
    (
      template: CuratedTaskTemplateItem,
      options: {
        inputValues: CuratedTaskInputValues;
        referenceSelection: CuratedTaskReferenceSelection;
      },
    ) => {
      applyLauncherReviewSuggestion(template, options);
    },
    [applyLauncherReviewSuggestion],
  );

  const handleApplyCuratedTaskTemplate = useCallback(
    (
      template: CuratedTaskTemplateItem,
      inputValues: CuratedTaskInputValues,
      referenceSelection: CuratedTaskReferenceSelection,
    ) => {
      recordCuratedTaskTemplateUsage({
        templateId: template.id,
        launchInputValues: inputValues,
        referenceMemoryIds: referenceSelection.referenceMemoryIds,
        referenceEntries: referenceSelection.referenceEntries,
      });
      resetCuratedTaskLauncher();

      if (template.shouldEnableTeamMode && !subagentEnabled) {
        onSubagentEnabledChange?.(true);
      }

      if (template.themeTarget) {
        handleThemeChange(template.themeTarget);
      }

      if (template.shouldLaunchBrowserAssist) {
        void onLaunchBrowserAssist?.();
      }

      const resolvedTemplate =
        findCuratedTaskTemplateById(template.id, curatedTaskTemplateCopy) ??
        template;
      const launchPrompt = buildCuratedTaskLaunchPrompt({
        task: resolvedTemplate,
        inputValues,
        referenceEntries: referenceSelection.referenceEntries,
      });
      const nextPrompt = appendSelectedText(
        launchPrompt,
        selectedText,
        appendSelectedTextToRecommendation,
      );
      const promptWithSelection = replaceCuratedTaskLaunchPromptInInput({
        currentInput: input,
        previousPrompt:
          activeCuratedTask?.id === template.id
            ? activeCuratedTask.prompt
            : null,
        nextPrompt,
      });
      setActiveCapability({
        kind: "curated_task",
        task: {
          ...resolvedTemplate,
          prompt: nextPrompt,
        },
        launchInputValues: inputValues,
        referenceMemoryIds: referenceSelection.referenceMemoryIds,
        referenceEntries: referenceSelection.referenceEntries,
      });
      setComposerText(promptWithSelection);
    },
    [
      activeCuratedTask,
      appendSelectedTextToRecommendation,
      curatedTaskTemplateCopy,
      handleThemeChange,
      input,
      onLaunchBrowserAssist,
      onSubagentEnabledChange,
      resetCuratedTaskLauncher,
      selectedText,
      setComposerText,
      setActiveCapability,
      subagentEnabled,
    ],
  );

  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const composerPanel = (
    <EmptyStateComposerFrame>
      <EmptyStateComposerPanel
        input={composerSnapshot.document.text}
        setInput={setComposerText}
        controller={composerController}
        onHistoryRecall={handleComposerHistoryRecall}
        placeholder={homeSurfaceCopy.composerPlaceholder}
        onSend={handleSend}
        onStop={handleStop}
        sendOnPointerDown={sendOnPointerDown}
        activeTheme={activeTheme}
        providerType={providerType}
        setProviderType={setProviderType}
        model={model}
        setModel={setModel}
        reasoningEffort={reasoningEffort}
        setReasoningEffort={setReasoningEffort}
        accessMode={accessMode}
        setAccessMode={setAccessMode}
        onManageProviders={onManageProviders}
        isLoading={isComposerBusy}
        disabled={isComposerBusy}
        isGeneralTheme={isGeneralTheme}
        characters={characters}
        skillSelection={skillSelection}
        activeCapability={activeCapability}
        onSelectInputCapability={handleSelectInputCapability}
        onClearInputCapability={clearSelectedSkill}
        onEditCuratedTask={
          activeCuratedTask
            ? () =>
                handleCuratedTaskLauncherRequest(
                  activeCuratedTask,
                  activeCuratedTaskLaunchInputValues,
                  activeCuratedTaskReferenceMemoryIds ||
                    effectiveDefaultCuratedTaskReferenceMemoryIds,
                  activeCuratedTaskReferenceEntries ||
                    effectiveDefaultCuratedTaskReferenceEntries,
                )
            : undefined
        }
        onApplyCuratedTaskReviewSuggestion={
          activeCuratedTask
            ? (task) =>
                handleCuratedTaskLauncherRequest(
                  task,
                  activeCuratedTaskLaunchInputValues,
                  activeCuratedTaskReferenceMemoryIds ||
                    effectiveDefaultCuratedTaskReferenceMemoryIds,
                  activeCuratedTaskReferenceEntries ||
                    effectiveDefaultCuratedTaskReferenceEntries,
                  homeSurfaceCopy.curatedTaskReviewSuggestionPrefillHint,
                )
            : undefined
        }
        creationReplaySurface={creationReplaySurface}
        projectId={projectId}
        openedProjects={openedProjects}
        onProjectContextChange={onProjectContextChange}
        sessionId={sessionId}
        defaultCuratedTaskReferenceMemoryIds={
          effectiveDefaultCuratedTaskReferenceMemoryIds
        }
        defaultCuratedTaskReferenceEntries={
          effectiveDefaultCuratedTaskReferenceEntries
        }
        knowledgePackSelection={knowledgePackSelection}
        knowledgePackOptions={knowledgePackOptions}
        knowledgeHubOpenRequestKey={knowledgeHubOpenRequestKey}
        onToggleKnowledgePack={onToggleKnowledgePack}
        onSelectKnowledgePack={onSelectKnowledgePack}
        onToggleKnowledgeCompanionPack={onToggleKnowledgeCompanionPack}
        onStartKnowledgeOrganize={onStartKnowledgeOrganize}
        onManageKnowledgePacks={onManageKnowledgePacks}
        copy={homeSurfaceCopy.composer}
        inputbarCopy={inputbarCoreCopy}
        pluginSuggestions={pluginSuggestions}
        pluginSuggestionsError={pluginSuggestionsError}
        pluginSuggestionsLoading={pluginSuggestionsLoading}
        onPluginSuggestionsNeeded={onPluginSuggestionsNeeded}
        showCreationModeSelector={showCreationModeSelector}
        creationMode={creationMode}
        onCreationModeChange={onCreationModeChange}
        taskEnabled={taskEnabled}
        onTaskEnabledChange={onTaskEnabledChange}
        objectiveEnabled={objectiveEnabled}
        onObjectiveEnabledChange={handleObjectiveEnabledChange}
        subagentEnabled={subagentEnabled}
        onSubagentEnabledChange={onSubagentEnabledChange}
        pendingImages={pendingImages}
        onFileSelect={handleFileSelect}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onRemoveImage={handleRemoveImage}
        pathReferences={pathReferences}
        onImportPathReferenceAsKnowledge={onImportPathReferenceAsKnowledge}
        onRemovePathReference={handleRemovePathReference}
        fileManagerOpen={fileManagerOpen}
        onToggleFileManager={onToggleFileManager}
      />
    </EmptyStateComposerFrame>
  );

  return (
    <EmptyStateLayout heroCopy={homeSurfaceCopy.hero} composer={composerPanel}>
      <CuratedTaskLauncherDialog
        open={Boolean(curatedTaskLauncherTask)}
        task={curatedTaskLauncherTask}
        projectId={projectId}
        sessionId={sessionId}
        initialInputValues={curatedTaskLauncherInitialInputValues}
        initialReferenceMemoryIds={curatedTaskLauncherInitialReferenceMemoryIds}
        initialReferenceEntries={curatedTaskLauncherInitialReferenceEntries}
        prefillHint={curatedTaskLauncherPrefillHint}
        onOpenChange={handleCuratedTaskLauncherOpenChange}
        onApplyReviewSuggestion={handleApplyLauncherReviewSuggestion}
        onConfirm={handleApplyCuratedTaskTemplate}
      />
    </EmptyStateLayout>
  );
};
