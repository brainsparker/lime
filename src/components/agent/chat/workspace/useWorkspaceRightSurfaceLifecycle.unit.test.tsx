import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutMode } from "@/lib/workspace/workbenchContract";
import { useWorkspaceRightSurfaceCoordinatorRuntime } from "./useWorkspaceRightSurfaceCoordinatorRuntime";
import {
  useWorkspaceRightSurfaceLocalStateRuntime,
  type WorkspaceRightSurfaceOwner,
} from "./useWorkspaceRightSurfaceLocalStateRuntime";
import {
  buildWorkspaceRightSurfaceDefinitions,
  RightSurfaceHost,
} from "./right-surface";
import type { WorkspaceArticleWorkspace } from "./workspaceArticleWorkspaceModel";
import type { WorkspacePluginSurfaceDescriptor } from "./workspacePluginSurfaceModel";

const pending = vi.hoisted(() => ({
  pendingIntents: [],
  pendingBrowserIntent: null,
  pendingFileTarget: null,
  refreshPendingRequests: vi.fn(async () => undefined),
  consumePendingRequestsForSurface: vi.fn(async () => undefined),
  dismissPendingRequestsForSurface: vi.fn(async () => undefined),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
  }),
}));
vi.mock("./useWorkspaceRightSurfacePendingBridgeRuntime", () => ({
  useWorkspaceRightSurfacePendingBridgeRuntime: () => pending,
}));

const owner: WorkspaceRightSurfaceOwner = {
  workspaceId: "workspace-a",
  sessionId: "session-a",
  threadId: "thread-a",
};
const file = { relativePath: "src/main.ts", title: "main.ts" };
const article: WorkspaceArticleWorkspace = {
  schemaVersion: "article-workspace.v1",
  appId: "content-factory-app",
  sessionId: "session-a",
  workspaceId: "workspace-a",
  source: "threadRead",
  objects: [],
  objectCount: 0,
  actionHistory: [],
  selectedObjectRef: {
    appId: "content-factory-app",
    sessionId: "session-a",
    kind: "articleDraft",
    id: "draft-selected",
  },
};
const plugin: WorkspacePluginSurfaceDescriptor = {
  appId: "app-a",
  containerId: "container-a",
  title: "App A",
  mcpApp: {
    serverName: "codex_apps",
    connectorId: "demo",
    resourceUri: "ui://demo/view.html",
    toolItemId: "item-demo",
  },
};
const threadItems: never[] = [];
const noop = () => undefined;
const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

interface Props {
  owner: WorkspaceRightSurfaceOwner;
  articleAvailable: boolean;
  shellAvailable: boolean;
  suppressUtilities: boolean;
}

function useLifecycle(props: Props) {
  const local = useWorkspaceRightSurfaceLocalStateRuntime(props.owner);
  const [layout, setLayout] = useState<LayoutMode>("chat");
  const [expertCollapsed, setExpertCollapsed] = useState(true);
  const [, setHarness] = useState(false);
  const coordinator = useWorkspaceRightSurfaceCoordinatorRuntime({
    articleEditorRightSurface: local.activeArticleWorkspace ?? article,
    articleEditorRightSurfaceAvailable: props.articleAvailable,
    bindRightSurfacePendingActions: noop,
    canvasWorkbenchRootPath: "/workspace/project",
    clawTraceEnabled: false,
    expertInfoPanelCollapsed: expertCollapsed,
    expertInfoPanelVisible: !expertCollapsed,
    handleToggleCanvas: () =>
      setLayout((current) => (current === "chat" ? "canvas" : "chat")),
    harnessPendingCount: 0,
    hasExpertInfoPanel: true,
    localState: local,
    preferredServiceSkillResultFileTarget: file,
    runtimeWorkspaceId: props.owner.workspaceId,
    sceneIsPreparingSend: false,
    sceneIsSending: false,
    sceneLayoutMode: layout,
    sceneSessionId: props.owner.sessionId,
    sceneThreadId: props.owner.threadId,
    sessionId: props.owner.sessionId,
    shellRightSurfaceAvailable: props.shellAvailable,
    activityAvailable: true,
    showHarnessToggle: true,
    suppressHomeNavbarUtilityActions: props.suppressUtilities,
    taskCenterHomeHotpathActive: false,
    threadItems,
    setExpertInfoPanelCollapsed: setExpertCollapsed,
    setHarnessPanelVisible: setHarness,
    setLayoutMode: setLayout,
  });
  return { local, coordinator };
}

