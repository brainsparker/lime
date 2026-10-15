import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import {
  canRestoreComposerSubmission,
  createComposerSubmissionSettlement,
  type ComposerSubmissionRestoreToken,
} from "../components/composerSubmissionSettlement";
import { prepareAgentStreamUserInputSend } from "./agentStreamUserInputSendPreparation";
import { submitAgentStreamUserInput } from "./agentStreamUserInputSubmission";
import { stopActiveAgentStream } from "./agentStreamFlowControl";
import { createRestoreTokenFixture } from "./agentStreamRestoreToken.testFixtures";
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
afterEach(() => {
  activityLogger.clear();
  clearAllAgentStreamTextOverlays();
  vi.restoreAllMocks();
});

function token(): ComposerSubmissionRestoreToken {
  return Object.freeze({ kind: "composer-submission" });
}

describe("in-process composer restore token", () => {
  it("retains the actual capability through preparation, submission, stop and the restore guard", async () => {
    const f = createRestoreTokenFixture();
    const controller = new ComposerController({ text: "A😀 原始输入" });
    const scope = { projectId: "workspace-1", sessionId: "session-1" };
    const settlement = createComposerSubmissionSettlement({
      controller,
      target: "start",
      scope,
      canApplyUi: () => true,
      onCommitted: vi.fn(),
    });
    const receipt = settlement.receipt!;
    const prepared = prepareAgentStreamUserInputSend({
      content: receipt.submission.text,
      images: [],
      skipUserMessage: false,
      options: {
        composerDraft: receipt.draft,
        composerSubmission: receipt.submission,
        composerRestoreToken: settlement.composerRestoreToken,
        observer: { onRuntimeAccepted: settlement.onRuntimeAccepted },
      },
      env: f.env,
    });
    expect(prepared.composerRestoreToken).toBe(settlement.composerRestoreToken);
    expect(prepared.submittedDraft).not.toBe(receipt.draft);
    await submitAgentStreamUserInput({ preparedSend: prepared, env: f.env });
    expect(f.state.active?.composerRestoreToken).toBe(
      settlement.composerRestoreToken,
    );
    expect(controller.getSnapshot().document.text).toBe("");
    await stopActiveAgentStream(f.stopOptions());
    const request = f.onRestoreInterruptedInput.mock.calls[0][0];
    expect(request.composerRestoreToken).toBe(settlement.composerRestoreToken);
    expect(request.draft.text).toBe("A😀 原始输入");
    expect(
      canRestoreComposerSubmission({
        controller,
        token: request.composerRestoreToken,
        scope,
      }),
    ).toBe(true);
    expect(
      canRestoreComposerSubmission({
        controller,
        token: structuredClone(request.composerRestoreToken),
        scope,
      }),
    ).toBe(false);
    controller.setText("后续编辑");
    expect(
      canRestoreComposerSubmission({
        controller,
        token: request.composerRestoreToken,
        scope,
      }),
    ).toBe(false);
    for (const projection of [
      prepared.requestMetadata,
      prepared.userMsg,
      prepared.assistantMsg,
      ...f.runtime.submitOp.mock.calls,
      ...f.runtime.interruptTurn.mock.calls,
    ]) {
      expect(JSON.stringify(projection)).not.toContain("composerRestoreToken");
      expect(JSON.stringify(projection)).not.toContain("composer-submission");
    }
  });

  it.each(["composer", "legacy"] as const)(
    "retains the token separately from cloned %s draft data",
    async (mode) => {
      const f = createRestoreTokenFixture();
      const original = token();
      const draft = new ComposerController({ text: "原输入" }).captureDraft();
      const prepared = prepareAgentStreamUserInputSend({
        content: draft.text,
        images: [],
        skipUserMessage: false,
        options: {
          composerRestoreToken: original,
          ...(mode === "composer"
            ? { composerDraft: draft }
            : { inputRestoreDraft: { text: draft.text } }),
        },
        env: f.env,
      });
      expect(prepared.composerRestoreToken).toBe(original);
      expect(prepared.submittedDraft).not.toHaveProperty(
        "composerRestoreToken",
      );
      await submitAgentStreamUserInput({ preparedSend: prepared, env: f.env });
      expect(f.state.active?.composerRestoreToken).toBe(original);
      await stopActiveAgentStream(f.stopOptions());
      expect(
        f.onRestoreInterruptedInput.mock.calls[0][0].composerRestoreToken,
      ).toBe(original);
    },
  );

  it("uses the fallback token only when it uses the fallback draft", async () => {
    const f = createRestoreTokenFixture();
    const original = token();
    await stopActiveAgentStream({
      ...f.stopOptions(),
      submittedDraftFallback: { text: "备用输入" },
      composerRestoreTokenFallback: original,
    });
    expect(f.onRestoreInterruptedInput.mock.calls[0][0]).toMatchObject({
      draft: { text: "备用输入" },
    });
    expect(
      f.onRestoreInterruptedInput.mock.calls[0][0].composerRestoreToken,
    ).toBe(original);
  });

  it.each([false, true])(
    "does not borrow a fallback capability for an active draft (active token=%s)",
    async (hasActiveToken) => {
      const f = createRestoreTokenFixture();
      const active = token();
      const fallback = token();
      const options = f.stopOptions();
      await stopActiveAgentStream({
        ...options,
        activeStream: {
          assistantMsgId: "active-1",
          eventName: "stream-1",
          sessionId: "session-1",
          submittedDraft: { text: "活动输入" },
          ...(hasActiveToken ? { composerRestoreToken: active } : {}),
        },
        submittedDraftFallback: { text: "另一份输入" },
        composerRestoreTokenFallback: fallback,
      });
      const request = f.onRestoreInterruptedInput.mock.calls[0][0];
      expect(request.draft.text).toBe("活动输入");
      expect(request.composerRestoreToken).toBe(
        hasActiveToken ? active : undefined,
      );
      expect(request.composerRestoreToken).not.toBe(fallback);
    },
  );

  it("keeps legacy requests token-free and output suppression unchanged", async () => {
    const f = createRestoreTokenFixture();
    await stopActiveAgentStream({
      ...f.stopOptions(),
      submittedDraftFallback: { text: "原输入" },
    });
    expect(f.onRestoreInterruptedInput.mock.calls[0][0]).not.toHaveProperty(
      "composerRestoreToken",
    );
    f.onRestoreInterruptedInput.mockClear();
    f.state.messages = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "已有回答",
        timestamp: new Date(),
      },
    ];
    await stopActiveAgentStream({
      ...f.stopOptions(),
      activeStream: {
        assistantMsgId: "assistant-1",
        eventName: "stream-1",
        sessionId: "session-1",
        submittedDraft: { text: "原输入" },
        composerRestoreToken: token(),
      },
    });
    expect(f.onRestoreInterruptedInput).not.toHaveBeenCalled();
  });
});
