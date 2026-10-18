import { createContext, useContext } from "react";
import type { ComposerController } from "@/components/input-kit/ComposerController";
import type { ArtifactAnnotationComment } from "./annotations/artifactAnnotation";
import type { ArtifactAnnotationDraftStore } from "./annotations/ArtifactAnnotationDraftStore";

export type ArtifactCommentSubmitResult =
  | "accepted"
  | "rejected"
  | "canceled"
  | "file-changed";

export interface ArtifactCommentSubmission {
  scopeKey: string;
  draftScopeKey: string;
  drafts: ArtifactAnnotationDraftStore;
  openComment?: (id: string) => void | Promise<void>;
  submit: (
    request: (
      | {
          comment: ArtifactAnnotationComment;
        }
      | {
          comments: readonly ArtifactAnnotationComment[];
        }
    ) & {
      controller: ComposerController;
      scopeKey: string;
      isCurrent: () => boolean;
    },
  ) => Promise<ArtifactCommentSubmitResult>;
}

export const ArtifactCommentSubmissionContext =
  createContext<ArtifactCommentSubmission | null>(null);
export const useArtifactCommentSubmission = () =>
  useContext(ArtifactCommentSubmissionContext);
