import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeSubmissionCapture,
  fromQueueAcceptanceResponse,
  fromRuntimeAcceptanceReceipt,
  normalizeRuntimeSubmissionResult,
} from "./agentSendResult";
const receipt = {
  kind: "start" as const,
  sessionId: "request-session",
  threadId: "canonical-thread",
  turnId: "real-turn",
};
describe("typed submission results", () => {
  it.each([
    undefined,
    true,
    false,
    {},
    { kind: "dispatched" },
    { kind: "accepted" },
    { kind: "runtime-accepted", receipt: {} },
  ])("does not accept ambiguous value %j", (value) => {
    expect(normalizeRuntimeSubmissionResult(value)).toEqual({
      kind: "unknown",
    });
  });
  it("keeps request identities and immutable start receipt", () => {
    const result = fromRuntimeAcceptanceReceipt(receipt);
    expect(result).toEqual({ kind: "runtime-accepted", receipt });
    if (result.kind !== "runtime-accepted")
      throw new Error("unexpected result");
    expect(Object.isFrozen(result.receipt)).toBe(true);
  });
  it("preserves all existing observer handlers and settles once before final processing", () => {
    const onTextDelta = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onRuntimeAccepted = vi.fn(() => {
      throw new Error("PRIVATE BODY");
    });
    const capture = createRuntimeSubmissionCapture({
      onTextDelta,
      onComplete,
      onError,
      onRuntimeAccepted,
    });
    expect(capture.observer).toMatchObject({
      onTextDelta,
      onComplete,
      onError,
    });
    capture.observer.onRuntimeAccepted(receipt);
    expect(capture.finish({ kind: "unknown" })).toEqual({
      kind: "runtime-accepted",
      receipt,
    });
    capture.observer.onRuntimeAccepted(receipt);
    expect(onRuntimeAccepted).toHaveBeenCalledTimes(1);
    expect(capture.reject(new Error("refresh failed"))).toEqual({
      kind: "runtime-accepted",
      receipt,
    });
  });
  it("rethrows the exact request rejection when no response accepted", () => {
    const capture = createRuntimeSubmissionCapture();
    const error = new Error("request rejected");
    expect(() => capture.rethrow(error)).toThrow(error);
    expect(capture.reject(error)).toEqual({ kind: "rejected", error });
  });
  it("keeps real queue response distinct from start/steer and verifies request message identity", () => {
    const context = {
      sessionId: "queue-session",
      threadId: "queue-thread",
      clientUserMessageId: "client-1",
    };
    const submission = {
      id: "queued-1",
      clientUserMessageId: "client-1",
      input: [{ type: "text" as const, text: "queued body" }],
    };
    const result = fromQueueAcceptanceResponse(context, submission);
    expect(result).toMatchObject({
      kind: "queue-accepted",
      receipt: { kind: "queue", queuedSubmissionId: "queued-1", ...context },
    });
    if (result.kind !== "queue-accepted") throw new Error("unexpected result");
    expect(result.receipt.submission).toBe(submission);
    expect(result.receipt).not.toHaveProperty("turnId");
    expect(result.receipt).not.toHaveProperty("itemId");
    expect(
      fromQueueAcceptanceResponse(
        { ...context, clientUserMessageId: "other" },
        submission,
      ),
    ).toEqual({ kind: "unknown" });
    expect(
      fromQueueAcceptanceResponse({ ...context, sessionId: null }, submission),
    ).toEqual({ kind: "unknown" });
  });
});

describe("receipt identity consistency", () => {
  it("keeps first genuine acceptance when a duplicate reports another turn", () => {
    const accepted = vi.fn();
    const capture = createRuntimeSubmissionCapture({
      onRuntimeAccepted: accepted,
    });
    capture.observer.onRuntimeAccepted(receipt);
    capture.observer.onRuntimeAccepted({
      ...receipt,
      sessionId: "other-session",
      turnId: "other-turn",
    });
    expect(
      capture.finish({
        kind: "runtime-accepted",
        receipt: { ...receipt, turnId: "other-turn" },
      }),
    ).toEqual({ kind: "runtime-accepted", receipt });
    expect(accepted).toHaveBeenCalledOnce();
  });
});
