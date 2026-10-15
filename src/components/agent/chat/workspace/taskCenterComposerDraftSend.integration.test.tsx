import React, { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import { decodeComposerDraft } from "@/components/input-kit/composerDraftCodec";
import {
  a,
  b,
  local,
  accepted,
  queueAccepted,
  deferred,
  installCoordinatorHarness,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type { DraftScope } from "@/lib/api/persistedAtomTypes";
import type { ComposerDraftCapture } from "@/components/input-kit/ComposerDraftCoordinator";
import type { AcceptedRuntimeSubmissionResult } from "../hooks/agentSendResult";
import type { RuntimeSubmissionResult } from "../hooks/agentSendResult";
import { createComposerSubmissionSettlement } from "../components/composerSubmissionSettlement";
import type { InputbarSendHandler } from "../components/Inputbar/inputbarSendPayload";
import type {
  TaskCenterDraftSendRequest,
  TaskCenterSessionReadyOptions,
} from "../homePendingPreview";
import type { WorkspaceHandleSend } from "./useWorkspaceSendActions";
import {
  useTaskCenterEmptyStateSendRuntime,
  useTaskCenterDraftSendDispatchRuntime,
} from "./useTaskCenterDraftSendRuntime";
import { isTaskCenterSendSourceCurrent } from "./useWorkspaceTaskCenterSendRuntime";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));
vi.mock("@/lib/agentUiPerformanceMetrics", () => ({
  recordAgentUiPerformanceMetric: vi.fn(),
}));
vi.mock("./agentChatWorkspaceHelpers", async (original) => ({
  ...(await original<typeof import("./agentChatWorkspaceHelpers")>()),
  scheduleAfterCommit: (callback: () => void) =>
    Promise.resolve().then(callback),
  scheduleAfterNextPaint: (callback: () => void) =>
    Promise.resolve().then(callback),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const setup = installCoordinatorHarness({ safeInvoke, safeListen });
const roots: Array<{ root: Root; container: HTMLDivElement }> = [];
afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

async function mountSend(kind: "home" | "local", structured = true) {
  const h = await setup();
  const source: DraftScope =
    kind === "home"
      ? { ...a, kind: "home", id: "new-conversation" }
      : { ...a, kind: "local", id: "existing" };
  await h.coordinator.bindCommitted(source);
  h.controller.setText("original rich draft");
  h.controller.ingestPaste("折叠粘贴".repeat(300));
  const ui = {
    sessionId: (kind === "local" ? "existing" : null) as string | null,
    workspaceId: a.workspaceId,
    navigationEpoch: 7,
    newChatAt: 100,
  };
  const isSendSourceCurrent = (
    options: TaskCenterSessionReadyOptions,
    sessionId?: string,
  ) =>
    isTaskCenterSendSourceCurrent(
      options,
      { ...ui, composerDraftStatus: h.coordinator.getSnapshot() },
      sessionId,
    );
  const onReady = vi.fn();
  const onCommitted = vi.fn();
  const onDraftAccepted = vi.fn(
    async (
      capture: ComposerDraftCapture,
      result: AcceptedRuntimeSubmissionResult,
    ) => {
      if (!capture.binding) throw new Error("missing original binding");
      await h.coordinator.promote(capture.binding, local, {
        expectedTarget: null,
        sessionId: result.receipt.sessionId,
        threadId: result.receipt.threadId,
      });
    },
  );
  const settlement = createComposerSubmissionSettlement({
    controller: h.controller,
    coordinator: h.coordinator,
    target: "start",
    scope: { projectId: "w", sessionId: null },
    canApplyUi: () => ui.navigationEpoch === 7,
    onDraftAccepted,
    onCommitted,
  });
  const backend = deferred<RuntimeSubmissionResult>();
  const handleSend = vi.fn<WorkspaceHandleSend>(() => backend.promise);
  const restoreInput = vi.fn();
  const setInput = vi.fn();
  let send!: InputbarSendHandler;
  let requestSnapshot: TaskCenterDraftSendRequest | null = null;
  function Harness() {
    const [request, setRequest] = useState<TaskCenterDraftSendRequest | null>(
      null,
    );
    const [, setPreview] = useState<TaskCenterDraftSendRequest | null>(null);
    requestSnapshot = request;
    const sendRef = useRef(handleSend);
    send = useTaskCenterEmptyStateSendRuntime({
      agentEntry: "new-task",
      input: "stale",
      setInput,
      activeSessionIdRef: { current: ui.sessionId },
      getComposerDraftNavigationEpoch: () => ui.navigationEpoch,
      newChatAt: ui.newChatAt,
      isSendSourceCurrent,
      clearMessages: vi.fn(),
      displayMessagesLength: 0,
      turnsLength: 0,
      threadItemsLength: 0,
      hasDisplayMessages: false,
      handleSend,
      sessionId: ui.sessionId,
      taskCenterWorkspaceId: ui.workspaceId,
      setTaskCenterDraftSendRequest: setRequest,
      taskCenterDraftSendRequest: request,
      setHomePendingPreviewRequest: setPreview,
      onSessionAccepted: onReady,
    });
    useTaskCenterDraftSendDispatchRuntime({
      taskCenterDraftSendRequest: request,
      setTaskCenterDraftSendRequest: setRequest,
      setHomePendingPreviewRequest: setPreview,
      messagesLength: 0,
      currentSessionId: ui.sessionId,
      restoreInput,
      sendRef,
      workspaceId: ui.workspaceId,
      isSendSourceCurrent,
      onSessionAccepted: onReady,
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(<Harness />));
  let completion!: Promise<RuntimeSubmissionResult>;
  await act(async () => {
    const receipt = settlement.receipt!;
    completion = Promise.resolve(
      send({
        textOverride: receipt.submission.text,
        composerDraft: structured ? receipt.draft : undefined,
        composerSubmission: receipt.submission,
        composerIntent: receipt.intent,
        composerTarget: receipt.target,
        composerDraftCapture: settlement.composerDraftCapture,
        composerRestoreToken: settlement.composerRestoreToken,
        onRuntimeAccepted: settlement.onRuntimeAccepted,
      }),
    ).then(settlement.finish, settlement.reject);
    await Promise.resolve();
  });
  return {
    h,
    ui,
    source,
    settlement,
    backend,
    completion,
    handleSend,
    setInput,
    restoreInput,
    onReady,
    onDraftAccepted,
    onCommitted,
    request: () => requestSnapshot,
    unmount() {
      act(() => root.unmount());
      container.remove();
      roots.splice(
        roots.findIndex((entry) => entry.root === root),
        1,
      );
    },
    async navigateAway() {
      ui.navigationEpoch += 1;
      await h.coordinator.bindCommitted(b);
      h.controller.setText("new unsent draft");
    },
    async accept(result: RuntimeSubmissionResult = accepted()) {
      await act(async () => {
        backend.resolve(result);
        await completion;
        await settlement.cleanup;
        await h.coordinator.idle();
      });
    },
  };
}

describe("TaskCenter captured rich draft through real persistence owners", () => {
  it.each(["home", "local"] as const)(
    "%s late acceptance consumes the old source without navigating or clearing a new draft",
    async (kind) => {
      const r = await mountSend(kind);
      expect(r.request()?.composerDraftCapture).toBe(
        r.settlement.composerDraftCapture,
      );
      expect(r.handleSend.mock.calls[0][6]?.composerRestoreToken).toBe(
        r.settlement.composerRestoreToken,
      );
      expect(r.handleSend.mock.calls[0][6]).not.toHaveProperty(
        "composerDraftCapture",
      );
      await r.navigateAway();
      await r.accept();
      expect(await r.completion).toMatchObject({ kind: "runtime-accepted" });
      expect(r.onDraftAccepted).toHaveBeenCalledOnce();
      expect(r.onDraftAccepted.mock.calls[0][0]).toBe(
        r.settlement.composerDraftCapture,
      );
      expect(r.onReady).not.toHaveBeenCalled();
      expect(r.onCommitted).not.toHaveBeenCalled();
      expect(r.h.controller.getDocument().text).toBe("new unsent draft");
      expect(await r.h.read(local)).toBeNull();
      expect(await r.h.read(r.source)).toBeNull();
      expect(
        r.h.mutations.filter((mutation) => mutation.op === "consume"),
      ).toEqual([
        expect.objectContaining({
          identity: r.settlement.composerDraftCapture!.binding!.identity,
        }),
      ]);
      const newEntry = await r.h.read(b);
      if (newEntry?.state !== "draft") throw new Error("new draft was lost");
      expect(decodeComposerDraft(newEntry.draft).document.text).toBe(
        "new unsent draft",
      );
      expect(r.restoreInput).not.toHaveBeenCalled();
      expect(r.setInput).not.toHaveBeenCalled();
    },
  );

  it.each(["home", "local"] as const)(
    "%s hook unmount preserves accepted source cleanup",
    async (kind) => {
      const r = await mountSend(kind);
      r.unmount();
      await r.accept();
      expect(await r.h.read(local)).toBeNull();
      expect(await r.h.read(r.source)).toBeNull();
      expect(
        r.h.mutations.filter((mutation) => mutation.op === "consume"),
      ).toEqual([
        expect.objectContaining({
          identity: r.settlement.composerDraftCapture!.binding!.identity,
        }),
      ]);
      expect(r.onReady).not.toHaveBeenCalled();
      expect(r.onDraftAccepted).toHaveBeenCalledOnce();
    },
  );

  it.each(["home", "local"] as const)(
    "%s late rejection cannot restore old plain text into the new surface",
    async (kind) => {
      const r = await mountSend(kind, false);
      expect(r.setInput).toHaveBeenCalledExactlyOnceWith("");
      await r.navigateAway();
      r.setInput.mockClear();
      await r.accept({ kind: "rejected" });
      expect(r.setInput).not.toHaveBeenCalled();
      expect(r.onReady).not.toHaveBeenCalled();
      expect(r.onDraftAccepted).not.toHaveBeenCalled();
      expect(r.h.controller.getDocument().text).toBe("new unsent draft");
      expect((await r.h.read(r.source))?.state).toBe("draft");
      expect(r.h.mutations.some((mutation) => mutation.op === "consume")).toBe(
        false,
      );
    },
  );

  it("queue acceptance uses the same original capture and consumes only once", async () => {
    const r = await mountSend("home");
    await r.navigateAway();
    await r.accept(queueAccepted());
    expect(await r.completion).toMatchObject({ kind: "queue-accepted" });
    expect(r.onDraftAccepted).toHaveBeenCalledOnce();
    expect(r.onDraftAccepted.mock.calls[0][0]).toBe(
      r.settlement.composerDraftCapture,
    );
    expect(await r.h.read(local)).toBeNull();
    const mutations = r.h.mutations;
    const promoteIndex = mutations.findIndex(
      (mutation) => mutation.op === "promote",
    );
    const consumeIndex = mutations.findIndex(
      (mutation) => mutation.op === "consume",
    );
    expect(promoteIndex).toBeGreaterThan(-1);
    expect(consumeIndex).toBeGreaterThan(promoteIndex);
    expect(mutations.filter((mutation) => mutation.op === "consume")).toEqual([
      {
        op: "consume",
        identity: r.settlement.composerDraftCapture!.binding!.identity,
      },
    ]);
    expect(r.onReady).not.toHaveBeenCalled();
    expect(r.h.controller.getDocument().text).toBe("new unsent draft");
  });

  it("same-scope newer draft version keeps navigation and the new document after old acceptance", async () => {
    const r = await mountSend("home");
    const generation = r.h.coordinator.getSnapshot().generation;
    r.h.controller.setText("new same-scope draft");
    expect(r.h.coordinator.getSnapshot().generation).toBe(generation);
    expect(r.h.coordinator.getSnapshot().identity).not.toEqual(
      r.settlement.composerDraftCapture!.binding!.identity,
    );
    await r.accept();
    expect(await r.completion).toMatchObject({ kind: "runtime-accepted" });
    expect(r.onDraftAccepted).toHaveBeenCalledOnce();
    expect(r.onReady).not.toHaveBeenCalled();
    expect(r.h.controller.getDocument().text).toBe("new same-scope draft");
    // Pending edits on the same lane follow a successful captured promotion.
    const entry = await r.h.read(local);
    if (entry?.state !== "draft")
      throw new Error("new same-scope draft was lost");
    expect(entry.scopeVersion).not.toBe(
      r.settlement.composerDraftCapture!.binding!.identity.scopeVersion,
    );
    expect(decodeComposerDraft(entry.draft).document.text).toBe(
      "new same-scope draft",
    );
  });
});
