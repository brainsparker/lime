import React from "react";
import { toast } from "sonner";
import type { HomeSurfaceToastCopy } from "../home/homeSurfaceCopy";
import type { MessageImage, MessagePathReference } from "../types";
import {
  getClipboardImageCandidates,
  readImageAttachment,
} from "../utils/imageAttachments";
import {
  readCustomPathReferencesFromDataTransfer,
  readSystemPathReferencesFromFiles,
} from "../utils/pathReferences";
import { useAttachmentGeneration } from "./useAttachmentGeneration";
import { useComposerController } from "@/components/input-kit/useComposerController";
import type { ComposerController } from "@/components/input-kit";

interface UseEmptyStateAttachmentsInput {
  controller?: ComposerController;
  toastCopy: HomeSurfaceToastCopy;
  onAddPathReferences?: (references: MessagePathReference[]) => void;
}

export function useEmptyStateAttachments({
  controller,
  toastCopy,
  onAddPathReferences,
}: UseEmptyStateAttachmentsInput) {
  const { controller: attachmentController, snapshot } = useComposerController({ controller });
  const pendingImages = [...snapshot.document.attachments];
  const { captureGeneration, isCurrentGeneration, invalidateGeneration, runAttachmentWrite } =
    useAttachmentGeneration(attachmentController);
  const setPendingImages = (images: MessageImage[]) => {
    runAttachmentWrite(images, () => attachmentController.setAttachments(images));
  };

  const readAndAppendImage = (
    file: File,
    mediaType: string | undefined,
    options?: { successToast?: string },
  ) => {
    const generation = captureGeneration();
    void readImageAttachment(file, mediaType)
      .then((image) => {
        if (!isCurrentGeneration(generation)) {
          return;
        }
        setPendingImages([...attachmentController.getSnapshot().document.attachments, image]);
        if (options?.successToast && isCurrentGeneration(generation)) {
          toast.success(options.successToast);
        }
      })
      .catch(() => {
        if (isCurrentGeneration(generation)) {
          toast.error(
            toastCopy.imageReadFailed(file.name || toastCopy.unnamedImage),
          );
        }
      });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    Array.from(files).forEach((file) => {
      readAndAppendImage(file, undefined);
    });
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent) => {
    const imageFiles = getClipboardImageCandidates(event.clipboardData);
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    imageFiles.forEach(({ file, mediaType }, index) => {
      readAndAppendImage(file, mediaType, {
        successToast: index === 0 ? toastCopy.imagePasted : undefined,
      });
    });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    const customReferences = readCustomPathReferencesFromDataTransfer(
      event.dataTransfer,
    );
    if (customReferences.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      onAddPathReferences?.(customReferences);
      return;
    }

    const files = event.dataTransfer.files;
    const systemReferences =
      files && files.length > 0 ? readSystemPathReferencesFromFiles(files) : [];
    if (systemReferences.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      onAddPathReferences?.(systemReferences);
      return;
    }

    const imageFiles = getClipboardImageCandidates(event.dataTransfer);
    if (imageFiles.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      imageFiles.forEach(({ file, mediaType }, index) => {
        readAndAppendImage(file, mediaType, {
          successToast: index === 0 ? toastCopy.imageAdded : undefined,
        });
      });
      return;
    }

    if (files && files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      toast.error(toastCopy.systemPathDropUnsupported);
    }
  };

  const handleRemoveImage = (index: number) => {
    setPendingImages(
      attachmentController.getSnapshot().document.attachments.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const clearPendingImages = () => {
    invalidateGeneration();
    setPendingImages([]);
  };

  const replacePendingImages = (images: MessageImage[]) => {
    invalidateGeneration();
    setPendingImages(images);
  };

  return {
    clearPendingImages,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    handlePaste,
    handleRemoveImage,
    pendingImages,
    replacePendingImages,
  };
}
