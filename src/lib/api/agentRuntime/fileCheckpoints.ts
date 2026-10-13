import type {
  AppServerAgentSessionFileCheckpointDetail,
  AppServerAgentSessionFileCheckpointDiffResponse,
  AppServerAgentSessionFileCheckpointListResponse,
  AppServerAgentSessionFileCheckpointRestoreResponse,
  AppServerAgentSessionFileCheckpointSummary,
} from "@/lib/api/appServer";
import type {
  AgentRuntimeFileCheckpointDetail,
  AgentRuntimeFileCheckpointDiffResult,
  AgentRuntimeFileCheckpointListResult,
  AgentRuntimeFileCheckpointRestoreResult,
  AgentRuntimeFileCheckpointSummary,
} from "./sessionTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isFileCheckpointSummary(
  value: unknown,
): value is AgentRuntimeFileCheckpointListResult["checkpoints"][number] {
  return (
    isRecord(value) &&
    isRequiredString(value.checkpoint_id) &&
    isRequiredString(value.turn_id) &&
    isRequiredString(value.path) &&
    isRequiredString(value.source) &&
    (typeof value.updated_at === "string" ||
      typeof value.updated_at === "number") &&
    isOptionalFiniteNumber(value.version_no) &&
    isOptionalString(value.version_id) &&
    isOptionalString(value.request_id) &&
    isOptionalString(value.title) &&
    isOptionalString(value.kind) &&
    isOptionalString(value.status) &&
    isOptionalString(value.preview_text) &&
    isOptionalString(value.snapshot_path) &&
    typeof value.validation_issue_count === "number" &&
    Number.isFinite(value.validation_issue_count)
  );
}

function isFileCheckpointListResult(
  value: unknown,
): value is AgentRuntimeFileCheckpointListResult {
  return (
    isRecord(value) &&
    isRequiredString(value.session_id) &&
    isRequiredString(value.thread_id) &&
    typeof value.checkpoint_count === "number" &&
    Number.isFinite(value.checkpoint_count) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isFileCheckpointSummary)
  );
}

function isFileCheckpointDetail(
  value: unknown,
): value is AgentRuntimeFileCheckpointDetail {
  return (
    isRecord(value) &&
    isRequiredString(value.session_id) &&
    isRequiredString(value.thread_id) &&
    isFileCheckpointSummary(value.checkpoint) &&
    isRequiredString(value.live_path) &&
    isRequiredString(value.snapshot_path) &&
    Array.isArray(value.version_history) &&
    isStringArray(value.validation_issues) &&
    (value.content === undefined || typeof value.content === "string")
  );
}

function isFileCheckpointDiffResult(
  value: unknown,
): value is AgentRuntimeFileCheckpointDiffResult {
  return (
    isRecord(value) &&
    isRequiredString(value.session_id) &&
    isRequiredString(value.thread_id) &&
    isFileCheckpointSummary(value.checkpoint) &&
    isOptionalString(value.current_version_id) &&
    isOptionalString(value.previous_version_id)
  );
}

function isFileCheckpointRestoreResult(
  value: unknown,
): value is AgentRuntimeFileCheckpointRestoreResult {
  return (
    isRecord(value) &&
    isRequiredString(value.session_id) &&
    isRequiredString(value.thread_id) &&
    isFileCheckpointSummary(value.checkpoint) &&
    isRequiredString(value.live_path) &&
    isRequiredString(value.snapshot_path) &&
    (value.backup_path === undefined ||
      value.backup_path === null ||
      typeof value.backup_path === "string") &&
    (typeof value.restored_at === "string" ||
      typeof value.restored_at === "number")
  );
}

