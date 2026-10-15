import type { ComposerSubmissionRestoreToken } from "../components/composerSubmissionSettlement";
import type { MessageImage, MessagePathReference } from "../types";
import type { InputCapabilitySendRoute } from "../skill-selection/inputCapabilitySelection";
import type { ComposerDraftSnapshot } from "@/components/input-kit/types";

export interface InterruptedInputDraftSnapshot extends Partial<
  Omit<ComposerDraftSnapshot, "inputCapabilityRoute">
> {
  text: string;
  images?: readonly MessageImage[];
  pathReferences?: readonly MessagePathReference[];
  inputCapabilityRoute?: InputCapabilitySendRoute;
}

export type InterruptedInputRestoreReason =
  | "no_submitted_draft"
  | "output_free_interrupted_turn"
  | "thinking_only_cancelled_turn"
  | "visible_output_present"
  | "side_effect_activity_present";

export interface InterruptedInputRestorePlan {
  shouldRestoreComposer: boolean;
  reason: InterruptedInputRestoreReason;
  draft: InterruptedInputDraftSnapshot | null;
}

export interface InterruptedInputRestoreRequest {
  composerRestoreToken?: ComposerSubmissionRestoreToken;
  requestId: string;
  reason: InterruptedInputRestoreReason;
  draft: InterruptedInputDraftSnapshot;
}
