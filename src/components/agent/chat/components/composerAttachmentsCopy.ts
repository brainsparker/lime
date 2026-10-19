export type ComposerAttachmentsCopyKey =
  | "agentChat.inputbar.imageAttachments.unnamedImage"
  | "agentChat.inputbar.imageAttachments.imageReadFailed"
  | "agentChat.inputbar.imageAttachments.imageAdded"
  | "agentChat.inputbar.imageAttachments.imagePasted";

type ComposerAttachmentsCopyValue = number | string;

export type ComposerAttachmentsCopyTranslate = (
  key: ComposerAttachmentsCopyKey,
  values?: Record<string, ComposerAttachmentsCopyValue>,
) => string;

export interface ComposerAttachmentsCopy {
  unnamedImage: string;
  imageReadFailed: (fileName: string) => string;
  imageAdded: (fileName: string) => string;
  imagePasted: string;
}

export function buildComposerAttachmentsCopy(
  translate: ComposerAttachmentsCopyTranslate,
): ComposerAttachmentsCopy {
  return {
    unnamedImage: translate("agentChat.inputbar.imageAttachments.unnamedImage"),
    imageReadFailed: (fileName) =>
      translate("agentChat.inputbar.imageAttachments.imageReadFailed", {
        fileName,
      }),
    imageAdded: (fileName) =>
      translate("agentChat.inputbar.imageAttachments.imageAdded", {
        fileName,
      }),
    imagePasted: translate("agentChat.inputbar.imageAttachments.imagePasted"),
  };
}
