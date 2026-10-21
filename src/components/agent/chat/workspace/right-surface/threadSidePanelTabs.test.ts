import { describe, expect, it } from "vitest";
import { openWorkspaceFile } from "./openWorkspaceFile";
import {
  activeSidePanelTab,
  closeSidePanelTab,
  openSidePanelTab,
  selectSidePanelTab,
  pinSidePanelTab,
  type ThreadSidePanelTabs,
} from "./threadSidePanelTabs";
import {
  projectNewTabTools,
  type ThreadSidePanelAction,
} from "./threadSidePanelActions";

const empty: ThreadSidePanelTabs = { tabs: [], activeTabId: null, open: false };

describe("Thread side panel tab identity", () => {
  it("Recents打开只替换原New tab实例，重用ID和迟到点击不能复活旧标签", () => {
    const source = { tabId: "new", kind: "workspace-new-tab" as const };
    let state = openSidePanelTab(empty, source);
    state = openSidePanelTab(state, {
      tabId: "other-new",
      kind: "workspace-new-tab",
    });
    const opened = openWorkspaceFile(state, "/project/report.pdf", {
      sourceTab: source,
    });
    expect(opened.tabs.map((tab) => tab.tabId)).toEqual([
      "file:/project/report.pdf",
      "other-new",
    ]);
    expect(opened.activeTabId).toBe("file:/project/report.pdf");
    expect(
      openWorkspaceFile(opened, "/project/late.pdf", { sourceTab: source }),
    ).toBe(opened);
    state = closeSidePanelTab(state, source.tabId);
    state = openSidePanelTab(state, { ...source });
    expect(
      openWorkspaceFile(state, "/project/late.pdf", { sourceTab: source }),
    ).toBe(state);
  });
  it("终端按session标签身份共存，重选和关闭不影响另一终端", () => {
    const first = { tabId: "terminal-1", kind: "shell" as const };
    const second = { tabId: "terminal-2", kind: "shell" as const };
    let state = openSidePanelTab(openSidePanelTab(empty, first), second);
    expect(state.tabs).toEqual([first, second]);
    state = selectSidePanelTab(state, first.tabId);
    expect(openSidePanelTab(state, first).tabs).toEqual([first, second]);
    state = closeSidePanelTab(state, first.tabId);
    expect(state.tabs).toEqual([second]);
    expect(state.activeTabId).toBe(second.tabId);
  });
  it("两个New tab有独立身份，动作只替换指定标签并保留位置", () => {
    let state = openSidePanelTab(empty, {
      tabId: "new-1",
      kind: "workspace-new-tab",
    });
    state = openSidePanelTab(state, {
      tabId: "new-2",
      kind: "workspace-new-tab",
    });
    state = openSidePanelTab(state, { tabId: "files", kind: "files" }, "new-1");
    expect(state.tabs).toEqual([
      { tabId: "files", kind: "files" },
      { tabId: "new-2", kind: "workspace-new-tab" },
    ]);
    expect(activeSidePanelTab(state)?.tabId).toBe("files");
  });

  it("延迟动作不恢复已关闭或已经替换的目标", () => {
    const state = openSidePanelTab(empty, {
      tabId: "new",
      kind: "workspace-new-tab",
    });
    const closed = closeSidePanelTab(state, "new");
    expect(
      openSidePanelTab(closed, { tabId: "files", kind: "files" }, "new"),
    ).toBe(closed);
    const replaced = openSidePanelTab(
      state,
      { tabId: "files", kind: "files" },
      "new",
    );
    expect(
      openSidePanelTab(replaced, { tabId: "browser", kind: "browser" }, "new"),
    ).toBe(replaced);
  });

  it("相同Files路径复用同一身份并消费New tab，Files和Changes分别保留", () => {
    let state = openWorkspaceFile(empty, null);
    state = openSidePanelTab(state, { tabId: "changes-1", kind: "changes" });
    state = openSidePanelTab(state, {
      tabId: "new",
      kind: "workspace-new-tab",
    });
    state = openWorkspaceFile(state, null, { replaceTabId: "new" });
    expect(state.tabs.map((tab) => tab.tabId)).toEqual(["file:", "changes-1"]);
    expect(state.activeTabId).toBe("file:");
  });

  it("关闭选中标签选择相邻标签，关闭最后一个折叠，迟到选择不改变状态", () => {
    let state = openSidePanelTab(empty, { tabId: "a", kind: "files" });
    state = openSidePanelTab(state, { tabId: "b", kind: "changes" });
    state = openSidePanelTab(state, { tabId: "c", kind: "shell" });
    state = selectSidePanelTab(state, "b");
    state = closeSidePanelTab(state, "b");
    expect(state.activeTabId).toBe("c");
    state = closeSidePanelTab(closeSidePanelTab(state, "c"), "a");
    expect(state).toEqual(empty);
    expect(selectSidePanelTab(state, "a")).toBe(state);
  });

  it("隐藏面板保留标签和选择，重新选择不创建新标签", () => {
    const visible = openWorkspaceFile(empty, "/work/a.ts");
    const hidden = { ...visible, open: false };
    const restored = openWorkspaceFile(hidden, "/work/a.ts");
    expect(restored.tabs).toEqual(visible.tabs);
    expect(restored.activeTabId).toBe("file:/work/a.ts");
    expect(restored.open).toBe(true);
  });

  it("空Files选路径后关闭自身；不同路径保留，重复路径复用内容实例", () => {
    let state = openWorkspaceFile(empty, null);
    const picker = activeSidePanelTab(state)!;
    state = openWorkspaceFile(state, "/work/a.ts", { sourceTab: picker });
    const first = activeSidePanelTab(state)!;
    expect(state.tabs).toEqual([first]);
    state = openWorkspaceFile(state, "/work/b.ts", { sourceTab: first });
    expect(state.tabs.map((tab) => tab.filePath)).toEqual([
      "/work/a.ts",
      "/work/b.ts",
    ]);
    state = openWorkspaceFile(state, "/work/a.ts");
    expect(activeSidePanelTab(state)).toBe(first);
    expect(state.tabs).toHaveLength(2);
  });

  it("关闭再打开同路径后，旧内容实例的迟到选择不能影响新实例", () => {
    let state = openWorkspaceFile(empty, "/work/a.ts");
    const stale = activeSidePanelTab(state)!;
    state = openWorkspaceFile(
      closeSidePanelTab(state, stale.tabId),
      "/work/a.ts",
    );
    expect(activeSidePanelTab(state)?.contentInstance).not.toBe(
      stale.contentInstance,
    );
    expect(
      openWorkspaceFile(state, "/work/late.ts", { sourceTab: stale }),
    ).toBe(state);
  });

  it("单击浏览只替换一个预览，固定文件和其他工具继续保留", () => {
    let state = openWorkspaceFile(empty, "/work/pinned.ts");
    const pinned = activeSidePanelTab(state)!;
    state = openSidePanelTab(state, { tabId: "terminal", kind: "shell" });
    state = openWorkspaceFile(state, "/work/a.ts", { isPreview: true });
    const preview = activeSidePanelTab(state)!;
    state = openWorkspaceFile(state, "/work/b.ts", {
      sourceTab: preview,
      isPreview: true,
    });
    expect(state.tabs.map((tab) => tab.tabId)).toEqual([
      pinned.tabId,
      "terminal",
      "file:/work/b.ts",
    ]);
    expect(state.tabs[0]).toBe(pinned);
    expect(state.previewTabId).toBe("file:/work/b.ts");
    expect(activeSidePanelTab(state)?.dndId).toBe(preview.dndId);
    expect(activeSidePanelTab(state)?.contentInstance).not.toBe(
      preview.contentInstance,
    );
    expect(
      openWorkspaceFile(state, "/work/late.ts", {
        sourceTab: preview,
        isPreview: true,
      }),
    ).toBe(state);
  });

  it("双击或面板操作固定预览时保留内容对象，随后浏览不关闭它", () => {
    let state = openWorkspaceFile(empty, "/work/a.ts", { isPreview: true });
    const first = activeSidePanelTab(state)!;
    state = openWorkspaceFile(state, "/work/a.ts", { isPreview: false });
    expect(state.previewTabId).toBeNull();
    expect(activeSidePanelTab(state)).toBe(first);
    state = openWorkspaceFile(state, "/work/b.ts", { isPreview: true });
    const second = activeSidePanelTab(state)!;
    state = pinSidePanelTab(state, second.tabId);
    expect(state.previewTabId).toBeNull();
    expect(activeSidePanelTab(state)).toBe(second);
    state = openWorkspaceFile(state, "/work/c.ts", { isPreview: true });
    expect(state.tabs.slice(0, 2)).toEqual([first, second]);
    expect(state.tabs[0]).toBe(first);
    expect(state.tabs[1]).toBe(second);
  });

  it("预览重选已有固定文件不降级，也不消费另一预览", () => {
    let state = openWorkspaceFile(empty, "/work/pinned.ts");
    const pinned = activeSidePanelTab(state)!;
    state = openWorkspaceFile(state, "/work/preview.ts", { isPreview: true });
    const preview = activeSidePanelTab(state)!;
    state = openWorkspaceFile(state, pinned.filePath!, { isPreview: true });
    expect(activeSidePanelTab(state)).toBe(pinned);
    expect(state.previewTabId).toBe(preview.tabId);
    expect(state.tabs).toEqual([pinned, preview]);
    state = closeSidePanelTab(state, preview.tabId);
    expect(state.previewTabId).toBeNull();
    expect(state.tabs).toEqual([pinned]);
  });

  it("迟到的New tab替换不能关闭当前预览", () => {
    const state = openWorkspaceFile(empty, "/work/a.ts", { isPreview: true });
    expect(
      openWorkspaceFile(state, "/work/b.ts", {
        isPreview: true,
        replaceTabId: "closed-new-tab",
      }),
    ).toBe(state);
  });
});

