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
  turnId: string;
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
  turnId: string,
): string {
  return `${sessionId}:${turnId}`;
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
  if (!turnId) {
    return;
  }
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
  if (!turnId) {
    return;
  }
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
  if (!turnId) {
    return false;
  }
  return locallyStartedAgentStreamBindingRecords.has(
    createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
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
  if (!turnId) {
    return false;
  }
  return locallyInterruptedAgentStreamBindingRecords.has(
    createLocallyStartedAgentStreamBindingKey(sessionId, turnId),
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
  if (!turnId) {
    return false;
  }
  const exactKey = createLocallyStartedAgentStreamBindingKey(sessionId, turnId);
  return locallyInterruptedAgentStreamBindingRecords.delete(exactKey);
}
