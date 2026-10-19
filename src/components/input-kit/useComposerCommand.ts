import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ComposerEditorHandle } from "./ComposerEditor";
import { composerCommands } from "./ComposerCommands";

export function useComposerCommand({
  scope,
  editor,
  disabled,
  addFiles,
  priority,
}: {
  scope?: string | null;
  editor: RefObject<ComposerEditorHandle>;
  disabled: boolean;
  addFiles(): void;
  priority?: "normal" | "fallback";
}) {
  const addFilesRef = useRef(addFiles);
  useLayoutEffect(() => {
    addFilesRef.current = addFiles;
  }, [addFiles]);
  useLayoutEffect(() => {
    if (!scope) return;
    let frame: number | undefined;
    const activeEditor = () => {
      const element = editor.current?.getElement();
      return !disabled &&
        element?.isConnected === true &&
        element.getClientRects().length > 0
        ? element
        : null;
    };
    const dispose = composerCommands.register(scope, {
      priority,
      isActive: () => activeEditor() !== null,
      run: () => {
        const target = activeEditor();
        addFilesRef.current();
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = undefined;
          if (target && activeEditor() === target) editor.current?.focus();
        });
      },
    });
    return () => {
      dispose();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [scope, editor, disabled, priority]);
}
