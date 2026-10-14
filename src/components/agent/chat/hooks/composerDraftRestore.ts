import type { ComposerController } from "@/components/input-kit";
import type { InterruptedInputRestoreRequest } from "./agentStreamInputRestoreTypes";

const restoredRequests = new WeakMap<ComposerController, Set<string>>();

/** 共享草稿只消费一次恢复请求，重挂载和迟到重放不得覆盖后续编辑。 */
export function restoreComposerDraft(controller: ComposerController, request: InterruptedInputRestoreRequest): boolean {
  const requests = restoredRequests.get(controller) ?? new Set<string>();
  if (requests.has(request.requestId)) return false;
  requests.add(request.requestId);
  restoredRequests.set(controller, requests);
  try {
    controller.restoreDraft({ ...request.draft, attachments: request.draft.attachments ?? request.draft.images });
    return true;
  } catch (error) {
    requests.delete(request.requestId);
    throw error;
  }
}
