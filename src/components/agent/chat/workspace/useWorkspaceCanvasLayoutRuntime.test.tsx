import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasState as GeneralCanvasState } from "@/components/general-chat/bridge";
import { useWorkspaceCanvasLayoutRuntime } from "./useWorkspaceCanvasLayoutRuntime";

type HookProps = Parameters<typeof useWorkspaceCanvasLayoutRuntime>[0];

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

function renderHook(props?: Partial<HookProps>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let latestValue: ReturnType<typeof useWorkspaceCanvasLayoutRuntime> | null =
    null;

  const defaultProps: HookProps = {
    activeTheme: "general",
    isThemeWorkbench: false,
    hasPendingA2UIForm: false,
    layoutMode: "chat-canvas",
    showChatPanel: true,
    showSidebar: true,
    defaultTopicSidebarVisible: true,
    hasMessages: true,
    canvasWorkbenchLayoutMode: "split",
    autoCollapsedTopicSidebarRef: { current: false },
    mappedTheme: "general",
    normalizedEntryTheme: "general",
    shouldPreserveBlankHomeSurface: false,
    shouldBootstrapCanvasOnEntry: false,
    canvasState: null,
    generalCanvasState: {
      isOpen: false,
      contentType: "empty",
      content: "",
      isEditing: false,
    },
    hasCurrentCanvasArtifact: false,
    currentImageWorkbenchActive: false,
    onHasMessagesChange: vi.fn(),
    setShowSidebar: vi.fn(),
    setLayoutMode: vi.fn(),
    setGeneralCanvasState: vi.fn(),
    setCanvasState: vi.fn(),
    setCanvasWorkbenchLayoutMode: vi.fn(),
  };

  function Probe(currentProps: HookProps) {
    latestValue = useWorkspaceCanvasLayoutRuntime(currentProps);
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
    getValue: () => {
      if (!latestValue) {
        throw new Error("hook 尚未初始化");
      }
      return latestValue;
    },
    defaultProps,
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

describe("useWorkspaceCanvasLayoutRuntime", () => {
  it("外层关闭和收起等待同一可见文件保存，失败不改变布局且可以重试", async () => {
    const setLayoutMode = vi.fn();
    const { render, getValue } = renderHook({
      setLayoutMode,
      hasCurrentCanvasArtifact: true,
    });
    await render();
    setLayoutMode.mockClear();
    let finish!: (saved: boolean) => void;
    const guard = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    getValue().bindBeforeCanvasLeave(guard);
    act(() => {
      getValue().handleCloseCanvas();
      getValue().handleToggleCanvas();
    });
    expect(guard).toHaveBeenCalledTimes(1);
    expect(setLayoutMode).not.toHaveBeenCalled();
    await act(async () => finish(false));
    expect(setLayoutMode).not.toHaveBeenCalled();
    act(() => getValue().handleToggleCanvas());
    expect(guard).toHaveBeenCalledTimes(2);
    await act(async () => finish(true));
    expect(setLayoutMode).toHaveBeenCalledExactlyOnceWith("chat");
  });

  it("工作区A到B再回A时旧保存完成不得关闭当前画布", async () => {
    const setLayoutMode = vi.fn();
    const { render, getValue } = renderHook({
      canvasScopeKey: "A",
      setLayoutMode,
      hasCurrentCanvasArtifact: true,
    });
    await render();
    let finish!: (saved: boolean) => void;
    getValue().bindBeforeCanvasLeave(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    act(() => getValue().handleCloseCanvas());
    await render({ canvasScopeKey: "B" });
    await render({ canvasScopeKey: "A" });
    setLayoutMode.mockClear();
    await act(async () => finish(true));
    expect(setLayoutMode).not.toHaveBeenCalled();
  });

  it("重新打开画布不调用关闭护栏；解除注册后保持同步关闭行为", async () => {
    const setLayoutMode = vi.fn();
    const { render, getValue } = renderHook({
      layoutMode: "chat",
      setLayoutMode,
      hasCurrentCanvasArtifact: true,
    });
    await render();
    const guard = vi.fn(async () => false);
    getValue().bindBeforeCanvasLeave(guard);
    setLayoutMode.mockClear();
    act(() => getValue().handleToggleCanvas());
    expect(guard).not.toHaveBeenCalled();
    expect(setLayoutMode).toHaveBeenCalledWith("chat-canvas");
    getValue().bindBeforeCanvasLeave(null);
    setLayoutMode.mockClear();
    act(() => getValue().handleCloseCanvas());
    expect(setLayoutMode).toHaveBeenCalledWith("chat");
  });
  it("进入真实预览目标时应自动收起通用空画布，但保留已有内容", async () => {
    const setGeneralCanvasState = vi.fn();
    const { render } = renderHook({
      setGeneralCanvasState,
    });

    await render();
    expect(setGeneralCanvasState).not.toHaveBeenCalled();

    await render({
      hasCurrentCanvasArtifact: true,
    });

    expect(setGeneralCanvasState).toHaveBeenCalledTimes(1);
    const updater = setGeneralCanvasState.mock.calls[0]?.[0] as
      | ((previous: GeneralCanvasState) => GeneralCanvasState)
      | undefined;
    expect(typeof updater).toBe("function");

    const previousState: GeneralCanvasState = {
      isOpen: true,
      contentType: "markdown",
      content: "# 临时草稿\n\n保留这段内容",
      isEditing: false,
    };

    const nextState = updater?.(previousState);
    expect(nextState).toEqual({
      ...previousState,
      isOpen: false,
    });
  });

  it("general 空白画布已显式打开时不应被自动回退到聊天态", async () => {
    const setLayoutMode = vi.fn();
    const { render } = renderHook({
      layoutMode: "chat-canvas",
      generalCanvasState: {
        isOpen: true,
        contentType: "markdown",
        content: "   ",
        isEditing: false,
      },
      setLayoutMode,
    });

    await render();

    expect(setLayoutMode.mock.calls.some((call) => call[0] === "chat")).toBe(
      false,
    );
  });

  it("隐藏聊天面板且没有真实内容时不应自动创建空白 general 画布", async () => {
    const setLayoutMode = vi.fn();
    const setGeneralCanvasState = vi.fn();
    const { render } = renderHook({
      showChatPanel: false,
      layoutMode: "chat",
      activeTheme: "general",
      normalizedEntryTheme: "general",
      shouldPreserveBlankHomeSurface: false,
      generalCanvasState: {
        isOpen: false,
        contentType: "empty",
        content: "",
        isEditing: false,
      },
      setLayoutMode,
      setGeneralCanvasState,
    });

    await render();

    expect(setLayoutMode.mock.calls.some((call) => call[0] === "canvas")).toBe(
      false,
    );
    expect(setGeneralCanvasState).not.toHaveBeenCalled();
  });

  it("stacked 自动收起侧栏后，不应在同一轮 general chat-canvas 中立刻反向展开", async () => {
    const setShowSidebar = vi.fn();
    const autoCollapsedTopicSidebarRef = { current: false };
    const { render } = renderHook({
      setShowSidebar,
      autoCollapsedTopicSidebarRef,
      canvasWorkbenchLayoutMode: "stacked",
      showSidebar: true,
      layoutMode: "chat-canvas",
    });

    await render();

    expect(setShowSidebar).toHaveBeenCalledWith(false);
    expect(autoCollapsedTopicSidebarRef.current).toBe(true);

    setShowSidebar.mockClear();

    await render({
      canvasWorkbenchLayoutMode: "split",
      showSidebar: false,
      autoCollapsedTopicSidebarRef,
      layoutMode: "chat-canvas",
    });

    expect(setShowSidebar).not.toHaveBeenCalled();
    expect(autoCollapsedTopicSidebarRef.current).toBe(true);
  });

  it("自动收起的侧栏在离开 general chat-canvas 主路径后应恢复", async () => {
    const setShowSidebar = vi.fn();
    const autoCollapsedTopicSidebarRef = { current: true };
    const { render } = renderHook({
      setShowSidebar,
      autoCollapsedTopicSidebarRef,
      showSidebar: false,
      canvasWorkbenchLayoutMode: "split",
      layoutMode: "chat",
    });

    await render();

    expect(setShowSidebar).toHaveBeenCalledWith(true);
    expect(autoCollapsedTopicSidebarRef.current).toBe(false);
  });

  it("待处理 A2UI 存在时应主动收起主题工作台侧栏并回到聊天态", async () => {
    const setLayoutMode = vi.fn();
    const setShowSidebar = vi.fn();
    const { render } = renderHook({
      activeTheme: "general",
      isThemeWorkbench: true,
      hasPendingA2UIForm: true,
      layoutMode: "canvas",
      showSidebar: true,
      setLayoutMode,
      setShowSidebar,
    });

    await render();

    expect(setLayoutMode).toHaveBeenCalledWith("chat");
    expect(setShowSidebar).toHaveBeenCalledWith(false);
  });

  it("空白 new-task 首页在隐藏聊天面板时不应自动生成 fallback 画布", async () => {
    const setLayoutMode = vi.fn();
    const setGeneralCanvasState = vi.fn();
    const setCanvasState = vi.fn();
    const { render } = renderHook({
      showChatPanel: false,
      hasMessages: false,
      layoutMode: "chat",
      activeTheme: "general",
      normalizedEntryTheme: "general",
      shouldPreserveBlankHomeSurface: true,
      setLayoutMode,
      setGeneralCanvasState,
      setCanvasState,
    });

    await render();

    expect(setLayoutMode.mock.calls.some((call) => call[0] === "canvas")).toBe(
      false,
    );
    expect(setGeneralCanvasState).not.toHaveBeenCalled();
    expect(setCanvasState).not.toHaveBeenCalled();
  });

  it("关闭通用画布时应回到聊天态并保留草稿内容", async () => {
    const setLayoutMode = vi.fn();
    const setGeneralCanvasState = vi.fn();
    const { render, getValue } = renderHook({
      activeTheme: "general",
      setLayoutMode,
      setGeneralCanvasState,
    });

    await render();

    act(() => {
      getValue().handleCloseCanvas();
    });

    expect(setLayoutMode).toHaveBeenCalledWith("chat");

    const updater = setGeneralCanvasState.mock.calls.at(-1)?.[0] as
      | ((previous: GeneralCanvasState) => GeneralCanvasState)
      | undefined;
    expect(typeof updater).toBe("function");
    expect(
      updater?.({
        isOpen: true,
        contentType: "markdown",
        content: "保留的草稿",
        isEditing: false,
      }),
    ).toEqual({
      isOpen: false,
      contentType: "markdown",
      content: "保留的草稿",
      isEditing: false,
    });
  });
});
