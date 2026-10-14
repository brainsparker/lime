import { isDeepStrictEqual } from "node:util";

const QUEUE_MUTATION_METHODS = new Set([
  "thread/queue/add",
  "thread/queue/update",
  "thread/queue/reorder",
  "thread/queue/delete",
  "thread/queue/start",
  "agentSession/queuedTurn/promote",
  "agentSession/queuedTurn/remove",
  "turn/queue/promote",
]);

export function isPublicQueueMutationMethod(method) {
  return QUEUE_MUTATION_METHODS.has(method);
}

function normalizeInput(input) {
  return input.map((part) =>
    part?.type === "text"
      ? { ...part, text_elements: part.text_elements ?? [] }
      : part,
  );
}

export function summarizeActiveSteerSubmission({
  steer,
  canonical,
  threadId,
  activeTurnId,
  inputText,
}) {
  const transportObserved =
    steer?.command === "app_server_handle_json_lines" &&
    steer.transport === "electron-ipc" &&
    steer.status === "success" &&
    steer.requestId != null;
  const input = Array.isArray(steer?.input) ? steer.input : [];
  const typedInputPreserved =
    input.length === 1 &&
    input[0]?.type === "text" &&
    input[0].text === inputText;
  const turnIdentityPreserved =
    typeof activeTurnId === "string" &&
    activeTurnId.length > 0 &&
    canonical?.thread?.id === threadId &&
    steer?.threadId === threadId &&
    steer.expectedTurnId === activeTurnId;
  const clientId = steer?.clientUserMessageId;
  const users = Array.isArray(canonical?.thread?.turns)
    ? canonical.thread.turns.flatMap((turn) =>
        (Array.isArray(turn.items) ? turn.items : [])
          .filter(
            (item) =>
              item?.type === "userMessage" && item.clientId === clientId,
          )
          .map((item) => ({ turnId: turn.id, item })),
      )
    : [];
  const canonicalIdentityPreserved =
    typeof clientId === "string" &&
    clientId.length > 0 &&
    users.length === 1 &&
    users[0].turnId === activeTurnId &&
    typeof users[0].item.id === "string" &&
    users[0].item.id.length > 0;
  const canonicalInputPreserved =
    typedInputPreserved &&
    canonicalIdentityPreserved &&
    Array.isArray(users[0].item.content) &&
    isDeepStrictEqual(
      normalizeInput(users[0].item.content),
      normalizeInput(input),
    );
  const checks = {
    transportObserved,
    typedInputPreserved,
    turnIdentityPreserved,
    canonicalIdentityPreserved,
    canonicalInputPreserved,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    ...checks,
    requestId: steer?.requestId ?? null,
    clientUserMessageId: clientId ?? null,
    itemId: canonicalIdentityPreserved ? users[0].item.id : null,
    turnId: canonicalIdentityPreserved ? users[0].turnId : null,
  };
}
