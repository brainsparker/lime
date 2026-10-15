import { describe, expect, it, vi } from "vitest";
import { createTaskCenterSubmissionSettlement } from "./taskCenterSubmissionSettlement";
const receipt = {
  kind: "start" as const,
  sessionId: "request-session",
  threadId: "request-thread",
  turnId: "request-turn",
};
describe("TaskCenter request-scoped settlement", () => {
  it("in-flight observer survives preview disposal and settles before backend wrapper completes", async () => {
    const accepted = vi.fn();
    const settlement = createTaskCenterSubmissionSettlement({
      onRuntimeAccepted: accepted,
    });
    const sendOptions = { observer: settlement.observer };
    let activeSession = "request-session";
    const requestSession = activeSession;
    activeSession = "unrelated-late-session";
    sendOptions.observer.onRuntimeAccepted(receipt);
    expect(await settlement.completion).toMatchObject({
      kind: "runtime-accepted",
      receipt: { sessionId: requestSession },
    });
    expect(activeSession).toBe("unrelated-late-session");
    expect(accepted).toHaveBeenCalledOnce();
    expect(settlement.reject(new Error("steer refresh failed"))).toEqual({
      kind: "runtime-accepted",
      receipt,
    });
  });
  it("settles only once despite duplicate final result and throwing existing observer", async () => {
    const observer = vi.fn(() => {
      throw new Error("observer failed");
    });
    const callback = vi.fn();
    const settlement = createTaskCenterSubmissionSettlement(
      { onRuntimeAccepted: observer },
      callback,
    );
    settlement.observer.onRuntimeAccepted(receipt);
    settlement.settle({ kind: "runtime-accepted", receipt });
    expect(await settlement.completion).toEqual({
      kind: "runtime-accepted",
      receipt,
    });
    expect(observer).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
  });
  it("undispatched cancellation and genuine rejection remain nonaccepted", async () => {
    const canceled = createTaskCenterSubmissionSettlement();
    canceled.settle({ kind: "rejected" });
    expect(await canceled.completion).toEqual({ kind: "rejected" });
    const failed = createTaskCenterSubmissionSettlement();
    const error = new Error("request rejected");
    failed.reject(error);
    expect(await failed.completion).toEqual({ kind: "rejected", error });
  });
});
