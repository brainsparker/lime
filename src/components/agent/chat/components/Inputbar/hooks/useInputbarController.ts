import { restoreComposerDraft } from "../../../hooks/composerDraftRestore";
import type { ComposerController, ComposerDraftSnapshot } from "@/components/input-kit";
import { claimComposerCapabilityInitialization, useComposerCapabilitySelection } from "../../../skill-selection/useComposerCapabilitySelection";
import { insertComposerSkill, insertComposerPlugin } from "../../../skill-selection/composerCapabilityMention";
import type { ComposerEditorHandle } from "@/components/input-kit";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { BuiltinCommandBadge } from "../components/BuiltinCommandBadge";
import { RuntimeSceneBadge } from "../components/RuntimeSceneBadge";
import { CuratedTaskBadge } from "../../../skill-selection/CuratedTaskBadge";
import { CuratedTaskLauncherDialog } from "../../CuratedTaskLauncherDialog";
import { useHintRoutes } from "./useHintRoutes";
import { useImageAttachments } from "./useImageAttachments";
import { useInputbarAdapter } from "./useInputbarAdapter";
import { useInputbarSend } from "./useInputbarSend";
import {
  type InputbarToolStates,
  useInputbarToolState,
} from "./useInputbarToolState";
import {
  buildSkillSelectionProps,
  type SkillSelectionSourceProps,
} from "../../../skill-selection/skillSelectionBindings";
import type {
  WorkflowGateState,
  WorkflowStep,
} from "../../../utils/workflowInputState";
import { useWorkflowInputState } from "../../../utils/workflowInputState";
import type { ServiceSkillHomeItem } from "@/components/agent/chat/service-skills/types";
import type { MessagePathReference } from "../../../types";
import {
  resolveInputCapabilitySelectionFromRoute,
  type InputCapabilitySelection,
} from "../../../skill-selection/inputCapabilitySelection";
import type { InputbarKnowledgePackSelection } from "../types";
import type { InputbarSendHandler } from "../inputbarSendPayload";
import type { InterruptedInputRestoreRequest } from "../../../hooks/agentStreamInputRestoreTypes";
import type { AgentInitialInputCapabilityParams } from "@/types/page";
import {
  buildCuratedTaskLaunchPrompt,
  findCuratedTaskTemplateById,
  hasFilledAllCuratedTaskRequiredInputs,
  replaceCuratedTaskLaunchPromptInInput,
  type CuratedTaskInputValues,
} from "../../../utils/curatedTaskTemplates";
import {
  mergeCuratedTaskReferenceEntries,
  normalizeCuratedTaskReferenceMemoryIds,
  type CuratedTaskReferenceSelection,
} from "../../../utils/curatedTaskReferenceSelection";
import {
  mergePathReferences,
  readCustomPathReferencesFromDataTransfer,
  readSystemPathReferencesFromFiles,
} from "../../../utils/pathReferences";
import { toast } from "sonner";
import { buildInputbarControllerCopy } from "./inputbarControllerCopy";
import { buildInputbarWorkflowStateCopy } from "../inputbarWorkflowCopy";
import { logAgentDebug } from "@/lib/agentDebug";
import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";
import { useComposerController } from "@/components/input-kit/useComposerController";
import type { ComposerSubmitTarget } from "@/components/input-kit/types";
import { AppServerClient } from "@/lib/api/appServer";
import { readPromptHistory } from "@/lib/api/promptHistory";
import {
  normalizeInputbarPluginTrigger,
  type InputbarPluginCapability,
  type InputbarPluginSelection,
  type InputbarPluginSelectionOptions,
  type InputbarPluginSkillCapability,
} from "../pluginInputCapability";

