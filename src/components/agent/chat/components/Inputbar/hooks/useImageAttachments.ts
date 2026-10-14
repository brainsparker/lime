import {
  useCallback,
  useRef,
  type ChangeEvent,
  type DragEvent,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { MessageImage } from "../../../types";
import {
  getClipboardImageCandidates,
  MAX_IMAGE_ATTACHMENTS_PER_TURN,
  readImageAttachment,
} from "../../../utils/imageAttachments";
import { buildInputbarImageAttachmentsCopy } from "./inputbarImageAttachmentsCopy";
import { useAttachmentGeneration } from "../../useAttachmentGeneration";
import { useComposerController } from "@/components/input-kit/useComposerController";
import type { ComposerController } from "@/components/input-kit";

export function useImageAttachments({ controller }: { controller?: ComposerController } = {}) {
  const { t } = useTranslation("agent");
  const copy = useMemo(
    () =>
      buildInputbarImageAttachmentsCopy((key, values) => t(key, values ?? {})),
    [t],
  );
  const { controller: attachmentController, snapshot } = useComposerController({ controller });
  const pendingImages = [...snapshot.document.attachments];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { captureGeneration, isCurrentGeneration, invalidateGeneration, runAttachmentWrite } =
    useAttachmentGeneration(attachmentController);

  const setPendingImagesSnapshot = useCallback((images: MessageImage[]) => {
    runAttachmentWrite(images, () => attachmentController.setAttachments(images));
  }, [attachmentController, runAttachmentWrite]);

  const replacePendingImages = useCallback(
    (images: MessageImage[]) => {
      invalidateGeneration();
      setPendingImagesSnapshot(images);
    },
    [invalidateGeneration, setPendingImagesSnapshot],
  );

  const appendImageFile = useCallback(
    async (
      file: File,
      successMessage?: string,
      preferredMediaType?: string,
    ) => {
      const generation = captureGeneration();
      const fileName = file.name || copy.unnamedImage;
      try {
        if (attachmentController.getSnapshot().document.attachments.length >= MAX_IMAGE_ATTACHMENTS_PER_TURN) {
          toast.error(copy.imageReadFailed(fileName));
          return;
        }

        const image = await readImageAttachment(file, preferredMediaType);
        if (!isCurrentGeneration(generation)) {
          return;
        }
        if (attachmentController.getSnapshot().document.attachments.length >= MAX_IMAGE_ATTACHMENTS_PER_TURN) {
          toast.error(copy.imageReadFailed(fileName));
          return;
        }

        setPendingImagesSnapshot([...attachmentController.getSnapshot().document.attachments, image]);
        if (isCurrentGeneration(generation)) {
          toast.success(successMessage ?? copy.imageAdded(fileName));
        }
      } catch {
        if (isCurrentGeneration(generation)) {
          toast.error(copy.imageReadFailed(fileName));
        }
      }
    },
    [attachmentController, captureGeneration, copy, isCurrentGeneration, setPendingImagesSnapshot],
  );

  const appendImageFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        void appendImageFile(file);
      });
    },
    [appendImageFile],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      appendImageFiles(files);
      event.target.value = "";
    },
    [appendImageFiles],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const imageFiles = getClipboardImageCandidates(event.clipboardData);
      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      imageFiles.forEach(({ file, mediaType }, index) => {
        void appendImageFile(
          file,
          index === 0 ? copy.imagePasted : undefined,
          mediaType,
        );
      });
    },
    [appendImageFile, copy.imagePasted],
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const files = event.dataTransfer.files;
      if (!files || files.length === 0) {
        return;
      }

      appendImageFiles(files);
    },
    [appendImageFiles],
  );

  const handleRemoveImage = useCallback(
    (index: number) => {
      setPendingImagesSnapshot(
        attachmentController.getSnapshot().document.attachments.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      );
    },
    [attachmentController, setPendingImagesSnapshot],
  );

  const clearPendingImages = useCallback(() => {
    replacePendingImages([]);
  }, [replacePendingImages]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    pendingImages,
    fileInputRef,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDrop,
    handleRemoveImage,
    clearPendingImages,
    replacePendingImages,
    openFileDialog,
  };
}
