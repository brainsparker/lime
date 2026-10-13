import type { Dispatch, SetStateAction } from "react";
import {
  parseAgentEvent,
  type AgentEvent,
  type AgentThreadItem,
} from "@/lib/api/agentProtocol";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { AgentStreamConversationProjectionHost } from "./agentStreamConversationProjection";
import { projectCommandContinuation } from "./commandContinuation";
import { upsertThreadItemState } from "./agentThreadState";
import { recordAgentUiPerformanceMetric } from "@/lib/agentUiPerformanceMetrics";

type Command = Extract<AgentThreadItem, { type: "command_execution" }>;

/** 恢复原 Command 的订阅，不占用新 Turn 的 sending/composer 状态。 */
export async function bindRecoveredCommands(options: {
  runtime: Pick<AgentRuntimeAdapter, "listenToTurnEvents" | "resumeThread">;
  threadId: string;
  commands: readonly AgentThreadItem[];
  getItems: () => readonly AgentThreadItem[];
  setItems: Dispatch<SetStateAction<AgentThreadItem[]>>;
  signal?: AbortSignal;
}): Promise<(() => void) | null> {
  if (options.signal?.aborted) return null;
  const commands = options.commands.filter(
    (item): item is Command =>
      item.type === "command_execution" &&
      item.thread_id === options.threadId &&
      item.source === "unifiedExecStartup" &&
      Boolean(item.process_id),
  );
  if (!commands.length || commands.length !== options.commands.length)
    return null;
  const matches = (item: AgentThreadItem): item is Command =>
    item.type === "command_execution" &&
    commands.some(
      (command) =>
        command.id === item.id &&
        command.turn_id === item.turn_id &&
        command.thread_id === item.thread_id &&
        command.process_id === item.process_id,
    );
  const host: AgentStreamConversationProjectionHost = {};
  const pending: AgentEvent[] = [];
  let disposed = false;
  let unlisten: (() => void) | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    options.signal?.removeEventListener("abort", dispose);
    unlisten?.();
  };
  options.signal?.addEventListener("abort", dispose, { once: true });
  const publishItems = (items: readonly AgentThreadItem[]) => {
    options.setItems((previous) =>
      items.filter(matches).reduce((current, item) => {
        const existing = current.find(
          (value) =>
            value.id === item.id &&
            value.turn_id === item.turn_id &&
            value.thread_id === item.thread_id,
        );
        if (
          existing &&
          existing.status !== "in_progress" &&
          item.status === "in_progress"
        )
          return current;
        return upsertThreadItemState(current, item);
      }, previous),
    );
  };
  const settle = () => {
    const items =
      host.conversationProjectionOwner?.reducer.getProjection().items;
    if (
      items &&
      !items.some((item) => matches(item) && item.status === "in_progress")
    )
      dispose();
  };
  const receive = (event: AgentEvent) => {
    if (disposed) return;
    if (!host.conversationProjectionOwner) {
      pending.push(event);
      return;
    }
    const update = projectCommandContinuation({
      event,
      host,
      items: options.getItems(),
      threadId: options.threadId,
      requestFinished: true,
    });
    if (update.item && matches(update.item)) {
      publishItems([update.item]);
      recordAgentUiPerformanceMetric("agentStream.commandResume.notification", {
        sessionId: options.threadId,
        turnId: update.item.turn_id,
        itemId: update.item.id,
        processId: update.item.process_id,
        method: event.protocol_method,
        status: update.item.status,
      });
    }
    settle();
  };
  try {
    unlisten = await options.runtime.listenToTurnEvents(
      `agentSession/event/${options.threadId}`,
      (event) => {
        const data = parseAgentEvent(event.payload);
        if (data) receive(data);
      },
    );
    if (disposed) {
      unlisten();
      return null;
    }
    const resumed = await options.runtime.resumeThread(
      options.threadId,
      (reducer) => {
        if (disposed)
          throw new DOMException("Command resume cancelled", "AbortError");
        const projection = reducer.getProjection();
        if (
          !commands.every((command) =>
            projection.items.some(
              (item) =>
                matches(item) &&
                item.id === command.id &&
                item.turn_id === command.turn_id,
            ),
          )
        )
          throw new Error(
            "Command resume snapshot does not contain the original process scopes",
          );
        host.conversationProjectionOwner = { reducer, nextEventOrdinal: 1 };
        publishItems(projection.items);
        for (const item of projection.items.filter(matches)) {
          recordAgentUiPerformanceMetric("agentStream.commandResume.bound", {
            sessionId: options.threadId,
            turnId: item.turn_id,
            itemId: item.id,
            processId: item.process_id,
            status: item.status,
          });
        }
        for (const event of pending.splice(0)) receive(event);
        settle();
      },
    );
    if (!resumed || !host.conversationProjectionOwner) {
      dispose();
      return null;
    }
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
