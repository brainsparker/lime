import type { AutoContinueRequestPayload } from "@/lib/api/agentRuntime/sessionTypes";
import type { HandleSendOptions } from "../../hooks/handleSendTypes";
import type { MessageImage } from "../../types";
import type {
  BaseComposerSendTriggerSource,
  ComposerDraftSnapshot,
  ComposerIntent,
  ComposerSubmission,
  ComposerSubmitTarget,
} from "@/components/input-kit";

export type InputbarSendTriggerSource =
  | BaseComposerSendTriggerSource
  | "adapter";

export interface InputbarSendPayload {
  images?: MessageImage[];
  textOverride?: string;
  autoContinuePayload?: AutoContinueRequestPayload;
  sendOptions?: HandleSendOptions;
  triggeredAt?: number;
  triggerSource?: InputbarSendTriggerSource;
  composerIntent?: ComposerIntent;
  composerTarget?: ComposerSubmitTarget;
  composerDraft?: ComposerDraftSnapshot;
  composerSubmission?: ComposerSubmission;
}

export type InputbarSendHandler = (
  payload?: InputbarSendPayload,
) => void | Promise<boolean> | boolean;

export function getInputbarSendOptions(
  payload: InputbarSendPayload,
): HandleSendOptions | undefined {
  if (
    !payload.composerDraft &&
    !payload.composerSubmission &&
    !payload.composerIntent &&
    !payload.composerTarget
  ) {
    return payload.sendOptions;
  }
  return {
    ...payload.sendOptions,
    ...(payload.composerDraft ? { composerDraft: payload.composerDraft } : {}),
    ...(payload.composerSubmission
      ? { composerSubmission: payload.composerSubmission }
      : {}),
    ...(payload.composerIntent
      ? { composerIntent: payload.composerIntent }
      : {}),
    ...(payload.composerTarget
      ? { composerTarget: payload.composerTarget }
      : {}),
  };
}
