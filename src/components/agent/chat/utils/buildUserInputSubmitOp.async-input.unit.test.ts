import { describe, expect, it } from "vitest";
import { createAgentSessionTurnStartParamsFromUserInputOp } from "@/lib/api/agentProtocol";
import { buildUserInputSubmitOp } from "./buildUserInputSubmitOp";

describe("async answer permission inheritance", () => {
  it.each([true, false])(
    "turn/start shouldSendPermissionOverrides=%s reaches the wire",
    (shouldSendPermissionOverrides) => {
      const op = buildUserInputSubmitOp({
        threadId: "thread",
        content: "reply",
        images: [],
        eventName: "event",
        effectiveAccessMode: "full-access",
        effectiveProviderType: "openai",
        effectiveModel: "model",
        shouldSendPermissionOverrides,
      });
      const params = createAgentSessionTurnStartParamsFromUserInputOp(op);
      if (shouldSendPermissionOverrides) {
        expect(params).toMatchObject({
          approvalPolicy: "never",
          permissions: ":danger-full-access",
        });
      } else {
        expect(params).not.toHaveProperty("approvalPolicy");
        expect(params).not.toHaveProperty("permissions");
        expect(params).not.toHaveProperty("sandboxPolicy");
      }
      expect(params.threadId).toBe("thread");
      expect(params.input).toEqual([{ type: "text", text: "reply" }]);
    },
  );
});