function readField(
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey?: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(record, camelKey)) {
    return record[camelKey];
  }
  return snakeKey ? record[snakeKey] : undefined;
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isAppServerFileCheckpointSummary(
  value: unknown,
): value is AppServerAgentSessionFileCheckpointSummary {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRequiredString(readField(value, "checkpointId", "checkpoint_id")) &&
    isRequiredString(readField(value, "turnId", "turn_id")) &&
    isRequiredString(readField(value, "path")) &&
    isRequiredString(readField(value, "source")) &&
    isRequiredString(readField(value, "updatedAt", "updated_at")) &&
    isOptionalFiniteNumber(readField(value, "versionNo", "version_no")) &&
    isOptionalString(readField(value, "versionId", "version_id")) &&
    isOptionalString(readField(value, "requestId", "request_id")) &&
    isOptionalString(readField(value, "title")) &&
    isOptionalString(readField(value, "kind")) &&
    isOptionalString(readField(value, "status")) &&
    isOptionalString(readField(value, "previewText", "preview_text")) &&
    isOptionalString(readField(value, "snapshotPath", "snapshot_path")) &&
    typeof readField(
      value,
      "validationIssueCount",
      "validation_issue_count",
    ) === "number" &&
    Number.isFinite(
      readField(value, "validationIssueCount", "validation_issue_count"),
    )
  );
}

function isAppServerFileCheckpointListResponse(
  value: unknown,
): value is AppServerAgentSessionFileCheckpointListResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRequiredString(readField(value, "sessionId", "session_id")) &&
    isRequiredString(readField(value, "threadId", "thread_id")) &&
    typeof readField(value, "checkpointCount", "checkpoint_count") ===
      "number" &&
    Number.isFinite(readField(value, "checkpointCount", "checkpoint_count")) &&
    Array.isArray(readField(value, "checkpoints")) &&
    (readField(value, "checkpoints") as unknown[]).every(
      isAppServerFileCheckpointSummary,
    )
  );
}

function isAppServerFileCheckpointDetail(
  value: unknown,
): value is AppServerAgentSessionFileCheckpointDetail {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRequiredString(readField(value, "sessionId", "session_id")) &&
    isRequiredString(readField(value, "threadId", "thread_id")) &&
    isAppServerFileCheckpointSummary(readField(value, "checkpoint")) &&
    isRequiredString(readField(value, "livePath", "live_path")) &&
    isRequiredString(readField(value, "snapshotPath", "snapshot_path")) &&
    Array.isArray(readField(value, "versionHistory", "version_history")) &&
    isStringArray(readField(value, "validationIssues", "validation_issues")) &&
    (readField(value, "content") === undefined ||
      typeof readField(value, "content") === "string")
  );
}

function isAppServerFileCheckpointDiffResponse(
  value: unknown,
): value is AppServerAgentSessionFileCheckpointDiffResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRequiredString(readField(value, "sessionId", "session_id")) &&
    isRequiredString(readField(value, "threadId", "thread_id")) &&
    isAppServerFileCheckpointSummary(readField(value, "checkpoint")) &&
    isOptionalString(
      readField(value, "currentVersionId", "current_version_id"),
    ) &&
    isOptionalString(
      readField(value, "previousVersionId", "previous_version_id"),
    )
  );
}

function isAppServerFileCheckpointRestoreResponse(
  value: unknown,
): value is AppServerAgentSessionFileCheckpointRestoreResponse {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isRequiredString(readField(value, "sessionId", "session_id")) &&
    isRequiredString(readField(value, "threadId", "thread_id")) &&
    isAppServerFileCheckpointSummary(readField(value, "checkpoint")) &&
    isRequiredString(readField(value, "livePath", "live_path")) &&
    isRequiredString(readField(value, "snapshotPath", "snapshot_path")) &&
    isOptionalNullableString(readField(value, "backupPath", "backup_path")) &&
    isRequiredString(readField(value, "restoredAt", "restored_at"))
  );
}

function assignStringIfPresent<T extends object>(
  target: Partial<T>,
  key: keyof T,
  value: unknown,
): void {
  if (typeof value === "string") {
    target[key] = value as T[keyof T];
  }
}

