import type { AgentEvent, AgentThreadItem } from "@/lib/api/agentProtocol";
import {
  applyAgentStreamConversationProjection,
  type AgentStreamConversationProjectionHost,
} from "./agentStreamConversationProjection";

/** Project the original process after model completion without restarting the sending state. */
export function projectCommandContinuation(params: {
  event: AgentEvent;
  items: readonly AgentThreadItem[];
  host: AgentStreamConversationProjectionHost;
  threadId: string;
  currentTurnId?: string | null;
  requestFinished: boolean;
}): { handled: boolean; item?: AgentThreadItem } {
  const event = params.event;
  const snapshot =
    (event.type === "item_completed" || event.type === "item_updated") &&
    event.item.type === "command_execution"
      ? event.item
      : undefined;
  if (
    (snapshot?.thread_id ?? event.thread_id ?? event.session_id) !==
    params.threadId
  )
    return { handled: false };
  const id =
    snapshot?.id ??
    (event.type === "tool_output_delta"
      ? event.tool_id
      : event.type === "terminal_interaction"
        ? event.item_id
        : undefined);
  const turnId = snapshot?.turn_id ?? event.turn_id;
  if (!id || (!params.requestFinished && turnId === params.currentTurnId))
    return { handled: false };
  const items =
    params.host.conversationProjectionOwner?.reducer.getProjection().items ??
    params.items;
  const current = items.find(
    (item) =>
      item.id === id &&
      item.turn_id === turnId &&
      item.thread_id === params.threadId,
  );
  if (
    !current ||
    current.type !== "command_execution" ||
    current.source !== "unifiedExecStartup" ||
    !current.process_id
  )
    return { handled: false };
  if (
    current.status !== "in_progress" ||
    (snapshot && snapshot.process_id !== current.process_id) ||
    (event.type === "terminal_interaction" &&
      event.process_id !== current.process_id)
  )
    return { handled: true };
  const update = applyAgentStreamConversationProjection({
    event,
    existingItems: params.items,
    host: params.host,
    threadId: params.threadId,
  });
  return {
    handled: true,
    item: update?.projection.items.find(
      (item) => item.id === id && item.turn_id === turnId,
    ),
  };
}
