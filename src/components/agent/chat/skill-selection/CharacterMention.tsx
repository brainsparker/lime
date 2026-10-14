
import type { CharacterMentionProps } from "./CharacterMention.types";
import { replaceComposerText, resolveComposerTrigger, mergeTriggerSelectionText, type TriggerMode, type ActiveTrigger, type PendingCuratedTaskLaunch } from "./composerMentionSelection";
import { useCharacterMentionSelection } from "./useCharacterMentionSelection";
/**
 * 角色与技能引用组件
 *
 * 在输入框中检测 @ 或 / 符号，显示角色、技能与命令列表供选择
 */

import React, { Suspense, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";



import { filterMentionableServiceSkills } from "@/components/agent/chat/service-skills/entryAdapter";




import { filterSlashCommands } from "../commands";
import { filterBuiltinCommands, filterRuntimeSceneSlashCommands } from "./builtinCommands";

import { LazyCharacterMentionPanel, preloadCharacterMentionPanel } from "./characterMentionPanelLoader";
import { isCompleteInputbarPluginTriggerQuery } from "../components/Inputbar/pluginInputCapability";

import { subscribeSlashEntryUsageChanged } from "./slashEntryUsage";
import { subscribeMentionEntryUsageChanged } from "./mentionEntryUsage";
import { partitionMentionableSkills } from "./skillQuery";
import { useRuntimeInputCapabilityCatalog } from "./runtimeInputCapabilityCatalog";
import { useIdleModulePreload } from "./useIdleModulePreload";
import { buildCuratedTaskLaunchPrompt, recordCuratedTaskTemplateUsage, subscribeCuratedTaskTemplateUsageChanged, type CuratedTaskInputValues, type CuratedTaskTemplateItem } from "../utils/curatedTaskTemplates";
import { subscribeCuratedTaskRecommendationSignalsChanged } from "../utils/curatedTaskRecommendationSignals";
import { CuratedTaskLauncherDialog } from "../components/CuratedTaskLauncherDialog";
import { extractCuratedTaskReferenceMemoryIds, mergeCuratedTaskReferenceEntries, normalizeCuratedTaskReferenceMemoryIds } from "../utils/curatedTaskReferenceSelection";
import type { CuratedTaskReferenceSelection } from "../utils/curatedTaskReferenceSelection";


import { useProjectFileMentionSearch } from "./useProjectFileMentionSearch";

export function CharacterMention({
  characters,
  skills = [],
  serviceSkills = [],
  serviceSkillGroups = [],
  editorRef,
  controller,
  value,
  onChange: notifyChange,
  onSelectCharacter,
  onSelectInputCapability,
  onSelectCuratedTask,
  onSelectPlugin,
  pluginSuggestions = [],
  onSkillSuggestionsNeeded,
  onPluginSuggestionsNeeded,
  projectId,
  sessionId,
  defaultCuratedTaskReferenceMemoryIds = [],
  defaultCuratedTaskReferenceEntries = [],
  onNavigateToSettings,
  inputCompletionEnabled = true,
}: CharacterMentionProps) {
  const onChange = useCallback((next: string) => {
    replaceComposerText(controller, next);
    notifyChange(controller.getDocument().text);
  }, [controller, notifyChange]);
  const { t } = useTranslation("agent");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("mention");
  const [pendingCuratedTaskLaunch, setPendingCuratedTaskLaunch] =
    useState<PendingCuratedTaskLaunch | null>(null);
  const [panelAnchor, setPanelAnchor] = useState({
    top: 0,
    left: 0,
    width: 320,
    bottom: 0,
    maxHeight: 320,
  });
  const commandRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<ActiveTrigger | null>(null);
  const [
    curatedTaskRecommendationSignalsVersion,
    setCuratedTaskRecommendationSignalsVersion,
  ] = useState(0);
  const [curatedTaskTemplatesVersion, setCuratedTaskTemplatesVersion] =
    useState(0);
  const [mentionEntryUsageVersion, setMentionEntryUsageVersion] = useState(0);
  const [slashEntryUsageVersion, setSlashEntryUsageVersion] = useState(0);
  const {
    builtinCommands: runtimeBuiltinCommands,
    sceneCommands: runtimeSceneCommands,
  } = useRuntimeInputCapabilityCatalog();

  useIdleModulePreload(() => {
    void preloadCharacterMentionPanel();
  });

  useEffect(() => {
    if (showMentions) {
      onSkillSuggestionsNeeded?.();
      onPluginSuggestionsNeeded?.();
    }
  }, [onPluginSuggestionsNeeded, onSkillSuggestionsNeeded, showMentions]);

  const filteredBuiltinCommands = useMemo(
    () => filterBuiltinCommands(mentionQuery, runtimeBuiltinCommands),
    [mentionQuery, runtimeBuiltinCommands],
  );
  const filteredServiceSkills = useMemo(
    () => filterMentionableServiceSkills(serviceSkills, mentionQuery),
    [mentionQuery, serviceSkills],
  );
  const filteredSlashCommands = useMemo(
    () => filterSlashCommands(mentionQuery),
    [mentionQuery],
  );
  const filteredRuntimeSceneCommands = useMemo(
    () => filterRuntimeSceneSlashCommands(mentionQuery, runtimeSceneCommands),
    [mentionQuery, runtimeSceneCommands],
  );

  const filteredCharacters = useMemo(() => {
    if (!mentionQuery) return characters;
    const query = mentionQuery.toLowerCase();
    return characters.filter(
      (char) =>
        char.name.toLowerCase().includes(query) ||
        char.description?.toLowerCase().includes(query),
    );
  }, [characters, mentionQuery]);

  const { installedSkills, availableSkills } = useMemo(
    () => partitionMentionableSkills(skills, mentionQuery),
    [skills, mentionQuery],
  );
  const projectFileSearch = useProjectFileMentionSearch({
    active: showMentions && triggerMode === "mention",
    projectId,
    query: mentionQuery,
  });

  const updateMentionState = useCallback(() => {
    if (!inputCompletionEnabled) {
      setMentionQuery("");
      setShowMentions(false);
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      setShowMentions(false);
      return;
    }

    const cursorPos = editor.getSelection().start;
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger) {
      activeTriggerRef.current = null;
      setShowMentions(false);
      return;
    }

    if (
      activeTrigger.mode === "mention" &&
      isCompleteInputbarPluginTriggerQuery({
        query: activeTrigger.query,
        plugins: pluginSuggestions,
      })
    ) {
      activeTriggerRef.current = null;
      setMentionQuery("");
      setShowMentions(false);
      return;
    }

    activeTriggerRef.current = activeTrigger;
    setMentionQuery(activeTrigger.query);
    setTriggerMode(activeTrigger.mode);
    setShowMentions(true);

    const rect = editor.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 800;
    const screenPadding = viewportWidth < 640 ? 12 : 16;
    const panelGap = viewportWidth < 640 ? 6 : 8;
    const panelWidth = Math.min(
      rect.width,
      Math.max(viewportWidth - screenPadding * 2, 240),
    );
    const left = Math.min(
      Math.max(rect.left, screenPadding),
      viewportWidth - panelWidth - screenPadding,
    );
    setPanelAnchor({
      top: rect.top,
      left,
      width: panelWidth,
      bottom: Math.max(viewportHeight - rect.top + panelGap, panelGap),
      maxHeight: Math.max(
        Math.min(rect.top - panelGap - screenPadding, 420),
        120,
      ),
    });
  }, [controller, inputCompletionEnabled, editorRef, pluginSuggestions]);

  useEffect(() => {
    if (!inputCompletionEnabled) {
      setShowMentions(false);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    editor.getElement()?.addEventListener("input", updateMentionState);
    editor.getElement()?.addEventListener("click", updateMentionState);
    editor.getElement()?.addEventListener("keyup", updateMentionState);

    return () => {
      editor.getElement()?.removeEventListener("input", updateMentionState);
      editor.getElement()?.removeEventListener("click", updateMentionState);
      editor.getElement()?.removeEventListener("keyup", updateMentionState);
    };
  }, [inputCompletionEnabled, editorRef, updateMentionState]);

  useEffect(() => {
    updateMentionState();
  }, [updateMentionState, value]);
  useEffect(() => controller.subscribe(updateMentionState), [controller, updateMentionState]);

  useEffect(() => {
    if (!showMentions) {
      return;
    }

    const handleReposition = () => {
      updateMentionState();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [showMentions, updateMentionState]);

  useEffect(() => {
    if (!showMentions) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        panelRef.current?.contains(target) ||
        editorRef.current?.contains(target)
      ) {
        return;
      }
      setShowMentions(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [editorRef, showMentions]);

  useEffect(() => {
    return subscribeCuratedTaskTemplateUsageChanged(() => {
      setCuratedTaskTemplatesVersion((previous) => previous + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeCuratedTaskRecommendationSignalsChanged(() => {
      setCuratedTaskRecommendationSignalsVersion((previous) => previous + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeMentionEntryUsageChanged(() => {
      setMentionEntryUsageVersion((previous) => previous + 1);
    });
  }, []);

  useEffect(() => {
    return subscribeSlashEntryUsageChanged(() => {
      setSlashEntryUsageVersion((previous) => previous + 1);
    });
  }, []);

  const { handleSelectProjectFile, handleSelectCapabilityDescriptor } = useCharacterMentionSelection({ editorRef, controller, onChange, onSelectCharacter, onSelectInputCapability, onSelectPlugin, onNavigateToSettings, activeTriggerRef, serviceSkills, setShowMentions, setPendingCuratedTaskLaunch, defaultCuratedTaskReferenceEntries, defaultCuratedTaskReferenceMemoryIds });

  const handleCuratedTaskLauncherOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      const pendingLaunch = pendingCuratedTaskLaunch;
      setPendingCuratedTaskLaunch(null);

      const editor = editorRef.current;
      if (!editor || !pendingLaunch) {
        return;
      }

      setTimeout(() => {
        editor.focus();
        const nextCursorPos = Math.min(
          pendingLaunch.restoreCursorPos,
          controller.getDocument().text.length,
        );
        editor.setSelection({ start: nextCursorPos, end: nextCursorPos });
      }, 0);
    },
    [controller, editorRef, pendingCuratedTaskLaunch],
  );
  const handleApplyCuratedTaskReviewSuggestion = useCallback(
    (
      task: CuratedTaskTemplateItem,
      options: {
        inputValues: CuratedTaskInputValues;
        referenceSelection: CuratedTaskReferenceSelection;
      },
    ) => {
      setPendingCuratedTaskLaunch((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          task,
          initialInputValues: options.inputValues,
          initialReferenceMemoryIds:
            normalizeCuratedTaskReferenceMemoryIds(
              options.referenceSelection.referenceMemoryIds,
            ) ?? [],
          initialReferenceEntries: mergeCuratedTaskReferenceEntries(
            options.referenceSelection.referenceEntries,
          ),
          launcherPrefillHint:
            "已按最近判断切到更适合的结果模板，你可以继续改后再发。",
        };
      });
    },
    [],
  );

  const handleConfirmCuratedTaskLaunch = useCallback(
    (
      task: CuratedTaskTemplateItem,
      inputValues: CuratedTaskInputValues,
      referenceSelection: CuratedTaskReferenceSelection,
    ) => {
      const pendingLaunch = pendingCuratedTaskLaunch;
      const editor = editorRef.current;
      if (!pendingLaunch || !editor) {
        return;
      }

      const launchPrompt = buildCuratedTaskLaunchPrompt({
        task,
        inputValues,
        referenceEntries: referenceSelection.referenceEntries,
      });
      const nextSelection = mergeTriggerSelectionText({
        leadingText: pendingLaunch.leadingText,
        insertedText: launchPrompt,
        trailingText: pendingLaunch.trailingText,
      });
      const launchedTask = {
        ...task,
        prompt: launchPrompt,
      };

      onChange(nextSelection.value);
      recordCuratedTaskTemplateUsage({
        templateId: task.id,
        launchInputValues: inputValues,
        referenceMemoryIds: referenceSelection.referenceMemoryIds,
        referenceEntries: referenceSelection.referenceEntries,
      });
      setPendingCuratedTaskLaunch(null);

      if (onSelectInputCapability) {
        onSelectInputCapability(
          {
            kind: "curated_task",
            task: launchedTask,
            launchInputValues: inputValues,
            referenceMemoryIds: referenceSelection.referenceMemoryIds,
            referenceEntries: referenceSelection.referenceEntries,
          },
          {
            replayText: launchPrompt,
          },
        );
      } else {
        onSelectCuratedTask?.(launchedTask);
      }

      setTimeout(() => {
        editor.focus();
        editor.setSelection({ start: nextSelection.cursorPos, end: nextSelection.cursorPos });
      }, 0);
    },
    [
      editorRef,
      onChange,
      onSelectCuratedTask,
      onSelectInputCapability,
      pendingCuratedTaskLaunch,
    ],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !showMentions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const composing =
        editor.isComposing() || e.isComposing ||
        e.key === "Process" ||
        e.keyCode === 229;
      if (composing) {
        return;
      }

      if (e.key === "Escape") {
        setShowMentions(false);
        e.preventDefault();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const cmdkRoot = commandRef.current;
        if (cmdkRoot) {
          cmdkRoot.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: e.key,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      }
    };

    editor.getElement()?.addEventListener("keydown", handleKeyDown, true);
    return () => editor.getElement()?.removeEventListener("keydown", handleKeyDown, true);
  }, [showMentions, editorRef]);

  if (!showMentions && !pendingCuratedTaskLaunch) return null;

  return createPortal(
    <>
      {showMentions ? (
        <>
          <div
            data-testid="mention-anchor"
            style={{
              position: "fixed",
              top: panelAnchor.top,
              left: panelAnchor.left,
              width: panelAnchor.width,
              height: 1,
              pointerEvents: "none",
              zIndex: 79,
            }}
          />
          <div
            ref={panelRef}
            data-testid="mention-popover-content"
            data-side="top"
            data-align="start"
            data-avoid-collisions="false"
            className="border bg-background p-0 shadow-md"
            style={{
              position: "fixed",
              left: panelAnchor.left,
              bottom: panelAnchor.bottom,
              width: `${panelAnchor.width}px`,
              maxWidth: "calc(100vw - 24px)",
              maxHeight: `${panelAnchor.maxHeight}px`,
              overflow: "auto",
              zIndex: 80,
            }}
          >
            <Suspense
              fallback={
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("agentChat.characterMention.loading", "加载中...")}
                </div>
              }
            >
              <LazyCharacterMentionPanel
                mode={triggerMode}
                mentionQuery={mentionQuery}
                builtinCommands={filteredBuiltinCommands}
                slashCommands={filteredSlashCommands}
                sceneCommands={filteredRuntimeSceneCommands}
                mentionServiceSkills={filteredServiceSkills}
                pluginSuggestions={pluginSuggestions}
                serviceSkillGroups={serviceSkillGroups}
                filteredCharacters={filteredCharacters}
                installedSkills={installedSkills}
                availableSkills={availableSkills}
                projectFiles={projectFileSearch.files}
                projectFileSearchStatus={projectFileSearch.status}
                projectId={projectId}
                sessionId={sessionId}
                referenceEntries={defaultCuratedTaskReferenceEntries}
                curatedTaskTemplatesVersion={curatedTaskTemplatesVersion}
                curatedTaskRecommendationSignalsVersion={
                  curatedTaskRecommendationSignalsVersion
                }
                mentionEntryUsageVersion={mentionEntryUsageVersion}
                slashEntryUsageVersion={slashEntryUsageVersion}
                commandRef={commandRef}
                onQueryChange={setMentionQuery}
                onSelectCapability={handleSelectCapabilityDescriptor}
                onSelectProjectFile={handleSelectProjectFile}
                onNavigateToSettings={
                  onNavigateToSettings
                    ? () => {
                        setShowMentions(false);
                        onNavigateToSettings();
                      }
                    : undefined
                }
              />
            </Suspense>
          </div>
        </>
      ) : null}
      <CuratedTaskLauncherDialog
        open={Boolean(pendingCuratedTaskLaunch)}
        task={pendingCuratedTaskLaunch?.task ?? null}
        projectId={projectId}
        sessionId={sessionId}
        initialInputValues={pendingCuratedTaskLaunch?.initialInputValues}
        initialReferenceMemoryIds={
          pendingCuratedTaskLaunch?.initialReferenceMemoryIds ??
          normalizeCuratedTaskReferenceMemoryIds([
            ...defaultCuratedTaskReferenceMemoryIds,
            ...(extractCuratedTaskReferenceMemoryIds(
              defaultCuratedTaskReferenceEntries,
            ) ?? []),
          ])
        }
        initialReferenceEntries={
          pendingCuratedTaskLaunch?.initialReferenceEntries ??
          mergeCuratedTaskReferenceEntries(defaultCuratedTaskReferenceEntries)
        }
        prefillHint={pendingCuratedTaskLaunch?.launcherPrefillHint}
        onOpenChange={handleCuratedTaskLauncherOpenChange}
        onApplyReviewSuggestion={handleApplyCuratedTaskReviewSuggestion}
        onConfirm={handleConfirmCuratedTaskLaunch}
      />
    </>,
    document.body,
  );
}
