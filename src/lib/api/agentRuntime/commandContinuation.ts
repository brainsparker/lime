import type { AppServerJsonRpcNotification } from "@/lib/api/appServer";
import { readAppServerV2NotificationRoute } from "./appServerV2Notification";

/** Routing facts only; the shared sequence gate still validates every lifecycle event. */
export class CommandContinuation {
  readonly #processes = new Map<string, string>();
  readonly #completed = new Set<string>();

  get active(): boolean {
    return this.#processes.size > 0;
  }

  restore(items: readonly unknown[]): void {
    for (const entity of items) {
      const item = record(entity);
      if (
        item?.type !== "commandExecution" ||
        item.source !== "unifiedExecStartup" ||
        typeof item.id !== "string" ||
        typeof item.processId !== "string" ||
        !item.processId
      )
        continue;
      if (item.status !== "inProgress") {
        this.#completed.add(item.id);
        this.#processes.delete(item.id);
      } else if (!this.#completed.has(item.id)) {
        this.#processes.set(item.id, item.processId);
      }
    }
  }

  observe(notification: AppServerJsonRpcNotification): void {
    const params = record(notification.params);
    const item = record(params?.item);
    if (!item || typeof item.id !== "string") return;
    if (notification.method === "item/completed") {
      this.#completed.add(item.id);
      this.#processes.delete(item.id);
    } else if (
      notification.method === "item/started" &&
      item.type === "commandExecution" &&
      item.source === "unifiedExecStartup" &&
      item.status === "inProgress" &&
      typeof item.processId === "string" &&
      item.processId.length > 0
    ) {
      this.#processes.set(item.id, item.processId);
    }
  }

  allows(notification: AppServerJsonRpcNotification): boolean {
    const route = readAppServerV2NotificationRoute(notification);
    const processId = route?.itemId
      ? this.#processes.get(route.itemId)
      : undefined;
    if (!processId) return false;
    if (
      notification.method === "item/commandExecution/outputDelta" ||
      notification.method === "item/commandExecution/terminalInteraction"
    )
      return true;
    const item = record(record(notification.params)?.item);
    return (
      notification.method === "item/completed" &&
      item?.type === "commandExecution" &&
      item.processId === processId
    );
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
