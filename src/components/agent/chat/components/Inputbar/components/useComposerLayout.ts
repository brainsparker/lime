import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type {
  ComposerController,
  ComposerEditorHandle,
} from "@/components/input-kit";

export type ComposerLayout = "single-line" | "multiline";

interface ComposerLayoutOptions {
  controller: ComposerController;
  editorRef: RefObject<ComposerEditorHandle>;
  hasVisibleAttachments: boolean;
  dictationShowTranscript?: boolean;
  isAwaitingInput?: boolean;
}

/** 选中异步问题且无附件时单行；听写优先，组合输入期间锁定布局。 */
export function useComposerLayout({
  controller,
  editorRef,
  hasVisibleAttachments,
  dictationShowTranscript,
  isAwaitingInput = false,
}: ComposerLayoutOptions) {
  const inputRef = useRef<HTMLDivElement>(null);
  const [lockedLayout, setLockedLayout] = useState<ComposerLayout | null>(null);
  const proposedLayout =
    dictationShowTranscript !== undefined
      ? dictationShowTranscript
        ? "multiline"
        : "single-line"
      : isAwaitingInput && !hasVisibleAttachments
        ? "single-line"
        : "multiline";
  const layout = lockedLayout ?? proposedLayout;
  const inputHidden = dictationShowTranscript === false;
  const previouslyHidden = useRef(inputHidden);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const editor = editorRef.current?.getElement();
    if (!input || !editor) return;
    const measure = () => {
      input.toggleAttribute(
        "data-overflowing",
        input.isConnected &&
          input.clientWidth > 0 &&
          input.scrollHeight > input.clientHeight,
      );
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(input);
    observer?.observe(editor);
    const fonts = input.ownerDocument.fonts;
    fonts?.addEventListener("loadingdone", measure);
    const unsubscribe = controller.subscribe(measure);
    measure();
    return () => {
      observer?.disconnect();
      fonts?.removeEventListener("loadingdone", measure);
      unsubscribe();
    };
  }, [controller, editorRef, inputHidden]);

  useLayoutEffect(() => {
    const shouldRestore =
      previouslyHidden.current && dictationShowTranscript === undefined;
    previouslyHidden.current = inputHidden;
    const input = inputRef.current;
    if (!shouldRestore || !input?.ownerDocument.hasFocus()) return;
    const active = input.ownerDocument.activeElement;
    const footer = input.parentElement;
    if (active === input.ownerDocument.body || footer?.contains(active))
      editorRef.current?.focus();
  }, [dictationShowTranscript, editorRef, inputHidden]);

  return {
    inputRef,
    layout,
    bodyLayout: hasVisibleAttachments ? ("multiline" as const) : layout,
    isComposing: lockedLayout !== null,
    onCompositionStateChange: (active: boolean) =>
      setLockedLayout((current) => (active ? (current ?? layout) : null)),
  };
}
