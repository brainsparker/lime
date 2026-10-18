import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import {
  a,
  b,
  harness as coordinatorHarness,
  deferred,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type { RuntimeSubmissionResult } from "../hooks/agentSendResult";
import { getInputbarSendOptions } from "./Inputbar/inputbarSendPayload";
import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { insertComposerSkill } from "../skill-selection/composerCapabilityMention";
import {
  getComposerEditorText,
  setComposerEditorText,
} from "@/components/input-kit/composerEditor.testUtils";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";
import type { Character } from "@/lib/api/projectMemory";
import type { ProjectGitStatus } from "@/lib/api/projectGit";
import type { Skill } from "@/lib/api/skills";
import type { ServiceSkillHomeItem } from "../service-skills/types";
import type { InputCapabilitySelection } from "../skill-selection/inputCapabilitySelection";
import type {
  InputbarSendHandler,
  InputbarSendPayload,
} from "./Inputbar/inputbarSendPayload";
import {
  buildCuratedTaskLaunchPrompt,
  findCuratedTaskTemplateById,
} from "../utils/curatedTaskTemplates";
import { changeLimeLocale } from "@/i18n/createI18n";

const {
  mockGetConfig,
  mockProjectSelector,
  mockReadProjectGitStatus,
  mockCheckoutProjectGitBranch,
  mockCreateProjectGitBranch,
  mockCreateProjectGitWorktree,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn(async () => ({})),
  mockProjectSelector: vi.fn(),
  mockReadProjectGitStatus: vi.fn(
    async (): Promise<ProjectGitStatus> => ({
      rootPath: "/workspace/lime",
      repositoryRoot: undefined,
      hasGitRepository: false,
      currentBranch: undefined,
      branches: [],
      uncommittedFileCount: 0,
    }),
  ),
  mockCheckoutProjectGitBranch: vi.fn(async () => ({
    rootPath: "/workspace/lime",
    repositoryRoot: "/workspace/lime",
    hasGitRepository: true,
    currentBranch: "main",
    branches: ["feature/demo", "main"],
    uncommittedFileCount: 0,
  })),
  mockCreateProjectGitBranch: vi.fn(async () => ({
    rootPath: "/workspace/lime",
    repositoryRoot: "/workspace/lime",
    hasGitRepository: true,
    currentBranch: "feature/new",
    branches: ["feature/demo", "feature/new", "main"],
    uncommittedFileCount: 0,
  })),
  mockCreateProjectGitWorktree: vi.fn(async () => ({
    worktreePath: "/workspace/lime-worktree-test",
    branch: "main",
    status: {
      rootPath: "/workspace/lime-worktree-test",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "abcdef0",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    },
  })),
}));

const mockGetSkillCatalog = vi.hoisted(() =>
  vi.fn(async () => ({
    version: "test",
    tenantId: "tenant-0001",
    syncedAt: "2026-04-30T00:00:00Z",
    groups: [],
    items: [],
    entries: [],
  })),
);

const {
  mockGatewayChannelStatus,
  mockGetBrowserConnectorSettings,
  mockGetChromeBridgeStatus,
} = vi.hoisted(() => ({
  mockGatewayChannelStatus: vi.fn(),
  mockGetBrowserConnectorSettings: vi.fn(),
  mockGetChromeBridgeStatus: vi.fn(),
}));

const mockCharacterMention = vi.fn<
  (props: {
    characters?: Character[];
    skills?: Skill[];
    serviceSkills?: ServiceSkillHomeItem[];
    onSelectSkill?: (skill: Skill) => void;
    onSelectInputCapability?: (
      capability: InputCapabilitySelection,
      options?: { replayText?: string },
    ) => void;
    onSelectServiceSkill?: (skill: ServiceSkillHomeItem) => void;
    defaultCuratedTaskReferenceMemoryIds?: string[];
    defaultCuratedTaskReferenceEntries?: Array<{
      id: string;
      title: string;
      summary: string;
      category: string;
      categoryLabel: string;
      tags: string[];
    }>;
    value: string;
    onChange: (value: string) => void;
  }) => React.ReactNode
>();

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  getConfig: mockGetConfig,
}));

vi.mock("@/lib/api/channelsRuntime", () => ({
  gatewayChannelStatus: mockGatewayChannelStatus,
}));

vi.mock("@/lib/api/skillCatalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/skillCatalog")>();
  return {
    ...actual,
    getSkillCatalog: mockGetSkillCatalog,
    listSkillCatalogSceneEntries: () => [],
    subscribeSkillCatalogChanged: () => () => undefined,
  };
});

vi.mock("@/lib/webview-api", () => ({
  getBrowserConnectorSettings: mockGetBrowserConnectorSettings,
  getChromeBridgeStatus: mockGetChromeBridgeStatus,
}));

vi.mock("@/components/projects/ProjectSelector", () => ({
  ProjectSelector: (props: {
    value: string | null;
    placeholder?: string;
    onChange?: (projectId: string) => void;
  }) => {
    mockProjectSelector(props);
    return (
      <div data-testid="project-selector-stub">
        {props.value ?? props.placeholder ?? "选择项目"}
      </div>
    );
  },
}));

vi.mock("@/lib/api/projectGit", () => ({
  readProjectGitStatus: mockReadProjectGitStatus,
  checkoutProjectGitBranch: mockCheckoutProjectGitBranch,
  createProjectGitBranch: mockCreateProjectGitBranch,
  createProjectGitWorktree: mockCreateProjectGitWorktree,
}));

vi.mock("./ChatModelSelector", () => ({
  ChatModelSelector: () => <div data-testid="chat-model-selector" />,
}));

vi.mock("../utils/promptContext", () => ({
  appendSelectedText: vi.fn((fullPrompt: string) => fullPrompt),
}));

vi.mock("../skill-selection/CharacterMention", () => ({
  CharacterMention: (props: {
    characters?: Character[];
    skills?: Skill[];
    serviceSkills?: ServiceSkillHomeItem[];
    onSelectSkill?: (skill: Skill) => void;
    onSelectInputCapability?: (
      capability: InputCapabilitySelection,
      options?: { replayText?: string },
    ) => void;
    onSelectServiceSkill?: (skill: ServiceSkillHomeItem) => void;
    defaultCuratedTaskReferenceMemoryIds?: string[];
    defaultCuratedTaskReferenceEntries?: Array<{
      id: string;
      title: string;
      summary: string;
      category: string;
      categoryLabel: string;
      tags: string[];
    }>;
    value: string;
    onChange: (value: string) => void;
  }) => {
    mockCharacterMention(props);
    return <div data-testid="character-mention-stub" />;
  },
}));

