const RESPONSE_GRACE_MS = 30_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const MAX_TIMER_MS = 2_147_483_647;

/** 0 means no transport deadline; process expiry still belongs to command/exec. */
export function commandExecRequestTimeoutMs(params: unknown): number {
  const request =
    params && typeof params === "object"
      ? (params as { disableTimeout?: unknown; timeoutMs?: unknown })
      : {};
  if (request.disableTimeout === true) return 0;
  const timeout =
    typeof request.timeoutMs === "number" &&
    Number.isSafeInteger(request.timeoutMs) &&
    request.timeoutMs >= 0
      ? request.timeoutMs
      : DEFAULT_COMMAND_TIMEOUT_MS;
  const deadline = timeout + RESPONSE_GRACE_MS;
  // JavaScript timers overflow above the signed 32-bit limit.
  return deadline <= MAX_TIMER_MS ? deadline : 0;
}
