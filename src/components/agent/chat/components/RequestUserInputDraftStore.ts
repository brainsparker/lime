import { atom } from "jotai/vanilla";
import type { ActionRequired } from "@/lib/api/agentActionTypes";
import type {
  RequestUserInputDraftState,
  RequestUserInputQuestion,
} from "./requestUserInputDraft";

/** 当前 Desktop 只有本地 App Server；这是 UI scope，不是远端 host authority。 */
export const LOCAL_REQUEST_HOST_ID = "local";

export interface RequestUserInputDraftIdentity {
  readonly key: string;
  readonly requestId: string;
  readonly questionKey: string;
}

interface RequestUserInputDraftEntry {
  readonly requestId: string;
  readonly questionKey: string;
  readonly draft: RequestUserInputDraftState;
}

export function requestUserInputDraftIdentity(
  hostId: string,
  request: ActionRequired,
  questions: RequestUserInputQuestion[],
): RequestUserInputDraftIdentity | null {
  const { threadId, turnId } = request.scope ?? {};
  if (
    ![hostId, threadId, turnId, request.requestId].every(
      (value) => typeof value === "string" && value.trim().length > 0,
    )
  )
    return null;
  return {
    key: JSON.stringify([hostId, threadId, request.requestId]),
    requestId: request.requestId,
    questionKey: JSON.stringify([
      turnId,
      questions.map((question) => question.id),
    ]),
  };
}

function copyDraft(
  draft: RequestUserInputDraftState,
): RequestUserInputDraftState {
  return {
    answers: Object.fromEntries(
      Object.entries(draft.answers).map(([id, answer]) => [id, { ...answer }]),
    ),
    questionIndex: draft.questionIndex,
  };
}

/** 仅应用内存中的视图草稿；canonical pending 仍归 PendingInteractionController。 */
export class RequestUserInputDraftStore {
  #drafts: ReadonlyMap<string, RequestUserInputDraftEntry> = new Map();

  read(
    identity: RequestUserInputDraftIdentity | null,
  ): RequestUserInputDraftState | null {
    if (!identity) return null;
    const entry = this.#drafts.get(identity.key);
    return entry?.requestId === identity.requestId &&
      entry.questionKey === identity.questionKey
      ? copyDraft(entry.draft)
      : null;
  }

  save(
    identity: RequestUserInputDraftIdentity | null,
    draft: RequestUserInputDraftState,
  ): void {
    if (!identity) return;
    this.#drafts = new Map(this.#drafts).set(identity.key, {
      requestId: identity.requestId,
      questionKey: identity.questionKey,
      draft: copyDraft(draft),
    });
  }

  clear(key: string, requestId: string): void {
    if (this.#drafts.get(key)?.requestId !== requestId) return;
    const next = new Map(this.#drafts);
    next.delete(key);
    this.#drafts = next;
  }
}

/** 每个 Jotai Store 独立初始化，不跨应用共享，也不写入任何持久化 owner。 */
export const requestUserInputDraftsAtom = atom(
  () => new RequestUserInputDraftStore(),
);
