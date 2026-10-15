import { describe, expect, it, vi } from "vitest";
import type { QueuedSubmission } from "@limecloud/app-server-client";
import { submitWorkspaceQueue } from "./workspaceQueueSubmission";
const context = {
  sessionId: "session-queue",
  threadId: "thread-queue",
  clientUserMessageId: "client-queue",
};
const input = [{ type: "text" as const, text: "queued body" }];
const response: QueuedSubmission = {
  id: "queued-real",
  clientUserMessageId: "client-queue",
  input,
};
describe("confirmed queue response", () => {
  it("keeps raw queued submission and captured identity separate from start/steer", async () => {
    const observer = vi.fn();
    const addQueue = vi.fn(async () => response);
    const result = await submitWorkspaceQueue({
      ...context,
      input,
      addQueue,
      observer: { onRuntimeAccepted: observer },
    });
    expect(result).toMatchObject({
      kind: "queue-accepted",
      receipt: {
        ...context,
        queuedSubmissionId: "queued-real",
        submission: response,
      },
    });
    expect(addQueue).toHaveBeenCalledWith({
      threadId: "thread-queue",
      clientUserMessageId: "client-queue",
      input,
    });
    expect(observer).toHaveBeenCalledOnce();
    if (result.kind !== "queue-accepted") throw new Error("unexpected result");
    expect(result.receipt.submission).toBe(response);
  });
  it.each([
    undefined,
    true,
    {},
    { id: "queued-real", clientUserMessageId: "other", input },
  ])("does not accept incomplete/mismatched response %j", async (value) => {
    const observer = vi.fn();
    const addQueue = vi.fn().mockResolvedValue(value);
    expect(
      await submitWorkspaceQueue({
        ...context,
        input,
        addQueue,
        observer: { onRuntimeAccepted: observer },
      }),
    ).toEqual({ kind: "unknown" });
    expect(observer).not.toHaveBeenCalled();
  });
  it("keeps original rejection and unknown captured session without inventing identity", async () => {
    const error = new Error("queue persistence failed");
    const addQueue = vi.fn(async () => {
      throw error;
    });
    expect(await submitWorkspaceQueue({ ...context, input, addQueue })).toEqual(
      { kind: "rejected", error },
    );
    addQueue.mockImplementation(async () => response as never);
    expect(
      await submitWorkspaceQueue({
        ...context,
        sessionId: null,
        input,
        addQueue,
      }),
    ).toEqual({ kind: "unknown" });
  });
});

describe("queue request context capture", () => {
  it("late response retains request session and thread after caller navigates", async () => {
    let resolve!: (response: QueuedSubmission) => void;
    const request = {
      ...context,
      input,
      addQueue: vi.fn(
        () =>
          new Promise<QueuedSubmission>((done) => {
            resolve = done;
          }),
      ),
    };
    const pending = submitWorkspaceQueue(request);
    request.sessionId = "new-session";
    request.threadId = "new-thread";
    request.clientUserMessageId = "new-message";
    resolve(response);
    expect(await pending).toMatchObject({
      kind: "queue-accepted",
      receipt: { ...context, queuedSubmissionId: response.id },
    });
  });
});
