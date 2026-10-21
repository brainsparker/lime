import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceDirectoryTree } from "./WorkspaceDirectoryTree";
import type { DirectoryListing } from "@/lib/api/fileBrowser";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
let host: HTMLDivElement;
let root: Root;
const select = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  select.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const listing = (path: string, entries: string[]): DirectoryListing => ({
  path,
  parentPath: null,
  error: null,
  entries: entries.map((name) => ({
    name: name.replace(/\/$/, ""),
    path: path + "/" + name.replace(/\/$/, ""),
    isDir: name.endsWith("/"),
    size: 0,
    modifiedAt: 0,
  })),
});
const state = {
  directoryCache: {
    "/work": listing("/work", ["z.ts", "src/", "a.ts"]),
    "/work/src": listing("/work/src", ["nested/", "two.ts", "one.ts"]),
    "/work/src/nested": listing("/work/src/nested", ["leaf.ts"]),
  },
  loadingDirectories: {},
};
async function render() {
  function Probe() {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    return (
      <WorkspaceDirectoryTree
        directoryPath="/work"
        state={state}
        expandedDirectories={expanded}
        selectedPath="/work/a.ts"
        onSelectFile={select}
        onToggleDirectory={(path) =>
          setExpanded((previous) => ({ ...previous, [path]: !previous[path] }))
        }
      />
    );
  }
  await act(async () => root.render(<Probe />));
}
function row(path: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.title === "/work/" + path,
  )!;
}
async function press(
  key: string,
  options: ConstructorParameters<typeof KeyboardEvent>[1] = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  await act(async () => document.activeElement!.dispatchEvent(event));
  return event;
}