describe("New tab tools", () => {
  const action = (
    id: string,
    extra: Partial<ThreadSidePanelAction> = {},
  ): ThreadSidePanelAction => ({
    id,
    kind: "files",
    title: id,
    icon: null,
    ...extra,
  });
  it("有Chat时工具最多5槽，快捷键工具优先，溢出预留More tools", () => {
    const actions = [
      action("plain"),
      action("shortcut", { keyboardShortcut: "⌘O" }),
      ...Array.from({ length: 5 }, (_, n) => action(String(n))),
    ];
    const result = projectNewTabTools(actions, true);
    expect(result.primary.map((item) => item.id)).toEqual([
      "shortcut",
      "plain",
      "0",
      "1",
    ]);
    expect(result.overflow).toHaveLength(3);
  });
  it("无Chat时6槽，MCP工具进入独立菜单，隐藏工具不出现", () => {
    const actions = [
      ...Array.from({ length: 6 }, (_, n) => action(String(n))),
      action("mcp", { isMcpProvided: true }),
      action("hidden", { showInNewTabTools: false }),
    ];
    const result = projectNewTabTools(actions, false);
    expect(result.primary).toHaveLength(5);
    expect(result.overflow.map((item) => item.id)).toEqual(["5"]);
    expect(result.extensions.map((item) => item.id)).toEqual(["mcp"]);
  });
});
