import type { Dispatch, SetStateAction } from "react";
import type { AgentThreadItem, AgentThreadTurn } from "@/lib/api/agentProtocol";
import type { Message } from "../types";
import type { AgentStreamResumeBindingTarget } from "./streamResumeTarget";
import { formatAgentRuntimeStatusSummary } from "../utils/agentRuntimeStatus";
import {
  upsertThreadItemState,
  upsertThreadTurnState,
} from "./agentThreadState";
import { buildAgentStreamProcessBoundaryTextCommitPatch } from "./agentStreamProcessBoundaryCommit";
import {
  appendInterruptedPlaceholderText,
  contentHasInterruptedPlaceholder,
  contentPartsHaveInterruptedPlaceholder,
  stripInterruptedPlaceholderText,
} from "./agentInterruptedMessageContent";

export function findExistingAssistantMessageId(
  messages: readonly Message[],
  turnId: string,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant" && message.runtimeTurnId === turnId) {
      return message.id;
    }
  }
  return null;
}

export function findExistingTurnSummaryItemId(
  items: readonly AgentThreadItem[],
  turnId: string,
): string | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.turn_id === turnId && item.type === "turn_summary") {
      return item.id;
    }
  }
  return null;
}

export function upsertRecoveredAssistantMessage(options: {
  assistantMsgId: string;
  runtimeStatus: NonNullable<Message["runtimeStatus"]>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  target: AgentStreamResumeBindingTarget;
}): void {
  const { assistantMsgId, runtimeStatus, setMessages, target } = options;
  setMessages((prev) => {
    const existingIndex = prev.findIndex(
      (message) => message.id === assistantMsgId,
    );
    if (existingIndex >= 0) {
      return prev.map((message) =>
        message.id === assistantMsgId
          ? {
              ...message,
              isThinking: true,
              runtimeStatus: message.runtimeStatus ?? runtimeStatus,
              runtimeTurnId: message.runtimeTurnId ?? target.turnId,
            }
          : message,
      );
    }

    return [
      ...prev,
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isThinking: true,
        runtimeStatus,
        runtimeTurnId: target.turnId,
      },
    ];
  });
}

export function upsertRecoveredRunningTurn(options: {
  pendingItemKey: string;
  runtimeStatus: NonNullable<Message["runtimeStatus"]>;
  setThreadItems: Dispatch<SetStateAction<AgentThreadItem[]>>;
  setThreadTurns: Dispatch<SetStateAction<AgentThreadTurn[]>>;
  target: AgentStreamResumeBindingTarget;
}): void {
  const {
    pendingItemKey,
    runtimeStatus,
    setThreadItems,
    setThreadTurns,
    target,
  } = options;
  const now = new Date().toISOString();
  const startedAt = target.startedAt || now;

  setThreadTurns((prev) => {
    const existing = prev.find((turn) => turn.id === target.turnId);
    if (existing) {
      return existing.status === "running"
        ? prev
        : upsertThreadTurnState(prev, {
            ...existing,
            status: "running",
            updated_at: now,
          });
    }

    return upsertThreadTurnState(prev, {
      id: target.turnId,
      thread_id: target.threadId,
      prompt_text: "",
      status: "running",
      started_at: startedAt,
      created_at: startedAt,
      updated_at: now,
    });
  });

  setThreadItems((prev) => {
    if (prev.some((item) => item.id === pendingItemKey)) {
      return prev;
    }
    return upsertThreadItemState(prev, {
      id: pendingItemKey,
      thread_id: target.threadId,
      turn_id: target.turnId,
      sequence: 0,
      status: "in_progress",
      started_at: startedAt,
      updated_at: now,
      type: "turn_summary",
      text: formatAgentRuntimeStatusSummary(runtimeStatus),
    });
  });
}

export function commitRecoveredAssistantProjection(options: {
  assistantMsgId: string;
  items: readonly AgentThreadItem[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  target: AgentStreamResumeBindingTarget;
}): void {
  const { assistantMsgId, items, setMessages, target } = options;
  const projectedMessage = items.reduce<
    Extract<AgentThreadItem, { type: "agent_message" }> | undefined
  >((selected, item) => {
    if (
      item.type !== "agent_message" ||
      item.turn_id !== target.turnId ||
      !item.text.trim()
    ) {
      return selected;
    }
    return !selected || item.text.trim().length > selected.text.trim().length
      ? item
      : selected;
  }, undefined);
  if (!projectedMessage) {
    return;
  }

  setMessages((previous) =>
    previous.map((message) => {
      if (message.id !== assistantMsgId) {
        return message;
      }
      const committedText = mergeRecoveredAssistantProjectionText(
        message,
        projectedMessage.text,
      );
      const patch = buildAgentStreamProcessBoundaryTextCommitPatch({
        accumulatedContent: committedText,
        parts: message.contentParts,
        renderedContent: committedText,
        shouldRetainThinkingPart: () => true,
        surfaceThinkingDeltas: true,
        textPartMetadata: {
          phase: projectedMessage.phase,
          threadItemId: projectedMessage.id,
          turnId: target.turnId,
        },
      });
      return patch.content || patch.contentParts
        ? { ...message, ...patch }
        : message;
    }),
  );
}

export function mergeRecoveredAssistantProjectionText(
  message: Message,
  projectedText: string,
): string {
  const contentPartsText = (message.contentParts ?? [])
    .filter(
      (
        part,
      ): part is Extract<
        NonNullable<Message["contentParts"]>[number],
        { type: "text" }
      > => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
  const visibleCandidates = [message.content, contentPartsText, projectedText]
    .map(stripInterruptedPlaceholderText)
    .filter((text) => text.trim().length > 0);
  const visibleText = visibleCandidates.reduce(
    (longest, candidate) =>
      candidate.trim().length > longest.trim().length ? candidate : longest,
    "",
  );
  if (!visibleText.trim()) {
    return projectedText;
  }

  const hasInterruptedPlaceholder =
    contentHasInterruptedPlaceholder(message.content) ||
    contentPartsHaveInterruptedPlaceholder(message.contentParts) ||
    contentHasInterruptedPlaceholder(projectedText);
  return hasInterruptedPlaceholder
    ? appendInterruptedPlaceholderText(visibleText)
    : visibleText;
}
