import React, { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function mountHome(
  options: {
    materialized?: boolean;
    materializeFails?: boolean;
    reject?: boolean;
  } = {},
) {
  let finish!: (accepted: boolean) => void;
  const backendAcceptance = new Promise<boolean>((resolve, reject) => {
    finish = options.reject ? () => reject(new Error("send failed")) : resolve;
  });
  const handleSend = vi.fn<WorkspaceHandleSend>(() => backendAcceptance);
  const setInput = vi.fn();
  const restoreInput = vi.fn();
  const commitMaterializedDraftTab = vi.fn();
  const materializeDraftTab = vi
    .fn()
    .mockResolvedValue(options.materializeFails ? null : "session-ready");
  let send!: InputbarSendHandler;

  function Harness() {
    const [request, setRequest] = useState<TaskCenterDraftSendRequest | null>(
      null,
    );
    const [, setPreview] = useState<TaskCenterDraftSendRequest | null>(null);
    const activeDraftTabIdRef = useRef(options.materialized ? "draft-1" : null);
    const materializedSessionIdsRef = useRef(new Map<string, string>());
    const prewarmedDraftSessionIdsRef = useRef(
      new Set(options.materialized ? ["draft-1"] : []),
    );
    const sendRef = useRef(handleSend);
    send = useTaskCenterEmptyStateSendRuntime({
      agentEntry: "new-task",
      input: "stale",
      setInput,
      activeDraftTabIdRef,
      activeSessionIdRef: { current: null },
      clearMessages: vi.fn(),
      displayMessagesLength: 0,
      turnsLength: 0,
      threadItemsLength: 0,
      hasDisplayMessages: false,
      handleSend,
      sessionId: null,
      taskCenterWorkspaceId: "workspace-1",
      setTaskCenterDraftTabs: vi.fn(),
      setTaskCenterDraftSendRequest: setRequest,
      taskCenterDraftSendRequest: request,
      setHomePendingPreviewRequest: setPreview,
      materializedSessionIdsRef,
      prewarmedDraftSessionIdsRef,
    });
    useTaskCenterDraftSendDispatchRuntime({
      taskCenterDraftSendRequest: request,
      setTaskCenterDraftSendRequest: setRequest,
      setHomePendingPreviewRequest: setPreview,
      messagesLength: 0,
      currentSessionId: null,
      materializedSessionIdsRef,
      prewarmedDraftSessionIdsRef,
      materializeDraftTab,
      commitMaterializedDraftTab,
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
  let completion!: Promise<boolean | void>;
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
        if (accepted && receipt.kind === "accepted") controller.commit(receipt);
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
    handleSend,
    setInput,
    restoreInput,
    commitMaterializedDraftTab,
    materializeDraftTab,
    completion: () => completion,
  };
}

describe("structured home send acceptance", () => {
  it.each([false, true])(
    "keeps the original folded draft until a %s materialized send is accepted",
    async (materialized) => {
      const runtime = mountHome({ materialized });
      await runtime.submit();
      expect(runtime.handleSend).toHaveBeenCalledOnce();
      expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
      expect(runtime.setInput).not.toHaveBeenCalled();
      expect(runtime.handleSend.mock.calls[0][6]).toMatchObject({
        composerDraft: runtime.receipt.draft,
        composerSubmission: runtime.receipt.submission,
      });
      if (materialized)
        expect(runtime.commitMaterializedDraftTab).toHaveBeenCalledWith(
          "draft-1",
          "session-ready",
          expect.objectContaining({ preserveInput: true }),
        );
      let settled = false;
      void runtime.completion().then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      await act(async () => {
        runtime.finish(false);
        await runtime.completion();
      });
      expect(await runtime.completion()).toBe(false);
      expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
      expect(runtime.restoreInput).not.toHaveBeenCalled();
      expect(runtime.setInput).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "a %s materialized send commits only after true acceptance",
    async (materialized) => {
      const runtime = mountHome({ materialized });
      await runtime.submit();
      await act(async () => {
        runtime.finish(true);
        await runtime.completion();
      });
      expect(await runtime.completion()).toBe(true);
      expect(runtime.controller.getDocument().text).toBe("");
    },
  );

  it("late success does not clear a newer draft", async () => {
    const runtime = mountHome();
    await runtime.submit();
    runtime.controller.setText("新的草稿😀");
    await act(async () => {
      runtime.finish(true);
      await runtime.completion();
    });
    expect(runtime.controller.getDocument().text).toBe("新的草稿😀");
    expect(runtime.setInput).not.toHaveBeenCalled();
  });

  it("materialization failure settles false and preserves the original document", async () => {
    const runtime = mountHome({ materialized: true, materializeFails: true });
    await runtime.submit();
    expect(await runtime.completion()).toBe(false);
    expect(runtime.handleSend).not.toHaveBeenCalled();
    expect(runtime.controller.captureDraft()).toEqual(runtime.receipt.draft);
    expect(runtime.restoreInput).not.toHaveBeenCalled();
  });

  it("send rejection does not overwrite a newer structured draft", async () => {
    const runtime = mountHome({ materialized: true, reject: true });
    await runtime.submit();
    runtime.controller.setText("新编辑");
    await act(async () => {
      runtime.finish(false);
      await runtime.completion();
    });
    expect(await runtime.completion()).toBe(false);
    expect(runtime.controller.getDocument().text).toBe("新编辑");
    expect(runtime.restoreInput).not.toHaveBeenCalled();
  });
});
