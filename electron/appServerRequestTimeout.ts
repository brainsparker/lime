const DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 30_000;
const APP_SERVER_BACKEND_TIMEOUT_GRACE_MS = 30_000;
const APP_SERVER_TURN_START_METHOD = "turn/start";
const APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_METHOD =
  "conversationImport/thread/commit";
const APP_SERVER_CONVERSATION_IMPORT_JOB_READ_METHOD =
  "conversationImport/job/read";
const APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_TIMEOUT_MS = 180_000;
const APP_SERVER_CONVERSATION_IMPORT_SCAN_TIMEOUT_MS = 120_000;
const APP_SERVER_CONVERSATION_IMPORT_PREVIEW_TIMEOUT_MS = 120_000;
const APP_SERVER_REQUEST_TIMEOUT_OVERRIDE_CEILING_MS = 600_000;

export function parsePositiveInteger(
  value: string | undefined,
): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveAppServerRequestTimeoutMs(
  method: string,
  requestedTimeoutMs?: unknown,
): number {
  const defaultTimeoutMs = resolveDefaultAppServerRequestTimeoutMs(method);
  const overrideTimeoutMs = parsePositiveIntegerValue(requestedTimeoutMs);
  if (!overrideTimeoutMs) {
    return defaultTimeoutMs;
  }
  return Math.min(
    Math.max(defaultTimeoutMs, overrideTimeoutMs),
    APP_SERVER_REQUEST_TIMEOUT_OVERRIDE_CEILING_MS,
  );
}

function resolveDefaultAppServerRequestTimeoutMs(method: string): number {
  if (method === "command/exec") return 600_000;
  if (
    [
      "plugin/install",
      "plugin/reconcile",
      "plugin/share/save",
      "plugin/share/list",
      "plugin/share/updateTargets",
      "plugin/share/checkout",
      "plugin/share/delete",
    ].includes(method)
  )
    return 150_000;
  if (method === APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_METHOD) {
    return APP_SERVER_CONVERSATION_IMPORT_THREAD_COMMIT_TIMEOUT_MS;
  }
  if (method === APP_SERVER_CONVERSATION_IMPORT_JOB_READ_METHOD) {
    return APP_SERVER_CONVERSATION_IMPORT_SCAN_TIMEOUT_MS;
  }
  if (method === "conversationImport/source/scan") {
    return APP_SERVER_CONVERSATION_IMPORT_SCAN_TIMEOUT_MS;
  }
  if (method === "conversationImport/thread/preview") {
    return APP_SERVER_CONVERSATION_IMPORT_PREVIEW_TIMEOUT_MS;
  }
  if (method !== APP_SERVER_TURN_START_METHOD) {
    return DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS;
  }
  const backendTimeoutMs = parsePositiveInteger(
    process.env.APP_SERVER_BACKEND_TIMEOUT_MS,
  );
  return backendTimeoutMs
    ? backendTimeoutMs + APP_SERVER_BACKEND_TIMEOUT_GRACE_MS
    : DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS;
}

function parsePositiveIntegerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}
