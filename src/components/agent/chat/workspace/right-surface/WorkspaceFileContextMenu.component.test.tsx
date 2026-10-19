import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { WorkspaceFileContextMenu } from "./WorkspaceFileContextMenu";
import { FileTree } from "./FileTree";
import { RightSurfaceTabStrip } from "./RightSurfaceTabStrip";
import type { ThreadSidePanelTab } from "./threadSidePanelTabs";
import type { OpenInTarget } from "@/lib/api/openInTypes";
import { openInQueryClient } from "@/lib/openInTargets";

const boundary = vi.hoisted(() => ({
  native: true,
  clipboard: vi.fn(),
  error: vi.fn(),
  targets: [] as OpenInTarget[],
  open: vi.fn(),
  gate: null as Promise<void> | null,
}));
vi.mock("@/lib/api/openIn", () => ({
  openIn: {
    getTargets: async () => {
      const targets = boundary.targets;
      await boundary.gate;
      return {
        targets,
        availableTargets: targets.map((target) => target.id),
        preferredTarget: null,
        mode: "native",
        discovery: "ready",
      };
    },
    detectTarget: async (params: { target: string; appPath?: string }) =>
      boundary.targets.find(
        (target) =>
          target.target === params.target && target.appPath === params.appPath,
      ) ?? null,
    loadTargetIcon: async () => null,
    open: boundary.open,
  },
}));
vi.mock("@/lib/desktop-runtime", () => ({
  hasDesktopHostInvokeCapability: () => boundary.native,
}));
vi.mock("sonner", () => ({ toast: { error: boundary.error } }));

let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  boundary.native = true;
  boundary.targets = [];
  boundary.gate = null;
  boundary.open.mockResolvedValue(undefined);
  openInQueryClient.clear();
  boundary.clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: boundary.clipboard },
  });
  await changeLimeLocale("en-US");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const path = "C:\\work\\nested\\real.ts";
const select = vi.fn();
function renderTree(scope = "root/query") {
  act(() =>
    root.render(
      <FileTree
        scope={scope}
        rows={[
          {
            kind: "entry",
            entry: {
              path: "C:\\work\\nested",
              name: "flattened/display",
              isDir: true,
              size: 0,
              modifiedAt: 0,
            },
            parentPath: null,
            depth: 0,
            position: 0,
            setSize: 1,
          },
          {
            kind: "entry",
            entry: {
              path,
              name: "display.ts",
              isDir: false,
              size: 0,
              modifiedAt: 0,
            },
            parentPath: "C:\\work\\nested",
            depth: 1,
            position: 0,
            setSize: 1,
          },
        ]}
        expandedDirectories={{ "C:\\work\\nested": true }}
        selectedPath={path}
        onToggleDirectory={vi.fn()}
        onSelectFile={select}
      />,
    ),
  );
}
function row(type: "file" | "folder") {
  return host.querySelector<HTMLElement>(`[data-item-type="${type}"]`)!;
}
function menu() {
  return document.querySelector<HTMLElement>(
    '[data-testid="workspace-file-context-menu"]',
  );
}
async function context(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
      }),
    );
  });
}
async function settleQuery() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
async function key(element: Element, key: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    element.dispatchEvent(event);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return event;
}

