import {
  isThreadSettingsUpdatedNotification,
  type JsonRpcNotification,
  type ThreadSettings,
} from "@limecloud/app-server-client";

export interface AgentThreadSettingsUpdate {
  threadId: string;
  sessionIds: string[];
  workspaceId?: string;
  threadSettings: ThreadSettings;
}

const MAX_MIRRORS = 2_048;
const MIRROR_TTL_MS = 30_000;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

/** 消耗一对 response/drain 镜像，保留同来源的合法 A → B → A。 */
export class ThreadSettingsNotificationMirrors {
  readonly #pending: {
    key: string;
    source: "response" | "drain";
    at: number;
  }[] = [];

  reset(): void {
    this.#pending.length = 0;
  }

  accept(
    notification: JsonRpcNotification,
    source: "response" | "drain",
  ): boolean {
    if (!isThreadSettingsUpdatedNotification(notification)) return true;
    const now = Date.now();
    while (this.#pending.length && this.#pending[0].at < now - MIRROR_TTL_MS) {
      this.#pending.shift();
    }
    const key = JSON.stringify(stableValue(notification.params));
    const mirror = this.#pending.findIndex(
      (entry) => entry.key === key && entry.source !== source,
    );
    if (mirror !== -1) {
      this.#pending.splice(mirror, 1);
      return false;
    }
    this.#pending.push({ key, source, at: now });
    if (this.#pending.length > MAX_MIRRORS) this.#pending.shift();
    return true;
  }
}
