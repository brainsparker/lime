import { describe, expect, it } from "vitest";
import {
  consumeLocallyInterruptedAgentStreamBinding,
  hasLocallyInterruptedAgentStreamBinding,
  hasLocallyStartedAgentStreamBinding,
  rememberLocallyInterruptedAgentStreamBinding,
  rememberLocallyStartedAgentStreamBinding,
} from "./streamBindingRecords";

function target(sessionId: string, turnId: string) {
  return {
    eventName: `agentSession/event/${sessionId}`,
    sessionId,
    threadId: sessionId,
    turnId,
  };
}

describe("stream binding canonical scope", () => {
  it("消费后续回合的 Stop 标记不能误消费前一回合", () => {
    const previous = target("interrupted-scope", "previous-turn");
    rememberLocallyInterruptedAgentStreamBinding({
      ...previous,
      assistantMsgId: "previous-assistant",
    });

    expect(
      consumeLocallyInterruptedAgentStreamBinding(
        target(previous.sessionId, "next-turn"),
      ),
    ).toBe(false);
    expect(hasLocallyInterruptedAgentStreamBinding(previous)).toBe(true);
    expect(
      consumeLocallyInterruptedAgentStreamBinding(
        target("another-session", previous.turnId),
      ),
    ).toBe(false);
    expect(consumeLocallyInterruptedAgentStreamBinding(previous)).toBe(true);
    expect(consumeLocallyInterruptedAgentStreamBinding(previous)).toBe(false);
  });

  it.each([null, "pending-turn:optimistic"])(
    "没有 canonical Turn ID（%s）的本地状态不能阻断真实回合",
    (turnId) => {
      const sessionId = `unscoped-${turnId}`;
      const stream = {
        assistantMsgId: "unscoped-assistant",
        eventName: "agent_stream_unscoped",
        sessionId,
        turnId,
      };
      rememberLocallyStartedAgentStreamBinding(stream);
      rememberLocallyInterruptedAgentStreamBinding(stream);

      const canonical = target(sessionId, "canonical-turn");
      expect(hasLocallyStartedAgentStreamBinding(canonical)).toBe(false);
      expect(hasLocallyInterruptedAgentStreamBinding(canonical)).toBe(false);
      expect(consumeLocallyInterruptedAgentStreamBinding(canonical)).toBe(
        false,
      );
    },
  );
});
