import { describe, expect, it } from "vitest";
import { resolveGateBExpectedIdentity } from "./claw-chat-current-fixture-assertion-context.mjs";
import { resolveGoalObjective } from "./claw-chat-current-fixture-goal.mjs";
import { summarizeAppServerInvocationResult } from "./claw-chat-current-fixture-rpc.mjs";

function fixture() {
  return {
    options: { scenario: "goal" },
    summary: {
      sessionId: "session-goal",
      threadId: "thread-goal",
      goalInputSend: { clicked: { sessionId: "session-goal" } },
      guiGoalCompleted: {
        completionScope: {
          runtimeTurnId: "turn-user",
          assistantRuntimeTurnId: "turn-user",
          runtimeTurnStatus: "completed",
        },
      },
    },
    backendLedger: [
      { kind: "turnStart", sessionId: "session-goal", turnId: "turn-user" },
      {
        kind: "turnStart",
        sessionId: "session-goal",
        turnId: "turn-automatic",
      },
    ],
    appServerRequests: [
      {
        method: "thread/read",
        params: { threadId: "thread-goal" },
        response: {
          sessionId: "session-goal",
          threadId: "thread-goal",
          activeTurnId: "turn-automatic",
          turns: [
            { turnId: "turn-user", status: "completed" },
            { turnId: "turn-automatic", status: "running" },
          ],
        },
      },
    ],
  };
}

describe("Goal user turn Gate B identity", () => {
  it("keeps the completed user turn when the active goal starts a later automatic turn", () => {
    expect(resolveGateBExpectedIdentity(fixture())).toEqual({
      sessionId: "session-goal",
      threadId: "thread-goal",
      turnId: "turn-user",
    });
  });

  it.each([
    "missing-scope",
    "foreign-assistant",
    "pending",
    "foreign-session",
    "missing-backend",
    "foreign-read-model",
  ])("rejects %s instead of falling back to another turn", (mutation) => {
    const input = fixture();
    if (mutation === "missing-scope")
      input.summary.guiGoalCompleted.completionScope = null;
    if (mutation === "foreign-assistant")
      input.summary.guiGoalCompleted.completionScope.assistantRuntimeTurnId =
        "turn-automatic";
    if (mutation === "pending")
      input.summary.guiGoalCompleted.completionScope.runtimeTurnStatus =
        "running";
    if (mutation === "foreign-session")
      input.summary.goalInputSend.clicked.sessionId = "session-other";
    if (mutation === "missing-backend") input.backendLedger.shift();
    if (mutation === "foreign-read-model")
      input.appServerRequests[0].response.turns.shift();
    expect(() => resolveGateBExpectedIdentity(input)).toThrow(/Gate B/);
  });
});

describe("Goal objective current protocol evidence", () => {
  function read() {
    return {
      method: "thread/goal/get",
      params: { threadId: "thread-goal" },
      response: {
        goal: {
          threadId: "thread-goal",
          objective: "完成目标",
          status: "active",
        },
      },
    };
  }

  it("uses a successful canonical goal response from the same thread", () => {
    expect(resolveGoalObjective([read()], "thread-goal")).toBe("完成目标");
  });

  it.each([
    "missing",
    "legacy-harness",
    "foreign-request",
    "foreign-response",
    "failed",
    "cleared",
    "inactive",
  ])("cannot accept %s as current backend objective evidence", (mutation) => {
    const request = read();
    if (mutation === "legacy-harness") request.method = "turn/start";
    if (mutation === "foreign-request")
      request.params.threadId = "other-thread";
    if (mutation === "foreign-response")
      request.response.goal.threadId = "other-thread";
    if (mutation === "failed") request.error = "unavailable";
    if (mutation === "cleared") request.response.goal = null;
    if (mutation === "inactive") request.response.goal.status = "paused";
    expect(
      resolveGoalObjective(
        mutation === "missing" ? [] : [request],
        "thread-goal",
      ),
    ).toBeNull();
  });

  it("retains typed goal evidence in the RPC ledger and excludes unrelated fields", () => {
    const goal = {
      threadId: "thread-goal",
      objective: "完成目标",
      status: "active",
      tokenBudget: null,
    };
    expect(
      summarizeAppServerInvocationResult("thread/goal/get", {
        goal: { ...goal, unrelated: "exclude" },
      }),
    ).toEqual({ goal });
    expect(
      summarizeAppServerInvocationResult("thread/goal/get", { goal: null }),
    ).toEqual({ goal: null });
  });
});
