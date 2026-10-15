import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComposerSubmissionRestoreToken } from "../components/composerSubmissionSettlement";
import { createRestoreTokenFixture } from "./agentStreamRestoreToken.testFixtures";
import { useAgentStream } from "./useAgentStream";
import { activityLogger } from "@/lib/workspace/workbenchRuntime";
import { clearAllAgentStreamTextOverlays } from "./agentStreamTextOverlayStore";

vi.mock("@/lib/api/permissionProfiles", () => ({
  resolveAllowedPermissionProfile: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/lib/api/modelRegistry", () => ({
  modelRegistryApi: {
    getModelRegistry: vi.fn().mockResolvedValue({ models: [] }),
  },
}));
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  activityLogger.clear();
  clearAllAgentStreamTextOverlays();
  vi.restoreAllMocks();
});

function mountHook() {
  const f = createRestoreTokenFixture();
  const options = {
    ...f.env,
    waitForSessionProviderSelectionSync:
      f.env.waitForSessionProviderSelectionSync!,
    setTodoItems: f.env.setTodoItems!,
    currentAssistantMsgIdRef: { current: null },
    currentStreamingSessionIdRef: { current: null },
    currentStreamingEventNameRef: { current: null },
    getMessages: () => f.state.messages,
    executionRuntime: null,
    threadBusy: false,
    threadTurns: [],
    onRestoreInterruptedInput: f.onRestoreInterruptedInput,
  };
  let current: ReturnType<typeof useAgentStream> | undefined;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness() {
    current = useAgentStream(options);
    return null;
  }
  act(() => root.render(<Harness />));
  return {
    ...f,
    getHook: () => current!,
    unmount: () => {
      act(() => {
        current?.detachStreamBindings();
        root.unmount();
      });
      container.remove();
    },
  };
}
function token(): ComposerSubmissionRestoreToken {
  return Object.freeze({ kind: "composer-submission" });
}

describe("useAgentStream restore capability lifetime", () => {
  it.each([false, true])(
    "preserves token identity with active stream detached=%s",
    async (detached) => {
      const h = mountHook();
      const original = token();
      try {
        await act(async () => {
          await h
            .getHook()
            .sendMessage(
              "原输入",
              [],
              false,
              false,
              false,
              undefined,
              undefined,
              undefined,
              { composerRestoreToken: original },
            );
        });
        if (detached) act(() => h.getHook().detachStreamBindings());
        await act(async () => {
          await h.getHook().stopSending();
        });
        const request = h.onRestoreInterruptedInput.mock.calls[0][0];
        expect(request.composerRestoreToken).toBe(original);
        expect(request.draft.text).toBe("原输入");
        expect(request.draft).not.toHaveProperty("composerRestoreToken");
        const count = h.onRestoreInterruptedInput.mock.calls.length;
        await act(async () => {
          await h.getHook().stopSending();
        });
        expect(h.onRestoreInterruptedInput).toHaveBeenCalledTimes(count);
      } finally {
        h.unmount();
      }
    },
  );

  it("replaces the fallback token with the next send and clears it for a token-free send", async () => {
    const h = mountHook();
    const first = token();
    const second = token();
    try {
      for (const [text, restoreToken] of [
        ["first", first],
        ["second", second],
        ["legacy", undefined],
      ] as const) {
        await act(async () => {
          await h
            .getHook()
            .sendMessage(
              text,
              [],
              false,
              false,
              false,
              undefined,
              undefined,
              undefined,
              { composerRestoreToken: restoreToken },
            );
        });
        act(() => h.getHook().detachStreamBindings());
        await act(async () => {
          await h.getHook().stopSending();
        });
        const request = h.onRestoreInterruptedInput.mock.calls.at(-1)![0];
        expect(request.draft.text).toBe(text);
        expect(request.composerRestoreToken).toBe(restoreToken);
      }
      expect(h.onRestoreInterruptedInput).toHaveBeenCalledTimes(3);
    } finally {
      h.unmount();
    }
  });
});
