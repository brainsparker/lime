import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import {
  a,
  b,
  local,
  harness as coordinatorHarness,
  deferred,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type {
  ComposerDraftCoordinator,
  ComposerDraftCapture,
} from "@/components/input-kit/ComposerDraftCoordinator";
import type { AcceptedRuntimeSubmissionResult } from "../../../hooks/agentSendResult";
import { getInputbarSendOptions } from "../inputbarSendPayload";
import { acceptedSubmission } from "../../../hooks/agentSendResult.testFixtures";
import {
  fromQueueAcceptanceResponse,
  type RuntimeSubmissionResult,
} from "../../../hooks/agentSendResult";
import React, { useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "@/lib/api/skills";
import type { MessageImage, MessagePathReference } from "../../../types";
import type { InputCapabilitySelection } from "../../../skill-selection/inputCapabilitySelection";
import type { InputbarSendHandler } from "../inputbarSendPayload";
import { useInputbarSend } from "./useInputbarSend";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { ComposerDraftSnapshot } from "@/components/input-kit";

const { recordAgentUiPerformanceMetricMock } = vi.hoisted(() => ({
  recordAgentUiPerformanceMetricMock: vi.fn(),
}));

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentUiPerformanceMetrics", () => ({
  recordAgentUiPerformanceMetric: recordAgentUiPerformanceMetricMock,
}));

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
}

interface HarnessProps {
  activeCapability?: InputCapabilitySelection | null;
  activeTools?: Record<string, boolean>;
  getInputRestoreEpoch?: () => number;
  input?: string;
  onSend: InputbarSendHandler;
  pathReferences?: MessagePathReference[];
  pendingImages?: MessageImage[];
  projectId?: string | null;
  sessionId?: string | null;
  composerController?: ComposerController;
  composerDraftCoordinator?: ComposerDraftCoordinator;
  onComposerDraftAccepted?: (
    capture: ComposerDraftCapture,
    result: AcceptedRuntimeSubmissionResult,
  ) => Promise<void> | void;
  onComposerAccepted?: (
    draft: ComposerDraftSnapshot | undefined,
    result: AcceptedRuntimeSubmissionResult,
  ) => void;
  isLoading?: boolean;
  onComposerCommitted?: (text: string, draft?: ComposerDraftSnapshot) => void;
}

const mountedRoots: MountedHarness[] = [];
const coordinators: Awaited<ReturnType<typeof coordinatorHarness>>[] = [];
async function prepareCoordinator() {
  const h = await coordinatorHarness({ safeInvoke, safeListen });
  coordinators.push(h);
  await h.coordinator.bindCommitted(a);
  h.controller.setText("captured from Inputbar");
  return h;
}
let latestSend: ReturnType<typeof useInputbarSend> | null = null;
let clearPathReferencesMock: ReturnType<typeof vi.fn>;
let clearActiveCapabilityMock: ReturnType<typeof vi.fn>;
let clearPendingImagesMock: ReturnType<typeof vi.fn>;

function Harness({
  activeCapability = null,
  activeTools = {},
  getInputRestoreEpoch,
  input = "",
  onSend,
  pathReferences = [],
  pendingImages = [],
  projectId = null,
  sessionId = null,
  composerController,
  composerDraftCoordinator,
  onComposerDraftAccepted,
  onComposerAccepted,
  isLoading = false,
  onComposerCommitted,
}: HarnessProps) {
  const handleSend = useInputbarSend({
    input,
    pendingImages,
    pathReferences,
    activeCapability,
    activeTools,
    projectId,
    sessionId,
    composerController,
    composerDraftCoordinator,
    onComposerDraftAccepted,
    onComposerAccepted,
    isLoading,
    onComposerCommitted,
    onSend,
    clearPendingImages: clearPendingImagesMock,
    clearPathReferences: clearPathReferencesMock,
    clearActiveCapability: clearActiveCapabilityMock,
    getInputRestoreEpoch,
  });

  useEffect(() => {
    latestSend = handleSend;
    return () => {
      if (latestSend === handleSend) {
        latestSend = null;
      }
    };
  }, [handleSend]);

  return null;
}

