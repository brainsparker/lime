import type { ComposerController } from "@/components/input-kit";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { projectComposerDocument } from "@/components/input-kit/composerSerialization";
import type { ServiceSkillItem } from "@/lib/api/serviceSkills";
import type { ServiceSkillHomeItem } from "../service-skills/types";
import type {
  CuratedTaskInputValues,
  CuratedTaskTemplateItem,
} from "../utils/curatedTaskTemplates";
import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";
import {
  getServiceSkillActionLabel,
  getServiceSkillRunnerDescription,
  getServiceSkillRunnerLabel,
  getServiceSkillRunnerTone,
} from "../service-skills/skillPresentation";

export function replaceComposerText(
  controller: ComposerController,
  next: string,
): void {
  const previous = controller.getDocument().text;
  if (previous === next) return;
  let start = 0;
  while (
    start < previous.length &&
    start < next.length &&
    previous[start] === next[start]
  )
    start++;
  let end = previous.length;
  let nextEnd = next.length;
  while (
    end > start &&
    nextEnd > start &&
    previous[end - 1] === next[nextEnd - 1]
  ) {
    end--;
    nextEnd--;
  }
  controller.replaceRange({ start, end }, next.slice(start, nextEnd));
}

export type TriggerMode = "mention" | "slash";

export interface ActiveTrigger {
  mode: TriggerMode;
  triggerIndex: number;
  query: string;
}

export interface PendingCuratedTaskLaunch {
  task: CuratedTaskTemplateItem;
  leadingText: string;
  trailingText: string;
  restoreCursorPos: number;
  initialInputValues?: CuratedTaskInputValues;
  initialReferenceMemoryIds?: string[];
  initialReferenceEntries?: CuratedTaskReferenceEntry[];
  launcherPrefillHint?: string;
}

function resolveMentionTrigger(textBeforeCursor: string): ActiveTrigger | null {
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");
  if (lastAtIndex === -1) {
    return null;
  }

  const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
  if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
    return null;
  }

  return {
    mode: "mention",
    triggerIndex: lastAtIndex,
    query: textAfterAt,
  };
}

function resolveSlashTrigger(textBeforeCursor: string): ActiveTrigger | null {
  const slashMatch = textBeforeCursor.match(/(?:^|[\s\n])(\/[^\s\n/]*)$/);
  if (!slashMatch) {
    return null;
  }

  const slashToken = slashMatch[1];
  const triggerIndex = textBeforeCursor.length - slashToken.length;
  return {
    mode: "slash",
    triggerIndex,
    query: slashToken.slice(1),
  };
}

function resolveActiveTrigger(
  value: string,
  cursorPos: number,
): ActiveTrigger | null {
  const textBeforeCursor = value.slice(0, cursorPos);
  const mentionTrigger = resolveMentionTrigger(textBeforeCursor);
  const slashTrigger = resolveSlashTrigger(textBeforeCursor);

  if (!mentionTrigger) {
    return slashTrigger;
  }
  if (!slashTrigger) {
    return mentionTrigger;
  }

  return mentionTrigger.triggerIndex > slashTrigger.triggerIndex
    ? mentionTrigger
    : slashTrigger;
}

export function resolveComposerTrigger(
  document: ProseMirrorNode,
  cursorPos: number,
): ActiveTrigger | null {
  const { text, spans } = projectComposerDocument(document);
  const trigger = resolveActiveTrigger(text, cursorPos);
  if (!trigger) return null;
  // atom 标签仅供展示，补全只能消费可编辑正文。
  return spans.some(
    (span) =>
      span.atom && span.from < cursorPos && span.to > trigger.triggerIndex,
  )
    ? null
    : trigger;
}

export function normalizeReplayText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function mergeTriggerSelectionText(params: {
  leadingText: string;
  insertedText: string;
  trailingText: string;
}): { value: string; cursorPos: number } {
  const normalizedInsertedText = params.insertedText.trim();
  if (!normalizedInsertedText) {
    return {
      value: `${params.leadingText}${params.trailingText}`,
      cursorPos: params.leadingText.length,
    };
  }

  const needsLeadingSpace =
    params.leadingText.length > 0 && !/[\s\n]$/.test(params.leadingText);
  const needsTrailingSpace =
    params.trailingText.length > 0 && !/^[\s\n]/.test(params.trailingText);
  const mergedInsertedText = `${needsLeadingSpace ? " " : ""}${normalizedInsertedText}${
    needsTrailingSpace ? " " : ""
  }`;

  return {
    value: `${params.leadingText}${mergedInsertedText}${params.trailingText}`,
    cursorPos: params.leadingText.length + mergedInsertedText.length,
  };
}

export function toServiceSkillHomeItem(
  skill: ServiceSkillItem,
): ServiceSkillHomeItem {
  return {
    ...skill,
    badge: "",
    recentUsedAt: null,
    isRecent: false,
    runnerLabel: getServiceSkillRunnerLabel(skill),
    runnerTone: getServiceSkillRunnerTone(skill),
    runnerDescription: getServiceSkillRunnerDescription(skill),
    actionLabel: getServiceSkillActionLabel(skill),
    automationStatus: null,
  };
}
