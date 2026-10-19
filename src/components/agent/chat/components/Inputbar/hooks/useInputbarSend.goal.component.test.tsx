import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { deferred } from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import {
  materializeThreadGoal,
  type MaterializedThreadGoal,
} from "@/lib/api/agentRuntime/threadGoalAttachments";
import { acceptedSubmission } from "../../../hooks/agentSendResult.testFixtures";
import { getInputbarSendOptions } from "../inputbarSendPayload";
import { useInputbarSend } from "./useInputbarSend";

vi.mock("@/lib/api/agentRuntime/threadGoalAttachments", () => ({
  materializeThreadGoal: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

type Params = Parameters<typeof useInputbarSend>[0];
let latestSend: ReturnType<typeof useInputbarSend>;
let root: Root;
let container: HTMLDivElement;
let props: Params;
const cleanup = vi.fn(async () => undefined);

function Harness(input: Params) {
  latestSend = useInputbarSend(input);
  return null;
}
function render(overrides: Partial<Params> = {}) {
  props = {
    input: "目标正文",
    composerController: new ComposerController({ text: "目标正文" }),
    pendingImages: [],
    pathReferences: [],
    activeCapability: null,
    activeTools: { objective_mode: true },
    onSend: vi.fn(async () => acceptedSubmission()),
    clearPendingImages: vi.fn(),
    clearActiveCapability: vi.fn(),
    onGoalSubmittingChange: vi.fn(),
    projectId: "project-1",
    sessionId: null,
    ...overrides,
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness {...props} />));
  return props.composerController!;
}
async function send() {
  let result;
  await act(async () => {
    result = await latestSend();
  });
  return result;
}

beforeEach(async () => {
  await changeLimeLocale("zh-CN");
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.mocked(materializeThreadGoal).mockImplementation(async (draft) => ({
    objective: draft.objective,
    cleanup,
  }));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("threadless Inputbar goal submission", () => {
  it("复用首轮 lowering，物化期间锁重复，保留富草稿恢复和原始 goal history", async () => {
    const controller = new ComposerController({
      text: "目标正文",
      attachments: [{ mediaType: "image/png", data: "aW1hZ2U=" }],
    });
    const paste = "完整贴文".repeat(300);
    controller.ingestPaste(paste);
    const before = controller.captureDraft();
    const onComposerAccepted = vi.fn();
    render({ composerController: controller, onComposerAccepted });
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    let pending: ReturnType<typeof latestSend>;
    await act(async () => {
      pending = latestSend();
      await Promise.resolve();
    });
    expect(props.onGoalSubmittingChange).toHaveBeenCalledWith(true);
    expect(props.onSend).not.toHaveBeenCalled();
    expect(await send()).toEqual({ kind: "rejected" });
    expect(materializeThreadGoal).toHaveBeenCalledOnce();
    const objective =
      "目标正文\nReferenced files: /isolated/pasted-text-1.txt, /isolated/image-1.png";
    await act(async () => {
      gate.resolve({ objective, cleanup });
      await pending;
    });
    expect(materializeThreadGoal).toHaveBeenCalledWith(
      {
        objective: "目标正文",
        pastedTextAttachments: [{ text: paste }],
        imageAttachments: [{ src: "data:image/png;base64,aW1hZ2U=" }],
      },
      { assertRequestCurrent: expect.any(Function) },
    );
    const payload = vi.mocked(props.onSend).mock.calls[0]![0]!;
    expect(payload.textOverride).toBe(`/goal ${objective}`);
    expect(payload.composerSubmission).toMatchObject({
      text: payload.textOverride,
      textElements: [],
      inputMentions: [],
      attachments: [],
    });
    expect(payload.sendOptions?.threadGoal).toEqual({ objective });
    expect(payload.sendOptions?.displayContent).toBeUndefined();
    expect(payload.images).toBeUndefined();
    expect(payload.sendOptions?.inputRestoreDraft).toMatchObject({
      text: before.text,
      editorDocument: before.editorDocument,
      pendingPastes: before.pendingPastes,
      images: before.attachments,
    });
    expect(onComposerAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ text: before.text }),
      expect.objectContaining({ kind: "runtime-accepted" }),
      "/goal 目标正文",
    );
    expect(controller.getDocument().text).toBe("");
    expect(props.onGoalSubmittingChange).toHaveBeenLastCalledWith(false);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("创建真实会话后首轮拒绝保留素材与草稿", async () => {
    const controller = render({
      onSend: vi.fn(async (payload) => {
        getInputbarSendOptions(payload!)?.observer?.onSessionReady?.(
          "session-created",
        );
        return { kind: "rejected" };
      }),
    });
    expect(await send()).toEqual({ kind: "rejected" });
    expect(controller.getDocument().text).toBe("目标正文");
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("接受结果未知保留素材和草稿", async () => {
    const controller = render({
      onSend: vi.fn(async () => ({ kind: "unknown" })),
    });
    expect(await send()).toEqual({ kind: "unknown" });
    expect(controller.getDocument().text).toBe("目标正文");
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("创建前拒绝回收素材并保留草稿", async () => {
    const controller = render({
      onSend: vi.fn(async () => ({ kind: "rejected" })),
    });
    expect(await send()).toEqual({ kind: "rejected" });
    expect(controller.getDocument().text).toBe("目标正文");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("切换项目后旧物化结果不发送、不清新稿、不提示错误", async () => {
    const controller = render();
    const gate = deferred<MaterializedThreadGoal>();
    vi.mocked(materializeThreadGoal).mockReturnValueOnce(gate.promise);
    let pending: ReturnType<typeof latestSend>;
    await act(async () => {
      pending = latestSend();
      await Promise.resolve();
    });
    props = { ...props, projectId: "project-2" };
    act(() => {
      root.render(<Harness {...props} />);
      controller.setText("新项目正文");
    });
    await act(async () => {
      gate.resolve({ objective: "旧目标", cleanup });
      await pending;
    });
    expect(props.onSend).not.toHaveBeenCalled();
    expect(controller.getDocument().text).toBe("新项目正文");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("空 /goal 只启用目标 Composer，不物化或发送首轮", async () => {
    const onGoalModeEnabled = vi.fn();
    render({
      composerController: new ComposerController({ text: "/goal" }),
      activeTools: {},
      onGoalModeEnabled,
    });
    expect(await send()).toEqual({ kind: "local-handled" });
    expect(onGoalModeEnabled).toHaveBeenCalledOnce();
    expect(materializeThreadGoal).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("显式命令不经普通文本快路，正文去掉命令后物化一次", async () => {
    render({
      composerController: new ComposerController({ text: "/goal 目标正文" }),
      activeTools: {},
    });
    await send();
    expect(materializeThreadGoal).toHaveBeenCalledWith(
      expect.objectContaining({ objective: "目标正文" }),
      expect.anything(),
    );
    expect(vi.mocked(props.onSend).mock.calls[0]?.[0]?.textOverride).toBe(
      "/goal 目标正文",
    );
  });

  it("没有 Controller receipt 不保留 raw goal fallback", async () => {
    render({ composerController: undefined });
    expect(await send()).toEqual({ kind: "rejected" });
    expect(materializeThreadGoal).not.toHaveBeenCalled();
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it("物化失败提示可见错误，保留草稿并解锁", async () => {
    const controller = render();
    vi.mocked(materializeThreadGoal).mockRejectedValueOnce(
      new Error("disk unavailable"),
    );
    expect(await send()).toMatchObject({ kind: "rejected" });
    expect(props.onSend).not.toHaveBeenCalled();
    expect(controller.getDocument().text).toBe("目标正文");
    expect(toast.error).toHaveBeenCalledWith(
      "无法准备目标附件，草稿已保留，请重试。",
    );
    expect(props.onGoalSubmittingChange).toHaveBeenLastCalledWith(false);
  });
});
