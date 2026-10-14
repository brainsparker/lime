import { baseKeymap } from "@tiptap/pm/commands";
import { undo, redo } from "@tiptap/pm/history";
import { keymap } from "@tiptap/pm/keymap";
import type { EditorView } from "@tiptap/pm/view";
import type { ComposerController } from "./ComposerController";

export function createComposerEditingKeymap() {
  return [
    keymap({ "Mod-z": undo, "Shift-Mod-z": redo, "Mod-y": redo }),
    keymap(baseKeymap),
  ];
}

export function isComposerComposing(
  event: KeyboardEvent,
  view: EditorView,
  composing: boolean,
): boolean {
  return (
    composing ||
    view.composing ||
    event.isComposing ||
    event.key === "Process" ||
    event.keyCode === 229
  );
}

export function handleComposerKeyDown(options: {
  event: KeyboardEvent;
  view: EditorView;
  controller: ComposerController;
  onSubmit?: (metadata: {
    triggeredAt: number;
    triggerSource: "enter";
  }) => void;
  onEscape?: () => boolean | void;
  sendOnEnter: boolean;
}): boolean {
  const { event, view, controller, onSubmit, onEscape, sendOnEnter } = options;
  const unmodified =
    !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  if (
    event.key === "Enter" &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    view.state.selection.$from.parent === view.state.selection.$to.parent &&
    view.state.selection.$from.parent.type.spec.code
  ) {
    event.preventDefault();
    controller.applyTransaction(
      view.state.tr.insertText("\n").scrollIntoView(),
    );
    return true;
  }
  if (unmodified && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    const draft = controller.getDocument();
    const atBoundary =
      event.key === "ArrowUp"
        ? draft.selectionStart === 0 && draft.selectionEnd === 0
        : draft.selectionStart === draft.text.length &&
          draft.selectionEnd === draft.text.length;
    if (
      atBoundary &&
      controller.recallHistory(event.key === "ArrowUp" ? "previous" : "next")
    ) {
      event.preventDefault();
      return true;
    }
  }
  if (
    event.key === "Enter" &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    event.preventDefault();
    controller.applyTransaction(
      view.state.tr
        .replaceSelectionWith(view.state.schema.nodes.hard_break.create())
        .scrollIntoView(),
    );
    return true;
  }
  if (event.key === "Enter" && unmodified && sendOnEnter && onSubmit) {
    event.preventDefault();
    onSubmit({ triggeredAt: Date.now(), triggerSource: "enter" });
    return true;
  }
  if (event.key === "Escape" && onEscape) {
    const handled = onEscape();
    if (handled !== false) {
      event.preventDefault();
      return true;
    }
  }
  return false;
}
