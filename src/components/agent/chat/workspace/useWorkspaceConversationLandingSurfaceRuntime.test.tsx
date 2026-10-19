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
    model: "mock-model",
    onDismissEntryBanner: vi.fn(),
    projectId: "project-1",
    providerType: "mock-provider",
    setChatToolPreferences: vi.fn(),
    setInput: vi.fn(),
    setModel: vi.fn(),
    setProviderType: vi.fn(),
    skills: [],
    skillsLoading: false,
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
  it("保留首页 banner 并透传关闭操作", () => {
    const onDismissEntryBanner = vi.fn();
    const { getValue } = renderHook(
      createDefaultProps({
        entryBannerVisible: true,
        entryBannerMessage: "继续上次的内容",
        onDismissEntryBanner,
      }),
    );

    const runtime = getValue();
    expect(runtime.entryBannerVisible).toBe(true);
    expect(runtime.entryBannerMessage).toBe("继续上次的内容");
    runtime.onDismissEntryBanner();
    expect(onDismissEntryBanner).toHaveBeenCalledOnce();
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

  it("本地路径引用与移除操作交给首页附件 owner", () => {
    const reference = {
      id: "file:/workspace/brief.md",
      name: "brief.md",
      path: "/workspace/brief.md",
      isDir: false,
      source: "file_manager" as const,
    };
    const onRemovePathReference = vi.fn();
    const { getValue } = renderHook(
      createDefaultProps({
        pathReferences: [reference],
        onRemovePathReference,
      }),
    );

    const emptyStateProps = getValue().emptyStateProps;
    expect(emptyStateProps.pathReferences).toEqual([reference]);
    emptyStateProps.onRemovePathReference?.(reference.id);
    expect(onRemovePathReference).toHaveBeenCalledWith(reference.id);
  });
});
