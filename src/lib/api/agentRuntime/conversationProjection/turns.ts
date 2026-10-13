import type {
  AgentThreadItem,
  AgentThreadTurn,
  AgentThreadTurnStatus,
} from "../../agentProtocol";
import type {
  ConversationProjectionEvent,
  ConversationProjectionSource,
  ConversationProjectionState,
  ConversationProjectionStatus,
  TurnProjection,
} from "./contracts";
import { addDiagnostic } from "./diagnostics";

export function upsertTurn(
  state: ConversationProjectionState,
  turn: AgentThreadTurn,
  source: ConversationProjectionSource,
  eventId?: string,
): ConversationProjectionState {
  if (state.thread_id && state.thread_id !== turn.thread_id) {
    return addDiagnostic(state, {
      code: "turn_mismatch",
      source,
      event_id: eventId,
      thread_id: turn.thread_id,
      turn_id: turn.id,
      message: `Ignored turn ${turn.id} outside thread ${state.thread_id}.`,
    });
  }
  const existing = state.turns[turn.id];
  const itemIds = existing?.item_ids ?? [];
  const projected: TurnProjection = {
    ...turn,
    ...(turn.unified_diff === undefined && existing?.unified_diff !== undefined
      ? { unified_diff: existing.unified_diff }
      : {}),
    ...(turn.moderation_metadata === undefined &&
    existing?.moderation_metadata !== undefined
      ? { moderation_metadata: existing.moderation_metadata }
      : {}),
    item_ids: itemIds,
  };
  const turns = { ...state.turns, [turn.id]: projected };
  const turnOrder = state.turn_order.includes(turn.id)
    ? state.turn_order
    : [...state.turn_order, turn.id];
  return {
    ...state,
    thread_id: state.thread_id ?? turn.thread_id,
    status: statusFromTurn(turns[turnOrder[turnOrder.length - 1]].status),
    turns,
    turn_order: turnOrder,
  };
}

export function applyTurnDiffUpdate(
  state: ConversationProjectionState,
  event: Extract<ConversationProjectionEvent, { type: "turn_diff_updated" }>,
): ConversationProjectionState {
  const turn = state.turns[event.turn_id];
  if (!turn || turn.thread_id !== event.thread_id) {
    return addDiagnostic(state, {
      code: "turn_mismatch",
      source: event.source,
      event_id: event.event_id,
      thread_id: event.thread_id,
      turn_id: event.turn_id,
      message: `Ignored diff update for unknown turn ${event.turn_id}.`,
    });
  }
  if (turn.unified_diff === event.unified_diff) {
    return state;
  }
  return {
    ...state,
    turns: {
      ...state.turns,
      [event.turn_id]: { ...turn, unified_diff: event.unified_diff },
    },
  };
}

export function applyTurnModerationMetadata(
  state: ConversationProjectionState,
  event: Extract<
    ConversationProjectionEvent,
    { type: "turn_moderation_metadata" }
  >,
): ConversationProjectionState {
  const turn = state.turns[event.turn_id];
  if (!turn || turn.thread_id !== event.thread_id) {
    return addDiagnostic(state, {
      code: "turn_mismatch",
      source: event.source,
      event_id: event.event_id,
      thread_id: event.thread_id,
      turn_id: event.turn_id,
      message: `Ignored moderation metadata for unknown turn ${event.turn_id}.`,
    });
  }
  if (turn.moderation_metadata === event.moderation_metadata) {
    return state;
  }
  return {
    ...state,
    turns: {
      ...state.turns,
      [event.turn_id]: {
        ...turn,
        moderation_metadata: event.moderation_metadata,
      },
    },
  };
}

export function ensureTurnForItem(
  state: ConversationProjectionState,
  item: AgentThreadItem,
  source: ConversationProjectionSource,
  eventId?: string,
): ConversationProjectionState {
  if (state.turns[item.turn_id]) {
    return state;
  }
  return upsertTurn(
    state,
    {
      id: item.turn_id,
      thread_id: item.thread_id,
      prompt_text: "",
      status: item.status === "in_progress" ? "running" : "completed",
      started_at: item.started_at,
      completed_at: item.completed_at,
      created_at: item.started_at,
      updated_at: item.updated_at,
    },
    source,
    eventId,
  );
}

function statusFromTurn(
  status: AgentThreadTurnStatus,
): ConversationProjectionStatus {
  switch (status) {
    case "running":
      return "running";
    case "failed":
      return "failed";
    case "interrupted":
    case "cancelled":
    case "canceled":
    case "aborted":
      return "interrupted";
    case "completed":
      return "completed";
    default:
      return "idle";
  }
}
