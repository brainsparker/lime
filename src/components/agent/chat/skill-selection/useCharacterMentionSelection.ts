import { insertComposerSkill, insertComposerPlugin } from "./composerCapabilityMention";
import type React from "react";
import type { Character } from "@/lib/api/projectMemory";
import type { Skill } from "@/lib/api/skills";
import { listServiceSkills } from "@/lib/api/serviceSkills";
import type { ProjectFileSearchResult } from "@/lib/api/fuzzyFileSearch";
import { toast } from "sonner";
import type { SlashCommandDefinition } from "../commands";
import type { BuiltinInputCommand, RuntimeSceneSlashCommand } from "./builtinCommands";
import type { InputCapabilityActivationOptions } from "./inputCapabilitySelection";
import type { InputCapabilityDescriptor } from "./inputCapabilitySections";
import type { ServiceSkillHomeItem } from "../service-skills/types";
import { matchesRuntimeSceneCommandToServiceSkill } from "../service-skills/runtimeSceneBinding";
import { type InputbarPluginCapability, type InputbarPluginSkillCapability } from "../components/Inputbar/pluginInputCapability";
import { mergeCuratedTaskReferenceEntries, normalizeCuratedTaskReferenceMemoryIds, extractCuratedTaskReferenceMemoryIds, type CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";
import type { CuratedTaskTemplateItem, CuratedTaskInputValues } from "../utils/curatedTaskTemplates";
import { recordSlashEntryUsage } from "./slashEntryUsage";
import type { CharacterMentionProps } from "./CharacterMention.types";
import { resolveComposerTrigger, normalizeReplayText, mergeTriggerSelectionText, toServiceSkillHomeItem, type ActiveTrigger, type PendingCuratedTaskLaunch } from "./composerMentionSelection";

interface SelectionOptions extends Pick<CharacterMentionProps, "editorRef" | "controller" | "onSelectCharacter" | "onSelectInputCapability" | "onSelectPlugin" | "onNavigateToSettings"> {
  onChange: (value: string) => void;
  activeTriggerRef: React.RefObject<ActiveTrigger | null>;
  serviceSkills: ServiceSkillHomeItem[];
  setShowMentions: (show: boolean) => void;
  setPendingCuratedTaskLaunch: (launch: PendingCuratedTaskLaunch) => void;
  defaultCuratedTaskReferenceEntries: CuratedTaskReferenceEntry[];
  defaultCuratedTaskReferenceMemoryIds: string[];
}

export function useCharacterMentionSelection({ editorRef, controller, onChange, onSelectCharacter, onSelectInputCapability, onSelectPlugin, onNavigateToSettings, activeTriggerRef, serviceSkills, setShowMentions, setPendingCuratedTaskLaunch, defaultCuratedTaskReferenceEntries, defaultCuratedTaskReferenceMemoryIds }: SelectionOptions) {
  const handleSelectCharacter = (character: Character) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "mention") {
      return;
    }

    const newValue =
      currentValue.slice(0, activeTrigger.triggerIndex) +
      `@${character.name} ` +
      textAfterCursor;

    onChange(newValue);
    setShowMentions(false);
    onSelectCharacter?.(character);

    setTimeout(() => {
      editor.focus();
      const newCursorPos =
        activeTrigger.triggerIndex + character.name.length + 2;
      editor.setSelection({ start: newCursorPos, end: newCursorPos });
    }, 0);
  };

  const handleSelectProjectFile = (file: ProjectFileSearchResult) => {
    const editor = editorRef.current;
    if (!editor) return;

    const cursorPos = editor.getSelection().start;
    const activeTrigger =
      activeTriggerRef.current?.mode === "mention"
        ? activeTriggerRef.current
        : resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "mention") {
      return;
    }

    controller.insertMention({ kind: "file", id: file.path, name: file.file_name, path: file.path, label: file.path.includes(" ") ? `"${file.path}"` : file.path }, { start: activeTrigger.triggerIndex, end: activeTrigger.triggerIndex + activeTrigger.query.length + 1 });
    onChange(controller.getDocument().text);
    setShowMentions(false);
    editor.focus();
  };

  const handleSelectInstalledSkill = (
    skill: Skill,
    options?: InputCapabilityActivationOptions,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const cursorPos = editor.getSelection().start;
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger) {
      return;
    }

    const replayText = normalizeReplayText(options?.replayText);
    insertComposerSkill(controller, skill, { start: activeTrigger.triggerIndex, end: cursorPos });
    if (replayText) controller.replaceRange(editor.getSelection(), ` ${replayText}`);
    onChange(controller.getDocument().text);
    setShowMentions(false);
    onSelectInputCapability?.({ kind: "installed_skill", skill }, replayText ? { replayText } : undefined);
    recordSlashEntryUsage({ kind: "skill", entryId: skill.key, replayText: replayText || undefined });
    editor.focus();
  };

  const handleSelectAvailableSkill = (skill: Skill) => {
    setShowMentions(false);

    toast.info(`技能「${skill.name}」尚未安装`, {
      action: onNavigateToSettings
        ? {
            label: "去技能中心",
            onClick: onNavigateToSettings,
          }
        : undefined,
    });
  };

  const handleSelectBuiltinCommand = (
    command: BuiltinInputCommand,
    options?: InputCapabilityActivationOptions,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "mention") {
      return;
    }

    const leadingText = currentValue.slice(0, activeTrigger.triggerIndex);
    const replayText = normalizeReplayText(options?.replayText);

    if (onSelectInputCapability) {
      const nextSelection = replayText
        ? mergeTriggerSelectionText({
            leadingText,
            insertedText: replayText,
            trailingText: textAfterCursor,
          })
        : {
            value: `${leadingText}${textAfterCursor}`,
            cursorPos: Math.max(0, activeTrigger.triggerIndex),
          };
      const normalizedValue =
        nextSelection.value.trimEnd() === "" ? "" : nextSelection.value;

      onChange(normalizedValue);
      setShowMentions(false);
      onSelectInputCapability(
        {
          kind: "builtin_command",
          command,
        },
        replayText ? { replayText } : undefined,
      );

      setTimeout(() => {
        editor.focus();
        const newCursorPos = Math.min(
          nextSelection.cursorPos,
          normalizedValue.length,
        );
        editor.setSelection({ start: newCursorPos, end: newCursorPos });
      }, 0);
      return;
    }

    const nextSelection = replayText
      ? mergeTriggerSelectionText({
          leadingText,
          insertedText: `${command.commandPrefix} ${replayText}`,
          trailingText: textAfterCursor,
        })
      : {
          value: `${leadingText}${command.commandPrefix} ${textAfterCursor}`,
          cursorPos:
            activeTrigger.triggerIndex + command.commandPrefix.length + 1,
        };

    onChange(nextSelection.value);
    setShowMentions(false);

    setTimeout(() => {
      editor.focus();
      const newCursorPos = nextSelection.cursorPos;
      editor.setSelection({ start: newCursorPos, end: newCursorPos });
    }, 0);
  };

  const handleSelectServiceSkill = (skill: ServiceSkillHomeItem) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "mention") {
      return;
    }

    if (onSelectInputCapability) {
      const newValue =
        currentValue.slice(0, activeTrigger.triggerIndex) + textAfterCursor;
      onChange(newValue.trimEnd() === "" ? "" : newValue);
      setShowMentions(false);
      onSelectInputCapability({
        kind: "service_skill",
        skill,
      });

      setTimeout(() => {
        editor.focus();
        const newCursorPos = Math.max(0, activeTrigger.triggerIndex);
        editor.setSelection({ start: newCursorPos, end: newCursorPos });
      }, 0);
      return;
    }

    const newValue =
      currentValue.slice(0, activeTrigger.triggerIndex) +
      `@${skill.title} ` +
      textAfterCursor;
    onChange(newValue);
    setShowMentions(false);

    setTimeout(() => {
      editor.focus();
      const newCursorPos = activeTrigger.triggerIndex + skill.title.length + 2;
      editor.setSelection({ start: newCursorPos, end: newCursorPos });
    }, 0);
  };

  const handleSelectPlugin = (
    plugin: InputbarPluginCapability,
    skill?: InputbarPluginSkillCapability,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const fallbackCursorPos = editor.getSelection().start;
    const fallbackTrigger = resolveComposerTrigger(
      controller.getEditorState().doc,
      fallbackCursorPos,
    );
    const activeTrigger =
      activeTriggerRef.current?.mode === "mention"
        ? activeTriggerRef.current
        : fallbackTrigger;
    if (!activeTrigger || activeTrigger.mode !== "mention") {
      return;
    }

    insertComposerPlugin(controller, plugin, skill, { start: activeTrigger.triggerIndex, end: activeTrigger.triggerIndex + activeTrigger.query.length + 1 });
    const next = controller.getDocument().text;
    onChange(next);
    setShowMentions(false);
    onSelectPlugin?.(plugin, skill, { inputOverride: next, preserveInputOverride: true });
    editor.focus();
  };

  const handleSelectSlashCommand = (
    command: SlashCommandDefinition,
    options?: { replayText?: string },
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "slash") {
      return;
    }

    const replayText = normalizeReplayText(options?.replayText);
    const nextSelection = replayText
      ? mergeTriggerSelectionText({
          leadingText: currentValue.slice(0, activeTrigger.triggerIndex),
          insertedText: `${command.commandPrefix} ${replayText}`,
          trailingText: textAfterCursor,
        })
      : {
          value:
            currentValue.slice(0, activeTrigger.triggerIndex) +
            `${command.commandPrefix} ` +
            textAfterCursor,
          cursorPos:
            activeTrigger.triggerIndex + command.commandPrefix.length + 1,
        };

    onChange(nextSelection.value);
    setShowMentions(false);
    if (command.support === "supported") {
      recordSlashEntryUsage({
        kind: "command",
        entryId: command.key,
        replayText: replayText || undefined,
      });
    }

    setTimeout(() => {
      editor.focus();
      const newCursorPos = nextSelection.cursorPos;
      editor.setSelection({ start: newCursorPos, end: newCursorPos });
    }, 0);
  };

  const handleSelectRuntimeSceneCommand = async (
    command: RuntimeSceneSlashCommand,
    options?: { replayText?: string },
  ) => {
    const replayText = normalizeReplayText(options?.replayText);

    const matchedVisibleSkill = serviceSkills.find((skill) =>
      matchesRuntimeSceneCommandToServiceSkill(skill, command),
    );
    const shouldResolveServiceSkill =
      !replayText &&
      onSelectInputCapability &&
      (matchedVisibleSkill || command.linkedSkillId);

    if (shouldResolveServiceSkill) {
      const matchedSkill =
        matchedVisibleSkill ||
        (await (async () => {
          try {
            const runtimeSkills = await listServiceSkills();
            const runtimeMatchedSkill = runtimeSkills.find((skill) =>
              matchesRuntimeSceneCommandToServiceSkill(skill, command),
            );
            return runtimeMatchedSkill
              ? toServiceSkillHomeItem(runtimeMatchedSkill)
              : null;
          } catch {
            return null;
          }
        })());

      if (
        matchedSkill &&
        matchedSkill.slotSchema.some((slot) => slot.required)
      ) {
        onSelectInputCapability({
          kind: "service_skill",
          skill: matchedSkill,
        });
        setShowMentions(false);
        recordSlashEntryUsage({
          kind: "scene",
          entryId: command.key,
        });
        return;
      }
    }

    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "slash") {
      return;
    }

    if (onSelectInputCapability) {
      const leadingText = currentValue.slice(0, activeTrigger.triggerIndex);
      const nextSelection = replayText
        ? mergeTriggerSelectionText({
            leadingText,
            insertedText: replayText,
            trailingText: textAfterCursor,
          })
        : {
            value: `${leadingText}${textAfterCursor}`,
            cursorPos: Math.max(0, activeTrigger.triggerIndex),
          };
      const normalizedValue =
        nextSelection.value.trimEnd() === "" ? "" : nextSelection.value;

      onChange(normalizedValue);
      setShowMentions(false);
      onSelectInputCapability(
        {
          kind: "runtime_scene",
          command,
        },
        replayText ? { replayText } : undefined,
      );

      setTimeout(() => {
        editor.focus();
        const newCursorPos = Math.min(
          nextSelection.cursorPos,
          normalizedValue.length,
        );
        editor.setSelection({ start: newCursorPos, end: newCursorPos });
      }, 0);
      return;
    }

    const nextSelection = replayText
      ? mergeTriggerSelectionText({
          leadingText: currentValue.slice(0, activeTrigger.triggerIndex),
          insertedText: `${command.commandPrefix} ${replayText}`,
          trailingText: textAfterCursor,
        })
      : {
          value:
            currentValue.slice(0, activeTrigger.triggerIndex) +
            `${command.commandPrefix} ` +
            textAfterCursor,
          cursorPos:
            activeTrigger.triggerIndex + command.commandPrefix.length + 1,
        };

    onChange(nextSelection.value);
    setShowMentions(false);
    recordSlashEntryUsage({
      kind: "scene",
      entryId: command.key,
      replayText: replayText || undefined,
    });

    setTimeout(() => {
      editor.focus();
      const newCursorPos = nextSelection.cursorPos;
      editor.setSelection({ start: newCursorPos, end: newCursorPos });
    }, 0);
  };

  const handleSelectCuratedTask = (
    task: CuratedTaskTemplateItem,
    options?: {
      launchInputValues?: CuratedTaskInputValues;
      referenceMemoryIds?: string[];
      referenceEntries?: CuratedTaskReferenceEntry[];
      launcherPrefillHint?: string;
    },
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = controller.getDocument().text;
    const cursorPos = editor.getSelection().start;
    const textAfterCursor = currentValue.slice(cursorPos);
    const activeTrigger = resolveComposerTrigger(controller.getEditorState().doc, cursorPos);
    if (!activeTrigger || activeTrigger.mode !== "slash") {
      return;
    }

    const mergedReferenceEntries = mergeCuratedTaskReferenceEntries([
      ...(options?.referenceEntries ?? []),
      ...defaultCuratedTaskReferenceEntries,
    ]);
    const mergedReferenceMemoryIds =
      normalizeCuratedTaskReferenceMemoryIds([
        ...(options?.referenceMemoryIds ?? []),
        ...(extractCuratedTaskReferenceMemoryIds(mergedReferenceEntries) ?? []),
        ...defaultCuratedTaskReferenceMemoryIds,
      ]) ?? [];

    setShowMentions(false);
    setPendingCuratedTaskLaunch({
      task,
      leadingText: currentValue.slice(0, activeTrigger.triggerIndex),
      trailingText: textAfterCursor,
      restoreCursorPos: cursorPos,
      initialInputValues: options?.launchInputValues,
      initialReferenceMemoryIds: mergedReferenceMemoryIds,
      initialReferenceEntries: mergedReferenceEntries,
      launcherPrefillHint: options?.launcherPrefillHint,
    });
  };

  const handleSelectCapabilityDescriptor = (
    item: InputCapabilityDescriptor,
  ) => {
    switch (item.kind) {
      case "builtin_command":
        handleSelectBuiltinCommand(item.command, {
          replayText: item.replayText,
        });
        return;
      case "service_skill":
        handleSelectServiceSkill(item.skill);
        return;
      case "plugin":
        handleSelectPlugin(item.plugin, item.skill);
        return;
      case "slash_command":
        handleSelectSlashCommand(item.command, {
          replayText: item.replayText,
        });
        return;
      case "scene_command":
        void handleSelectRuntimeSceneCommand(item.command, {
          replayText: item.replayText,
        });
        return;
      case "curated_task":
        handleSelectCuratedTask(item.task, {
          launchInputValues: item.launchInputValues,
          referenceMemoryIds: item.referenceMemoryIds,
          referenceEntries: item.referenceEntries,
          launcherPrefillHint: item.launcherPrefillHint,
        });
        return;
      case "character":
        handleSelectCharacter(item.character);
        return;
      case "installed_skill":
        handleSelectInstalledSkill(item.skill, {
          replayText: item.replayText,
        });
        return;
      case "available_skill":
        handleSelectAvailableSkill(item.skill);
        return;
      default:
        return;
    }
  };

  return { handleSelectCharacter, handleSelectProjectFile, handleSelectInstalledSkill, handleSelectAvailableSkill, handleSelectBuiltinCommand, handleSelectServiceSkill, handleSelectPlugin, handleSelectSlashCommand, handleSelectRuntimeSceneCommand, handleSelectCuratedTask, handleSelectCapabilityDescriptor };
}
