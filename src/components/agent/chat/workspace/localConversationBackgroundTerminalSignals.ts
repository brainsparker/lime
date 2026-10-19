import type { AgentThreadItem, AgentThreadTurn } from "../types";

export type BackgroundTerminal = Extract<
  AgentThreadItem,
  { type: "command_execution" }
>;

/** Earlier turns may retain running commands after the assistant has finished. */
export function selectBackgroundTerminals(
  threadId: string | null | undefined,
  turns: readonly AgentThreadTurn[],
  items: readonly AgentThreadItem[],
): BackgroundTerminal[] {
  if (!threadId) return [];
  const threadTurns = turns.filter((turn) => turn.thread_id === threadId);
  const lastTurn = threadTurns.at(-1);
  const commandsByTurn = new Map<string, BackgroundTerminal[]>();
  for (const item of items) {
    if (
      item.thread_id !== threadId ||
      item.type !== "command_execution" ||
      item.status !== "in_progress" ||
      item.command_status !== "inProgress"
    ) continue;
    const commands = commandsByTurn.get(item.turn_id) ?? [];
    commands.push(item);
    commandsByTurn.set(item.turn_id, commands);
  }
  return [...threadTurns].reverse().flatMap((turn) =>
    turn === lastTurn && turn.status === "running"
      ? []
      : commandsByTurn.get(turn.id) ?? [],
  );
}
