import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceConversationLandingSurfaceRuntime } from "./useWorkspaceConversationLandingSurfaceRuntime";

type HookProps = Parameters<
  typeof useWorkspaceConversationLandingSurfaceRuntime
>[0];

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function createDefaultProps(overrides: Partial<HookProps> = {}): HookProps {
  return {
    accessMode: "default",
    activeTheme: "general",
    chatToolPreferences: {
      task: false,
      subagent: false,
    },
    creationReplaySurface: null,
    emptyStateDisabled: false,
    emptyStateIsLoading: false,
    emptyStateSendOnPointerDown: true,
    entryBannerMessage: undefined,
    entryBannerVisible: false,
    handleSendFromEmptyState: vi.fn(),
    input: "",
    inputbarScene: {
      knowledgePackSelection: undefined,
      knowledgePackOptions: [],
      onToggleKnowledgePack: vi.fn(),
      onSelectKnowledgePack: vi.fn(),
      onToggleKnowledgeCompanionPack: vi.fn(),
      onStartKnowledgeOrganize: vi.fn(),
      onManageKnowledgePacks: vi.fn(),
      onImportPathReferenceAsKnowledge: vi.fn(),
    },
    lockTheme: false,
    model: "mock-model",
    onDismissEntryBanner: vi.fn(),
    projectCharacters: [],
    projectId: "project-1",
    providerType: "mock-provider",
    serviceSkillGroups: [],
    serviceSkills: [],
    setActiveTheme: vi.fn(),
    setChatToolPreferences: vi.fn(),
    setInput: vi.fn(),
    setModel: vi.fn(),
    setProviderType: vi.fn(),
    skills: [],
    skillsLoading: false,
    selectedText: "",
    ...overrides,
  };
}

function renderHook(props: HookProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue: ReturnType<
    typeof useWorkspaceConversationLandingSurfaceRuntime
  > | null = null;

  function Probe(currentProps: HookProps) {
    latestValue = useWorkspaceConversationLandingSurfaceRuntime(currentProps);
    return null;
  }

  act(() => {
    root.render(<Probe {...props} />);
  });
  mountedRoots.push({ root, container });

  return {
    getValue: () => {
      if (!latestValue) {
        throw new Error("hook 尚未初始化");
      }
      return latestValue;
    },
  };
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

describe("useWorkspaceConversationLandingSurfaceRuntime", () => {
  it("routes Home skill suggestions to the existing directory owner", () => {
    const onSkillSuggestionsNeeded = vi.fn();
    const { getValue } = renderHook(
      createDefaultProps({ onSkillSuggestionsNeeded }),
    );
    getValue().emptyStateProps.onSkillSuggestionsNeeded?.();
    expect(onSkillSuggestionsNeeded).toHaveBeenCalledOnce();
  });
  it("应集中产出入口 banner、leading card 与空态技能 props", () => {
    const onSelectServiceSkill = vi.fn();
    const serviceSkills = [
      {
        id: "daily-trend-briefing",
        title: "每日趋势摘要",
      },
    ];
    const { getValue } = renderHook(
      createDefaultProps({
        entryBannerVisible: true,
        entryBannerMessage: "继续上次的内容",
        serviceSkills,
        onSelectServiceSkill,
      }),
    );

    const runtime = getValue();
    expect(runtime.entryBannerVisible).toBe(true);
    expect(runtime.entryBannerMessage).toBe("继续上次的内容");
    expect(runtime.emptyStateProps.serviceSkills).toBe(serviceSkills);
    expect(runtime.emptyStateProps.onSelectServiceSkill).toBe(
      onSelectServiceSkill,
    );
  });

  it("空态工具偏好变更应回写 chat tool preferences", () => {
    const setChatToolPreferences = vi.fn();
    const { getValue } = renderHook(
      createDefaultProps({
        setChatToolPreferences,
      }),
    );

    getValue().emptyStateProps.onTaskEnabledChange?.(true);

    expect(setChatToolPreferences).toHaveBeenCalledTimes(1);
    const updater = setChatToolPreferences.mock.calls[0]?.[0] as (
      previous: HookProps["chatToolPreferences"],
    ) => HookProps["chatToolPreferences"];
    expect(
      updater({
        task: false,
        subagent: false,
      }),
    ).toEqual({
      task: true,
      subagent: false,
    });
  });

  it("输入栏知识包与路径导入入口应由 inputbar scene current owner 透传", () => {
    const onSelectKnowledgePack = vi.fn();
    const onImportPathReferenceAsKnowledge = vi.fn();
    const knowledgePackSelection = {
      workingDir: "/tmp/project",
      packName: "品牌资料",
    };
    const knowledgePackOptions = [
      {
        workingDir: "/tmp/project",
        packName: "品牌资料",
      },
    ];
    const { getValue } = renderHook(
      createDefaultProps({
        inputbarScene: {
          ...createDefaultProps().inputbarScene,
          knowledgePackSelection,
          knowledgePackOptions,
          onSelectKnowledgePack,
          onImportPathReferenceAsKnowledge,
        },
      }),
    );

    const emptyStateProps = getValue().emptyStateProps;
    expect(emptyStateProps.knowledgePackSelection).toBe(knowledgePackSelection);
    expect(emptyStateProps.knowledgePackOptions).toBe(knowledgePackOptions);
    expect(emptyStateProps.onSelectKnowledgePack).toBe(onSelectKnowledgePack);
    expect(emptyStateProps.onImportPathReferenceAsKnowledge).toBe(
      onImportPathReferenceAsKnowledge,
    );
  });
});