describe("Files 菜单真实 DOM", () => {
  it.each(["tree", "tab"])(
    "%s follows the evidenced loading/wait-before-open contract",
    async (surface) => {
      let ready!: () => void;
      boundary.gate = new Promise<void>((resolve) => {
        ready = resolve;
      });
      if (surface === "tree") renderTree();
      else
        act(() =>
          root.render(
            <WorkspaceFileContextMenu
              scope={{ tabId: "file", kind: "files", filePath: path }}
              filePath={path}
            >
              <button role="tab">File</button>
            </WorkspaceFileContextMenu>,
          ),
        );
      await context(
        surface === "tree" ? row("file") : host.querySelector('[role="tab"]')!,
      );
      if (surface === "tree") {
        expect(
          menu()
            ?.querySelector(
              '[data-testid="workspace-file-menu-loading-targets"]',
            )
            ?.getAttribute("aria-disabled"),
        ).toBe("true");
        expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
      } else expect(menu()).toBeNull();
      await act(async () => {
        ready();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      await settleQuery();
      expect(menu()).not.toBeNull();
      expect(
        menu()?.querySelector(
          '[data-testid="workspace-file-menu-loading-targets"]',
        ),
      ).toBeNull();
      expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(0);
    },
  );
  it("真实目标快照产生 primary/Open with，普通选择保留原生 target 与 appPath 且不写偏好", async () => {
    boundary.targets = [
      {
        id: "app:/Applications/Editor.app",
        target: "systemDefault",
        kind: "native",
        label: "Editor",
        appPath: "/Applications/Editor.app",
        available: true,
        icon: null,
      },
    ];
    renderTree();
    await context(row("file"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(menu()?.textContent).toContain("Open in Editor");
    expect(menu()?.textContent).toContain("Open with");
    expect(menu()?.querySelectorAll('[role="separator"]')).toHaveLength(1);
    const primary = menu()!.querySelector<HTMLElement>(
      '[data-testid="workspace-file-menu-open:app:/Applications/Editor.app"]',
    )!;
    await act(async () => primary.click());
    expect(boundary.open).toHaveBeenCalledWith(
      expect.objectContaining({
        path,
        target: "systemDefault",
        appPath: "/Applications/Editor.app",
        openMode: "file",
      }),
    );
    expect(boundary.open.mock.calls[0][0]).not.toHaveProperty(
      "persistPreferredTargetPath",
    );
  });
  it("唯一树外层接受图标的 composedPath，复制操作路径且维持已证顺序", async () => {
    renderTree();
    await context(row("file").querySelector("svg")!);
    expect(menu()?.dataset.filePath).toBe(path);
    expect(
      Array.from(menu()!.querySelectorAll('[role="menuitem"]')).map((item) =>
        item.getAttribute("data-testid"),
      ),
    ).toEqual(["workspace-file-menu-save-as", "workspace-file-menu-copy-path"]);
    await act(async () =>
      document
        .querySelector<HTMLElement>(
          '[data-testid="workspace-file-menu-copy-path"]',
        )!
        .click(),
    );
    expect(boundary.clipboard).toHaveBeenCalledExactlyOnceWith(path);
    expect(menu()).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(row("file"));
    expect(select).not.toHaveBeenCalled();
  });

  it("目录、树空白和无文件路径的容器不能打开文件菜单", async () => {
    renderTree();
    await context(row("folder").querySelector("span")!);
    expect(menu()).toBeNull();
    await context(host.querySelector('[role="tree"]')!);
    expect(menu()).toBeNull();
    expect(boundary.clipboard).not.toHaveBeenCalled();
  });

  it.each(["ContextMenu", "F10"])(
    "%s打开菜单，Escape恢复原行焦点",
    async (name) => {
      renderTree();
      const file = row("file");
      await act(async () => file.focus());
      expect((await key(file, name, name === "F10")).defaultPrevented).toBe(
        true,
      );
      expect(menu()?.dataset.filePath).toBe(path);
      await key(menu()!, "Escape");
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(file);
    },
  );

  it("无原生保存能力只显示 Copy path，键盘 Enter激活同一动作", async () => {
    boundary.native = false;
    renderTree();
    await key(row("file"), "ContextMenu");
    expect(menu()!.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
    const copy = menu()!.querySelector<HTMLElement>('[role="menuitem"]')!;
    await act(async () => copy.focus());
    await key(copy, "Enter");
    expect(boundary.clipboard).toHaveBeenCalledExactlyOnceWith(path);
  });

  it("root/query切换立即关闭旧菜单，不把旧路径交给新scope", async () => {
    renderTree("root/query-a");
    await context(row("file"));
    const oldCopy = menu()!.querySelector<HTMLElement>(
      '[data-testid="workspace-file-menu-copy-path"]',
    )!;
    renderTree("root/query-b");
    expect(menu()).toBeNull();
    await act(async () => oldCopy.click());
    expect(boundary.clipboard).not.toHaveBeenCalled();
    await context(row("file"));
    expect(menu()?.dataset.filePath).toBe(path);
  });

  it("实际文件标签复用同一builder和真实path，空Files标签没有文件菜单", async () => {
    const file: ThreadSidePanelTab = {
      kind: "files",
      tabId: "file",
      filePath: path,
      contentInstance: "instance",
    };
    act(() =>
      root.render(
        <RightSurfaceTabStrip
          definitions={[{ kind: "files", label: "Files", render: () => null }]}
          tabs={[file, { kind: "files", tabId: "empty" }]}
          activeTabId={file.tabId}
          onNewTab={vi.fn()}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          previewTabId={null}
          idPrefix="test"
        />,
      ),
    );
    const tabs = host.querySelectorAll('[role="tab"]');
    await context(tabs[1]);
    expect(menu()).toBeNull();
    await context(tabs[0]);
    await settleQuery();
    expect(menu()?.dataset.filePath).toBe(path);
    await act(async () =>
      menu()!
        .querySelector<HTMLElement>(
          '[data-testid="workspace-file-menu-copy-path"]',
        )!
        .click(),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(boundary.clipboard).toHaveBeenCalledExactlyOnceWith(path);
    expect(document.activeElement).toBe(tabs[0]);
  });

  it.each([
    ["zh-CN", "复制路径", "另存为"],
    ["zh-TW", "複製路徑", "另存新檔"],
    ["en-US", "Copy path", "Save as"],
    ["ja-JP", "パスをコピー", "名前を付けて保存"],
    ["ko-KR", "경로 복사", "다른 이름으로 저장"],
  ] as const)("%s投影五语菜单及剪贴板失败终态", async (locale, copy, save) => {
    await changeLimeLocale(locale);
    boundary.clipboard.mockRejectedValue(new Error("denied"));
    act(() =>
      root.render(
        <WorkspaceFileContextMenu scope="test">
          <div>
            <button role="treeitem" data-item-type="file" data-item-path={path}>
              file
            </button>
          </div>
        </WorkspaceFileContextMenu>,
      ),
    );
    await context(row("file"));
    expect(menu()?.textContent).toContain(copy);
    expect(menu()?.textContent).toContain(save);
    await act(async () =>
      menu()!
        .querySelector<HTMLElement>(
          '[data-testid="workspace-file-menu-copy-path"]',
        )!
        .click(),
    );
    expect(boundary.error).toHaveBeenCalledTimes(1);
    expect(boundary.error.mock.calls[0][0]).not.toContain(
      "workspace.fileActions",
    );
  });
});
