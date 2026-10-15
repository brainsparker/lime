import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { createThreadClient as SourceThreadClient } from "./threadClient";
import type { createThreadClient as DeclaredThreadClient } from "./threadClient.d";
import type { createAgentRuntimeClient as SourceRuntimeClient } from "./clientFactory";
import type { createAgentRuntimeClient as DeclaredRuntimeClient } from "./clientFactory.d";
import type { useAgentStream } from "@/components/agent/chat/hooks/useAgentStream";
import {
  createTurnStartAcceptance,
  createTurnSteerAcceptance,
  requireRuntimeAcceptanceReceipt,
  runRuntimeAcceptanceEffect,
  type RuntimeAcceptanceReceipt,
} from "./runtimeAcceptance";
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: logMock }));
afterEach(() => vi.clearAllMocks());
const context = {
  sessionId: "session-captured",
  threadId: "thread-canonical",
  clientUserMessageId: "client-input",
};
describe("runtime acceptance receipt", () => {
  it("captures real start identity, keeps session distinct from thread and is immutable", () => {
    const receipt = createTurnStartAcceptance(context, {
      turn: { id: "turn-start", status: "inProgress" },
    });
    expect(receipt).toEqual({
      ...context,
      kind: "start",
      turnId: "turn-start",
    });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(() => requireRuntimeAcceptanceReceipt(receipt)).not.toThrow();
    expectTypeOf<
      ReturnType<typeof SourceThreadClient>["submitAgentRuntimeTurn"]
    >().toEqualTypeOf<
      ReturnType<typeof DeclaredThreadClient>["submitAgentRuntimeTurn"]
    >();
    expectTypeOf<
      ReturnType<typeof SourceRuntimeClient>["submitAgentRuntimeTurn"]
    >().toEqualTypeOf<
      ReturnType<typeof DeclaredRuntimeClient>["submitAgentRuntimeTurn"]
    >();
    expectTypeOf<
      Awaited<ReturnType<ReturnType<typeof useAgentStream>["sendMessage"]>>
    >().toEqualTypeOf<RuntimeAcceptanceReceipt>();
  });
  it.each([
    undefined,
    null,
    true,
    false,
    {},
    { turn: { turnId: "old", status: "accepted" } },
    { turn: { id: "", status: "inProgress" } },
    { turn: { id: "unknown", status: "dispatched" } },
  ])("does not infer acceptance from %j", (response) => {
    expect(() =>
      createTurnStartAcceptance(context, response as never),
    ).toThrow();
  });
  it("validates steer response and never creates a receipt for a mismatch", () => {
    expect(
      createTurnSteerAcceptance(context, "turn-active", {
        turnId: "turn-active",
      }),
    ).toEqual({ ...context, kind: "steer", turnId: "turn-active" });
    expect(() =>
      createTurnSteerAcceptance(context, "turn-active", { turnId: "another" }),
    ).toThrow("mismatched turnId");
  });
  it("reports observer failures without logging their text or changing receipt", () => {
    const receipt = createTurnStartAcceptance(context, {
      turn: { id: "turn-start", status: "inProgress" },
    });
    runRuntimeAcceptanceEffect(receipt, "observer", () => {
      throw new Error("PRIVATE USER BODY");
    });
    expect(logMock).toHaveBeenCalledWith(
      "AgentRuntime",
      "acceptance.postProcessingFailed",
      {
        phase: "observer",
        sessionId: context.sessionId,
        threadId: context.threadId,
        turnId: "turn-start",
      },
      { level: "error" },
    );
    expect(JSON.stringify(logMock.mock.calls)).not.toContain(
      "PRIVATE USER BODY",
    );
  });
});