function assignNumberIfPresent<T extends object>(
  target: Partial<T>,
  key: keyof T,
  value: unknown,
): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value as T[keyof T];
  }
}

function assignNullableStringIfPresent<T extends object>(
  target: Partial<T>,
  key: keyof T,
  value: unknown,
): void {
  if (value === null || typeof value === "string") {
    target[key] = value as T[keyof T];
  }
}

function assignIfPresent<T extends object>(
  target: Partial<T>,
  key: keyof T,
  value: unknown,
): void {
  if (value !== undefined) {
    target[key] = value as T[keyof T];
  }
}

export function projectAppServerFileCheckpointSummary(
  command: string,
  value: unknown,
): AgentRuntimeFileCheckpointSummary {
  if (!isAppServerFileCheckpointSummary(value)) {
    throw new Error(`${command} did not return file checkpoint summary`);
  }
  const record = value as unknown as Record<string, unknown>;
  const summary: AgentRuntimeFileCheckpointSummary = {
    checkpoint_id: readField(record, "checkpointId", "checkpoint_id") as string,
    turn_id: readField(record, "turnId", "turn_id") as string,
    path: readField(record, "path") as string,
    source: readField(record, "source") as string,
    updated_at: readField(record, "updatedAt", "updated_at") as string,
    validation_issue_count: readField(
      record,
      "validationIssueCount",
      "validation_issue_count",
    ) as number,
  };
  assignNumberIfPresent(
    summary,
    "version_no",
    readField(record, "versionNo", "version_no"),
  );
  assignStringIfPresent(
    summary,
    "version_id",
    readField(record, "versionId", "version_id"),
  );
  assignStringIfPresent(
    summary,
    "request_id",
    readField(record, "requestId", "request_id"),
  );
  assignStringIfPresent(summary, "title", readField(record, "title"));
  assignStringIfPresent(summary, "kind", readField(record, "kind"));
  assignStringIfPresent(summary, "status", readField(record, "status"));
  assignStringIfPresent(
    summary,
    "preview_text",
    readField(record, "previewText", "preview_text"),
  );
  assignStringIfPresent(
    summary,
    "snapshot_path",
    readField(record, "snapshotPath", "snapshot_path"),
  );
  if (!isFileCheckpointSummary(summary)) {
    throw new Error(`${command} did not return file checkpoint summary`);
  }
  return summary;
}

export function projectAppServerFileCheckpointListResult(
  command: string,
  value: unknown,
): AgentRuntimeFileCheckpointListResult {
  if (!isAppServerFileCheckpointListResponse(value)) {
    throw new Error(`${command} did not return file checkpoint list`);
  }
  const record = value as unknown as Record<string, unknown>;
  const result: AgentRuntimeFileCheckpointListResult = {
    session_id: readField(record, "sessionId", "session_id") as string,
    thread_id: readField(record, "threadId", "thread_id") as string,
    checkpoint_count: readField(
      record,
      "checkpointCount",
      "checkpoint_count",
    ) as number,
    checkpoints: (readField(record, "checkpoints") as unknown[]).map(
      (checkpoint) =>
        projectAppServerFileCheckpointSummary(command, checkpoint),
    ),
  };
  assertFileCheckpointListResult(command, result);
  return result;
}

export function projectAppServerFileCheckpointDetail(
  command: string,
  value: unknown,
): AgentRuntimeFileCheckpointDetail {
  if (!isAppServerFileCheckpointDetail(value)) {
    throw new Error(`${command} did not return file checkpoint detail`);
  }
  const record = value as unknown as Record<string, unknown>;
  const detail: AgentRuntimeFileCheckpointDetail = {
    session_id: readField(record, "sessionId", "session_id") as string,
    thread_id: readField(record, "threadId", "thread_id") as string,
    checkpoint: projectAppServerFileCheckpointSummary(
      command,
      readField(record, "checkpoint"),
    ),
    live_path: readField(record, "livePath", "live_path") as string,
    snapshot_path: readField(record, "snapshotPath", "snapshot_path") as string,
    version_history: readField(
      record,
      "versionHistory",
      "version_history",
    ) as unknown[],
    validation_issues: readField(
      record,
      "validationIssues",
      "validation_issues",
    ) as string[],
  };
  assignIfPresent(
    detail,
    "checkpoint_document",
    readField(record, "checkpointDocument", "checkpoint_document"),
  );
  assignIfPresent(
    detail,
    "live_document",
    readField(record, "liveDocument", "live_document"),
  );
  assignIfPresent(detail, "metadata", readField(record, "metadata"));
  assignStringIfPresent(detail, "content", readField(record, "content"));
  assertFileCheckpointDetail(command, detail);
  return detail;
}

