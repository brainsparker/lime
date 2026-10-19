import { describe, expect, it } from "vitest";
import type { AgentThreadItem, AgentThreadTurn } from "../types";
import { selectBackgroundTerminals } from "./localConversationBackgroundTerminalSignals";

const turn = (id: string, status: AgentThreadTurn["status"] = "completed") =>
  ({ id, thread_id: "thread", status }) as AgentThreadTurn;
const command = (id: string, turnId: string): AgentThreadItem => ({
  id,
  thread_id: "thread",
  turn_id: turnId,
  type: "command_execution",
  status: "in_progress",
  command_status: "inProgress",
  command: `process-${id}`,
  cwd: "/work",
  sequence: 1,
  started_at: "2026-10-19T00:00:00Z",
  updated_at: "2026-10-19T00:00:00Z",
});

describe("canonical background terminal selection", () => {
  it("excludes the active last turn, terminal commands, unrelated threads and unloaded turns", () => {
    const background = command("background", "old");
    const items: AgentThreadItem[] = [
      background,
      command("foreground", "active"),
      { ...command("done", "old"), command_status: "completed", status: "completed" },
      { ...command("interrupted", "old"), status: "failed" },
      { ...command("other", "old"), thread_id: "other-thread" },
      command("unloaded", "missing-turn"),
    ];
    expect(selectBackgroundTerminals("thread", [turn("old"), turn("active", "running")], items)).toEqual([background]);
    expect(selectBackgroundTerminals(null, [turn("old")], items)).toEqual([]);
  });

  it("includes a running command in the latest completed turn and follows canonical completion", () => {
    const item = command("tail", "last");
    expect(selectBackgroundTerminals("thread", [turn("last")], [item])).toEqual([item]);
    expect(selectBackgroundTerminals("thread", [turn("last")], [{ ...item, status: "completed", command_status: "completed" }])).toEqual([]);
  });
  it("groups background processes by newest turn first while retaining item order within a turn", () => {
    const older = command("older", "old");
    const newer = command("newer", "new");
    const sibling = command("sibling", "new");
    expect(selectBackgroundTerminals("thread", [turn("old"), turn("new"), turn("active", "running")], [older, newer, sibling])).toEqual([newer, sibling, older]);
  });
});