vi.mock("../skill-selection/SkillSelector", () => ({
  SkillSelector: () => <div data-testid="skill-selector-stub" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    ...rest
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    [key: string]: unknown;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...rest}
    />
  ),
}));

vi.mock("@/components/ui/textarea", () => {
  const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
  >((props, ref) => <textarea ref={ref} {...props} />);
  return { Textarea };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: () => null,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({
    children,
    align: _align,
    side: _side,
    sideOffset: _sideOffset,
    onCloseAutoFocus: _onCloseAutoFocus,
    ...rest
  }: {
    children: React.ReactNode;
    align?: string;
    side?: string;
    sideOffset?: number;
    onCloseAutoFocus?: unknown;
    [key: string]: unknown;
  }) => (
    <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];
const coordinatorInstances: Awaited<ReturnType<typeof coordinatorHarness>>[] =
  [];
async function prepareCoordinator() {
  const h = await coordinatorHarness({ safeInvoke, safeListen });
  coordinatorInstances.push(h);
  await h.coordinator.bindCommitted(a);
  h.controller.setText("EmptyState persistent draft");
  return h;
}
afterEach(async () => {
  for (const h of coordinatorInstances.splice(0)) await h.close();
});

beforeEach(async () => {
  await changeLimeLocale("zh-CN");
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockGetConfig.mockImplementation(async () => ({}));
  mockGatewayChannelStatus.mockResolvedValue({
    status: {
      running_accounts: 0,
    },
  });
  mockGetBrowserConnectorSettings.mockResolvedValue({
    enabled: true,
    system_connectors: [
      {
        connector_type: "chrome",
        available: true,
        authorization_status: "authorized",
      },
    ],
  });
  mockGetChromeBridgeStatus.mockResolvedValue({
    observer_count: 1,
    control_count: 0,
  });
  mockReadProjectGitStatus.mockResolvedValue({
    rootPath: "/workspace/lime",
    repositoryRoot: undefined,
    hasGitRepository: false,
    currentBranch: undefined,
    branches: [],
    uncommittedFileCount: 0,
  });
  mockCheckoutProjectGitBranch.mockResolvedValue({
    rootPath: "/workspace/lime",
    repositoryRoot: "/workspace/lime",
    hasGitRepository: true,
    currentBranch: "main",
    branches: ["feature/demo", "main"],
    uncommittedFileCount: 0,
  });
  mockCreateProjectGitBranch.mockResolvedValue({
    rootPath: "/workspace/lime",
    repositoryRoot: "/workspace/lime",
    hasGitRepository: true,
    currentBranch: "feature/new",
    branches: ["feature/demo", "feature/new", "main"],
    uncommittedFileCount: 0,
  });
  mockCreateProjectGitWorktree.mockResolvedValue({
    worktreePath: "/workspace/lime-worktree-test",
    branch: "main",
    status: {
      rootPath: "/workspace/lime-worktree-test",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "abcdef0",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    },
  });
  window.localStorage.clear();
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) break;
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  window.localStorage.clear();
  vi.clearAllMocks();
});

function renderEmptyState(
  props?: Partial<React.ComponentProps<typeof EmptyState>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: React.ComponentProps<typeof EmptyState> = {
    input: "",
    setInput: vi.fn(),
    onSend: vi.fn<InputbarSendHandler>(async () => acceptedSubmission()),
    providerType: "openai",
    setProviderType: vi.fn(),
    model: "gpt-4.1",
    setModel: vi.fn(),
  };

  act(() => {
    root.render(<EmptyState {...defaultProps} {...props} />);
  });

  mountedRoots.push({ root, container });
  return container;
}

async function flushAsyncEffects(turns = 4): Promise<void> {
  await act(async () => {
    for (let index = 0; index < turns; index += 1) {
      await Promise.resolve();
    }
  });
}

async function waitForProjectContextSelector(
  container: HTMLElement,
  selector: string,
  turns = 12,
): Promise<Element | null> {
  for (let index = 0; index < turns; index += 1) {
    const element = container.querySelector(selector);
    if (element) {
      return element;
    }
    await flushAsyncEffects(1);
  }
  return container.querySelector(selector);
}

function expectEmptyStateSend(
  onSend: ReturnType<typeof vi.fn>,
  payload: Pick<
    InputbarSendPayload,
    "images" | "textOverride" | "sendOptions"
  > = {},
) {
  const actual = onSend.mock.calls.at(-1)?.[0] as
    | InputbarSendPayload
    | undefined;
  expect(actual).toBeTruthy();
  expect(actual?.images).toEqual(payload.images);
  expect(actual?.textOverride).toEqual(payload.textOverride);
  expect(actual?.composerDraft?.editorDocument?.type).toBe("doc");
  if (actual?.composerSubmission?.text)
    expect(actual.composerSubmission.text).toBe(actual.textOverride);
  else expect(actual?.composerSubmission?.textElements).toEqual([]);
  expect(actual?.sendOptions?.inputRestoreDraft).toEqual({
    ...actual?.composerDraft,
    images: actual?.composerDraft?.attachments,
  });
  if (payload.sendOptions && "asymmetricMatch" in payload.sendOptions) {
    expect(actual?.sendOptions).toEqual(payload.sendOptions);
  } else {
    const { inputRestoreDraft: _actualRestore, ...actualOptions } =
      actual?.sendOptions ?? {};
    const { inputRestoreDraft: expectedRestore, ...expectedOptions } =
      payload.sendOptions ?? {};
    if (expectedRestore)
      expect(actual?.sendOptions?.inputRestoreDraft).toMatchObject(
        expectedRestore,
      );
    expect(actualOptions).toEqual(expectedOptions);
  }
}

function updateFieldValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null,
  value: string,
) {
  expect(element).toBeTruthy();
  if (!element) {
    return;
  }

  if (element.matches('[data-testid="composer-editor"]')) {
    setComposerEditorText(element, value);
    return;
  }
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function createRepositoryResearchServiceSkill(): ServiceSkillHomeItem {
  return {
    id: "repository-research",
    title: "仓库线索研究",
    summary: "围绕仓库主题整理项目线索。",
    category: "情报研究",
    outputHint: "仓库列表 + 关键线索",
    source: "cloud_catalog",
    runnerType: "instant",
    defaultExecutorBinding: "agent_turn",
    executionLocation: "client_default",
    version: "seed-v1",
    badge: "云目录",
    recentUsedAt: null,
    isRecent: false,
    runnerLabel: "先做这一轮",
    runnerTone: "emerald",
    runnerDescription: "先在当前工作区整理一版仓库研究结果。",
    actionLabel: "补齐这一步",
    automationStatus: null,
    slotSchema: [
      {
        key: "repository_query",
        label: "检索主题",
        type: "text",
        required: true,
        placeholder: "例如 AI Agent",
      },
    ],
  };
}

function createSceneBoundServiceSkill(): ServiceSkillHomeItem {
  return {
    id: "project-insight-flow",
    title: "项目线索整理",
    summary: "围绕当前项目整理线索、结论和下一步动作。",
    category: "研究与方案",
    outputHint: "线索清单 + 下一步建议",
    source: "cloud_catalog",
    runnerType: "instant",
    defaultExecutorBinding: "agent_turn",
    executionLocation: "client_default",
    version: "seed-v1",
    badge: "云目录",
    recentUsedAt: null,
    isRecent: false,
    runnerLabel: "立即开始",
    runnerTone: "emerald",
    runnerDescription: "围绕当前项目继续整理线索和结果。",
    actionLabel: "继续整理",
    automationStatus: null,
    slotSchema: [],
    sceneBinding: {
      sceneKey: "project-insight-flow",
      commandPrefix: "/project-insight-flow",
      title: "项目线索整理",
      summary: "围绕当前项目整理线索和下一步动作。",
    },
  };
}

describe("EmptyState", () => {
  it("首页只保留 Banner 与统一输入区，旧任务目录不再挂载", async () => {
    const container = renderEmptyState({ projectId: "lime" });
    await flushAsyncEffects();
    const page = container.querySelector('[data-testid="home-composer-page"]');
    expect(page).toBeTruthy();
    expect(
      page?.querySelectorAll('[data-testid="composer-editor"]'),
    ).toHaveLength(1);
    expect(
      page?.querySelector('[data-testid="dream-blossom-home-artwork"]'),
    ).toBeTruthy();
    for (const selector of [
      '[data-testid="home-ambient-suggestions"]',
      '[data-testid="home-starter-chips"]',
      '[data-testid="home-more-skills-trigger"]',
      '[data-testid="home-guide-help-trigger"]',
      '[data-testid="entry-recent-session-resume"]',
    ])
      expect(container.querySelector(selector)).toBeNull();
  });

  it("从当前 capability route 带入的模板仍发送结构化引用，失败保留输入", async () => {
    const template = findCuratedTaskTemplateById("daily-trend-briefing")!;
    const launchInputValues = {
      theme_target: "AI 内容创作",
      platform_region: "X",
    };
    const prompt = buildCuratedTaskLaunchPrompt({
      task: template,
      inputValues: launchInputValues,
    });
    const referenceEntries = [
      {
        id: "memory-1",
        title: "品牌风格",
        summary: "简洁",
        category: "context",
        categoryLabel: "参考",
        sourceKind: "memory" as const,
        tags: [],
      },
    ];
    const capabilityRoute = {
      kind: "curated_task" as const,
      taskId: template.id,
      taskTitle: template.title,
      prompt,
      launchInputValues,
      referenceMemoryIds: ["memory-1"],
      referenceEntries,
    };
    const onSend = vi.fn<InputbarSendHandler>(async () => {
      throw new Error("offline");
    });
    const controller = new ComposerController({ text: prompt });
    const container = renderEmptyState({
      input: prompt,
      composerController: controller,
      onSend,
      initialInputCapability: { capabilityRoute },
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    expectEmptyStateSend(onSend, {
      textOverride: prompt,
      sendOptions: expect.objectContaining({
        capabilityRoute: expect.objectContaining(capabilityRoute),
        requestMetadata: expect.objectContaining({
          harness: expect.objectContaining({
            curated_task: expect.objectContaining({
              task_id: template.id,
              reference_memory_ids: ["memory-1"],
              launch_input_values: launchInputValues,
            }),
          }),
        }),
      }),
    });
    expect(controller.getDocument().text).toBe(prompt);
  });

  it("首页应以 slogan 作为主视觉并保留创作语义", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("创作");
    expect(container.textContent).toContain("青柠一下，灵感即来");
    expect(
      container.querySelector('[data-testid="empty-state-hero-eyebrow-badge"]')
        ?.textContent,
    ).toBe("创作");
    expect(container.textContent).toContain("说一句目标，Lime 就接着帮你做。");
    expect(container.textContent).not.toContain(
      "文案、图片、视频、搜索和网页任务围绕同一目标持续推进，并沉淀上下文、偏好和做法。",
    );
    expect(container.textContent).not.toContain("通用对话");
    expect(container.textContent).not.toContain("新建任务");
  });

  it("通用首页项目包含 Git 目录时应显示启动模式和分支菜单", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 1,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      onSelectServiceSkill: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);
    await waitForProjectContextSelector(
      container,
      '[data-testid="composer-utility-branch"]',
    );

    const projectContextBar = container.querySelector(
      '[data-testid="composer-utility-bar"]',
    );

    expect(projectContextBar).toBeTruthy();
    expect(
      projectContextBar?.querySelector(
        '[data-testid="composer-utility-mode-menu"]',
      ),
    ).toBeTruthy();
    expect(
      projectContextBar?.querySelector(
        '[data-testid="composer-utility-branch"]',
      ),
    ).toBeTruthy();
    expect(projectContextBar?.textContent).toContain("启动模式");
    expect(projectContextBar?.textContent).toContain("在本地处理");
    expect(projectContextBar?.textContent).toContain("新工作树");
    expect(projectContextBar?.textContent).toContain("未提交：1 个文件");
    expect(projectContextBar?.textContent).toContain("main");
    expect(projectContextBar?.textContent).toContain("feature/demo");
  });

  it("通用首页项目分支菜单应通过后端切换分支", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });
    mockCheckoutProjectGitBranch.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "feature/demo",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      onSelectServiceSkill: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);

    const featureBranch = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("feature/demo"),
    );
    expect(featureBranch).toBeTruthy();

    await act(async () => {
      featureBranch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockCheckoutProjectGitBranch).toHaveBeenCalledWith(
      "/workspace/lime",
      "feature/demo",
    );
    expect(
      container.querySelector('[data-testid="composer-utility-bar"]')
        ?.textContent,
    ).toContain("feature/demo");
  });

  it("通用首页项目分支搜索回车应通过后端创建并检出新分支", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });
    mockCreateProjectGitBranch.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "feature/new",
      branches: ["feature/demo", "feature/new", "main"],
      uncommittedFileCount: 0,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      onSelectServiceSkill: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);

    const branchSearch = container.querySelector(
      'input[placeholder="搜索分支"]',
    ) as HTMLInputElement | null;
    updateFieldValue(branchSearch, "feature/new");

    await act(async () => {
      branchSearch?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        }),
      );
      await Promise.resolve();
    });

    expect(mockCreateProjectGitBranch).toHaveBeenCalledWith(
      "/workspace/lime",
      "feature/new",
    );
    expect(
      container.querySelector('[data-testid="composer-utility-bar"]')
        ?.textContent,
    ).toContain("feature/new");
  });

  it("仅发送路径引用时应使用当前 locale 的兜底 prompt", async () => {
    await changeLimeLocale("en-US");
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      activeTheme: "general",
      input: "",
      onSend,
      pathReferences: [
        {
          id: "path-1",
          path: "/tmp/report.md",
          name: "report.md",
          isDir: false,
          source: "file_manager",
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      'button[aria-label="Send"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "Please review these files or folders.",
      sendOptions: expect.objectContaining({
        requestMetadata: expect.objectContaining({
          path_references: [
            expect.objectContaining({
              path: "/tmp/report.md",
              name: "report.md",
            }),
          ],
        }),
      }),
    });
    const payload = onSend.mock.calls.at(-1)?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(payload?.triggerSource).toBe("button");
    expect(payload?.triggeredAt).toEqual(expect.any(Number));
  });

  it("启用 pointerdown 发送时首页发送按钮不应在 click 重复发送", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_780_000_200_000);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      activeTheme: "general",
      input: "你好",
      onSend,
      sendOnPointerDown: true,
    });

    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      '[data-testid="send-btn"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      sendButton?.click();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expectEmptyStateSend(onSend, {
      textOverride: "你好",
    });
    const payload = onSend.mock.calls.at(-1)?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(payload?.triggerSource).toBe("button");
    expect(payload?.triggeredAt).toBe(1_780_000_200_000);
    nowSpy.mockRestore();
  });

  it("从 Skills 页带回的技能应显示在首页输入框内的 @ 标签", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill = {
      key: "local:writer",
      name: "写作助手",
      description: "本地补充技能",
      directory: "writer",
      installed: true,
      sourceKind: "other",
    } as Skill;
    const container = renderEmptyState({
      activeTheme: "general",
      input: "整理最近发布计划",
      onSend,
      skills: [skill],
      initialInputCapability: {
        capabilityRoute: {
          kind: "installed_skill",
          skillKey: skill.key,
          skillName: skill.name,
        },
        requestKey: 20260512,
      },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const badge = container.querySelector('[data-composer-token="skill"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain("/local:writer");
    expect(badge?.getAttribute("data-composer-name")).toBe("写作助手");

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "整理最近发布计划 /local:writer",
      sendOptions: {
        capabilityRoute: {
          kind: "installed_skill",
          skillKey: "writer",
          skillName: "写作助手",
        },
        displayContent: "整理最近发布计划 /local:writer",
      },
    });
  });

  it("首页中断恢复请求应由 EmptyState 完整恢复文本、图片、路径和技能 route", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const onInputRestoreRequestHandled = vi.fn();
    const pathReference = {
      id: "file:/tmp/report.md",
      path: "/tmp/report.md",
      name: "report.md",
      isDir: false,
      source: "file_manager" as const,
    };
    const image = {
      data: "image-data",
      mediaType: "image/png",
    };
    const capabilityRoute = {
      kind: "installed_skill" as const,
      skillKey: "draft",
      skillName: "起草",
    };
    const skill = {
      key: "local:draft",
      name: "起草",
      description: "恢复输入用技能",
      directory: "draft",
      installed: true,
      sourceKind: "other",
    } as Skill;
    const draftController = new ComposerController({
      text: "继续生成提纲",
      attachments: [image],
      pathReferences: [pathReference],
      inputCapabilityRoute: capabilityRoute,
    });
    insertComposerSkill(draftController, skill);
    const originalDraft = draftController.captureDraft();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });

    function RestoreHarness() {
      const [input, setInput] = React.useState("");
      const [pathReferences, setPathReferences] = React.useState<
        (typeof pathReference)[]
      >([]);
      const [restoreRequest, setRestoreRequest] = React.useState<
        React.ComponentProps<typeof EmptyState>["inputRestoreRequest"]
      >({
        requestId: "restore-empty-state-1",
        reason: "output_free_interrupted_turn",
        draft: {
          ...originalDraft,
          images: [image],
          pathReferences: [pathReference],
          inputCapabilityRoute: capabilityRoute,
        },
      });

      return (
        <EmptyState
          input={input}
          setInput={setInput}
          onSend={onSend}
          providerType="openai"
          setProviderType={vi.fn()}
          model="gpt-4.1"
          setModel={vi.fn()}
          activeTheme="general"
          skills={[skill]}
          pathReferences={pathReferences}
          onClearPathReferences={() => setPathReferences([])}
          onAddPathReferences={(references) =>
            setPathReferences(references as (typeof pathReference)[])
          }
          inputRestoreRequest={restoreRequest}
          onInputRestoreRequestHandled={(requestId) => {
            onInputRestoreRequestHandled(requestId);
            setRestoreRequest(null);
          }}
        />
      );
    }

    await act(async () => {
      root.render(<RestoreHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushAsyncEffects();

    expect(
      getComposerEditorText(
        container.querySelector<HTMLElement>(
          '[data-testid="composer-editor"][role="textbox"]',
        ),
      ),
    ).toBe(originalDraft.text);
    expect(
      container.querySelector('[data-composer-token="skill"]'),
    ).toBeTruthy();
    expect(onInputRestoreRequestHandled).toHaveBeenCalledWith(
      "restore-empty-state-1",
    );

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      images: [image],
      textOverride: originalDraft.text,
      sendOptions: expect.objectContaining({
        capabilityRoute,
        inputRestoreDraft: expect.objectContaining({
          ...originalDraft,
          images: [image],
          pathReferences: [pathReference],
          inputCapabilityRoute: capabilityRoute,
        }),
      }),
    });
  });

  it("无浏览器入口且无可续接动作时，不应默认渲染补充续接条", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="entry-supplemental-panel"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="entry-connect-browser"]'),
    ).toBeNull();
  });

  it("只有未形成直接收益的方法目录时，不应默认渲染补充续接条", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      serviceSkills: [createSceneBoundServiceSkill()],
      onSelectServiceSkill: vi.fn(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="entry-supplemental-panel"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="entry-connect-browser"]'),
    ).toBeNull();
  });

  it("runtime tool surface 告警不应再透传到首页空态输入区", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      subagentEnabled: true,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector(
        '[data-testid="empty-state-runtime-tool-warning"]',
      ),
    ).toBeNull();
    expect(container.textContent).not.toContain("当前 runtime tool surface");
    expect(container.textContent).not.toContain("联网搜索偏好本轮可能不会生效");
    expect(container.textContent).not.toContain(
      "Subagents 本轮可能不会完全生效",
    );
  });

  it("首页主体不再重复展示项目选择器入口", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      projectId: "project-brand",
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="project-selector-stub"]'),
    ).toBeNull();
    expect(mockProjectSelector).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="home-composer-page"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid^="entry-project-continuation-"]'),
    ).toBeNull();
  });

  it("通用首页不应把浏览器连接提前放到首屏补充入口", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="home-supplemental-actions"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="entry-connect-browser"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("连接浏览器");
    expect(container.textContent).not.toContain(
      "需要网页登录时，也可以先把浏览器接上。",
    );
    expect(
      container.querySelector('[data-testid="entry-capability-toggle"]'),
    ).toBeNull();
  });

  it("浏览器接入不再通过首屏补充入口直接触发", async () => {
    const onLaunchBrowserAssist = vi.fn();
    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist,
    });

    await act(async () => {
      await Promise.resolve();
    });

    const mediaButton = container.querySelector(
      '[data-testid="entry-connect-browser"]',
    ) as HTMLButtonElement | null;
    expect(mediaButton).toBeNull();

    expect(onLaunchBrowserAssist).not.toHaveBeenCalled();
  });

  it("应挂载 CharacterMention，并透传角色与技能", async () => {
    const characters: Character[] = [
      {
        id: "char-1",
        project_id: "project-1",
        name: "角色A",
        aliases: [],
        relationships: [],
        is_main: true,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const skills: Skill[] = [
      {
        key: "skill-1",
        name: "技能A",
        description: "desc",
        directory: "skill-a",
        installed: true,
        sourceKind: "builtin",
      },
    ];
    const setInput = vi.fn<(value: string) => void>();
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());

    const container = renderEmptyState({
      input: "@",
      setInput,
      onSend,
      characters,
      skills,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const mention = container.querySelector(
      '[data-testid="character-mention-stub"]',
    );
    expect(mention).toBeTruthy();
    expect(mockCharacterMention.mock.calls.length).toBeGreaterThan(0);
    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];
    expect(latestCall.characters).toEqual(characters);
    expect(latestCall.skills).toEqual(skills);

    act(() => {
      latestCall.onChange("@技能A");
    });

    expect(setInput).toHaveBeenCalledWith("@技能A");

    const sendButton = container.querySelector(
      'button[title="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton?.disabled).toBe(false);

    act(() => {
      sendButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expectEmptyStateSend(onSend, {
      textOverride: "@技能A",
    });
    const payload = onSend.mock.calls.at(-1)?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(payload?.composerTarget).toBe("start");
    expect(payload?.composerDraft?.text).toBe("@技能A");
  });

  it("应把服务型技能与选择回调透传给 CharacterMention", async () => {
    const serviceSkills: ServiceSkillHomeItem[] = [
      {
        id: "daily-trend-briefing",
        title: "每日趋势摘要",
        summary: "围绕指定平台与关键词输出趋势摘要。",
        entryHint: "把平台和关键词给我，我先整理一份趋势报告。",
        aliases: ["趋势报告"],
        category: "内容运营",
        outputHint: "趋势摘要 + 调度建议",
        source: "cloud_catalog",
        runnerType: "scheduled",
        defaultExecutorBinding: "automation_job",
        executionLocation: "client_default",
        slotSchema: [],
        surfaceScopes: ["home", "mention", "workspace"],
        promptTemplateKey: "trend_briefing",
        version: "seed-v1",
        badge: "云目录",
        recentUsedAt: null,
        isRecent: false,
        runnerLabel: "本地计划任务",
        runnerTone: "sky",
        runnerDescription:
          "当前先进入工作区生成首版任务方案，后续再接本地自动化。",
        actionLabel: "先做方案",
        automationStatus: null,
      },
    ];
    const onSelectServiceSkill = vi.fn<(skill: ServiceSkillHomeItem) => void>();

    renderEmptyState({
      input: "@",
      serviceSkills,
      onSelectServiceSkill,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];
    expect(latestCall.serviceSkills).toEqual(serviceSkills);
    expect(typeof latestCall.onSelectInputCapability).toBe("function");

    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "service_skill",
        skill: serviceSkills[0]!,
      });
    });

    expect(onSelectServiceSkill).toHaveBeenCalledWith(serviceSkills[0]!);
  });

  it("首页安装技能选择应走统一 capability 回调，且发送后清除激活态", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill: Skill = {
      key: "canvas-design",
      name: "canvas-design",
      description: "desc",
      directory: "canvas-design",
      installed: true,
      sourceKind: "builtin",
    };

    const container = renderEmptyState({
      input: "帮我设计封面",
      onSend,
      skills: [skill],
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];
    expect(typeof latestCall.onSelectInputCapability).toBe("function");

    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "installed_skill",
        skill,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("canvas-design");
    expect(container.textContent).not.toContain("已挂载 canvas-design");

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });
    expectEmptyStateSend(onSend, {
      textOverride: "帮我设计封面 /canvas-design",
      sendOptions: {
        capabilityRoute: {
          kind: "installed_skill",
          skillKey: "canvas-design",
          skillName: "canvas-design",
        },
        displayContent: "帮我设计封面 /canvas-design",
      },
    });

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      updateFieldValue(
        container.querySelector<HTMLElement>(
          '[data-testid="composer-editor"][role="textbox"]',
        ),
        "帮我设计封面",
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sendButtonAfterCapabilityCleared = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButtonAfterCapabilityCleared).toBeTruthy();

    act(() => {
      sendButtonAfterCapabilityCleared?.click();
    });
    const secondPayload = onSend.mock.calls[1]?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(secondPayload).toMatchObject({
      textOverride: "帮我设计封面",
    });
    expect(secondPayload?.images).toBeUndefined();
    expect(secondPayload?.sendOptions?.capabilityRoute).toBeUndefined();
    expect(secondPayload?.composerSubmission?.inputMentions).toEqual([]);
    expect(
      secondPayload?.sendOptions?.inputRestoreDraft?.editorDocument?.type,
    ).toBe("doc");
  });

  it("首页选择 builtin command 后发送应透传结构化 capability route", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const command = {
      key: "image-compose",
      label: "配图",
      mentionLabel: "配图",
      commandPrefix: "@配图",
      description: "输出配图方向。",
      aliases: [],
    };
    const container = renderEmptyState({
      input: "帮我整理这篇文章的配图方向",
      onSend,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];

    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "builtin_command",
        command,
      });
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "帮我整理这篇文章的配图方向",
      sendOptions: {
        capabilityRoute: {
          kind: "builtin_command",
          commandKey: "image-compose",
          commandPrefix: "@配图",
        },
        displayContent: "帮我整理这篇文章的配图方向",
      },
    });
  });

  it("首页选择 @资料 兼容入口时应打开资料中枢而不是普通命令标签", async () => {
    const onToggleKnowledgePack = vi.fn<(enabled: boolean) => void>();
    const onStartKnowledgeOrganize = vi.fn();
    const command = {
      key: "knowledge_pack",
      label: "资料",
      mentionLabel: "资料",
      commandPrefix: "@资料",
      description: "查看、添加、选择或使用当前项目资料。",
      aliases: [],
    };
    const container = renderEmptyState({
      input: "按项目资料写一版介绍",
      knowledgePackSelection: {
        enabled: false,
        packName: "team-notes",
        workingDir: "workspace-root",
        label: "团队资料",
        status: "ready",
      },
      knowledgePackOptions: [
        {
          packName: "team-notes",
          label: "团队资料",
          status: "ready",
          defaultForWorkspace: true,
        },
      ],
      onToggleKnowledgePack,
      onSelectKnowledgePack: vi.fn(),
      onStartKnowledgeOrganize,
      onManageKnowledgePacks: vi.fn(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];

    await act(async () => {
      latestCall.onSelectInputCapability?.({
        kind: "builtin_command",
        command,
      });
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="inputbar-builtin-command-badge"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="inputbar-knowledge-hub"]'),
    ).toBeTruthy();
    expect(container.textContent).toContain("团队资料");
    expect(container.textContent).toContain("使用这份资料");

    const useKnowledgeButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("使用这份资料"));

    act(() => {
      useKnowledgeButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onToggleKnowledgePack).toHaveBeenCalledWith(true);
    expect(onStartKnowledgeOrganize).not.toHaveBeenCalled();
  });

  it("首页启用项目资料后发送应携带资料引用 metadata", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "按项目资料写一版介绍",
      onSend,
      knowledgePackSelection: {
        enabled: true,
        packName: "team-notes",
        workingDir: "workspace-root",
        label: "团队资料",
        status: "ready",
      },
      knowledgePackOptions: [
        {
          packName: "team-notes",
          label: "团队资料",
          status: "ready",
          defaultForWorkspace: true,
        },
      ],
      onToggleKnowledgePack: vi.fn(),
      onSelectKnowledgePack: vi.fn(),
      onStartKnowledgeOrganize: vi.fn(),
      onManageKnowledgePacks: vi.fn(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "按项目资料写一版介绍",
      sendOptions: {
        requestMetadata: {
          knowledge_pack: {
            pack_name: "team-notes",
            working_dir: "workspace-root",
            source: "inputbar",
          },
        },
      },
    });
  });

  it("当前带入 Skill 草稿时，首页应显影更明确的连续性横幅", async () => {
    const container = renderEmptyState({
      creationReplaySurface: {
        kind: "skill_scaffold",
        eyebrow: "当前带入 Skill 草稿",
        badgeLabel: "Skill 草稿",
        title: "账号复盘方法",
        summary: "把结果复盘成下一轮增长方案。",
        hint: "这轮会先沿着这份 Skill 草稿继续生成，跑顺后可回到 Skills 继续整理。",
        defaultReferenceMemoryIds: [],
        defaultReferenceEntries: [],
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Skill 草稿");
    expect(container.textContent).toContain("账号复盘方法");
    expect(container.textContent).not.toContain("沿着当前上下文继续");
    expect(container.textContent).not.toContain("先沿着当前做法开工");
  });

  it("首页不再显式暴露做法数量文案", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      skills: [
        {
          key: "writer",
          name: "写作助手",
          description: "desc",
          directory: "writer",
          installed: true,
          sourceKind: "builtin",
        },
      ],
      serviceSkills: [
        {
          id: "trend-briefing",
          title: "趋势情报",
          summary: "输出趋势摘要",
          category: "研究",
          outputHint: "摘要",
          source: "cloud_catalog",
          runnerType: "instant",
          defaultExecutorBinding: "agent_turn",
          executionLocation: "client_default",
          slotSchema: [],
          version: "seed-v1",
          badge: "云目录",
          recentUsedAt: null,
          isRecent: false,
          runnerLabel: "先做这一轮",
          runnerTone: "emerald",
          runnerDescription: "先在当前工作区完成情报任务。",
          actionLabel: "开始执行",
          automationStatus: null,
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("2 套做法可直接复用");
    expect(container.textContent).not.toContain("按需挂上常用做法");
  });

  it("通用对话存在 current service skill 时仍应展示稳定占位文案", async () => {
    const container = renderEmptyState({
      serviceSkills: [createRepositoryResearchServiceSkill()],
    });

    await act(async () => {
      await Promise.resolve();
    });

    const textarea = container.querySelector<HTMLElement>(
      '[data-testid="composer-editor"][role="textbox"]',
    );
    expect(textarea?.getAttribute("data-placeholder")).toBe(
      "先说这轮要做什么，目标、对象或限制都可以。",
    );
  });

  it("通用对话默认不展示 Tab 起手建议", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
      serviceSkills: [],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-testid="home-input-tab-suggestion"]'),
    ).toBeNull();
  });

  it("高级设置不再渲染联网搜索前置开关", async () => {
    const container = renderEmptyState({ activeTheme: "general" });
    await act(async () => {
      await Promise.resolve();
    });

    const plusTrigger = container.querySelector(
      '[data-testid="inputbar-plus-trigger"]',
    ) as HTMLButtonElement | null;
    expect(plusTrigger).toBeTruthy();
    const globeToggle = container.querySelector(
      'button[title="联网搜索已关闭"]',
    ) as HTMLButtonElement | null;
    expect(globeToggle).toBeNull();

    act(() => {
      plusTrigger?.click();
    });

    const expandedGlobeToggle = container.querySelector(
      'button[title="联网搜索已关闭"]',
    ) as HTMLButtonElement | null;
    expect(expandedGlobeToggle).toBeNull();
  });

  it("通用主题默认只保留最小主路径，展开高级设置后才显示进阶控制", async () => {
    const onSubagentEnabledChange = vi.fn<(enabled: boolean) => void>();
    const setAccessMode =
      vi.fn<(mode: "read-only" | "current" | "full-access") => void>();
    const container = renderEmptyState({
      activeTheme: "general",
      subagentEnabled: false,
      onSubagentEnabledChange,
      accessMode: "current",
      setAccessMode,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const attachButton = container.querySelector(
      'button[title="添加图片"]',
    ) as HTMLButtonElement | null;
    expect(attachButton).toBeTruthy();

    const plusTrigger = container.querySelector(
      '[data-testid="inputbar-plus-trigger"]',
    ) as HTMLButtonElement | null;
    expect(plusTrigger).toBeTruthy();

    expect(
      container.querySelector('button[title="深度思考已关闭"]'),
    ).toBeNull();
    expect(
      container.querySelector('button[title="联网搜索已关闭"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="inputbar-plan-toggle"]'),
    ).toBeNull();
    expect(
      container.querySelector('button[title="Subagents 已关闭"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="inputbar-access-mode-select"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="chat-model-selector"]'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("通用任务上下文");
    expect(container.textContent).not.toContain("当前模型");

    act(() => {
      plusTrigger?.click();
    });

    const thinkingButton = container.querySelector(
      'button[title="深度思考已关闭"]',
    ) as HTMLButtonElement | null;
    expect(thinkingButton).toBeNull();
    const globeButton = container.querySelector(
      'button[title="联网搜索已关闭"]',
    ) as HTMLButtonElement | null;
    expect(globeButton).toBeNull();
    const planButton = container.querySelector(
      '[data-testid="inputbar-plan-toggle"]',
    ) as HTMLButtonElement | null;
    expect(planButton).toBeNull();
    const subagentButton = document.body.querySelector(
      '[data-testid="inputbar-plus-subagent-mode"]',
    ) as HTMLButtonElement | null;
    expect(subagentButton).toBeTruthy();
    const accessModeSelect = container.querySelector(
      '[data-testid="inputbar-access-mode-select"]',
    ) as HTMLSelectElement | null;
    expect(accessModeSelect).toBeTruthy();
    expect(
      container.querySelector('[data-testid="chat-model-selector"]'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("通用任务上下文");

    act(() => {
      subagentButton?.click();
    });
    act(() => {
      accessModeSelect!.value = "full-access";
      accessModeSelect?.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSubagentEnabledChange).toHaveBeenCalledWith(true);
    expect(setAccessMode).toHaveBeenCalledWith("full-access");
  });

  it("首页默认不再把执行模式和联网状态作为 hero 徽标暴露", async () => {
    const container = renderEmptyState({
      activeTheme: "general",
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("编排模式已开启");
    expect(container.textContent).not.toContain("联网搜索已开启");
    expect(
      container.querySelector('[data-testid="home-composer-page"]'),
    ).toBeTruthy();
  });

  it("通用首页发送时不应自动注入任何历史默认 skill", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "请输出一篇新品发布文案",
      activeTheme: "general",
      onSend,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "请输出一篇新品发布文案",
    });
  });

  it("首页开启 plan 和 goal 后发送应绑定当前 thread goal", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "请先规划再持续推进这个任务",
      activeTheme: "general",
      sessionId: "thread-empty-state-plan-goal",
      taskEnabled: true,
      onSend,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const plusTrigger = container.querySelector(
      '[data-testid="inputbar-plus-trigger"]',
    ) as HTMLButtonElement | null;
    expect(plusTrigger).toBeTruthy();

    act(() => {
      plusTrigger?.click();
    });

    const objectiveButton = document.body.querySelector(
      '[data-testid="inputbar-plus-objective"]',
    ) as HTMLButtonElement | null;
    expect(objectiveButton).toBeTruthy();

    act(() => {
      objectiveButton?.click();
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "请先规划再持续推进这个任务",
      sendOptions: expect.objectContaining({
        collaborationMode: "plan",
        threadGoal: { objective: "请先规划再持续推进这个任务" },
        toolPreferencesOverride: {
          task: true,
          subagent: false,
        },
      }),
    });
  });

  it("即使存在历史配置字段，通用首页也不再自动注入默认 skill", async () => {
    mockGetConfig.mockImplementation(async () => ({
      chat_appearance: {},
    }));

    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "请输出一篇用户访谈纪要",
      activeTheme: "general",
      onSend,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "请输出一篇用户访谈纪要",
    });
  });

  it("首页手动选择安装技能后发送时仍应优先使用 capability route", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill: Skill = {
      key: "custom-writing-skill",
      name: "custom-writing-skill",
      description: "desc",
      directory: "custom-writing-skill",
      installed: true,
      sourceKind: "builtin",
    };

    const container = renderEmptyState({
      input: "请输出一篇品牌故事",
      activeTheme: "general",
      onSend,
      skills: [skill],
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];
    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "installed_skill",
        skill,
      });
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "请输出一篇品牌故事 /custom-writing-skill",
      sendOptions: {
        capabilityRoute: {
          kind: "installed_skill",
          skillKey: "custom-writing-skill",
          skillName: "custom-writing-skill",
        },
        displayContent: "请输出一篇品牌故事 /custom-writing-skill",
      },
    });
  });

  it("首页先选 capability 再切到服务技能入口时，不应继续残留旧 capability route", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const onSelectServiceSkill = vi.fn<(skill: ServiceSkillHomeItem) => void>();
    const installedSkill: Skill = {
      key: "canvas-design",
      name: "canvas-design",
      description: "desc",
      directory: "canvas-design",
      installed: true,
      sourceKind: "builtin",
    };
    const serviceSkill = createRepositoryResearchServiceSkill();

    const container = renderEmptyState({
      input: "整理最近发布计划",
      onSend,
      skills: [installedSkill],
      serviceSkills: [serviceSkill],
      onSelectServiceSkill,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const latestCall =
      mockCharacterMention.mock.calls[
        mockCharacterMention.mock.calls.length - 1
      ][0];

    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "installed_skill",
        skill: installedSkill,
      });
    });

    act(() => {
      latestCall.onSelectInputCapability?.({
        kind: "service_skill",
        skill: serviceSkill,
      });
    });

    expect(onSelectServiceSkill).toHaveBeenCalledWith(serviceSkill);

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "整理最近发布计划 /canvas-design",
    });
  });

  it("通用主题不应在首屏直接展示浏览器协助入口", async () => {
    const onLaunchBrowserAssist = vi.fn();
    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const launchButton = container.querySelector(
      '[data-testid="entry-connect-browser"]',
    ) as HTMLButtonElement | null;
    expect(launchButton).toBeNull();

    expect(onLaunchBrowserAssist).not.toHaveBeenCalled();
  });
  it.each([
    { kind: "unknown" as const },
    { kind: "local-handled" as const },
    { kind: "rejected" as const },
  ])("preserves draft for %j", async (result) => {
    const controller = new ComposerController({ text: "保留首页富草稿😀" });
    const onSend = vi.fn<InputbarSendHandler>(async () => result);
    const setInput = vi.fn();
    const container = renderEmptyState({
      input: controller.getDocument().text,
      composerController: controller,
      onSend,
      setInput,
      activeTheme: "general",
    });
    await flushAsyncEffects();
    const before = controller.captureDraft();
    const button = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(controller.captureDraft()).toEqual(before);
    expect(setInput).not.toHaveBeenCalledWith("");
  });
  it("starts real consume from the early observer while final send completion is pending", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const commit = vi.spyOn(h.controller, "commit");
    const setInput = vi.fn();
    const onSend = vi.fn<InputbarSendHandler>((payload) => {
      getInputbarSendOptions(payload!)?.observer?.onRuntimeAccepted?.(
        acceptedSubmission().receipt,
      );
      return gate.promise;
    });
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      setInput,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await h.coordinator.idle();
    });
    expect(onSend).toHaveBeenCalledOnce();
    expect(
      onSend.mock.calls[0][0]?.composerDraftCapture?.receipt.submission.text,
    ).toBe("EmptyState persistent draft");
    expect(commit).toHaveBeenCalledOnce();
    expect(setInput).toHaveBeenCalledWith("");
    await act(async () => {
      gate.resolve({ kind: "unknown" });
      await Promise.resolve();
    });
    expect(commit).toHaveBeenCalledOnce();
  });

  it("settles old capture after navigating and unmounting without clearing the new document", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<RuntimeSubmissionResult>();
    const setInput = vi.fn();
    const onSend = vi.fn<InputbarSendHandler>(() => gate.promise);
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      setInput,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await h.coordinator.bindCommitted(b);
      h.controller.setText("new target draft");
    });
    const mounted = mountedRoots.pop()!;
    act(() => mounted.root.unmount());
    mounted.container.remove();
    setInput.mockClear();
    await act(async () => {
      gate.resolve(acceptedSubmission());
      await Promise.resolve();
      await h.coordinator.idle();
    });
    expect(await h.read(a)).toBeNull();
    expect(h.controller.getDocument().text).toBe("new target draft");
    expect(setInput).not.toHaveBeenCalledWith("");
  });

  it("rejects persistent restore without the original capture token", async () => {
    const h = await prepareCoordinator();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      inputRestoreRequest: {
        requestId: "old",
        reason: "output_free_interrupted_turn",
        draft: { text: "stale other scope" },
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
    expect(handled).toHaveBeenCalledWith("old");
  });

  it("restores the accepted draft with a matching original token after consume", async () => {
    const h = await prepareCoordinator();
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await h.coordinator.idle();
    });
    const payload = onSend.mock.calls[0][0]!;
    expect(h.controller.getDocument().text).toBe("");
    const first = mountedRoots.pop()!;
    act(() => first.root.unmount());
    first.container.remove();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: "",
      inputRestoreRequest: {
        requestId: "same",
        reason: "output_free_interrupted_turn",
        draft: payload.sendOptions!.inputRestoreDraft!,
        composerRestoreToken: payload.composerRestoreToken,
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
    expect(handled).toHaveBeenCalledWith("same");
  });
  it("defers an early stop restore until the same token finishes consuming", async () => {
    const h = await prepareCoordinator();
    const gate = deferred<unknown>();
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op: string }).op === "consume"
        ? gate.promise.then(execute)
        : execute(),
    );
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      onSend,
    });
    await flushAsyncEffects();
    await act(async () => {
      (
        container.querySelector(
          'button[aria-label="发送"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });
    const payload = onSend.mock.calls[0][0]!;
    const first = mountedRoots.pop()!;
    act(() => first.root.unmount());
    first.container.remove();
    const handled = vi.fn();
    renderEmptyState({
      composerController: h.controller,
      composerDraftCoordinator: h.coordinator,
      input: h.controller.getDocument().text,
      inputRestoreRequest: {
        requestId: "early",
        reason: "output_free_interrupted_turn",
        draft: payload.sendOptions!.inputRestoreDraft!,
        composerRestoreToken: payload.composerRestoreToken,
      },
      onInputRestoreRequestHandled: handled,
    });
    await flushAsyncEffects();
    expect(handled).not.toHaveBeenCalled();
    await act(async () => {
      gate.resolve(null);
      await h.coordinator.idle();
    });
    await flushAsyncEffects();
    expect(handled).toHaveBeenCalledWith("early");
    expect(h.controller.getDocument().text).toBe("EmptyState persistent draft");
  });
});