describe("共享目录树键盘", () => {
  it("键盘折叠不丢失首个文件身份，后续加选仍打开折叠前的文件", async () => {
    function Probe() {
      const [expanded, setExpanded] = useState<Record<string, boolean>>({
        "/work/src": true,
      });
      return (
        <WorkspaceDirectoryTree
          directoryPath="/work"
          state={state}
          expandedDirectories={expanded}
          selectedPath="/work/src/one.ts"
          onSelectFile={select}
          onToggleDirectory={(path) =>
            setExpanded((previous) => ({
              ...previous,
              [path]: !previous[path],
            }))
          }
        />
      );
    }
    await act(async () => root.render(<Probe />));
    await act(async () => row("src").focus());
    await press("ArrowLeft");
    expect(row("src/one.ts")).toBeUndefined();
    expect(select).not.toHaveBeenCalled();
    await act(async () =>
      row("a.ts").dispatchEvent(
        new MouseEvent("click", { bubbles: true, metaKey: true }),
      ),
    );
    expect(select).toHaveBeenCalledExactlyOnceWith("/work/src/one.ts", {
      isPreview: true,
    });
    expect(row("a.ts").getAttribute("aria-selected")).toBe("true");
    await press("ArrowUp");
    await press("ArrowRight");
    expect(row("src/one.ts").getAttribute("aria-selected")).toBe("true");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("sticky目录不重复暴露树项，点击沿canonical目录折叠并恢复焦点", async () => {
    function Probe() {
      const [expanded, setExpanded] = useState<Record<string, boolean>>({
        "/work/src": true,
      });
      return (
        <WorkspaceDirectoryTree
          directoryPath="/work"
          state={{
            directoryCache: {
              "/work": listing("/work", ["src/", "z.ts"]),
              "/work/src": listing(
                "/work/src",
                Array.from({ length: 100 }, (_, index) => `file${index}.ts`),
              ),
            },
            loadingDirectories: {},
          }}
          expandedDirectories={expanded}
          selectedPath={null}
          onSelectFile={select}
          onToggleDirectory={(path) =>
            setExpanded((previous) => ({
              ...previous,
              [path]: !previous[path],
            }))
          }
        />
      );
    }
    await act(async () => root.render(<Probe />));
    const canonical = row("src");
    await act(async () => canonical.focus());
    const scroll = host.querySelector<HTMLElement>(
      "[data-file-tree-virtualized-scroll]",
    )!;
    await act(async () => {
      scroll.scrollTop = 280;
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const sticky = host.querySelector<HTMLButtonElement>(
      "[data-file-tree-sticky-row]",
    )!;
    expect(sticky).not.toBe(canonical);
    expect(sticky.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(sticky.hasAttribute("role")).toBe(false);
    expect(sticky.tabIndex).toBe(-1);
    expect(canonical.dataset.itemParked).toBe("true");
    expect(document.activeElement).toBe(canonical);
    await act(async () => sticky.click());
    expect(document.activeElement).toBe(canonical);
    expect(canonical.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
    expect(host.querySelector("[data-file-tree-sticky-row]")).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("大目录有限挂载，End跨越离屏行且保留同一真实焦点元素", async () => {
    const large = listing(
      "/work",
      Array.from({ length: 10000 }, (_, i) => `file${i}.ts`),
    );
    await act(async () =>
      root.render(
        <WorkspaceDirectoryTree
          directoryPath="/work"
          state={{ directoryCache: { "/work": large }, loadingDirectories: {} }}
          expandedDirectories={{}}
          selectedPath={null}
          onToggleDirectory={vi.fn()}
          onSelectFile={select}
        />,
      ),
    );
    const scroll = host.querySelector<HTMLElement>(
      "[data-file-tree-virtualized-scroll]",
    )!;
    const mounted = () => host.querySelectorAll('[role="treeitem"]');
    expect(mounted().length).toBeLessThan(40);
    const first = row("file0.ts");
    await act(async () => first.focus());
    await act(async () => {
      scroll.scrollTop = 14000;
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    expect(document.activeElement).toBe(first);
    expect(first.dataset.itemParked).toBe("true");
    expect(mounted().length).toBeLessThan(40);
    await press("End");
    const last = row("file9999.ts");
    expect(document.activeElement).toBe(last);
    expect(last.dataset.itemParked).toBeUndefined();
    expect(last.getAttribute("aria-posinset")).toBe("10000");
    expect(row("file0.ts")).toBeUndefined();
    await press("ArrowUp");
    expect(document.activeElement).toBe(row("file9998.ts"));
    await press("Home");
    expect(document.activeElement).toBe(row("file0.ts"));
    expect(select).not.toHaveBeenCalled();
  });

  it("选中文件在首次可用时定位，外部焦点不被抢且resize更新可见窗口", async () => {
    let resize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    outside.focus();
    const large = listing(
      "/work",
      Array.from({ length: 1000 }, (_, i) => `file${i}.ts`),
    );
    const renderLarge = async (loaded: boolean) => {
      await act(async () =>
        root.render(
          <WorkspaceDirectoryTree
            directoryPath="/work"
            state={{
              directoryCache: loaded ? { "/work": large } : {},
              loadingDirectories: {},
            }}
            expandedDirectories={{}}
            selectedPath="/work/file900.ts"
            onToggleDirectory={vi.fn()}
            onSelectFile={select}
          />,
        ),
      );
    };
    try {
      await renderLarge(false);
      await renderLarge(true);
      const scroll = host.querySelector<HTMLElement>(
        "[data-file-tree-virtualized-scroll]",
      )!;
      expect(scroll.scrollTop).toBe(25200);
      expect(row("file900.ts").getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(outside);
      Object.defineProperty(scroll, "clientHeight", {
        configurable: true,
        value: 56,
      });
      await act(async () => resize!());
      expect(host.querySelectorAll('[role="treeitem"]').length).toBeLessThan(
        25,
      );
      expect(document.activeElement).toBe(outside);
      await act(async () => root.render(null));
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      outside.remove();
      vi.unstubAllGlobals();
    }
  });

  it("树行表达层级和同级位置，焦点只有一个Tab入口且不改变选中态", async () => {
    await render();
    const tree = host.querySelector('[role="tree"]')!;
    expect(tree.getAttribute("tabindex")).toBe("-1");
    const tabStops = () =>
      Array.from(tree.querySelectorAll('[role="treeitem"][tabindex="0"]'));
    expect(tabStops()).toEqual([row("a.ts")]);
    expect(row("src").getAttribute("aria-selected")).toBe("false");
    expect(row("a.ts").getAttribute("aria-selected")).toBe("true");
    expect(row("src").querySelectorAll("svg")).toHaveLength(1);
    expect(row("src").getAttribute("aria-label")).toBe("src");
    expect(row("src").hasAttribute("aria-current")).toBe(false);
    await act(async () => row("src").focus());
    expect(tabStops()).toEqual([row("src")]);
    await press("ArrowRight");
    await press("ArrowRight");
    await press("ArrowRight");
    const semantics = Array.from(
      tree.querySelectorAll('[role="treeitem"]'),
    ).map((element) => [
      element.getAttribute("aria-level"),
      element.getAttribute("aria-posinset"),
      element.getAttribute("aria-setsize"),
    ]);
    expect(semantics).toEqual([
      ["1", "1", "3"],
      ["2", "1", "3"],
      ["3", "1", "1"],
      ["2", "2", "3"],
      ["2", "3", "3"],
      ["1", "2", "3"],
      ["1", "3", "3"],
    ]);
    await press("ArrowDown");
    expect(tabStops()).toEqual([row("src/nested/leaf.ts")]);
    expect(row("a.ts").getAttribute("aria-selected")).toBe("true");
    expect(row("src/nested/leaf.ts").getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(select).not.toHaveBeenCalled();
    await press("ArrowLeft");
    await press("ArrowLeft");
    expect(row("src/nested/leaf.ts")).toBeUndefined();
    expect(tabStops()).toEqual([row("src/nested")]);
  });

  it("根目录切换恢复该树的Tab入口，移除旧焦点路径且不抢真实焦点", async () => {
    const renderDirectory = async (
      directoryPath: string,
      selectedPath: string | null,
    ) => {
      await act(async () =>
        root.render(
          <WorkspaceDirectoryTree
            directoryPath={directoryPath}
            state={state}
            expandedDirectories={{}}
            selectedPath={selectedPath}
            onToggleDirectory={vi.fn()}
            onSelectFile={select}
          />,
        ),
      );
    };
    await renderDirectory("/work", "/work/a.ts");
    await act(async () => row("z.ts").focus());
    await renderDirectory("/work/src", "/work/src/one.ts");
    const currentTabStop = host.querySelector(
      '[role="treeitem"][tabindex="0"]',
    );
    expect(currentTabStop).toBe(row("src/one.ts"));
    expect(document.activeElement).not.toBe(currentTabStop);
    expect(row("z.ts")).toBeUndefined();
    await renderDirectory("/work/src/nested", null);
    expect(
      host.querySelectorAll('[role="treeitem"][tabindex="0"]'),
    ).toHaveLength(1);
    expect(row("src/nested/leaf.ts").tabIndex).toBe(0);
    expect(select).not.toHaveBeenCalled();
  });

  it("展开目录从加载转到可用时保留同一行和焦点，状态行不冲突", async () => {
    const errors = vi.spyOn(console, "error");
    const renderState = async (loaded: boolean) => {
      await act(async () =>
        root.render(
          <WorkspaceDirectoryTree
            directoryPath="/work"
            state={
              loaded
                ? state
                : {
                    directoryCache: { "/work": state.directoryCache["/work"] },
                    loadingDirectories: { "/work/src": true },
                  }
            }
            expandedDirectories={{ "/work/src": true }}
            selectedPath={null}
            onToggleDirectory={vi.fn()}
            onSelectFile={select}
          />,
        ),
      );
    };
    try {
      await renderState(false);
      const directory = row("src");
      await act(async () => directory.focus());
      expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
      await renderState(true);
      expect(host.querySelector('[role="status"]')).toBeNull();
      expect(row("src")).toBe(directory);
      expect(document.activeElement).toBe(directory);
      expect(directory.tabIndex).toBe(0);
      expect(row("src/one.ts").getAttribute("aria-level")).toBe("2");
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it("上下按可见自然顺序移动，边界不循环，也不打开文件", async () => {
    await render();
    await act(async () => row("src").focus());
    expect((await press("ArrowUp")).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(row("src"));
    await press("ArrowDown");
    expect(document.activeElement).toBe(row("a.ts"));
    await press("End");
    expect(document.activeElement).toBe(row("z.ts"));
    await press("ArrowDown");
    expect(document.activeElement).toBe(row("z.ts"));
    await press("Home");
    expect(document.activeElement).toBe(row("src"));
    expect(select).not.toHaveBeenCalled();
  });

  it("右键展开再进入下一可见行；左键折叠或返回真实父目录", async () => {
    await render();
    const source = row("src");
    await act(async () => source.focus());
    await press("ArrowRight");
    expect(source.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(source);
    await press("ArrowRight");
    expect(document.activeElement).toBe(row("src/nested"));
    await press("ArrowRight");
    await press("ArrowDown");
    expect(document.activeElement).toBe(row("src/nested/leaf.ts"));
    await press("ArrowLeft");
    expect(document.activeElement).toBe(row("src/nested"));
    await press("ArrowLeft");
    expect(row("src/nested/leaf.ts")).toBeUndefined();
    expect(document.activeElement).toBe(row("src/nested"));
    await press("ArrowLeft");
    expect(document.activeElement).toBe(source);
    await press("ArrowLeft");
    expect(source.getAttribute("aria-expanded")).toBe("false");
    expect(select).not.toHaveBeenCalled();
  });

  it("文件右键移动下一行，根项左键保持焦点", async () => {
    await render();
    await act(async () => row("a.ts").focus());
    await press("ArrowRight");
    expect(document.activeElement).toBe(row("z.ts"));
    await press("ArrowLeft");
    expect(document.activeElement).toBe(row("z.ts"));
  });

  it("输入法和原生按钮激活保留给原事件 owner", async () => {
    await render();
    await act(async () => row("a.ts").focus());
    expect(
      (await press("ArrowDown", { isComposing: true })).defaultPrevented,
    ).toBe(false);
    expect(document.activeElement).toBe(row("a.ts"));
    expect((await press("Enter")).defaultPrevented).toBe(false);
    expect((await press(" ")).defaultPrevented).toBe(false);
    await act(async () => row("a.ts").click());
    expect(select).toHaveBeenCalledExactlyOnceWith("/work/a.ts", {
      isPreview: true,
    });
    await act(async () =>
      row("a.ts").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(select).toHaveBeenLastCalledWith("/work/a.ts", { isPreview: false });
    expect(row("a.ts").getAttribute("aria-selected")).toBe("true");
  });
});
