import type { ComposerController } from "@/components/input-kit";

export interface DictationDraft {
  owner: ComposerController;
  revision: number;
  start: number;
  end: number;
  before: string;
  after: string;
}

export function captureDictationDraft(
  controller: ComposerController,
): DictationDraft {
  const { document, revision } = controller.getSnapshot();
  return {
    owner: controller,
    revision,
    start: document.selectionStart,
    end: document.selectionEnd,
    before: document.text.slice(0, document.selectionStart),
    after: document.text.slice(document.selectionEnd),
  };
}

export function applyDictationTranscript(
  controller: ComposerController,
  draft: DictationDraft,
  transcript: string,
): boolean {
  if (
    controller !== draft.owner ||
    controller.getSnapshot().revision !== draft.revision
  )
    return false;
  const clean = transcript.trim();
  if (!clean) return false;
  const leading = draft.before.trim() && !/\s$/.test(draft.before) ? " " : "";
  const trailing = draft.after.trim() && !/^\s/.test(draft.after) ? " " : "";
  const inserted = `${leading}${clean}${trailing}`;
  controller.replaceRange({ start: draft.start, end: draft.end }, inserted);
  draft.end = draft.start + inserted.length;
  draft.revision = controller.getSnapshot().revision;
  return true;
}
