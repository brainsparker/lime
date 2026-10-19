import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  useWorkspaceRightSurfaceLocalStateRuntime,
  type WorkspaceRightSurfaceLocalStateRuntime,
  type WorkspaceRightSurfaceOwner,
} from "./useWorkspaceRightSurfaceLocalStateRuntime";

const owner: WorkspaceRightSurfaceOwner = {
  workspaceId: "workspace-a",
  sessionId: "session-a",
  threadId: "thread-a",
};
const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

function mount(initialOwner: WorkspaceRightSurfaceOwner = owner) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  let latest!: WorkspaceRightSurfaceLocalStateRuntime;
  const observations: WorkspaceRightSurfaceLocalStateRuntime[] = [];
  function Probe(props: WorkspaceRightSurfaceOwner) {
    latest = useWorkspaceRightSurfaceLocalStateRuntime(props);
    observations.push(latest);
    return null;
  }
  const render = (nextOwner = initialOwner) => {
    act(() => root.render(<Probe {...nextOwner} />));
  };
  render();
  return { render, get: () => latest, observations };
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

describe("Right Surface 本地显示状态", () => {
  it("外部资源引用激活同一路径文件标签，保留终端与文件内容实例", () => {
    const view = mount();
    act(() => view.get().openSidePanelTab("files"));
    act(() => view.get().setManualRightSurface("shell"));
    const terminal = view.get().sidePanelTabs.tabs[1];
    const path = "/skills/Review work/SKILL.md";
    act(() => view.get().openWorkspaceFile(path));
    const file = view.get().sidePanelTabs.tabs[1];
    expect(view.get().sidePanelTabs.activeTabId).toBe(file.tabId);
    expect(view.get().manualRightSurface).toBe("files");
    expect(file.filePath).toBe(path);
    act(() => view.get().selectSidePanelTab(terminal.tabId));
    act(() => view.get().openWorkspaceFile(path));
    expect(view.get().sidePanelTabs.tabs).toEqual([terminal, file]);
    expect(view.get().sidePanelTabs.tabs[1]).toBe(file);
    expect(view.get().sidePanelTabs.activeTabId).toBe(file.tabId);
    const stale = view.get();
    view.render({ ...owner, sessionId: "session-b", threadId: "thread-b" });
    act(() => stale.openWorkspaceFile(path));
    expect(view.get().sidePanelTabs.tabs).toEqual([]);
  });

  it("预览固定保留同一内容对象与草稿，旧owner固定不影响新预览", () => {
    const view = mount();
    act(() => view.get().openSidePanelTab("files"));
    const picker = view.get().sidePanelTabs.tabs[0];
    act(() => view.get().openWorkspaceFile("/work/a.ts", picker));
    const first = view.get().sidePanelTabs.tabs[0];
    act(() =>
      view.get().openWorkspaceFile("/work/b.ts", first, { isPreview: true }),
    );
    const preview = view.get().sidePanelTabs.tabs[1];
    const draft = {
      content: "edited",
      document: { kind: "ready" as const, baseContent: "base" },
    };
    view.get().setFileDraft(preview, draft);
    act(() => view.get().pinSidePanelTab(preview.tabId));
    expect(view.get().sidePanelTabs.tabs[1]).toBe(preview);
    expect(view.get().getFileDraft(preview)).toBe(draft);
    expect(view.get().sidePanelTabs.previewTabId).toBeNull();
    const stale = view.get();
    view.render({ ...owner, sessionId: "session-b", threadId: "thread-b" });
    act(() => view.get().openSidePanelTab("files"));
    const newPicker = view.get().sidePanelTabs.tabs[0];
    act(() =>
      view
        .get()
        .openWorkspaceFile("/work/b.ts", newPicker, { isPreview: true }),
    );
    const currentPreview = view.get().sidePanelTabs.tabs[0];
    act(() => stale.pinSidePanelTab(currentPreview.tabId));
    expect(view.get().sidePanelTabs.previewTabId).toBe(currentPreview.tabId);
    expect(view.get().getFileDraft(currentPreview)).toBeNull();
  });
  it("切换保留打开顺序；关闭未选中标签只移除它，关闭选中标签回退", () => {
    const view = mount();
    act(() => view.get().setManualRightSurface("browser"));
    act(() => view.get().setManualRightSurface("shell"));
    act(() => view.get().setManualRightSurface("files"));
    act(() => view.get().setManualRightSurface("browser"));
    expect(view.get().openedRightSurfaces).toEqual([
      "browser",
      "shell",
      "files",
    ]);
    act(() => view.get().closeRightSurface("shell"));
    expect(view.get().openedRightSurfaces).toEqual(["browser", "files"]);
    expect(view.get().manualRightSurface).toBe("browser");
    act(() => view.get().closeRightSurface("browser"));
    expect(view.get().openedRightSurfaces).toEqual(["files"]);
    expect(view.get().manualRightSurface).toBe("files");
    act(() => view.get().closeRightSurface("files"));
    expect(view.get().openedRightSurfaces).toEqual([]);
    expect(view.get().manualRightSurface).toBeNull();
  });

  it.each([
    { ...owner, workspaceId: "workspace-b" },
    { ...owner, sessionId: "session-b" },
    { ...owner, threadId: "thread-b" },
  ])("owner 切换在首次渲染就隔离所有显示状态：%j", (nextOwner) => {
    const view = mount();
    act(() => {
      view.get().setManualRightSurface("browser");
      view.get().setRightSurfaceBrowserTitle("Old browser");
      view.get().setActiveBrowserRightSurfaceIntent({
        source: "rightSurfacePending",
        sourceRequestId: "old",
        origin: "runtime",
        launchUrl: "https://example.com/old",
        priority: "background",
      });
      view.get().setActiveFilesRightSurfaceTarget({ relativePath: "old.md" });
      view.get().setActiveArticleWorkspace({
        schemaVersion: "article-workspace.v1",
        appId: "content-factory-app",
        sessionId: "session-a",
        source: "threadRead",
        objects: [],
        objectCount: 0,
        actionHistory: [],
      });
      view.get().setActivePluginSurfaces([
        {
          appId: "old-app",
          containerId: "old-plugin",
          title: "Old plugin",
          mcpApp: {
            serverName: "codex_apps",
            connectorId: "demo",
            resourceUri: "ui://demo/view.html",
            toolItemId: "item-demo",
          },
        },
      ]);
      view.get().setActivePluginSurfaceContainerId("old-plugin");
      view.get().setDismissedPluginSurfaceContainerIds(["old-dismissed"]);
    });
    const index = view.observations.length;
    view.render(nextOwner);
    const first = view.observations[index];
    expect(first.openedRightSurfaces).toEqual([]);
    expect(first.manualRightSurface).toBeNull();
    expect(first.rightSurfaceBrowserTitle).toBeNull();
    expect(first.activeBrowserRightSurfaceIntent).toBeNull();
    expect(first.activeFilesRightSurfaceTarget).toBeNull();
    expect(first.activeArticleWorkspace).toBeNull();
    expect(first.activePluginSurfaces).toEqual([]);
    expect(first.activePluginSurfaceContainerId).toBeNull();
    expect(first.dismissedPluginSurfaceContainerIds).toEqual([]);
  });

  it("A → B → A 后拒绝最初 A 的迟到 setter", () => {
    const view = mount();
    const stale = view.get();
    view.render({ ...owner, sessionId: "session-b", threadId: "thread-b" });
    view.render(owner);
    act(() => {
      stale.setManualRightSurface("browser");
      stale.setRightSurfaceBrowserTitle("late");
      stale.setActiveFilesRightSurfaceTarget({ relativePath: "late.md" });
      stale.rememberRightSurface("shell");
    });
    expect(view.get().openedRightSurfaces).toEqual([]);
    expect(view.get().rightSurfaceBrowserTitle).toBeNull();
    expect(view.get().activeFilesRightSurfaceTarget).toBeNull();
    act(() => view.get().setManualRightSurface("files"));
    expect(view.get().manualRightSurface).toBe("files");
  });

  it("同工作区首页可由首次 canonical owner 接管，真实 owner 变化后不接管", () => {
    const view = mount({ ...owner, sessionId: null, threadId: null });
    act(() => {
      view.get().setManualRightSurface("browser");
      view.get().setRightSurfaceBrowserTitle("Home intent");
    });
    view.render({ ...owner, threadId: null });
    view.render(owner);
    expect(view.get().openedRightSurfaces).toEqual(["browser"]);
    expect(view.get().rightSurfaceBrowserTitle).toBe("Home intent");
    view.render({ ...owner, sessionId: "session-b", threadId: null });
    expect(view.get().openedRightSurfaces).toEqual([]);
    view.render({ ...owner, sessionId: "session-b", threadId: "thread-b" });
    expect(view.get().rightSurfaceBrowserTitle).toBeNull();
  });

  it("取消选择保留标签；可用性撤销只移除指定种类并回退", () => {
    const view = mount();
    act(() => view.get().setManualRightSurface("browser"));
    act(() => view.get().setManualRightSurface("shell"));
    act(() => view.get().setManualRightSurface(null));
    expect(view.get().openedRightSurfaces).toEqual(["browser", "shell"]);
    act(() => view.get().setManualRightSurface("shell"));
    act(() => view.get().pruneRightSurfaces(new Set(["browser", "files"])));
    expect(view.get().openedRightSurfaces).toEqual(["browser"]);
    expect(view.get().manualRightSurface).toBe("browser");
  });
});