export function projectAppServerFileCheckpointDiffResult(
  command: string,
  value: unknown,
): AgentRuntimeFileCheckpointDiffResult {
  if (!isAppServerFileCheckpointDiffResponse(value)) {
    throw new Error(`${command} did not return file checkpoint diff`);
  }
  const record = value as unknown as Record<string, unknown>;
  const result: AgentRuntimeFileCheckpointDiffResult = {
    session_id: readField(record, "sessionId", "session_id") as string,
    thread_id: readField(record, "threadId", "thread_id") as string,
    checkpoint: projectAppServerFileCheckpointSummary(
      command,
      readField(record, "checkpoint"),
    ),
  };
  assignStringIfPresent(
    result,
    "current_version_id",
    readField(record, "currentVersionId", "current_version_id"),
  );
  assignStringIfPresent(
    result,
    "previous_version_id",
    readField(record, "previousVersionId", "previous_version_id"),
  );
  assignIfPresent(result, "diff", readField(record, "diff"));
  assertFileCheckpointDiffResult(command, result);
  return result;
}

export function projectAppServerFileCheckpointRestoreResult(
  command: string,
  value: unknown,
): AgentRuntimeFileCheckpointRestoreResult {
  if (!isAppServerFileCheckpointRestoreResponse(value)) {
    throw new Error(`${command} did not return file checkpoint restore result`);
  }
  const record = value as unknown as Record<string, unknown>;
  const result: AgentRuntimeFileCheckpointRestoreResult = {
    session_id: readField(record, "sessionId", "session_id") as string,
    thread_id: readField(record, "threadId", "thread_id") as string,
    checkpoint: projectAppServerFileCheckpointSummary(
      command,
      readField(record, "checkpoint"),
    ),
    live_path: readField(record, "livePath", "live_path") as string,
    snapshot_path: readField(record, "snapshotPath", "snapshot_path") as string,
    restored_at: readField(record, "restoredAt", "restored_at") as string,
  };
  assignNullableStringIfPresent(
    result,
    "backup_path",
    readField(record, "backupPath", "backup_path"),
  );
  assertFileCheckpointRestoreResult(command, result);
  return result;
}

function assertFileCheckpointListResult(
  command: string,
  value: unknown,
): asserts value is AgentRuntimeFileCheckpointListResult {
  if (!isFileCheckpointListResult(value)) {
    throw new Error(`${command} did not return file checkpoint list`);
  }
}

function assertFileCheckpointDetail(
  command: string,
  value: unknown,
): asserts value is AgentRuntimeFileCheckpointDetail {
  if (!isFileCheckpointDetail(value)) {
    throw new Error(`${command} did not return file checkpoint detail`);
  }
}

function assertFileCheckpointDiffResult(
  command: string,
  value: unknown,
): asserts value is AgentRuntimeFileCheckpointDiffResult {
  if (!isFileCheckpointDiffResult(value)) {
    throw new Error(`${command} did not return file checkpoint diff`);
  }
}

function assertFileCheckpointRestoreResult(
  command: string,
  value: unknown,
): asserts value is AgentRuntimeFileCheckpointRestoreResult {
  if (!isFileCheckpointRestoreResult(value)) {
    throw new Error(`${command} did not return file checkpoint restore result`);
  }
}
