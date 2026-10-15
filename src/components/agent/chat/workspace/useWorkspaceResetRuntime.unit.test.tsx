import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceResetRuntime } from "./useWorkspaceResetRuntime";

type HookProps = Parameters<typeof useWorkspaceResetRuntime>[0];

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function renderHook(props?: Partial<HookProps>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const defaultProps: HookProps = {
    clearMessages: vi.fn(),
    clearPendingEntryA2UI: vi.fn(),
    clearProjectSelectionRuntime: vi.fn(),
    resetProjectSelection: vi.fn(),
    resetRestoredSessionState: vi.fn(),
    resetGuideState: vi.fn(),
    resetComposerDraft: vi.fn(),
    hasHandledNewChatRequest: vi.fn(() => false),
    markNewChatRequestHandled: vi.fn(),
    defaultTopicSidebarVisible: true,
    normalizedInitialTheme: "general",
    initialCreationMode: "guided",
    newChatAt: 123,
    externalProjectId: undefined,
    preserveSessionRestoreOnNewChat: false,
    onNavigate: vi.fn(),
    autoCollapsedTopicSidebarRef: { current: true },
    processedMessageIdsRef: { current: new Set<string>() },
    setInput: vi.fn(),
    setSelectedText: vi.fn(),
    setLayoutMode: vi.fn(),
    setShowSidebar: vi.fn(),
    setCanvasState: vi.fn(),
    setGeneralCanvasState: vi.fn(),
    setTaskFiles: vi.fn(),
    setSelectedFileId: vi.fn(),
    setMentionedCharacters: vi.fn(),
    setActiveTheme: vi.fn(),
    setCreationMode: vi.fn(),
  };
  let runtime!: ReturnType<typeof useWorkspaceResetRuntime>;

  function Probe(currentProps: HookProps) {
    runtime = useWorkspaceResetRuntime(currentProps);
    return null;
  }

  const render = async (nextProps?: Partial<HookProps>) => {
    await act(async () => {
      root.render(<Probe {...defaultProps} {...props} {...nextProps} />);
      await Promise.resolve();
    });
  };

  mountedRoots.push({ root, container });

  return {
    render,
    props: defaultProps,
    current: () => runtime,
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
  vi.restoreAllMocks();
});

describe("useWorkspaceResetRuntime", () => {
  it.each([null, "project-a"])(
    "返回首页仅委托根导航并恢复 workspace %s 的草稿",
    async (workspaceId) => {
      const onStartNewConversation = vi.fn();
      const harness = renderHook({
        newChatAt: undefined,
        composerDraftHomeWorkspaceId: workspaceId,
        onStartNewConversation,
      });
      await harness.render();
      act(() => harness.current().handleBackHome());
      expect(onStartNewConversation).toHaveBeenCalledExactlyOnceWith({
        projectId: workspaceId,
        freshDraft: false,
      });
      expect(harness.props.clearMessages).not.toHaveBeenCalled();
      expect(harness.props.resetComposerDraft).not.toHaveBeenCalled();
      expect(harness.props.setInput).not.toHaveBeenCalled();
      expect(harness.props.onNavigate).not.toHaveBeenCalled();
    },
  );

  it("刷新恢复运行中会话时不应把 newChatAt 当作新任务清空候选", async () => {
    const harness = renderHook({
      preserveSessionRestoreOnNewChat: true,
    });

    await harness.render();

    expect(harness.props.markNewChatRequestHandled).toHaveBeenCalledWith("123");
    expect(harness.props.clearMessages).not.toHaveBeenCalled();
    expect(harness.props.clearProjectSelectionRuntime).not.toHaveBeenCalled();
    expect(harness.props.resetRestoredSessionState).not.toHaveBeenCalled();
    expect(harness.props.resetComposerDraft).not.toHaveBeenCalled();
  });

  it("没有恢复保护时仍应按新任务请求清空当前会话", async () => {
    const harness = renderHook();

    await harness.render();

    expect(harness.props.markNewChatRequestHandled).toHaveBeenCalledWith("123");
    expect(harness.props.clearMessages).toHaveBeenCalledWith({
      showToast: false,
    });
    expect(harness.props.clearProjectSelectionRuntime).toHaveBeenCalled();
    expect(harness.props.resetRestoredSessionState).toHaveBeenCalled();
    expect(harness.props.resetComposerDraft).toHaveBeenCalledOnce();
  });

  it("持久化 owner 尚未建立时不把新任务标为已处理或清空正文", async () => {
    const harness = renderHook({ composerDraftEnabled: true });
    await harness.render();
    act(() => harness.current().handleBackHome());
    expect(harness.props.markNewChatRequestHandled).not.toHaveBeenCalled();
    expect(harness.props.resetComposerDraft).not.toHaveBeenCalled();
    expect(harness.props.setInput).not.toHaveBeenCalled();
    expect(harness.props.clearMessages).not.toHaveBeenCalled();
    expect(harness.props.onNavigate).not.toHaveBeenCalled();
  });
});
