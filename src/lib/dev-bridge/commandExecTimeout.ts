import { commandExecRequestTimeoutMs } from "../../../packages/app-server-client/src/command-exec-timeout";

/** 只投影current JSON-RPC command/exec，不改其它命令的超时或fallback策略。 */
export function commandExecBridgeTimeout(args: unknown): number | null {
  const lines = (args as { request?: { lines?: unknown } } | null)?.request
    ?.lines;
  if (!Array.isArray(lines)) return null;
  let timeout: number | null = null;
  for (const line of lines) {
    try {
      const message: unknown = JSON.parse(line);
      if (!message || typeof message !== "object") continue;
      const request = message as {
        method?: unknown;
        params?: unknown;
        id?: unknown;
      };
      if (request.method !== "command/exec" || request.id == null) continue;
      const next = commandExecRequestTimeoutMs(request.params);
      if (next === 0) return 0;
      timeout = Math.max(timeout ?? 0, next);
    } catch {
      /* 无效JSON由App Server报告，不改变transport策略。 */
    }
  }
  return timeout;
}
