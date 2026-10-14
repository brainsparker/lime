import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import type { Message } from "../types";
import { canonicalAgentMessageItemId } from "../utils/contentPartTimeline";
import type { MessageListRenderGroup } from "./MessageList.types";

export function resolveCanonicalMessageItemId(
  message: Message,
  group: MessageListRenderGroup,
  threadRead: AgentRuntimeThreadReadModel | null,
): string | null {
  if (message.role === "assistant") {
    const fromContentParts = canonicalAgentMessageItemId(message.contentParts);
    if (fromContentParts) return fromContentParts;
  }
  const turnId =
    message.runtimeTurnId?.trim() || group.timeline?.turn?.id?.trim() || null;
  const itemType =
    message.role === "assistant"
      ? "agent_message"
      : message.role === "user"
        ? "user_message"
        : null;
  if (!itemType) return null;
  const matchingItems = [
    ...(group.timeline?.items ?? []),
    ...(threadRead?.thread_items ?? []),
  ].filter(
    (item) => item.type === itemType && (!turnId || item.turn_id === turnId),
  );
  if (message.role !== "user") return matchingItems[0]?.id ?? null;

  const uniqueItems = [
    ...new Map(matchingItems.map((item) => [item.id, item])).values(),
  ];
  const exactItems = uniqueItems.filter(
    (item) =>
      item.id === message.id ||
      (item.type === "user_message" && item.client_id === message.id),
  );
  if (exactItems.length === 1) return exactItems[0].id;
  if (exactItems.length > 1) return null;
  return uniqueItems.length === 1 ? uniqueItems[0].id : null;
}