interface UseInputbarControllerParams {
  composerController?: ComposerController;
  input: string;
  setInput: (value: string) => void;
  onSend: InputbarSendHandler;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  providerType?: string;
  setProviderType?: (type: string) => void;
  model?: string;
  setModel?: (model: string) => void;
  reasoningEffort?: ModelReasoningEffortLevel | "";
  setReasoningEffort?: (value: ModelReasoningEffortLevel | "") => void;
  toolStates?: Partial<InputbarToolStates>;
  onToolStatesChange?: (states: Partial<InputbarToolStates>) => void;
  initialInputCapability?: AgentInitialInputCapabilityParams;
  variant?: "default" | "workspace";
  workflowGate?: WorkflowGateState | null;
  workflowSteps?: WorkflowStep[];
  workflowRunState?: "idle" | "auto_running" | "await_user_decision";
  knowledgePackSelection?: InputbarKnowledgePackSelection | null;
  onKnowledgePacksNeeded?: () => void;
  onStartKnowledgeOrganize?: () => void;
  onManageKnowledgePacks?: () => void;
  pluginSuggestions?: InputbarPluginCapability[];
  projectId?: string | null;
  sessionId?: string | null;
  pathReferences?: MessagePathReference[];
  onAddPathReferences?: (references: MessagePathReference[]) => void;
  onClearPathReferences?: () => void;
  inputRestoreRequest?: InterruptedInputRestoreRequest | null;
  onInputRestoreRequestHandled?: (requestId: string) => void;
  submitTarget?: ComposerSubmitTarget;
}

