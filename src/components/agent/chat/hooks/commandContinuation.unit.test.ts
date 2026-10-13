import { describe, expect, it } from "vitest";
import { parseAgentEvent, type AgentThreadItem } from "@/lib/api/agentProtocol";
import { projectCommandContinuation } from "./commandContinuation";
import { hasRunningSessionCommand } from "../projection/commandActivity";
import type { AgentStreamConversationProjectionHost } from "./agentStreamConversationProjection";

function command(): AgentThreadItem {
  return {
    id: "command",
    type: "command_execution",
    thread_id: "thread",
    turn_id: "original",
    status: "in_progress",
    sequence: 0,
    started_at: "2026-10-12T00:00:00Z",
    updated_at: "2026-10-12T00:00:00Z",
    command: "read answer",
    cwd: "/workspace",
    source: "unifiedExecStartup",
    process_id: "process",
    aggregated_output: "ready\n",
  };
}

describe("session Command continuation", () => {
  it.each([true, false])(
    "原请求已完成或下一请求进行中，都只投影原命令（finished=%s）",
    (requestFinished) => {
      const host: AgentStreamConversationProjectionHost = {};
      const base = {
        items: [command()],
        host,
        threadId: "thread",
        currentTurnId: "next",
        requestFinished,
      };
      const delta = parseAgentEvent({
        type: "tool_output_delta",
        thread_id: "thread",
        turn_id: "original",
        tool_id: "command",
        delta: "tail\n",
        protocol_method: "item/commandExecution/outputDelta",
      })!;
      const projected = projectCommandContinuation({ ...base, event: delta });
      expect(projected).toMatchObject({
        handled: true,
        item: {
          turn_id: "original",
          status: "in_progress",
          aggregated_output: "ready\ntail\n",
        },
      });
      const interaction = parseAgentEvent({
        type: "terminal_interaction",
        thread_id: "thread",
        turn_id: "original",
        item_id: "command",
        process_id: "process",
        stdin: "sent 9 chars",
        protocol_method: "item/commandExecution/terminalInteraction",
      })!;
      expect(
        projectCommandContinuation({ ...base, event: interaction }).item,
      ).toMatchObject({
        terminal_interactions: [
          { process_id: "process", stdin: "sent 9 chars" },
        ],
      });
      const completion = parseAgentEvent({
        type: "item_completed",
        item: {
          ...command(),
          status: "completed",
          aggregated_output: "ready\ntail\n",
          exit_code: 0,
        },
        protocol_method: "item/completed",
      })!;
      expect(
        projectCommandContinuation({ ...base, event: completion }).item,
      ).toMatchObject({
        status: "completed",
        aggregated_output: "ready\ntail\n",
      });
      expect(
        hasRunningSessionCommand(
          host.conversationProjectionOwner!.reducer.getProjection().items,
        ),
      ).toBe(false);
      expect(projectCommandContinuation({ ...base, event: delta })).toEqual({
        handled: true,
      });
    },
  );

  it("未知 Item、其它 Thread/Turn 和当前请求命令不进入后台分支", () => {
    const base = {
      items: [command()],
      host: {},
      threadId: "thread",
      currentTurnId: "next",
      requestFinished: false,
    };
    for (const scope of [
      { thread_id: "other", turn_id: "original", tool_id: "command" },
      { thread_id: "thread", turn_id: "next", tool_id: "command" },
      { thread_id: "thread", turn_id: "original", tool_id: "other" },
    ]) {
      const event = parseAgentEvent({
        type: "tool_output_delta",
        delta: "wrong",
        ...scope,
        protocol_method: "item/commandExecution/outputDelta",
      })!;
      expect(projectCommandContinuation({ ...base, event })).toEqual({
        handled: false,
      });
    }
  });
});
