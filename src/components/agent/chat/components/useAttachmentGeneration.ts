import { useCallback, useLayoutEffect, useRef } from "react";
import type { ComposerAttachment, ComposerController } from "@/components/input-kit";

function sameAttachments(left: readonly ComposerAttachment[], right: readonly ComposerAttachment[]): boolean {
  return left.length === right.length && left.every((image, index) => {
    const other = right[index];
    return image.data === other.data && image.mediaType === other.mediaType &&
      image.sourceUri === other.sourceUri && image.sourcePath === other.sourcePath &&
      image.previewUrl === other.previewUrl && image.index === other.index &&
      JSON.stringify(image.metadata) === JSON.stringify(other.metadata);
  });
}

export function useAttachmentGeneration(controller?: ComposerController) {
  const generationRef = useRef(0);
  const attachmentWriteRef = useRef<readonly ComposerAttachment[] | null>(null);
  const captureGeneration = useCallback(() => generationRef.current, []);
  const isCurrentGeneration = useCallback(
    (generation: number) => generation === generationRef.current,
    [],
  );
  const invalidateGeneration = useCallback(() => {
    generationRef.current += 1;
  }, []);

  const runAttachmentWrite = useCallback((images: readonly ComposerAttachment[], write: () => void) => {
    const previous = attachmentWriteRef.current;
    attachmentWriteRef.current = images;
    try { write(); } finally { attachmentWriteRef.current = previous; }
  }, []);

  useLayoutEffect(() => {
    invalidateGeneration();
    if (!controller) return invalidateGeneration;
    let attachments = controller.getSnapshot().document.attachments;
    let plugins = controller.getEditorState().plugins;
    const unsubscribe = controller.subscribe(() => {
      const nextAttachments = controller.getSnapshot().document.attachments;
      const nextPlugins = controller.getEditorState().plugins;
      const ownWrite = attachmentWriteRef.current !== null && sameAttachments(nextAttachments, attachmentWriteRef.current);
      // Whole draft resets rebuild plugins; ordinary PM edits retain them.
      if (plugins !== nextPlugins || (!sameAttachments(attachments, nextAttachments) && !ownWrite)) {
        invalidateGeneration();
      }
      attachments = nextAttachments;
      plugins = nextPlugins;
    });
    return () => {
      unsubscribe();
      invalidateGeneration();
    };
  }, [controller, invalidateGeneration]);

  return { captureGeneration, isCurrentGeneration, invalidateGeneration, runAttachmentWrite };
}