function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  let latest!: ReturnType<typeof useLifecycle>;
  const props: Props = {
    owner,
    articleAvailable: true,
    shellAvailable: true,
    suppressUtilities: false,
  };
  function Probe(current: Props) {
    latest = useLifecycle(current);
    return (
      <RightSurfaceHost
        activeSurface={latest.coordinator.rightSurfaceState.activeSurface}
        openSurfaces={latest.coordinator.rightSurfaceState.openSurfaces}
        onSelectSurface={latest.coordinator.handleSelectRightSurfaceTab}
        definitions={buildWorkspaceRightSurfaceDefinitions({
          browser: () => (
            <div>{latest.coordinator.rightSurfaceBrowserTitle}</div>
          ),
          files: () => (
            <div>
              {latest.coordinator.filesRightSurfaceTarget?.relativePath}
            </div>
          ),
          articleWorkspace: () => (
            <div>
              {latest.local.activeArticleWorkspace?.selectedObjectRef?.id}
            </div>
          ),
          shell: () => <div>Shell output</div>,
          expertInfo: () => <div>Expert info</div>,
          appSurface: () => <div>Plugin</div>,
        })}
      />
    );
  }
  const render = (changes: Partial<Props> = {}) => {
    Object.assign(props, changes);
    act(() => root.render(<Probe {...props} />));
  };
  render();
  return { get: () => latest, render, container };
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("Right Surface 标签生命周期接线", () => {
  it("可用 launcher 不会自动打开标签", () => {
    const view = mount();
    expect(view.get().coordinator.rightSurfaceLaunchers.length).toBeGreaterThan(
      0,
    );
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([]);
    expect(view.container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it("Browser → Files → Browser 保留标签、Browser 标题和 Files 目标", () => {
    const view = mount();
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    act(() =>
      view
        .get()
        .coordinator.handleRightSurfaceBrowserNavigate(
          "https://example.com",
          "Browser selected tab",
        ),
    );
    act(() => view.get().coordinator.handleToggleRightSurfaceFiles());
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "browser",
      "files",
    ]);
    act(() =>
      view.container
        .querySelector('[data-testid="workspace-right-surface-tab-browser"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(
      view.container
        .querySelector('[data-testid="workspace-right-surface-host"]')
        ?.getAttribute("data-surface"),
    ).toBe("browser");
    expect(
      Array.from(view.container.querySelectorAll('[role="tab"]'), (element) =>
        element.getAttribute("data-testid"),
      ),
    ).toEqual([
      "workspace-right-surface-tab-browser",
      "workspace-right-surface-tab-files",
    ]);
    expect(view.get().coordinator.rightSurfaceBrowserTitle).toBe(
      "Browser selected tab",
    );
    expect(view.get().local.activeFilesRightSurfaceTarget).toEqual(file);
    act(() => view.get().coordinator.handleSelectRightSurfaceTab("files"));
    expect(view.get().coordinator.filesRightSurfaceTarget).toEqual(file);
  });

  it("Article → Files → Article 保留 selected object 和文章显示意图", () => {
    const view = mount();
    act(() => view.get().local.openArticleWorkspaceRightSurface(article));
    act(() => view.get().coordinator.handleSelectRightSurfaceTab("files"));
    expect(view.get().local.activeArticleWorkspace).toBe(article);
    act(() =>
      view.get().coordinator.handleSelectRightSurfaceTab("articleWorkspace"),
    );
    expect(view.get().local.activeArticleWorkspace?.selectedObjectRef?.id).toBe(
      "draft-selected",
    );
    expect(view.get().local.activeFilesRightSurfaceTarget).toEqual(file);
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "articleWorkspace",
      "files",
    ]);
  });

  it("Shell 后台关闭只删除 Shell；选中关闭回退到 Browser", () => {
    const view = mount();
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    act(() => view.get().coordinator.handleSelectRightSurfaceTab("browser"));
    act(() => view.get().coordinator.handleCloseRightSurfaceShell());
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "browser",
    ]);
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "browser",
    );
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "browser",
    );
    expect(pending.dismissPendingRequestsForSurface).toHaveBeenCalledWith(
      "shell",
      "user_closed_surface",
    );
  });

  it("失去可用性只裁剪对应标签并清理对应目标", () => {
    const view = mount();
    act(() => view.get().local.openArticleWorkspaceRightSurface(article));
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    view.render({ shellAvailable: false });
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "articleWorkspace",
      "browser",
    ]);
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "browser",
    );
    expect(view.get().local.activeArticleWorkspace).toBe(article);
    view.render({ articleAvailable: false });
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "browser",
    ]);
    expect(view.get().local.activeArticleWorkspace).toBeNull();
  });

  it("utility suppression 使用同一 availability 投影移除 inactive Shell", () => {
    const view = mount();
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    view.render({ suppressUtilities: true });
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "browser",
    ]);
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "browser",
    );
    pending.consumePendingRequestsForSurface.mockClear();
    act(() => view.get().coordinator.handleToggleRightSurfaceShell());
    act(() => view.get().coordinator.handleSelectRightSurfaceTab("shell"));
    expect(view.get().local.openedRightSurfaces).toEqual(["browser"]);
    expect(pending.consumePendingRequestsForSurface).not.toHaveBeenCalled();
  });

  it("Expert 和 Canvas 切换保留已有 Files 与 Article 目标", () => {
    const view = mount();
    act(() => view.get().local.openArticleWorkspaceRightSurface(article));
    act(() => view.get().coordinator.handleToggleRightSurfaceFiles());
    act(() => view.get().coordinator.handleToggleExpertInfoPanel());
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "expertInfo",
    );
    act(() => view.get().coordinator.handleToggleExpertInfoPanel());
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "files",
    );
    act(() => view.get().coordinator.handleToggleCanvasFromRightSurface());
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "workbench",
    );
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "articleWorkspace",
      "files",
      "workbench",
    ]);
    expect(view.get().local.activeArticleWorkspace).toBe(article);
    expect(view.get().local.activeFilesRightSurfaceTarget).toEqual(file);
  });

  it("Plugin 分组最后一个关闭时即使在后台也移除分组", () => {
    const view = mount();
    const second = { ...plugin, containerId: "container-b" };
    act(() => {
      view.get().local.setActivePluginSurfaces([plugin, second]);
      view.get().local.setActivePluginSurfaceContainerId(plugin.containerId);
      view.get().local.setManualRightSurface("appSurface");
    });
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    act(() => view.get().coordinator.handleClosePluginSurface(plugin));
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "appSurface",
      "browser",
    ]);
    act(() => view.get().coordinator.handleClosePluginSurface(second));
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([
      "browser",
    ]);
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "browser",
    );
    expect(view.get().local.dismissedPluginSurfaceContainerIds).toEqual([
      "container-a",
      "container-b",
    ]);
  });

  it("关闭 Browser 回退到 Expert 后，Expert toggle 关闭实际选中的标签", () => {
    const view = mount();
    act(() => view.get().coordinator.handleToggleExpertInfoPanel());
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBe(
      "expertInfo",
    );
    act(() => view.get().coordinator.handleToggleExpertInfoPanel());
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([]);
    expect(view.get().coordinator.rightSurfaceState.activeSurface).toBeNull();
  });

  it("会话 epoch 隔离保留的标签、标题及外部回调", () => {
    const view = mount();
    act(() => view.get().coordinator.handleToggleRightSurfaceBrowser());
    const previous = view.get().coordinator;
    view.render({
      owner: { ...owner, sessionId: "session-b", threadId: "thread-b" },
    });
    act(() =>
      previous.handleRightSurfaceBrowserNavigate(
        "https://late.example",
        "late",
      ),
    );
    expect(view.get().coordinator.rightSurfaceState.openSurfaces).toEqual([]);
    expect(view.get().coordinator.rightSurfaceBrowserTitle).toBeNull();
  });
});
