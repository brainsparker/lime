import type {
  ComposerDraftBindingToken,
  ComposerDraftCoordinator,
} from "@/components/input-kit/ComposerDraftCoordinator";
import type { DraftScope } from "@/lib/api/persistedAtomTypes";

export interface ComposerDraftNavigationCallbacks {
  composerDraftCoordinator?: ComposerDraftCoordinator;
  getComposerDraftNavigationEpoch?: () => number;
  onComposerDraftScopeCommitted?: (scope: DraftScope) => void;
  onComposerDraftPromotion?: (
    token: ComposerDraftBindingToken,
    target: DraftScope,
    metadata: { sessionId: string; threadId?: string },
  ) => void;
}
