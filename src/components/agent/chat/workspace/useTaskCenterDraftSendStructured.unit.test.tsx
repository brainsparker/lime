import {
  acceptedSubmission,
  runtimeReceipt,
} from "../hooks/agentSendResult.testFixtures";
import {
  isRuntimeSubmissionAccepted,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";
import React, { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordAgentUiPerformanceMetric } from "@/lib/agentUiPerformanceMetrics";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { InputbarSendHandler } from "../components/Inputbar/inputbarSendPayload";
import type { TaskCenterDraftSendRequest } from "../homePendingPreview";
import type { WorkspaceHandleSend } from "./useWorkspaceSendActions";
import {
  useTaskCenterEmptyStateSendRuntime,
  useTaskCenterDraftSendDispatchRuntime,
} from "./useTaskCenterDraftSendRuntime";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./agentChatWorkspaceHelpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./agentChatWorkspaceHelpers")>()),
  scheduleAfterCommit: (callback: () => void) => queueMicrotask(callback),
  scheduleAfterNextPaint: (callback: () => void) => queueMicrotask(callback),
}));

vi.mock("@/lib/agentUiPerformanceMetrics", () => ({
  recordAgentUiPerformanceMetric: vi.fn(),
}));

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function mountHome(
  options: {
    reject?: boolean;
    existingContent?: boolean;
  } = {},
) {
  let finish!: (result: RuntimeSubmissionResult) => void;
  let fail!: (error: Error) => void;
  const activeSessionIdRef = { current: null as string | null };
  const onSessionAccepted = vi.fn();
  const backendAcceptance = new Promise<RuntimeSubmissionResult>(
    (resolve, reject) => {
      fail = reject;
      finish = options.reject
        ? () => reject(new Error("send failed"))
        : resolve;
    },
  );
  const handleSend = vi.fn<WorkspaceHandleSend>(() => backendAcceptance);
  const setInput = vi.fn();
  const restoreInput = vi.fn();
  let send!: InputbarSendHandler;

  function Harness() {
    const [request, setRequest] = useState<TaskCenterDraftSendRequest | null>(
      null,
    );
    const [, setPreview] = useState<TaskCenterDraftSendRequest | null>(null);
    const sendRef = useRef(handleSend);
    send = useTaskCenterEmptyStateSendRuntime({
      agentEntry: "new-task",
      input: "stale",
      setInput,
      activeSessionIdRef,
      clearMessages: vi.fn(),
      displayMessagesLength: 0,
      turnsLength: 0,
      threadItemsLength: 0,
      hasDisplayMessages: options.existingContent ?? false,
      handleSend,
      sessionId: null,
      taskCenterWorkspaceId: "workspace-1",
      setTaskCenterDraftSendRequest: setRequest,
      taskCenterDraftSendRequest: request,
      setHomePendingPreviewRequest: setPreview,
      onSessionAccepted,
    });
    useTaskCenterDraftSendDispatchRuntime({
      taskCenterDraftSendRequest: request,
      setTaskCenterDraftSendRequest: setRequest,
      setHomePendingPreviewRequest: setPreview,
      messagesLength: 0,
      currentSessionId: null,
      restoreInput,
      sendRef,
      workspaceId: "workspace-1",
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(<Harness />));
  const controller = new ComposerController({ text: "A😀 " });
  controller.setSelection(4);
  controller.ingestPaste("完整粘贴".repeat(300));
  controller.setSelection(1, 3);
  const receipt = controller.submit("start");
  let completion!: Promise<RuntimeSubmissionResult>;
  async function submit() {
    await act(async () => {
      completion = Promise.resolve(
        send({
          textOverride: receipt.submission.text,
          composerDraft: receipt.draft,
          composerSubmission: receipt.submission,
          composerIntent: receipt.intent,
          composerTarget: receipt.target,
        }),
      ).then((accepted) => {
        if (
          isRuntimeSubmissionAccepted(accepted) &&
          receipt.kind === "accepted"
        )
          controller.commit(receipt);
        return accepted;
      });
      await Promise.resolve();
    });
  }
  return {
    controller,
    receipt,
    submit,
    finish,
    fail,
    activeSessionIdRef,
    onSessionAccepted,
    accept(kind: "start" | "steer" = "start", sessionId = "session-ready") {
      handleSend.mock.calls[0][6]?.observer?.onRuntimeAccepted?.({
        ...runtimeReceipt(sessionId),
        kind,
      });
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
      mounted.splice(
        mounted.findIndex((entry) => entry.root === root),
        1,
      );
    },
    handleSend,
    setInput,
    restoreInput,
    completion: () => completion,
  };
}

describe("structured home send acceptance", () => {
  it("keeps the original folded draft until a send is accepted", async () => {
    const runtime = mountHome();
    await runtime.submit();
    expect(runtime.handleSend).toHaveBeenCalledOnce();
    expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
    expect(runtime.setInput).not.toHaveBeenCalled();
    expect(runtime.handleSend.mock.calls[0][6]).toMatchObject({
      composerDraft: runtime.receipt.draft,
      composerSubmission: runtime.receipt.submission,
    });
    let settled = false;
    void runtime.completion().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await act(async () => {
      runtime.finish({ kind: "rejected" });
      await runtime.completion();
    });
    expect(await runtime.completion()).toMatchObject({ kind: "rejected" });
    expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
    expect(runtime.restoreInput).not.toHaveBeenCalled();
    expect(runtime.setInput).not.toHaveBeenCalled();
  });

  it("a send commits only after true acceptance", async () => {
    const runtime = mountHome();
    await runtime.submit();
    await act(async () => {
      runtime.finish(acceptedSubmission("session-ready"));
      await runtime.completion();
    });
    expect(await runtime.completion()).toMatchObject({
      kind: "runtime-accepted",
    });
    expect(runtime.controller.getDocument().text).toBe("");
  });

  it("late success does not clear a newer draft", async () => {
    const runtime = mountHome();
    await runtime.submit();
    runtime.controller.setText("新的草稿😀");
    await act(async () => {
      runtime.finish(acceptedSubmission("session-ready"));
      await runtime.completion();
    });
    expect(runtime.controller.getDocument().text).toBe("新的草稿😀");
    expect(runtime.setInput).not.toHaveBeenCalled();
  });

  it("send rejection does not overwrite a newer structured draft", async () => {
    const runtime = mountHome({ reject: true });
    await runtime.submit();
    runtime.controller.setText("新编辑");
    await act(async () => {
      runtime.finish({ kind: "rejected" });
      await runtime.completion();
    });
    expect(await runtime.completion()).toMatchObject({ kind: "rejected" });
    expect(runtime.controller.getDocument().text).toBe("新编辑");
    expect(runtime.restoreInput).not.toHaveBeenCalled();
  });

  it("actual hook unmount keeps an in-flight acceptance", async () => {
    const runtime = mountHome();
    await runtime.submit();
    runtime.unmount();
    runtime.accept();
    expect(await runtime.completion()).toMatchObject({
      kind: "runtime-accepted",
      receipt: { sessionId: "session-ready" },
    });
    runtime.fail(new Error("late refresh failure"));
    await Promise.resolve();
    expect(runtime.controller.getDocument().text).toBe("");
  });

  it("direct fallback preserves early acceptance after a late rejection", async () => {
    const runtime = mountHome({ existingContent: true });
    await runtime.submit();
    await act(async () => {
      runtime.accept("steer", "fallback-session");
      runtime.fail(new Error("refresh failed"));
      await runtime.completion();
    });
    expect(await runtime.completion()).toMatchObject({
      kind: "runtime-accepted",
      receipt: { sessionId: "fallback-session", kind: "steer" },
    });
  });

  it.each(["start", "steer"] as const)(
    "actual home %s acceptance survives a later refresh rejection",
    async (kind) => {
      const runtime = mountHome();
      await runtime.submit();
      await act(async () => {
        runtime.accept(kind);
        await runtime.completion();
        runtime.fail(new Error("refresh"));
        await Promise.resolve();
      });
      expect(await runtime.completion()).toMatchObject({
        kind: "runtime-accepted",
        receipt: { kind },
      });
      expect(runtime.controller.getDocument().text).toBe("");
    },
  );

  it("late first send promotes receipt session from stable Home", async () => {
    const runtime = mountHome();
    await runtime.submit();
    runtime.activeSessionIdRef.current = "unrelated-new-active";
    await act(async () => {
      runtime.finish(acceptedSubmission("captured-request-session"));
      await runtime.completion();
      await Promise.resolve();
    });
    expect(runtime.onSessionAccepted).toHaveBeenCalledWith(
      "captured-request-session",
      expect.objectContaining({
        acceptedResult: expect.objectContaining({
          receipt: expect.objectContaining({
            sessionId: "captured-request-session",
          }),
        }),
      }),
    );
  });

  it.each([{ kind: "unknown" as const }, { kind: "local-handled" as const }])(
    "nonaccepted %j keeps complete home document",
    async (result) => {
      const runtime = mountHome();
      await runtime.submit();
      await act(async () => {
        runtime.finish(result);
        await runtime.completion();
      });
      expect(await runtime.completion()).toEqual(result);
      expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
      expect(runtime.onSessionAccepted).not.toHaveBeenCalled();
    },
  );

  it("postaccepted metric failure cannot suppress receipt promotion or change completion", async () => {
    const runtime = mountHome();
    await runtime.submit();
    const actualMetrics = await vi.importActual<
      typeof import("@/lib/agentUiPerformanceMetrics")
    >("@/lib/agentUiPerformanceMetrics");
    vi.mocked(recordAgentUiPerformanceMetric).mockImplementation(
      (name, context) => {
        if (name === "homeInput.sendDispatch.done")
          throw new Error("PRIVATE METRIC BODY");
        return actualMetrics.recordAgentUiPerformanceMetric(name, context);
      },
    );
    await act(async () => {
      runtime.finish(acceptedSubmission("metric-session"));
      await runtime.completion();
      await Promise.resolve();
    });
    expect(runtime.onSessionAccepted).toHaveBeenCalledWith(
      "metric-session",
      expect.objectContaining({
        acceptedResult: expect.objectContaining({ kind: "runtime-accepted" }),
      }),
    );
    expect(await runtime.completion()).toMatchObject({
      kind: "runtime-accepted",
    });
    vi.mocked(recordAgentUiPerformanceMetric).mockReset();
  });
});