function renderHarness(props: HarnessProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ container, root });

  act(() => {
    root.render(<Harness {...props} />);
  });
}

async function send() {
  expect(latestSend).toBeTypeOf("function");
  await act(async () => {
    await latestSend?.();
  });
}

async function sendWithMetadata(
  metadata: NonNullable<Parameters<ReturnType<typeof useInputbarSend>>[0]>,
) {
  expect(latestSend).toBeTypeOf("function");
  await act(async () => {
    await latestSend?.(metadata);
  });
}

function createPathReference(
  overrides: Partial<MessagePathReference> = {},
): MessagePathReference {
  return {
    id: "file:/tmp/report.md",
    path: "/tmp/report.md",
    name: "report.md",
    isDir: false,
    size: 128,
    mimeType: "text/markdown",
    source: "file_manager",
    ...overrides,
  };
}

function createInstalledSkillSelection(): InputCapabilitySelection {
  const skill: Skill = {
    key: "local:capability-report",
    name: "Capability Report",
    description: "生成能力报告",
    directory: "capability-report",
    installed: true,
    sourceKind: "other",
  };

  return {
    kind: "installed_skill",
    skill,
  };
}

describe("useInputbarSend", () => {
  afterEach(async () => {
    for (const { root, container } of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    latestSend = null;
    for (const h of coordinators.splice(0)) await h.close();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    clearPathReferencesMock = vi.fn();
    clearActiveCapabilityMock = vi.fn();
    clearPendingImagesMock = vi.fn();
  });

  it("普通文本发送应显式下传当前输入文本", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    renderHarness({
      input: "继续优化 Skill runtime",
      onSend,
    });

    await send();

    expect(onSend).toHaveBeenCalledWith({
      onRuntimeAccepted: expect.any(Function),
      images: undefined,
      textOverride: "继续优化 Skill runtime",
      sendOptions: undefined,
    });
    expect(clearPendingImagesMock).toHaveBeenCalledTimes(1);
  });

  it("纯文本无附件和模式时应走最小发送快路径", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    const triggeredAt = Date.now() - 12;
    renderHarness({
      activeTools: {
        objective_mode: false,
        subagent_mode: false,
        task_mode: false,
      },
      input: "你好",
      onSend,
    });

    await sendWithMetadata({ triggeredAt, triggerSource: "button" });

    expect(onSend).toHaveBeenCalledWith({
      onRuntimeAccepted: expect.any(Function),
      images: undefined,
      textOverride: "你好",
      sendOptions: undefined,
      triggeredAt,
      triggerSource: "button",
    });
    expect(recordAgentUiPerformanceMetricMock).toHaveBeenCalledWith(
      "inputbar.send.plainTextFastPath",
      expect.objectContaining({
        inputLength: 2,
        sessionId: null,
        triggerSource: "button",
      }),
    );
  });

  it("Plugin 原子输入应只由 receipt.submission 提供文本、mentions 和范围", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    const composerController = new ComposerController({
      text: " 帮我整理项目资料",
    });
    composerController.setSelection(0);
    composerController.insertMention({
      id: "content-factory-app@personal",
      kind: "plugin",
      name: "写文章",
      path: "plugin://content-factory-app@personal",
      label: "@写文章",
    });
    const expected = composerController.submit("start").submission;
    renderHarness({
      composerController,
      input: "帮我整理项目资料",
      onSend,
    });

    await send();

    const payload = onSend.mock.calls[0]?.[0];
    expect(payload?.textOverride).toBe("@写文章 帮我整理项目资料");
    expect(payload?.composerSubmission?.inputMentions).toEqual([
      {
        type: "mention",
        name: "写文章",
        path: "plugin://content-factory-app@personal",
      },
    ]);
    expect(payload?.composerSubmission?.textElements).toEqual(
      expected.textElements,
    );
    expect(payload?.composerSubmission?.textElements).toEqual([
      { byteRange: { start: 0, end: 10 }, placeholder: "@写文章" },
    ]);
  });

  it("只有路径引用时仍应发送路径占位文本并保留 metadata", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    const pathReferences = [createPathReference()];
    renderHarness({
      input: "   ",
      onSend,
      pathReferences,
    });

    await send();

    const payload = onSend.mock.calls[0]?.[0];
    expect(payload?.sendOptions?.inputRestoreDraft?.pathReferences).not.toBe(
      pathReferences,
    );
    expect(onSend).toHaveBeenCalledWith({
      onRuntimeAccepted: expect.any(Function),
      images: undefined,
      textOverride: "请查看这些文件或文件夹。",
      sendOptions: {
        inputRestoreDraft: {
          text: "",
          images: [],
          pathReferences: [createPathReference()],
          textElements: [],
          inputCapabilityRoute: undefined,
        },
        requestMetadata: {
          path_references: [
            {
              path: "/tmp/report.md",
              name: "report.md",
              is_dir: false,
              isDir: false,
              size: 128,
              mime_type: "text/markdown",
              mimeType: "text/markdown",
              source: "file_manager",
            },
          ],
          harness: {
            file_references: [
              {
                path: "/tmp/report.md",
                name: "report.md",
                is_dir: false,
                isDir: false,
                size: 128,
                mime_type: "text/markdown",
                mimeType: "text/markdown",
                source: "file_manager",
              },
            ],
            fileReferences: [
              {
                path: "/tmp/report.md",
                name: "report.md",
                is_dir: false,
                isDir: false,
                size: 128,
                mime_type: "text/markdown",
                mimeType: "text/markdown",
                source: "file_manager",
              },
            ],
          },
        },
      },
    });
    expect(clearPathReferencesMock).toHaveBeenCalledTimes(1);
  });

  it("富输入恢复草稿应使用发送瞬间的独立快照", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    const image: MessageImage = {
      data: "image-data",
      mediaType: "image/png",
      sourcePath: "/tmp/screenshot.png",
    };
    const pendingImages = [image];
    const pathReferences = [createPathReference()];
    renderHarness({
      activeCapability: createInstalledSkillSelection(),
      input: "请结合截图和文件生成能力报告",
      onSend,
      pathReferences,
      pendingImages,
    });

    await send();

    const payload = onSend.mock.calls[0]?.[0];
    expect(payload?.sendOptions?.inputRestoreDraft).toMatchObject({
      text: "请结合截图和文件生成能力报告",
      images: [image],
      pathReferences: [createPathReference()],
      inputCapabilityRoute: undefined,
    });
    expect(payload?.sendOptions?.inputRestoreDraft?.images).not.toBe(
      pendingImages,
    );
    expect(payload?.sendOptions?.inputRestoreDraft?.pathReferences).not.toBe(
      pathReferences,
    );
  });

  it("同batch发送读取canonical资源和能力，旧React闭包不能回灌", async () => {
    const onSend = vi.fn().mockResolvedValue({ kind: "rejected" });
    const composerController = new ComposerController();
    const image: MessageImage = {
      data: "latest-image",
      mediaType: "image/png",
      sourcePath: "/tmp/latest.png",
    };
    const reference = createPathReference({
      id: "file:/tmp/latest.md",
      path: "/tmp/latest.md",
      name: "latest.md",
    });
    const route = {
      kind: "builtin_command" as const,
      commandKey: "latest-report",
      commandPrefix: "@latest-report",
    };
    renderHarness({
      composerController,
      activeCapability: createInstalledSkillSelection(),
      input: "过期文本",
      pendingImages: [{ data: "old-image", mediaType: "image/jpeg" }],
      pathReferences: [createPathReference()],
      onSend,
    });

    await act(async () => {
      composerController.setText("请用最新素材生成报告");
      composerController.setAttachments([image]);
      composerController.setPathReferences([reference]);
      composerController.setInputCapabilityRoute(route);
      const draft = composerController.captureDraft();
      await latestSend?.();
      expect(composerController.captureDraft()).toEqual(draft);
    });

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        textOverride: "请用最新素材生成报告",
        images: [image],
        composerSubmission: expect.objectContaining({
          attachments: [image],
          pathReferences: [reference],
          inputCapabilityRoute: route,
        }),
        sendOptions: expect.objectContaining({
          capabilityRoute: route,
          inputRestoreDraft: expect.objectContaining({
            images: [image],
            pathReferences: [reference],
            inputCapabilityRoute: route,
          }),
          requestMetadata: expect.objectContaining({
            path_references: [
              expect.objectContaining({ path: "/tmp/latest.md" }),
            ],
          }),
        }),
      }),
    );
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
    expect(clearPathReferencesMock).not.toHaveBeenCalled();
  });

  it("旧空props不能拦截只有canonical图片和路径的发送", async () => {
    const onSend = vi.fn().mockResolvedValue({ kind: "rejected" });
    const composerController = new ComposerController();
    const image: MessageImage = { data: "image-data", mediaType: "image/png" };
    const reference = createPathReference();
    renderHarness({ composerController, onSend });

    await act(async () => {
      composerController.setAttachments([image]);
      composerController.setPathReferences([reference]);
      await latestSend?.();
    });

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [image],
        textOverride: "请查看这些文件或文件夹。",
        composerSubmission: expect.objectContaining({
          attachments: [image],
          pathReferences: [reference],
        }),
      }),
    );
  });

  it("canonical能力已清除时不能发送旧React能力", async () => {
    const onSend = vi.fn().mockResolvedValue({ kind: "rejected" });
    const composerController = new ComposerController({ text: "普通文本" });
    renderHarness({
      composerController,
      activeCapability: createInstalledSkillSelection(),
      input: "普通文本",
      onSend,
    });

    await send();

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        textOverride: "普通文本",
        sendOptions: undefined,
      }),
    );
  });

  it("发送期间发生输入恢复时不应再清理刚恢复的富输入状态", async () => {
    let inputRestoreEpoch = 1;
    const image: MessageImage = {
      data: "image-data",
      mediaType: "image/png",
      sourcePath: "/tmp/screenshot.png",
    };
    const pathReferences = [createPathReference()];
    const onSend = vi.fn(async () => {
      inputRestoreEpoch = 2;
      return acceptedSubmission();
    });

    renderHarness({
      activeCapability: createInstalledSkillSelection(),
      getInputRestoreEpoch: () => inputRestoreEpoch,
      input: "请结合截图和文件生成能力报告",
      onSend,
      pathReferences,
      pendingImages: [image],
    });

    await send();

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
    expect(clearPathReferencesMock).not.toHaveBeenCalled();
    expect(clearActiveCapabilityMock).not.toHaveBeenCalled();
  });

  it("过期技能选择不生成发送路由，typed 计划模式保持完整", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    renderHarness({
      activeCapability: createInstalledSkillSelection(),
      activeTools: {
        task_mode: true,
        subagent_mode: true,
      },
      input: "生成一份能力报告",
      onSend,
      sessionId: "thread-skill-runtime",
    });

    await send();

    expect(onSend).toHaveBeenCalledWith({
      onRuntimeAccepted: expect.any(Function),
      images: undefined,
      textOverride: "生成一份能力报告",
      sendOptions: {
        inputRestoreDraft: {
          text: "生成一份能力报告",
          images: [],
          pathReferences: [],
          textElements: [],
          inputCapabilityRoute: undefined,
        },
        displayContent: "生成一份能力报告",
        collaborationMode: "plan",
        toolPreferencesOverride: {
          task: true,
          subagent: true,
        },
      },
    });
    expect(clearActiveCapabilityMock).toHaveBeenCalledTimes(1);
  });

  it("目标模式应通过 typed threadGoal 发送同一文本", async () => {
    const onSend = vi.fn().mockResolvedValue(acceptedSubmission());
    renderHarness({
      activeTools: {
        objective_mode: true,
      },
      input: "保持当前修复目标",
      onSend,
      projectId: "workspace-1",
      sessionId: "thread-goal-1",
    });

    await send();

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        textOverride: "保持当前修复目标",
        sendOptions: expect.objectContaining({
          threadGoal: { objective: "保持当前修复目标" },
        }),
      }),
    );
  });

  it("发送展开后的 paste 和 Skill，失败时保留折叠文档与选择区", async () => {
    const onSend = vi.fn().mockResolvedValue({ kind: "rejected" });
    const composerController = new ComposerController({ text: "A😀 " });
    composerController.setSelection(4);
    composerController.insertMention({
      id: "skill-1",
      kind: "skill",
      name: "x",
      path: "/skills/x/SKILL.md",
      label: "@x",
    });
    composerController.ingestPaste("完整正文".repeat(300));
    const draft = composerController.captureDraft();
    renderHarness({ composerController, input: "过期的 React 文本", onSend });
    await send();
    const payload = onSend.mock.calls[0][0];
    expect(payload.textOverride).toContain("完整正文".repeat(300));
    expect(payload.composerSubmission.text).toBe(payload.textOverride);
    expect(payload.composerSubmission.inputMentions).toEqual([
      { type: "skill", name: "x", path: "/skills/x/SKILL.md" },
    ]);
    expect(payload.composerSubmission.textElements.length).toBeGreaterThan(0);
    expect(payload.composerDraft).toEqual(draft);
    expect(payload.composerDraft.text).toContain("[Pasted text");
    expect(composerController.captureDraft()).toEqual(draft);
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
  });

  it("active turn 的显式 queue target 应生成 queue intent 并在成功后提交草稿", async () => {
    const queueResult = fromQueueAcceptanceResponse(
      {
        sessionId: "queue-session",
        threadId: "queue-thread",
        clientUserMessageId: "queue-client",
      },
      {
        id: "queued-real",
        clientUserMessageId: "queue-client",
        input: [{ type: "text", text: "排队处理" }],
      },
    );
    const onSend = vi.fn().mockResolvedValue(queueResult);
    const onComposerCommitted = vi.fn();
    const composerController = new ComposerController({ text: "排队处理" });
    renderHarness({
      composerController,
      input: "排队处理",
      isLoading: true,
      onComposerCommitted,
      onSend,
    });

    await sendWithMetadata({
      triggeredAt: Date.now(),
      triggerSource: "button",
      submitTarget: "queue",
    });

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        composerIntent: "queue",
        composerTarget: "queue",
        composerDraft: expect.objectContaining({ text: "排队处理" }),
      }),
    );
    expect(composerController.getDocument().text).toBe("");
    expect(onComposerCommitted).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ text: "排队处理" }),
    );
  });
  it.each([
    { kind: "unknown" as const },
    { kind: "local-handled" as const },
    { kind: "rejected" as const },
  ])("keeps document and resources for %j", async (result) => {
    const controller = new ComposerController({ text: "未发送😀" });
    controller.setAttachments([{ data: "image-data", mediaType: "image/png" }]);
    const before = controller.captureDraft();
    const onSend = vi.fn<InputbarSendHandler>(async () => result);
    renderHarness({ composerController: controller, onSend });
    await send();
    expect(controller.captureDraft()).toEqual(before);
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
    expect(clearActiveCapabilityMock).not.toHaveBeenCalled();
  });
  it("late confirmed queue cannot clear newer composer document", async () => {
    let resolve!: (value: RuntimeSubmissionResult) => void;
    const onSend = vi.fn<InputbarSendHandler>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const controller = new ComposerController({ text: "原队列" });
    renderHarness({ composerController: controller, onSend, isLoading: true });
    let pending!: ReturnType<NonNullable<typeof latestSend>>;
    await act(async () => {
      pending = latestSend!({
        triggeredAt: Date.now(),
        triggerSource: "button",
        submitTarget: "queue",
      });
      await Promise.resolve();
    });
    controller.setText("新草稿");
    await act(async () => {
      resolve(
        fromQueueAcceptanceResponse(
          {
            sessionId: "session-q",
            threadId: "thread-q",
            clientUserMessageId: "client-q",
          },
          {
            id: "queued-q",
            clientUserMessageId: "client-q",
            input: [{ type: "text", text: "原队列" }],
          },
        ),
      );
      await pending;
    });
    expect(controller.getDocument().text).toBe("新草稿");
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
  });
  it("settles early observer acceptance with one capture while runtime completion is pending", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const submit = vi.spyOn(h.controller, "submit");
    const commit = vi.spyOn(h.controller, "commit");
    const onComposerAccepted = vi.fn();
    const onSend = vi.fn<InputbarSendHandler>((payload) => {
      getInputbarSendOptions(payload!)?.observer?.onRuntimeAccepted?.(
        acceptedSubmission().receipt,
      );
      return gate.promise;
    });
    renderHarness({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      onSend,
      onComposerAccepted,
    });
    let pending!: ReturnType<NonNullable<typeof latestSend>>;
    await act(async () => {
      pending = latestSend!();
    });
    await h.coordinator.idle();
    expect(submit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledOnce();
    expect(clearPendingImagesMock).toHaveBeenCalledOnce();
    expect(onComposerAccepted).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: "captured from Inputbar" }),
      expect.objectContaining({ kind: "runtime-accepted" }),
    );
    expect(
      onSend.mock.calls[0][0]?.composerDraftCapture?.receipt.submission.text,
    ).toBe("captured from Inputbar");
    await act(async () => {
      gate.resolve({ kind: "unknown" });
      await pending;
    });
    expect(commit).toHaveBeenCalledOnce();
  });

  it("consumes an in-flight old capture after navigation while preserving the new scope", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const onSend = vi.fn<InputbarSendHandler>(() => gate.promise);
    renderHarness({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      onSend,
    });
    let pending!: ReturnType<NonNullable<typeof latestSend>>;
    await act(async () => {
      pending = latestSend!();
    });
    await act(async () => {
      await h.coordinator.bindCommitted(b);
      h.controller.setText("new scope");
    });
    await act(async () => {
      gate.resolve(acceptedSubmission());
      await pending;
      await h.coordinator.idle();
    });
    expect(await h.read(a)).toBeNull();
    expect(h.controller.getDocument().text).toBe("new scope");
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
  });

  it("continues persistence after Inputbar unmount and avoids UI postprocessing", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const onSend = vi.fn<InputbarSendHandler>(() => gate.promise);
    renderHarness({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      onSend,
    });
    let pending!: ReturnType<NonNullable<typeof latestSend>>;
    await act(async () => {
      pending = latestSend!();
    });
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
    await act(async () => {
      gate.resolve(acceptedSubmission());
      await pending;
      await h.coordinator.idle();
    });
    expect(await h.read(a)).toBeNull();
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
  });

  it("uses the root promotion callback before consume, once for the same captured binding", async () => {
    const h = await prepareCoordinator();
    let payloadCapture: ComposerDraftCapture | undefined;
    const promote = vi.fn(
      async (
        capture: ComposerDraftCapture,
        result: AcceptedRuntimeSubmissionResult,
      ) => {
        expect(capture).toBe(payloadCapture);
        await h.coordinator.promote(capture.binding!, local, {
          expectedTarget: null,
          sessionId: result.receipt.sessionId,
          threadId: result.receipt.threadId,
        });
      },
    );
    const actual = acceptedSubmission("s1");
    const onSend = vi.fn<InputbarSendHandler>(async (payload) => {
      payloadCapture = payload?.composerDraftCapture;
      getInputbarSendOptions(payload!)?.observer?.onRuntimeAccepted?.(
        actual.receipt,
      );
      return actual;
    });
    renderHarness({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      onComposerDraftAccepted: promote,
      onSend,
    });
    await send();
    await h.coordinator.idle();
    expect(promote).toHaveBeenCalledOnce();
    expect(h.mutations.map((x) => x.op)).toEqual(["put", "promote", "consume"]);
    expect(await h.read(a)).toBeNull();
    expect(await h.read(local)).toBeNull();
    expect(clearPendingImagesMock).toHaveBeenCalledOnce();
  });
});
