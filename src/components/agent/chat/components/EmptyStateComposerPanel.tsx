import {
  isRuntimeSubmissionAccepted,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";
import type { ComposerDraftSnapshot } from "@/components/input-kit";
import { ComposerController } from "@/components/input-kit";
import type { ComposerEditorHandle } from "@/components/input-kit";
import React, { useRef, useState } from "react";
import styled from "styled-components";

import { InputbarAccessModeSelect } from "./Inputbar/components/InputbarAccessModeSelect";
import { InputbarCore } from "./Inputbar/components/InputbarCore";
import { InputbarModeStatusChip } from "./Inputbar/components/InputbarModeStatusChip";
import { ComposerUtilityBar } from "./Inputbar/components/ComposerUtilityBar";
import type { ComposerProject } from "./Inputbar/components/composerUtilityBarTypes";
import { InputbarModelExtra } from "./Inputbar/components/InputbarModelExtra";

import type { MessageImage, MessagePathReference } from "../types";

import { type SkillSelectionProps } from "../skill-selection/skillSelectionBindings";
import type { HomeSurfaceComposerCopy } from "../home/homeSurfaceCopy";
import type { AgentAccessMode } from "../hooks/agentChatStorage";
import type { SelectInputCapabilityHandler } from "../skill-selection/inputCapabilitySelection";

import { type InputbarPluginCapability } from "./Inputbar/pluginInputCapability";
import type { InputbarCoreCopy } from "./Inputbar/components/inputbarCoreCopy";
import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";
import type { BaseComposerSendMetadata } from "@/components/input-kit";
import {
  HomeComposerAccent,
  HomeComposerDecorationFrame,
} from "./HomeComposerDecorations";
import { useHomeSkinPresentation } from "./homeSkinPresentation";

const ConnectedComposerShell = styled.div`
  width: 100%;
  border: 1px solid var(--lime-composer-border, rgba(110, 231, 183, 0.84));
  border-radius: 22px;
  background: var(--lime-composer-surface);
  box-shadow:
    0 12px 30px var(--lime-shadow-color),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;

  > div:first-child {
    padding: 0;
  }

  [data-testid="inputbar-core-container"] {
    border: 0;
    border-radius: 21px 21px 0 0;
    box-shadow: none;
  }

  [data-testid="composer-editor"] {
    min-height: 136px;
    padding-top: 7px;
    font-size: 16px;
    line-height: 1.55;
  }

  [data-testid="inputbar-context-bar-slot"] {
    border: 0;
    border-top: 1px solid var(--lime-surface-border, rgba(226, 232, 240, 0.9));
    border-radius: 0 0 21px 21px;
  }

  &:focus-within {
    border-color: var(--lime-composer-border-focus, rgba(74, 222, 128, 0.7));
    box-shadow:
      0 0 0 3px var(--lime-focus-ring, rgba(74, 222, 128, 0.24)),
      0 14px 32px var(--lime-shadow-color),
      inset 0 1px 0 rgba(255, 255, 255, 0.92);
  }

  &:focus-within [data-testid="inputbar-core-container"] {
    border: 0;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
    box-shadow: none;
  }

  &:focus-within [data-testid="inputbar-context-bar-slot"] {
    border-top-color: var(
      --lime-surface-border-strong,
      rgba(203, 213, 225, 0.96)
    );
    background: var(
      --lime-composer-context-surface-focus,
      var(--lime-composer-surface-focus)
    );
    box-shadow: none;
  }
`;

interface EmptyStateComposerPanelProps {
  input: string;
  setInput: (value: string) => void;
  controller?: ComposerController;
  onHistoryRecall?: (draft: ComposerDraftSnapshot) => void;
  placeholder: string;
  onSend: (
    inputOverride?: string,
    modeState?: {
      goalEnabled?: boolean;
      planEnabled?: boolean;
      subagentEnabled?: boolean;
    },
    triggerMetadata?: BaseComposerSendMetadata,
  ) => Promise<RuntimeSubmissionResult>;
  onStop?: () => void;
  sendOnPointerDown?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  activeTheme: string;
  providerType: string;
  setProviderType: (type: string) => void;
  model: string;
  setModel: (model: string) => void;
  reasoningEffort?: ModelReasoningEffortLevel | "";
  setReasoningEffort?: (value: ModelReasoningEffortLevel | "") => void;
  accessMode?: AgentAccessMode;
  setAccessMode?: (mode: AgentAccessMode) => void;
  onManageProviders?: () => void;
  skillSelection: SkillSelectionProps;
  onSelectInputCapability?: SelectInputCapabilityHandler;
  projectId?: string | null;
  openedProjects?: ComposerProject[];
  onProjectContextChange?: (projectId: string | null) => void;
  projectContextModeLabel?: string;
  projectContextBranchLabel?: string;
  sessionId?: string | null;
  copy: HomeSurfaceComposerCopy;
  inputbarCopy: InputbarCoreCopy;
  pluginSuggestions?: readonly InputbarPluginCapability[];
  pluginSuggestionsError?: string | null;
  pluginSuggestionsLoading?: boolean;
  onPluginSuggestionsNeeded?: () => void;
  taskEnabled?: boolean;
  onTaskEnabledChange?: (enabled: boolean) => void;
  objectiveEnabled?: boolean;
  onObjectiveEnabledChange?: (enabled: boolean) => void;
  subagentEnabled: boolean;
  onSubagentEnabledChange?: (enabled: boolean) => void;
  pendingImages: MessageImage[];
  onAddFiles: () => Promise<boolean>;
  onPaste?: (event: ClipboardEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  onRemoveImage?: (index: number) => void;
  pathReferences?: MessagePathReference[];
  onImportPathReferenceAsKnowledge?: (reference: MessagePathReference) => void;
  onRemovePathReference?: (id: string) => void;
}

export function EmptyStateComposerPanel({
  input,
  setInput,
  controller,
  placeholder,
  onSend,
  onHistoryRecall,
  onStop,
  isLoading = false,
  disabled = false,
  activeTheme,
  providerType,
  setProviderType,
  model,
  setModel,
  reasoningEffort,
  setReasoningEffort,
  accessMode,
  setAccessMode,
  onManageProviders,
  skillSelection,
  onSelectInputCapability,
  projectId = null,
  openedProjects = [],
  onProjectContextChange,
  projectContextModeLabel,
  projectContextBranchLabel,
  sessionId = null,
  copy,
  inputbarCopy,
  pluginSuggestions = [],
  pluginSuggestionsError = null,
  pluginSuggestionsLoading = false,
  onPluginSuggestionsNeeded,
  taskEnabled = false,
  onTaskEnabledChange,
  objectiveEnabled: objectiveEnabledProp,
  onObjectiveEnabledChange,
  subagentEnabled,
  onSubagentEnabledChange,
  pendingImages,
  onAddFiles,
  onPaste,
  onDragOver,
  onDrop,
  onRemoveImage,
  pathReferences = [],
  onImportPathReferenceAsKnowledge,
  onRemovePathReference,
}: EmptyStateComposerPanelProps) {
  const { composerDecorations } = useHomeSkinPresentation();
  const [fallbackController] = useState(
    () => controller ?? new ComposerController({ text: input }),
  );
  const resolvedController = controller ?? fallbackController;
  const editorRef = useRef<ComposerEditorHandle>(null);
  const [localObjectiveEnabled, setLocalObjectiveEnabled] = useState(false);
  const objectiveEnabled = objectiveEnabledProp ?? localObjectiveEnabled;
  const handleSendDraft = (triggerMetadata?: BaseComposerSendMetadata) => {
    const submittedInput = resolvedController.getDocument().text;
    const result = onSend(
      submittedInput,
      {
        goalEnabled: objectiveEnabled,
        planEnabled: taskEnabled,
        subagentEnabled,
      },
      triggerMetadata,
    );
    if (controller) return;
    void result.then((accepted) => {
      if (isRuntimeSubmissionAccepted(accepted)) setInput("");
    });
  };

  const handleToggleSubagentMode = () => {
    onSubagentEnabledChange?.(!subagentEnabled);
  };

  const handleToggleTaskMode = () => {
    if (!taskEnabled && objectiveEnabled) {
      if (onObjectiveEnabledChange) onObjectiveEnabledChange(false);
      else setLocalObjectiveEnabled(false);
    }
    onTaskEnabledChange?.(!taskEnabled);
  };

  const handleToggleObjectiveMode = () => {
    const nextObjectiveEnabled = !objectiveEnabled;
    if (nextObjectiveEnabled && taskEnabled) onTaskEnabledChange?.(false);
    if (onObjectiveEnabledChange) {
      onObjectiveEnabledChange(nextObjectiveEnabled);
      return;
    }
    setLocalObjectiveEnabled(nextObjectiveEnabled);
  };

  const handleToolAction = (tool: string) => {
    switch (tool) {
      case "attach": {
        const editor = editorRef.current;
        void onAddFiles().then((added) => {
          if (
            added &&
            editorRef.current === editor &&
            editor?.getElement()?.isConnected
          )
            editor.focus();
        });
        return;
      }
      case "task_mode":
        handleToggleTaskMode();
        return;
      case "objective_mode":
        handleToggleObjectiveMode();
        return;
      case "subagent_mode":
        handleToggleSubagentMode();
        return;
      default:
        return;
    }
  };

  const contextCommands = copy.contextCommands;
  const planModeStatusLabel = contextCommands.planMode
    .replace(/模式$/, "")
    .replace(/ mode$/i, "");
  const objectiveStatusLabel = contextCommands.goal;

  const contextualSuggestions = {
    onAddFiles: () => handleToolAction("attach"),
    commands: [
      {
        id: "goal" as const,
        label: contextCommands.goal,
        onSelect: () => {
          if (!objectiveEnabled) handleToolAction("objective_mode");
        },
      },
      {
        id: "plan-mode" as const,
        label: contextCommands.planMode,
        onSelect: () => handleToolAction("task_mode"),
      },
    ],
    projectId,
    skills: skillSelection.skills,
    skillsLoading: skillSelection.isSkillsLoading,
    onSkillSuggestionsNeeded: skillSelection.onSkillSuggestionsNeeded,
    onSelectInputCapability,
    plugins: pluginSuggestions,
    pluginsLoading: pluginSuggestionsLoading,
    pluginsError: pluginSuggestionsError,
    onPluginSuggestionsNeeded,
    onChange: setInput,
  };
  const leftExtra = (
    <>
      <InputbarAccessModeSelect
        accessMode={accessMode}
        setAccessMode={setAccessMode}
      />
      <HomeComposerAccent icon={composerDecorations?.accentIcon} />

      {taskEnabled ? (
        <InputbarModeStatusChip
          label={planModeStatusLabel}
          testId="empty-state-task-mode-status"
          onRemove={() => handleToolAction("task_mode")}
        />
      ) : null}

      {objectiveEnabled ? (
        <InputbarModeStatusChip
          label={objectiveStatusLabel}
          testId="empty-state-objective-status"
          onRemove={() => handleToolAction("objective_mode")}
        />
      ) : null}
    </>
  );
  const trailingMeta = (
    <InputbarModelExtra
      providerType={providerType}
      setProviderType={setProviderType}
      model={model}
      setModel={setModel}
      reasoningEffort={reasoningEffort}
      setReasoningEffort={setReasoningEffort}
      activeTheme={activeTheme}
      onManageProviders={onManageProviders}
    />
  );
  const projectContextBar = (
    <div
      data-testid="inputbar-context-bar-slot"
      className="flex min-h-10 w-full items-center bg-[image:var(--lime-composer-context-surface,var(--lime-composer-surface))] px-4 py-1.5"
    >
      <ComposerUtilityBar
        projectId={projectId}
        openedProjects={openedProjects}
        onProjectChange={onProjectContextChange}
        modeLabel={projectContextModeLabel}
        branchLabel={projectContextBranchLabel}
        copy={inputbarCopy.projectContext}
      />
    </div>
  );
  return (
    <>
      <HomeComposerDecorationFrame>
        <ConnectedComposerShell data-testid="inputbar-connected-composer">
          <InputbarCore
            uiCopy={inputbarCopy}
            controller={resolvedController}
            sessionId={sessionId}
            commandPriority="fallback"
            editorRef={editorRef}
            text={input}
            setText={setInput}
            onSend={handleSendDraft}
            onHistoryRecall={onHistoryRecall}
            onStop={onStop}
            isLoading={isLoading}
            disabled={disabled}
            onToolClick={handleToolAction}
            pendingImages={pendingImages}
            onRemoveImage={onRemoveImage}
            onPaste={onPaste}
            onDragOver={onDragOver}
            onDrop={onDrop}
            placeholder={placeholder}
            showDragHandle={false}
            visualVariant="default"
            connectedContextBar
            deferSendOnEnter
            sendOnPointerDown
            leftExtra={leftExtra}
            trailingMeta={trailingMeta}
            pathReferences={pathReferences}
            onImportPathReferenceAsKnowledge={onImportPathReferenceAsKnowledge}
            onRemovePathReference={onRemovePathReference}
            showEditorExpandButton={false}
            contextualSuggestions={contextualSuggestions}
          />
          {projectContextBar}
        </ConnectedComposerShell>
      </HomeComposerDecorationFrame>
    </>
  );
}
