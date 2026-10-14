import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  ComposerController,
  type ComposerDocumentInput,
} from "./ComposerController";
import type {
  ComposerAttachment,
  ComposerMentionBinding,
  ComposerPathReference,
  ComposerSelection,
  ComposerTextElement,
  ComposerSubmitTarget,
} from "./types";

export interface UseComposerControllerOptions {
  controller?: ComposerController;
  initialDocument?: ComposerDocumentInput;
  externalDocument?: ComposerDocumentInput;
  onDocumentChange?: (
    document: ReturnType<ComposerController["getDocument"]>,
  ) => void;
}

export function useComposerController({
  controller: externalController,
  initialDocument,
  externalDocument,
  onDocumentChange,
}: UseComposerControllerOptions = {}) {
  const controllerRef = useRef<ComposerController | null>(null);
  const controller = useMemo(() => externalController ??
    (controllerRef.current ??= new ComposerController(initialDocument)),
  [externalController, initialDocument]);
  const onDocumentChangeRef = useRef(onDocumentChange);
  onDocumentChangeRef.current = onDocumentChange;
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => controller.subscribe(() => {
    onDocumentChangeRef.current?.(controller.getDocument());
  }), [controller]);
  useEffect(() => {
    if (externalDocument) {
      controller.replaceDocument(externalDocument);
    }
  }, [controller, externalDocument]);

  const setText = useCallback(
    (value: string) => {
      controller.setText(value);
    },
    [controller],
  );
  const setSelection = useCallback(
    (start: number, end = start) => {
      controller.setSelection(start, end);
    },
    [controller],
  );
  const setAttachments = useCallback(
    (attachments: readonly ComposerAttachment[]) => {
      controller.setAttachments(attachments);
    },
    [controller],
  );
  const setPathReferences = useCallback(
    (references: readonly ComposerPathReference[]) => {
      controller.setPathReferences(references);
    },
    [controller],
  );
  const setMentionBindings = useCallback(
    (bindings: readonly ComposerMentionBinding[]) => {
      controller.setMentionBindings(bindings);
    },
    [controller],
  );
  const setTextElements = useCallback((elements: readonly ComposerTextElement[]) => {
    controller.setTextElements(elements);
  }, [controller]);
  const replaceDocument = useCallback((document: ComposerDocumentInput) => {
    controller.replaceDocument(document);
  }, [controller]);
  const restoreDraft = useCallback((document: ComposerDocumentInput) => {
    controller.restoreDraft(document);
  }, [controller]);
  const replaceRange = useCallback((range: ComposerSelection, text: string) => {
    controller.replaceRange(range, text);
  }, [controller]);
  const insertMention = useCallback((
    binding: Omit<ComposerMentionBinding, "from" | "to">,
    range?: ComposerSelection,
  ) => {
    controller.insertMention(binding, range);
  }, [controller]);
  const submit = useCallback(
    (target: ComposerSubmitTarget, allowEmpty = false) =>
      controller.submit(target, { allowEmpty }),
    [controller],
  );
  const recallHistory = useCallback(
    (direction: "previous" | "next") => controller.recallHistory(direction),
    [controller],
  );
  const getHistory = useCallback(() => controller.getHistory(), [controller]);

  return {
    controller,
    snapshot,
    setText,
    setSelection,
    setAttachments,
    setPathReferences,
    setMentionBindings,
    setTextElements,
    replaceDocument,
    restoreDraft,
    replaceRange,
    insertMention,
    submit,
    recallHistory,
    getHistory,
  };
}