export function useInputbarController({
  composerController: externalComposerController,
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  disabled,
  providerType,
  setProviderType,
  model,
  setModel,
  reasoningEffort,
  setReasoningEffort,
  toolStates,
  onToolStatesChange,
  initialInputCapability,
  variant = "default",
  workflowGate,
  workflowSteps = [],
  workflowRunState,
  knowledgePackSelection,
  onKnowledgePacksNeeded,
  onStartKnowledgeOrganize,
  onManageKnowledgePacks,
  pluginSuggestions = [],
  projectId = null,
  sessionId = null,
  pathReferences: initialPathReferences = [],
  onAddPathReferences,
  onClearPathReferences,
  inputRestoreRequest = null,
  onInputRestoreRequestHandled,
  submitTarget,
  skills,
  serviceSkills,
  serviceSkillGroups,
  isSkillsLoading,
  onSelectServiceSkill,
  onNavigateToSettings,
  onImportSkill,
  onRefreshSkills,
}: UseInputbarControllerParams & SkillSelectionSourceProps) {
  const { t } = useTranslation("agent");
  const copy = useMemo(() => buildInputbarControllerCopy((key) => t(key)), [t]);
  const workflowCopy = useMemo(
    () => buildInputbarWorkflowStateCopy((key, values) => t(key, values ?? {})),
    [t],
  );
  const [activePluginSelection, setActivePluginSelection] =
    useState<InputbarPluginSelection | null>(null);
  const [knowledgeHubOpenRequestKey, setKnowledgeHubOpenRequestKey] =
    useState(0);
  const [editingCuratedTaskCapability, setEditingCuratedTaskCapability] =
    useState<Extract<
      InputCapabilitySelection,
      { kind: "curated_task" }
    > | null>(null);
  const [curatedTaskEditorPrefillHint, setCuratedTaskEditorPrefillHint] =
    useState<string | null>(null);
  const inputRestoreEpochRef = useRef(0);
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
  const pathReferences = useMemo(() => [...composerSnapshot.document.pathReferences], [composerSnapshot.document.pathReferences]);
  const [activeCapability, setActiveCapability] = useComposerCapabilitySelection(composerController, skills);
  const {
    pendingImages,
    fileInputRef,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDrop: handleImageDrop,
    handleRemoveImage,
    clearPendingImages,
    openFileDialog,
  } = useImageAttachments({ controller: composerController });
  const handleComposerHistoryRecall = useCallback((draft: ComposerDraftSnapshot) => {
    setInput(draft.text);
  }, [setInput]);

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
    if (composerController.getDocument().text !== input) {
      setComposerControllerText(input);
    }
  }, [composerController, input, setComposerControllerText]);
  const emittedComposerTextRef = useRef(input);
  useEffect(() => {
    if (emittedComposerTextRef.current === composerSnapshot.document.text) return;
    emittedComposerTextRef.current = composerSnapshot.document.text;
    setInput(composerSnapshot.document.text);
  }, [composerSnapshot.document.text, setInput]);
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      const customReferences = readCustomPathReferencesFromDataTransfer(
        event.dataTransfer,
      );
      if (customReferences.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        composerController.setPathReferences(mergePathReferences([...composerController.getDocument().pathReferences], customReferences));
        onAddPathReferences?.(customReferences);
        return;
      }

      const files = event.dataTransfer.files;
      const systemReferences =
        files && files.length > 0
          ? readSystemPathReferencesFromFiles(files)
          : [];
      if (systemReferences.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        composerController.setPathReferences(mergePathReferences([...composerController.getDocument().pathReferences], systemReferences));
        onAddPathReferences?.(systemReferences);
        return;
      }

      if (files && files.length > 0) {
        const hasImageFile = Array.from(files).some((file) =>
          file.type.startsWith("image/"),
        );
        if (!hasImageFile) {
          toast.error(copy.systemPathDropUnsupported);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      handleImageDrop(event);
    },
    [composerController, copy.systemPathDropUnsupported, handleImageDrop, onAddPathReferences],
  );
  const editorRef = useRef<ComposerEditorHandle>(null);
  const isWorkspaceVariant = variant === "workspace";
  const activeSkill =
    activeCapability?.kind === "installed_skill"
      ? activeCapability.skill
      : null;
  const activeBuiltinCommand =
    activeCapability?.kind === "builtin_command"
      ? activeCapability.command
      : null;
  const activeRuntimeScene =
    activeCapability?.kind === "runtime_scene"
      ? activeCapability.command
      : null;
  const activeCuratedTask =
    activeCapability?.kind === "curated_task" ? activeCapability.task : null;
  const activeCuratedTaskReferenceEntries =
    activeCapability?.kind === "curated_task"
      ? activeCapability.referenceEntries
      : undefined;

  useEffect(() => {
    if (activeBuiltinCommand?.key !== "knowledge_pack") {
      return;
    }
    setActiveCapability(null);
    if (!knowledgePackSelection && !onStartKnowledgeOrganize) {
      onManageKnowledgePacks?.();
      return;
    }
    onKnowledgePacksNeeded?.();
    setKnowledgeHubOpenRequestKey((current) => current + 1);
  }, [
    activeBuiltinCommand?.key,
    knowledgePackSelection,
    onKnowledgePacksNeeded,
    onManageKnowledgePacks,
    onStartKnowledgeOrganize,
    setActiveCapability,
  ]);
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
    if (!inputRestoreRequest) {
      return;
    }

    if (!restoreComposerDraft(composerController, inputRestoreRequest)) return;
    inputRestoreEpochRef.current += 1;
    const restoreEpoch = inputRestoreEpochRef.current;
    const { draft, requestId } = inputRestoreRequest;
    logAgentDebug("Inputbar", "inputRestoreRequest.apply", {
      draftImageCount: draft.images?.length ?? 0,
      draftPathReferenceCount: draft.pathReferences?.length ?? 0,
      draftTextLength: draft.text.trim().length,
      hasCapabilityRoute: Boolean(draft.inputCapabilityRoute),
      requestId,
      restoreEpoch,
    });
    setInput(composerController.getDocument().text);
    onInputRestoreRequestHandled?.(requestId);
  }, [
    inputRestoreRequest,
    composerController,
    setInput,
    onAddPathReferences,
    onClearPathReferences,
    onInputRestoreRequestHandled,
    setComposerText,
    setActiveCapability,
    skills,
  ]);

  useEffect(() => {
    const route = initialInputCapability?.capabilityRoute;
    if (!route || !claimComposerCapabilityInitialization(composerController, initialInputCapabilitySignature)) {
      return;
    }

    const resolvedCapability = resolveInputCapabilitySelectionFromRoute({
      route,
      skills,
    });
    const shouldOpenCuratedTaskLauncherOnBootstrap =
      resolvedCapability.kind === "curated_task" &&
      resolvedCapability.task.requiredInputFields.length > 0 &&
      !hasFilledAllCuratedTaskRequiredInputs({
        task: resolvedCapability.task,
        inputValues: resolvedCapability.launchInputValues ?? {},
      });

    if (
      route.kind === "curated_task" &&
      !shouldOpenCuratedTaskLauncherOnBootstrap &&
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
    if (
      shouldOpenCuratedTaskLauncherOnBootstrap &&
      resolvedCapability.kind === "curated_task"
    ) {
      setCuratedTaskEditorPrefillHint(null);
      setEditingCuratedTaskCapability(resolvedCapability);
    }
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

  const { activeTools, handleToolClick, isFullscreen } = useInputbarToolState({
    toolStates,
    onToolStatesChange,
    openFileDialog,
  });

  const {
    showHintPopup,
    hintRoutes,
    hintIndex,
    handleSetInput,
    handleHintSelect,
    handleHintKeyDown,
  } = useHintRoutes({
    setInput: setComposerText,
    editorRef,
  });

  const handleSend = useInputbarSend({
    input,
    isLoading,
    pendingImages,
    pathReferences,
    activeCapability,
    knowledgePackSelection,
    activeTools,
    projectId,
    sessionId,
    onSend,
    clearPendingImages,
    clearPathReferences: onClearPathReferences,
    clearActiveCapability: () => setActiveCapability(null),
    getInputRestoreEpoch: () => inputRestoreEpochRef.current,
    composerController,
    onComposerCommitted: (text, draft) => {
      setInput(text);
      if (sessionId && draft?.text.trim()) {
        void promptHistoryClientRef.current
          ?.appendPromptHistory({
            threadId: sessionId,
            text: draft.text,
          })
          .catch(() => undefined);
      }
    },
    submitTarget,
  });
  const handleInterrupt = useCallback(() => {
    composerController.submit("interrupt", { allowEmpty: true });
    onStop?.();
  }, [composerController, onStop]);
  const inputAdapter = useInputbarAdapter({
    input,
    setInput: handleSetInput,
    isLoading,
    disabled,
    providerType,
    setProviderType,
    model,
    setModel,
    reasoningEffort,
    setReasoningEffort,
    handleSend,
    onStop: handleInterrupt,
    pendingImages,
  });

  const {
    workflowQuickActions,
    workflowQueueItems,
    workflowActiveItem,
    workflowQueueTotalCount,
    workflowCompletedCount,
    workflowTotalCount,
    workflowProgressLabel,
    workflowSummaryLabel,
    renderWorkflowGeneratingPanel,
  } = useWorkflowInputState({
    isWorkspaceVariant,
    workflowGate,
    workflowSteps,
    workflowRunState,
    isSending: inputAdapter.state.isSending,
    copy: workflowCopy,
  });

  useEffect(() => {
    if (activePluginSelection && !composerSnapshot.document.mentionBindings.some((binding) => binding.kind === "plugin" && binding.id === activePluginSelection.plugin.pluginId)) setActivePluginSelection(null);
    if (activeCapability?.kind === "installed_skill" && !composerSnapshot.document.mentionBindings.some((binding) => binding.kind === "skill" && binding.id === activeCapability.skill.key)) setActiveCapability(null);
  }, [activeCapability, activePluginSelection, composerSnapshot.document.mentionBindings, setActiveCapability]);


  const topExtra =
    activeSkill ||
    activeBuiltinCommand ||
    activeRuntimeScene ||
    activeCuratedTask ||
    activePluginSelection
      ? React.createElement(
          React.Fragment,
          null,
          activeBuiltinCommand
            ? React.createElement(BuiltinCommandBadge, {
                command: activeBuiltinCommand,
                onClear: () => setActiveCapability(null),
              })
            : null,
          activeRuntimeScene
            ? React.createElement(RuntimeSceneBadge, {
                command: activeRuntimeScene,
                onClear: () => setActiveCapability(null),
              })
            : null,
          activeCuratedTask
            ? React.createElement(CuratedTaskBadge, {
                task: activeCuratedTask,
                projectId,
                sessionId,
                referenceEntries: activeCuratedTaskReferenceEntries,
                onEdit: () => {
                  if (activeCapability?.kind !== "curated_task") {
                    return;
                  }
                  setCuratedTaskEditorPrefillHint(null);
                  setEditingCuratedTaskCapability(activeCapability);
                },
                onApplyReviewSuggestion: (task) => {
                  if (activeCapability?.kind !== "curated_task") {
                    return;
                  }

                  const resolvedTask =
                    findCuratedTaskTemplateById(task.id) ?? task;
                  const nextReferenceEntries = mergeCuratedTaskReferenceEntries(
                    activeCapability.referenceEntries ?? [],
                  );
                  const nextLaunchInputValues =
                    activeCapability.launchInputValues ?? {};
                  const nextReferenceMemoryIds =
                    normalizeCuratedTaskReferenceMemoryIds(
                      activeCapability.referenceMemoryIds,
                    ) ?? [];
                  const nextPrompt = buildCuratedTaskLaunchPrompt({
                    task: resolvedTask,
                    inputValues: nextLaunchInputValues,
                    referenceEntries: nextReferenceEntries,
                  });

                    setComposerText(
                    replaceCuratedTaskLaunchPromptInInput({
                      currentInput: input,
                      previousPrompt: activeCapability.task.prompt,
                      nextPrompt,
                    }),
                  );
                  setActiveCapability({
                    kind: "curated_task",
                    task: {
                      ...resolvedTask,
                      prompt: nextPrompt,
                    },
                    launchInputValues: nextLaunchInputValues,
                    referenceMemoryIds: nextReferenceMemoryIds,
                    referenceEntries: nextReferenceEntries,
                  });
                },
                onClear: () => setActiveCapability(null),
              })
            : null,
        )
      : undefined;
  const handleCuratedTaskEditorOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setCuratedTaskEditorPrefillHint(null);
      setEditingCuratedTaskCapability(null);
    }
  }, []);
  const handleApplyCuratedTaskEditorReviewSuggestion = useCallback(
    (
      task: NonNullable<typeof editingCuratedTaskCapability>["task"],
      options: {
        inputValues: CuratedTaskInputValues;
        referenceSelection: CuratedTaskReferenceSelection;
      },
    ) => {
      const resolvedTask = findCuratedTaskTemplateById(task.id) ?? task;
      setEditingCuratedTaskCapability((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          task: resolvedTask,
          launchInputValues: options.inputValues,
          referenceMemoryIds:
            normalizeCuratedTaskReferenceMemoryIds(
              options.referenceSelection.referenceMemoryIds,
            ) ?? [],
          referenceEntries: mergeCuratedTaskReferenceEntries(
            options.referenceSelection.referenceEntries,
          ),
        };
      });
      setCuratedTaskEditorPrefillHint(
        copy.curatedTaskReviewSuggestionPrefillHint,
      );
    },
    [copy.curatedTaskReviewSuggestionPrefillHint],
  );
  const handleConfirmCuratedTaskEdit = useCallback(
    (
      task: NonNullable<typeof editingCuratedTaskCapability>["task"],
      inputValues: CuratedTaskInputValues,
      referenceSelection: CuratedTaskReferenceSelection,
    ) => {
      const previousPrompt = editingCuratedTaskCapability?.task.prompt;
      const resolvedTask = findCuratedTaskTemplateById(task.id) ?? task;
      const nextPrompt = buildCuratedTaskLaunchPrompt({
        task: resolvedTask,
        inputValues,
        referenceEntries: referenceSelection.referenceEntries,
      });
      setComposerText(
        replaceCuratedTaskLaunchPromptInInput({
          currentInput: input,
          previousPrompt,
          nextPrompt,
        }),
      );
      setActiveCapability({
        kind: "curated_task",
        task: {
          ...resolvedTask,
          prompt: nextPrompt,
        },
        launchInputValues: inputValues,
        referenceMemoryIds: referenceSelection.referenceMemoryIds,
        referenceEntries: referenceSelection.referenceEntries,
      });
      setCuratedTaskEditorPrefillHint(null);
      setEditingCuratedTaskCapability(null);
    },
    [editingCuratedTaskCapability, input, setComposerText, setActiveCapability],
  );
  const dialogLayer = editingCuratedTaskCapability
    ? React.createElement(CuratedTaskLauncherDialog, {
        open: true,
        task: editingCuratedTaskCapability.task,
        projectId,
        sessionId,
        initialInputValues: editingCuratedTaskCapability.launchInputValues,
        initialReferenceMemoryIds:
          editingCuratedTaskCapability.referenceMemoryIds,
        initialReferenceEntries: editingCuratedTaskCapability.referenceEntries,
        prefillHint: curatedTaskEditorPrefillHint,
        onOpenChange: handleCuratedTaskEditorOpenChange,
        onApplyReviewSuggestion: handleApplyCuratedTaskEditorReviewSuggestion,
        onConfirm: handleConfirmCuratedTaskEdit,
      })
    : undefined;
  const handleSelectServiceSkill = (skill: ServiceSkillHomeItem) => {
    setActiveCapability(null);
    onSelectServiceSkill?.(skill);
  };
  const handleSelectPlugin = (
    plugin: InputbarPluginCapability,
    skill?: InputbarPluginSkillCapability,
    _options?: InputbarPluginSelectionOptions,
  ) => {
    const blocked =
      plugin.disabled ||
      (plugin.blockerCodes?.length ?? 0) > 0 ||
      skill?.disabled ||
      (skill?.blockerCodes?.length ?? 0) > 0;
    if (blocked) {
      return;
    }
    insertComposerPlugin(composerController, plugin, skill, { start: 0, end: 0 });
    setInput(composerController.getDocument().text);
    setActivePluginSelection({ plugin, skill, trigger: normalizeInputbarPluginTrigger(plugin, skill), text: composerController.getDocument().text, preserveInput: true });

  };
  const handleSelectInputCapability = (
    capability: InputCapabilitySelection,
  ) => {
    if (capability.kind === "installed_skill") {
      insertComposerSkill(composerController, capability.skill);
      setInput(composerController.getDocument().text);
    }
    if (capability.kind === "service_skill") {
      handleSelectServiceSkill(capability.skill);
      return;
    }
    if (capability.kind === "builtin_command") {
      if (capability.command.key === "knowledge_pack") {
        if (!knowledgePackSelection && !onStartKnowledgeOrganize) {
          onManageKnowledgePacks?.();
        } else {
          onKnowledgePacksNeeded?.();
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
  };
  const skillSelection = buildSkillSelectionProps({
    skills,
    serviceSkills,
    serviceSkillGroups,
    activeSkill,
    isSkillsLoading,
    onSelectInputCapability: handleSelectInputCapability,
    onClearSkill: () => setActiveCapability(null),
    onNavigateToSettings,
    onImportSkill,
    onRefreshSkills,
  });

  return {
    pathReferences,
    handleComposerHistoryRecall,
    editorRef,
    composerController,
    isWorkspaceVariant,
    pendingImages,
    fileInputRef,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDrop,
    handleRemoveImage,
    showHintPopup,
    hintRoutes,
    hintIndex,
    handleHintSelect,
    handleHintKeyDown,
    activeTools,
    handleToolClick,
    isFullscreen,
    handleSend,
    inputAdapter,
    topExtra,
    dialogLayer,
    pluginSuggestions,
    activePluginSelection,
    handleSelectPlugin,
    workflowQuickActions,
    workflowQueueItems,
    workflowActiveItem,
    workflowQueueTotalCount,
    workflowCompletedCount,
    workflowTotalCount,
    workflowProgressLabel,
    workflowSummaryLabel,
    renderWorkflowGeneratingPanel,
    skillSelection,
    handleSelectInputCapability,
    activeCapability,
    knowledgeHubOpenRequestKey,
  };
}
