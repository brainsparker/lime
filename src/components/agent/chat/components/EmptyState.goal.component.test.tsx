import {
  flushAsyncEffects,
  mountedRoots,
  prepareCoordinator,
  renderEmptyState,
} from "./EmptyState.testFixtures";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ComposerController } from "@/components/input-kit/ComposerController";
import {
  b,
  deferred,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import {
  materializeThreadGoal,
  type MaterializedThreadGoal,
} from "@/lib/api/agentRuntime/threadGoalAttachments";
import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";
import type { InputbarSendHandler } from "./Inputbar/inputbarSendPayload";

vi.mock("@/lib/api/agentRuntime/threadGoalAttachments", () => ({
  materializeThreadGoal: vi.fn(),
}));

async function send(container: HTMLElement) {
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('button[aria-label="发送"]')
      ?.click(),
  );
  await flushAsyncEffects();
}

describe("EmptyState new-thread goal current integration", () => {
  const cleanup = vi.fn(async () => undefined);
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(materializeThreadGoal).mockImplementation(async (draft) => ({
      objective: draft.objective,
      cleanup,
    }));
  });

  it("同一 receipt 的 paste/image 物化完成后再发送，同源正文供乐观投影与首轮使用", async () => {
    const controller = new ComposerController({
      text: "完成任务",
      attachments: [{ data: "image-data", mediaType: "image/png" }],
    });
    controller.ingestPaste("完整 paste\n".repeat(1000));
    const captured = controller.captureDraft();
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: controller,
      input: controller.getDocument().text,
      objectiveEnabled: true,
      onSend,
    });
    await send(container);
    expect(materializeThreadGoal).toHaveBeenCalledWith(
      {
        objective: "完成任务",
        pastedTextAttachments: [{ text: "完整 paste\n".repeat(1000) }],
        imageAttachments: [{ src: "data:image/png;base64,image-data" }],
      },
      { assertRequestCurrent: expect.any(Function) },
    );
    expect(onSend).not.toHaveBeenCalled();
    await send(container);
    expect(materializeThreadGoal).toHaveBeenCalledOnce();
    const objective =
      "完成任务\nReferenced pasted text files: /isolated/pasted-text-1.txt\nReferenced image files: /isolated/image-1.png";
    await act(async () => gate.resolve({ objective, cleanup }));
    await flushAsyncEffects();
    expect(onSend).toHaveBeenCalledOnce();
    const payload = onSend.mock.calls[0]![0]!;
    expect(payload.textOverride).toBe(`/goal ${objective}`);
    expect(payload.composerSubmission).toMatchObject({
      text: payload.textOverride,
      textElements: [],
      inputMentions: [],
      attachments: [],
    });
    expect(payload.images).toBeUndefined();
    expect(payload.sendOptions?.threadGoal).toEqual({ objective });
    expect(payload.sendOptions?.inputRestoreDraft).toMatchObject({
      text: captured.text,
      editorDocument: captured.editorDocument,
      pendingPastes: captured.pendingPastes,
      images: captured.attachments,
    });
    expect(controller.getDocument().text).toBe("");
    expect(cleanup).not.toHaveBeenCalled();
  });

  it.each(["paste", "image"])(
    "仅 %s 目标仍经过目标物化与普通首轮",
    async (kind) => {
      const controller = new ComposerController();
      if (kind === "paste") controller.ingestPaste("仅 paste\n".repeat(1000));
      else
        controller.setAttachments([
          { data: "image-data", mediaType: "image/png" },
        ]);
      vi.mocked(materializeThreadGoal).mockResolvedValueOnce({
        objective: "Referenced files: /isolated/goal-file",
        cleanup,
      });
      const onSend = vi.fn<InputbarSendHandler>(async () =>
        acceptedSubmission(),
      );
      const container = renderEmptyState({
        composerController: controller,
        input: controller.getDocument().text,
        objectiveEnabled: true,
        onSend,
      });
      await send(container);
      expect(materializeThreadGoal).toHaveBeenCalledOnce();
      expect(onSend.mock.calls[0]?.[0]?.textOverride).toBe(
        "/goal Referenced files: /isolated/goal-file",
      );
    },
  );

  it("显式 /goal 消费同一目标 draft，空命令只开启目标编辑", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const empty = renderEmptyState({ input: "/goal", onSend });
    await send(empty);
    expect(materializeThreadGoal).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    const nonempty = renderEmptyState({ input: "/goal 持续完成任务", onSend });
    await send(nonempty);
    expect(materializeThreadGoal).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "持续完成任务" }),
      expect.anything(),
    );
    expect(onSend.mock.calls[0]?.[0]?.textOverride).toBe("/goal 持续完成任务");
  });

  it("物化失败保留完整富草稿并显示可见错误", async () => {
    const controller = new ComposerController({
      text: "完整目标",
      attachments: [{ data: "image-data", mediaType: "image/png" }],
    });
    controller.ingestPaste("失败后仍需恢复的 paste\n".repeat(1000));
    const before = controller.captureDraft();
    vi.mocked(materializeThreadGoal).mockRejectedValueOnce(
      new Error("disk unavailable"),
    );
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: controller,
      input: controller.getDocument().text,
      objectiveEnabled: true,
      onSend,
    });
    await send(container);
    expect(onSend).not.toHaveBeenCalled();
    expect(controller.captureDraft()).toMatchObject({
      text: before.text,
      editorDocument: before.editorDocument,
      pendingPastes: before.pendingPastes,
      attachments: before.attachments,
    });
    expect(toast.error).toHaveBeenCalledWith(
      "无法准备目标附件，草稿已保留，请重试。",
    );
  });

  it("物化期间切换 scope 不创建线程、不清新稿、不向新 surface 提示错误", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      objectiveEnabled: true,
      onSend,
    });
    await send(container);
    await act(async () => {
      await h.coordinator.bindCommitted(b);
      h.controller.setText("新线程草稿");
    });
    await act(async () =>
      gate.resolve({ objective: "old materialized", cleanup }),
    );
    await flushAsyncEffects();
    expect(onSend).not.toHaveBeenCalled();
    expect(h.controller.getDocument().text).toBe("新线程草稿");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("已接受旧 receipt 不会清理准备期间产生的新 revision", async () => {
    const controller = new ComposerController({ text: "旧目标" });
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: controller,
      input: "旧目标",
      objectiveEnabled: true,
      onSend,
    });
    await send(container);
    act(() => controller.setText("新 revision"));
    await act(async () => gate.resolve({ objective: "旧目标", cleanup }));
    await flushAsyncEffects();
    expect(onSend.mock.calls[0]?.[0]?.textOverride).toBe("/goal 旧目标");
    expect(controller.getDocument().text).toBe("新 revision");
  });

  it("卸载期间完成物化只回收本次素材", async () => {
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "目标",
      objectiveEnabled: true,
      onSend,
    });
    await send(container);
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
    await act(async () => gate.resolve({ objective: "目标", cleanup }));
    await flushAsyncEffects();
    expect(onSend).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
