import { ComposerController } from "@/components/input-kit/ComposerController";
import type { ArtifactCommentSubmission } from "../ArtifactCommentSubmissionContext";
import type { ArtifactAnnotationDraft } from "./ArtifactAnnotationDraftStore";

/** 文档浮层和主 Composer 共享不可变发送快照与 revision-safe settlement。 */
export async function submitArtifactAnnotationBatch({
  submission,
  drafts: batchDrafts,
  isCurrent,
}: {
  submission: ArtifactCommentSubmission;
  drafts: readonly ArtifactAnnotationDraft[];
  isCurrent: () => boolean;
}): Promise<void> {
  if (
    !isCurrent() ||
    !batchDrafts.length ||
    batchDrafts.some((draft) => draft.scopeKey !== submission.draftScopeKey)
  )
    return;
  const captured = batchDrafts.map((draft) => ({
    draft,
    receipt: draft.controller.submit("start"),
  }));
  if (
    captured.some(({ receipt }) => receipt.kind !== "accepted") ||
    !submission.drafts.beginBatch(captured.map(({ draft }) => draft.comment.id))
  )
    return;
  const comments = captured.map(({ draft, receipt }) => ({
    ...draft.comment,
    body: receipt.draft.text,
  }));
  // 此 Controller 只承载本次不可变批次的发送快照；每条可编辑正文仍属于原 Controller。
  const controller = new ComposerController({}, { plainTextMode: true });
  controller.setText(comments.map((comment) => comment.body).join("\n\n"));
  controller.setAttachments(
    captured.flatMap(({ receipt }) => receipt.draft.attachments),
  );
  try {
    const result = await submission.submit({
      comments,
      controller,
      scopeKey: submission.scopeKey,
      isCurrent,
    });
    for (const { draft, receipt } of captured) {
      if (result === "accepted" && receipt.kind === "accepted")
        draft.controller.commit(receipt);
      submission.drafts.finish(draft.comment.id, result);
    }
  } catch {
    for (const { draft } of captured)
      submission.drafts.finish(draft.comment.id, "rejected");
  }
}
