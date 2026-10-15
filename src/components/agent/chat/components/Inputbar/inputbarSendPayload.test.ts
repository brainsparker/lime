import { describe, expect, it, vi } from "vitest";
import { runtimeReceipt } from "../../hooks/agentSendResult.testFixtures";
import { getInputbarSendOptions } from "./inputbarSendPayload";

describe("Inputbar runtime acceptance observer plumbing", () => {
  it("composes the early callback with the original observer and preserves its fields", () => {
    const onRuntimeAccepted = vi.fn();
    const original = vi.fn();
    const onComplete = vi.fn();
    const token = Object.freeze({ kind: "composer-submission" as const });
    const options = getInputbarSendOptions({
      onRuntimeAccepted,
      composerRestoreToken: token,
      sendOptions: {
        observer: { onRuntimeAccepted: original, onComplete },
        targetSessionId: "s1",
      },
    });
    const receipt = runtimeReceipt();
    options?.observer?.onRuntimeAccepted?.(receipt);
    options?.observer?.onRuntimeAccepted?.(receipt);
    expect(onRuntimeAccepted).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(original).toHaveBeenCalledExactlyOnceWith(receipt);
    expect(options?.observer?.onComplete).toBe(onComplete);
    expect(options?.composerRestoreToken).toBe(token);
    expect(options?.targetSessionId).toBe("s1");
  });

  it("keeps the original callback when the new callback fails", () => {
    const original = vi.fn();
    const options = getInputbarSendOptions({
      onRuntimeAccepted: () => {
        throw new Error("ui callback");
      },
      sendOptions: { observer: { onRuntimeAccepted: original } },
    });
    expect(() =>
      options?.observer?.onRuntimeAccepted?.(runtimeReceipt()),
    ).not.toThrow();
    expect(original).toHaveBeenCalledOnce();
  });

  it("keeps the existing options object for payloads without new composer metadata", () => {
    const options = { targetSessionId: "s1" };
    expect(getInputbarSendOptions({ sendOptions: options })).toBe(options);
  });
});
