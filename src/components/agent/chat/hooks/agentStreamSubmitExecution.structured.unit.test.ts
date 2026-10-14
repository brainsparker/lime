import { describe, expect, it, vi } from "vitest";
import type { ComposerSubmission } from "@/components/input-kit/types";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import { executeAgentStreamSubmit } from "./agentStreamSubmitExecution";

vi.mock("@/lib/api/modelRegistry", () => ({
  modelRegistryApi: {
    getModelRegistry: vi.fn().mockResolvedValue({ models: [] }),
  },
}));
vi.mock("@/lib/api/permissionProfiles", () => ({
  resolveAllowedPermissionProfile: vi
    .fn()
    .mockResolvedValue({ id: "current", allowed: true }),
}));

const submission: ComposerSubmission = {
  text: "A😀@x",
  textElements: [{ byteRange: { start: 5, end: 7 }, placeholder: "@x" }],
  inputMentions: [{ type: "skill", name: "x", path: "/skills/x" }],
  attachments: [],
  pathReferences: [
    { id: "path-1", path: "/tmp/report.md", name: "report.md", isDir: false },
    { id: "path-2", path: "/tmp/report.md", name: "report.md", isDir: false },
  ],
};

function createOptions(activeTurnId: string | null) {
  const submitOp = vi.fn().mockResolvedValue(undefined);
  const steerTurn = vi.fn().mockResolvedValue({ turnId: activeTurnId });
  const options: Parameters<typeof executeAgentStreamSubmit>[0] = {
    runtime: {
      getThreadTurnControl: vi.fn().mockResolvedValue({
        activeTurnId,
        queuedTurnIds: [],
        threadId: "thread-1",
        updatedAtMs: 0,
      }),
      listenToTurnEvents: vi.fn().mockResolvedValue(vi.fn()),
      submitOp,
      steerTurn,
    } as unknown as AgentRuntimeAdapter,
    ensureSession: vi.fn().mockResolvedValue("session-1"),
    attemptSilentTurnRecovery: vi.fn().mockResolvedValue(false),
    refreshSessionReadModel: vi.fn().mockResolvedValue(true),
    sessionIdRef: { current: "session-1" },
    getWorkspaceIdForSubmit: () => "workspace-1",
    getThreadIdForSubmit: () => "thread-1",
    getSyncedSessionExecutionStrategy: () => "react",
    effectiveAccessMode: "current",
    content: submission.text,
    images: [],
    composerSubmission: submission,
    skipUserMessage: false,
    effectiveProviderType: "openai",
    effectiveModel: "fixture",
    effectiveExecutionStrategy: "react",
    eventName: "event-1",
    clientUserMessageId: "client-1",
    assistantMsgId: "assistant-1",
    pendingTurnKey: "pending-turn-1",
    pendingItemKey: "pending-item-1",
    warnedKeysRef: { current: new Set() },
    actionLoggedKeys: new Set(),
    toolLogIdByToolId: new Map(),
    toolStartedAtByToolId: new Map(),
    toolNameByToolId: new Map(),
    requestState: {
      accumulatedContent: "",
      requestLogId: null,
      requestStartedAt: 0,
      requestFinished: false,
    },
    callbacks: {
      activateStream: vi.fn(),
      isStreamActivated: () => false,
      clearOptimisticItem: vi.fn(),
      clearOptimisticTurn: vi.fn(),
      disposeListener: vi.fn(),
      clearActiveStreamIfMatch: () => false,
      registerListener: vi.fn(),
    },
    appendThinkingToParts: (parts) => parts,
    setMessages: vi.fn(),
    setIsSending: vi.fn(),
    setPendingActions: vi.fn(),
    setThreadItems: vi.fn(),
    setThreadTurns: vi.fn(),
    setCurrentTurnId: vi.fn(),
    setExecutionRuntime: vi.fn(),
  };
  return { options, submitOp, steerTurn };
}

describe("structured Composer start and steer dispatch", () => {
  it.each([null, "turn-active"])(
    "uses the same typed submission when active turn is %s",
    async (activeTurnId) => {
      const { options, submitOp, steerTurn } = createOptions(activeTurnId);
      await executeAgentStreamSubmit(options);
      const input = [
        {
          type: "text",
          text: submission.text,
          text_elements: submission.textElements,
        },
        ...submission.inputMentions,
        { type: "mention", name: "report.md", path: "/tmp/report.md" },
      ];
      if (activeTurnId) {
        expect(steerTurn).toHaveBeenCalledWith({
          threadId: "thread-1",
          expectedTurnId: activeTurnId,
          clientUserMessageId: "client-1",
          input,
        });
        expect(submitOp).not.toHaveBeenCalled();
      } else {
        expect(submitOp.mock.calls[0][0].turn).toMatchObject({
          threadId: "thread-1",
          clientUserMessageId: "client-1",
          input,
        });
        expect(steerTurn).not.toHaveBeenCalled();
      }
    },
  );

  it("rejects an unprovable rewrite before turn/steer and optimistic removal", async () => {
    const { options, steerTurn, submitOp } = createOptions("turn-active");
    options.content = "/rewritten command";
    await expect(executeAgentStreamSubmit(options)).rejects.toThrow(
      "Cannot map",
    );
    expect(steerTurn).not.toHaveBeenCalled();
    expect(submitOp).not.toHaveBeenCalled();
    expect(options.callbacks.clearOptimisticItem).not.toHaveBeenCalled();
  });
});
