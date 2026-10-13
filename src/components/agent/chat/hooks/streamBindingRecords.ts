import type { ActiveStreamState } from "./agentStreamSubmissionLifecycle";
import {
  normalizeNonEmpty,
  normalizeRealTurnId,
  type AgentStreamResumeBindingTarget,
} from "./streamResumeTarget";

const LOCALLY_STARTED_STREAM_BINDING_TTL_MS = 5 * 60 * 1000;
const LOCALLY_INTERRUPTED_STREAM_BINDING_TTL_MS = 30 * 1000;

interface LocallyStartedAgentStreamBindingRecord {
  eventName: string;
  recordedAt: number;
  sessionId: string;
  turnId: string | null;
}

const locallyStartedAgentStreamBindingRecords = new Map<
  string,
  LocallyStartedAgentStreamBindingRecord
>();
const locallyInterruptedAgentStreamBindingRecords = new Map<
  string,
  LocallyStartedAgentStreamBindingRecord
>();

function pruneAgentStreamBindingRecords(
  records: Map<string, LocallyStartedAgentStreamBindingRecord>,
  ttlMs: number,
  now = Date.now(),
): void {
  for (const [key, record] of records) {
    if (now - record.recordedAt > ttlMs) {
      records.delete(key);
    }
  }
}

function createLocallyStartedAgentStreamBindingKey(
  sessionId: string,
  turnId?: string | null,
): string {
  return `${sessionId}:${turnId || "*"}`;
}

export function rememberLocallyStartedAgentStreamBinding(
  stream: ActiveStreamState | null,
): void {
  const sessionId = normalizeNonEmpty(stream?.sessionId);
  const eventName = normalizeNonEmpty(stream?.eventName);
  if (!sessionId || !eventName?.startsWith("agent_stream_")) {
    return;
  }

  pruneAgentStreamBindingRecords(
    locallyStartedAgentStreamBindingRecords,
    LOCALLY_STARTED_STREAM_BINDING_TTL_MS,
  );
  const turnId = normalizeRealTurnId(stream?.turnId);
  const recordedAt = Date.now();
  const record: LocallyStartedAgentStreamBindingRecord = {
    eventName,
    recordedAt,
    sessionId,
    turnId,
  };
  locallyStartedAgentStreamBindingRecords.set(
    createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
    record,
  );
  locallyStartedAgentStreamBindingRecords.set(
    createLocallyStartedAgentStreamBindingKey(sessionId, null),
    record,
  );
}

export function rememberLocallyInterruptedAgentStreamBinding(
  stream: ActiveStreamState | null,
): void {
  const sessionId = normalizeNonEmpty(stream?.sessionId);
  const eventName = normalizeNonEmpty(stream?.eventName);
  if (!sessionId) {
    return;
  }

  pruneAgentStreamBindingRecords(
    locallyInterruptedAgentStreamBindingRecords,
    LOCALLY_INTERRUPTED_STREAM_BINDING_TTL_MS,
  );
  const turnId = normalizeRealTurnId(stream?.turnId);
  const recordedAt = Date.now();
  const record: LocallyStartedAgentStreamBindingRecord = {
    eventName: eventName ?? "",
    recordedAt,
    sessionId,
    turnId,
  };
  locallyInterruptedAgentStreamBindingRecords.set(
    createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
    record,
  );
  locallyInterruptedAgentStreamBindingRecords.set(
    createLocallyStartedAgentStreamBindingKey(sessionId, null),
    record,
  );
}

export function hasLocallyStartedAgentStreamBinding(
  target?: AgentStreamResumeBindingTarget | null,
): boolean {
  const sessionId = normalizeNonEmpty(target?.sessionId);
  if (!sessionId) {
    return false;
  }

  pruneAgentStreamBindingRecords(
    locallyStartedAgentStreamBindingRecords,
    LOCALLY_STARTED_STREAM_BINDING_TTL_MS,
  );
  const turnId = normalizeRealTurnId(target?.turnId);
  return (
    locallyStartedAgentStreamBindingRecords.has(
      createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
    ) ||
    locallyStartedAgentStreamBindingRecords.has(
      createLocallyStartedAgentStreamBindingKey(sessionId, null),
    )
  );
}

export function hasLocallyInterruptedAgentStreamBinding(
  target?: AgentStreamResumeBindingTarget | null,
): boolean {
  const sessionId = normalizeNonEmpty(target?.sessionId);
  if (!sessionId) {
    return false;
  }

  pruneAgentStreamBindingRecords(
    locallyInterruptedAgentStreamBindingRecords,
    LOCALLY_INTERRUPTED_STREAM_BINDING_TTL_MS,
  );
  const turnId = normalizeRealTurnId(target?.turnId);
  return (
    locallyInterruptedAgentStreamBindingRecords.has(
      createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
    ) ||
    locallyInterruptedAgentStreamBindingRecords.has(
      createLocallyStartedAgentStreamBindingKey(sessionId, null),
    )
  );
}

export function consumeLocallyInterruptedAgentStreamBinding(
  target?: AgentStreamResumeBindingTarget | null,
): boolean {
  const sessionId = normalizeNonEmpty(target?.sessionId);
  if (!sessionId) {
    return false;
  }

  pruneAgentStreamBindingRecords(
    locallyInterruptedAgentStreamBindingRecords,
    LOCALLY_INTERRUPTED_STREAM_BINDING_TTL_MS,
  );
  const turnId = normalizeRealTurnId(target?.turnId);
  const exactKey = createLocallyStartedAgentStreamBindingKey(sessionId, turnId);
  const sessionKey = createLocallyStartedAgentStreamBindingKey(sessionId, null);
  const record =
    locallyInterruptedAgentStreamBindingRecords.get(exactKey) ??
    locallyInterruptedAgentStreamBindingRecords.get(sessionKey);
  if (!record) {
    return false;
  }

  locallyInterruptedAgentStreamBindingRecords.delete(exactKey);
  locallyInterruptedAgentStreamBindingRecords.delete(sessionKey);
  if (record.turnId) {
    locallyInterruptedAgentStreamBindingRecords.delete(
      createLocallyStartedAgentStreamBindingKey(
        record.sessionId,
        record.turnId,
      ),
    );
  }
  locallyInterruptedAgentStreamBindingRecords.delete(
    createLocallyStartedAgentStreamBindingKey(record.sessionId, null),
  );
  return true;
}
