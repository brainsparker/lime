import type { ComposerSubmitResult } from "@/components/input-kit";
import { composerDocumentFromJSON } from "@/components/input-kit/composerSchema";
import { serializeComposerDocument } from "@/components/input-kit/composerSerialization";
import type { ThreadGoalDraft } from "@/lib/api/agentRuntime/threadGoalAttachments";

/** Paste 正文属于目标素材；继续使用同一文档 serializer，避免同时展开和引用。 */
export function prepareThreadGoalDraft(
  receipt: ComposerSubmitResult,
  commandLength = 0,
): ThreadGoalDraft {
  const document = composerDocumentFromJSON({
    ...receipt.draft.editorDocument,
    content: receipt.draft.editorDocument.content.map((block) =>
      block.type === "paragraph"
        ? {
            ...block,
            content: block.content?.filter((node) => node.type !== "paste"),
          }
        : block,
    ),
  });
  const raw = serializeComposerDocument(document).text;
  const objective = (commandLength ? raw.trimStart().slice(commandLength) : raw)
    .replace(
      /\[((?:\\.|[^\]])+)\]\((?:plugin|app):\/\/(?:\\.|[^)])+\)/g,
      (_match: string, label: string) => label.replace(/\\([\\[\]()])/g, "$1"),
    )
    .trim();
  return {
    objective,
    pastedTextAttachments: receipt.draft.pendingPastes.map(({ text }) => ({
      text,
    })),
    imageAttachments: receipt.submission.attachments.map((image) => ({
      src: image.data
        ? /^(?:data:|https?:\/\/|file:)/i.test(image.data)
          ? image.data
          : `data:${image.mediaType};base64,${image.data}`
        : (image.sourceUri ?? image.sourcePath ?? ""),
      ...(image.sourcePath ? { localPath: image.sourcePath } : {}),
    })),
  };
}
