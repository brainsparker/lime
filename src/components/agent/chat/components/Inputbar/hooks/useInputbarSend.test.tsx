import React, { useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "@/lib/api/skills";
import type { MessageImage, MessagePathReference } from "../../../types";
import type { InputCapabilitySelection } from "../../../skill-selection/inputCapabilitySelection";
import type {
  InputbarSendHandler,
  InputbarSendTriggerSource,
} from "../inputbarSendPayload";
import { useInputbarSend } from "./useInputbarSend";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { ComposerDraftSnapshot } from "@/components/input-kit";

const { recordAgentUiPerformanceMetricMock } = vi.hoisted(() => ({
  recordAgentUiPerformanceMetricMock: vi.fn(),
}));

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
  isLoading?: boolean;
  onComposerCommitted?: (text: string, draft?: ComposerDraftSnapshot) => void;
}

const mountedRoots: MountedHarness[] = [];
let latestSend:
  | ((metadata?: {
      triggeredAt?: number;
      triggerSource?: InputbarSendTriggerSource;
      submitTarget?: "start" | "queue" | "steer" | "interrupt" | "command";
    }) => Promise<void>)
  | null = null;
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
  isLoading = false,
  onComposerCommitted,
}: HarnessProps) {
  const handleSend = useInputbarSend({
    input,
    pendingImages,
    pathReferences,
    activeCapability,
    knowledgePackSelection: null,
    activeTools,
    projectId,
    sessionId,
    composerController,
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

async function sendWithMetadata(metadata: {
  triggeredAt?: number;
  triggerSource?: InputbarSendTriggerSource;
}) {
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
  afterEach(() => {
    for (const { root, container } of mountedRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    latestSend = null;
    vi.clearAllMocks();
  });

  beforeEach(() => {
    clearPathReferencesMock = vi.fn();
    clearActiveCapabilityMock = vi.fn();
    clearPendingImagesMock = vi.fn();
  });

  it("普通文本发送应显式下传当前输入文本", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    renderHarness({
      input: "继续优化 Skill runtime",
      onSend,
    });

    await send();

    expect(onSend).toHaveBeenCalledWith({
      images: undefined,
      textOverride: "继续优化 Skill runtime",
      sendOptions: undefined,
    });
    expect(clearPendingImagesMock).toHaveBeenCalledTimes(1);
  });

  it("纯文本无附件和模式时应走最小发送快路径", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
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
    const onSend = vi.fn().mockResolvedValue(true);
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
    const onSend = vi.fn().mockResolvedValue(true);
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
    const onSend = vi.fn().mockResolvedValue(true);
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
      inputCapabilityRoute: {
        kind: "installed_skill",
        skillKey: "capability-report",
        skillName: "Capability Report",
      },
    });
    expect(payload?.sendOptions?.inputRestoreDraft?.images).not.toBe(
      pendingImages,
    );
    expect(payload?.sendOptions?.inputRestoreDraft?.pathReferences).not.toBe(
      pathReferences,
    );
  });

  it("同batch发送读取canonical资源和能力，旧React闭包不能回灌", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
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
      kind: "installed_skill" as const,
      skillKey: "latest-report",
      skillName: "最新报告",
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

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
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
          path_references: [expect.objectContaining({ path: "/tmp/latest.md" })],
        }),
      }),
    }));
    expect(clearPendingImagesMock).not.toHaveBeenCalled();
    expect(clearPathReferencesMock).not.toHaveBeenCalled();
  });

  it("旧空props不能拦截只有canonical图片和路径的发送", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const composerController = new ComposerController();
    const image: MessageImage = { data: "image-data", mediaType: "image/png" };
    const reference = createPathReference();
    renderHarness({ composerController, onSend });

    await act(async () => {
      composerController.setAttachments([image]);
      composerController.setPathReferences([reference]);
      await latestSend?.();
    });

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
      images: [image],
      textOverride: "请查看这些文件或文件夹。",
      composerSubmission: expect.objectContaining({
        attachments: [image],
        pathReferences: [reference],
      }),
    }));
  });

  it("canonical能力已清除时不能发送旧React能力", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const composerController = new ComposerController({ text: "普通文本" });
    renderHarness({
      composerController,
      activeCapability: createInstalledSkillSelection(),
      input: "普通文本",
      onSend,
    });

    await send();

    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
      textOverride: "普通文本",
      sendOptions: undefined,
    }));
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
      return true;
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

  it("技能路由和 typed 计划模式不应因显式文本发送丢失", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
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
      images: undefined,
      textOverride: "生成一份能力报告",
      sendOptions: {
        capabilityRoute: {
          kind: "installed_skill",
          skillKey: "capability-report",
          skillName: "Capability Report",
        },
        inputRestoreDraft: {
          text: "生成一份能力报告",
          images: [],
          pathReferences: [],
          textElements: [],
          inputCapabilityRoute: {
            kind: "installed_skill",
            skillKey: "capability-report",
            skillName: "Capability Report",
          },
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
    const onSend = vi.fn().mockResolvedValue(true);
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
    const onSend = vi.fn().mockResolvedValue(false);
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
    const onSend = vi.fn().mockResolvedValue(true);
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
});
