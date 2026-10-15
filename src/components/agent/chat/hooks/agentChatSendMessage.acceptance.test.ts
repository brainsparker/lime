import { describe, expect, it, vi } from "vitest";
import { createAgentChatSendMessage } from "./agentChatSendMessage";
import type { RawSendMessageFn } from "./agentChatShared";
const receipt = {
  kind: "steer" as const,
  sessionId: "captured-session",
  threadId: "thread-1",
  turnId: "turn-steer",
};
function setup(rawSendMessage: RawSendMessageFn) {
  return createAgentChatSendMessage({
    baseStatusSnapshot: {
      sessionId: "other",
      currentTurnId: null,
      providerType: "openai",
      model: "fixture",
      executionStrategy: "react",
      queuedTurnsCount: 0,
      isSending: false,
    },
    rawSendMessage,
    compactSession: vi.fn(),
    clearMessages: vi.fn(),
    createFreshSession: vi.fn(),
    appendAssistantMessage: vi.fn(),
    notifyInfo: vi.fn(),
    notifySuccess: vi.fn(),
  });
}
describe("outer chat acceptance", () => {
  it.each(["normal prompt", "/review changes", "/diff", "/init"])(
    "returns real receipt through %s",
    async (content) => {
      const raw = vi.fn<RawSendMessageFn>(async (...args) => {
        args[8]?.observer?.onRuntimeAccepted?.(receipt);
        return receipt;
      });
      const accepted = vi.fn();
      const onComplete = vi.fn();
      const result = await setup(raw)(
        content,
        [],
        false,
        false,
        false,
        undefined,
        undefined,
        undefined,
        { observer: { onRuntimeAccepted: accepted, onComplete } },
      );
      expect(result).toEqual({ kind: "runtime-accepted", receipt });
      expect(accepted).toHaveBeenCalledOnce();
      expect(raw.mock.calls[0][8]?.observer?.onComplete).toBe(onComplete);
    },
  );
  it("local slash action never fabricates runtime acceptance", async () => {
    const raw = vi.fn<RawSendMessageFn>();
    const accepted = vi.fn();
    expect(
      await setup(raw)(
        "/help",
        [],
        false,
        false,
        false,
        undefined,
        undefined,
        undefined,
        { observer: { onRuntimeAccepted: accepted } },
      ),
    ).toEqual({ kind: "local-handled" });
    expect(raw).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();
  });
  it("late postresponse rejection preserves steer acceptance; request rejection stays original", async () => {
    const error = new Error("refresh failed");
    const raw = vi.fn<RawSendMessageFn>(async (...args) => {
      args[8]?.observer?.onRuntimeAccepted?.(receipt);
      throw error;
    });
    expect(await setup(raw)("/review changes", [])).toEqual({
      kind: "runtime-accepted",
      receipt,
    });
    raw.mockImplementation(async () => {
      throw error;
    });
    await expect(setup(raw)("normal", [])).rejects.toBe(error);
  });
  it("unknown raw response keeps result unknown", async () => {
    const raw = vi.fn<RawSendMessageFn>().mockResolvedValue(undefined as never);
    expect(await setup(raw)("normal", [])).toEqual({ kind: "unknown" });
  });
});
