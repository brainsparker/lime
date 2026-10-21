import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectoryListing } from "@/lib/api/fileBrowser";
import { FileTree } from "./FileTree";
import { getDirectoryTreeRows } from "./fileTreeRows";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./WorkspaceFileContextMenu", () => ({
  WorkspaceFileContextMenu: ({ children }: { children: ReactNode }) => children,
}));

let host: HTMLDivElement;
let root: Root;
const open = vi.fn();
const toggle = vi.fn();
const cache: Record<string, DirectoryListing> = {
  "/work": {
    path: "/work",
    parentPath: null,
    error: null,
    entries: ["src/", "a.ts", "b.ts", "c.ts"].map((name) => ({
      name: name.replace(/\/$/, ""),
      path: `/work/${name.replace(/\/$/, "")}`,
      isDir: name.endsWith("/"),
      size: 0,
      modifiedAt: 0,
    })),
  },
};
const rows = getDirectoryTreeRows("/work", cache, {}, {});

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  open.mockReset();
  toggle.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mount(initial: Partial<ComponentProps<typeof FileTree>> = {}) {
  let props: ComponentProps<typeof FileTree> = {
    scope: "/work",
    rows,
    filePaths: new Set(["/work/a.ts", "/work/b.ts", "/work/c.ts"]),
    expandedDirectories: {},
    selectedPath: "/work/a.ts",
    resetKey: cache,
    onSelectFile: open,
    onToggleDirectory: toggle,
    ...initial,
  };
  const render = (next: Partial<typeof props> = {}) => {
    props = { ...props, ...next };
    act(() => root.render(<FileTree {...props} />));
  };
  render();
  return render;
}
function row(name: string) {
  return host.querySelector<HTMLButtonElement>(
    `[role="treeitem"][data-item-path="/work/${name}"]`,
  )!;
}
function selected() {
  return [
    ...host.querySelectorAll('[role="treeitem"][aria-selected="true"]'),
  ].map((element) => element.getAttribute("aria-label"));
}
function click(
  name: string,
  options: ConstructorParameters<typeof MouseEvent>[1] = {},
) {
  act(() =>
    row(name).dispatchEvent(
      new MouseEvent("click", { bubbles: true, ...options }),
    ),
  );
}
function press(
  key: string,
  options: ConstructorParameters<typeof KeyboardEvent>[1] = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => document.activeElement!.dispatchEvent(event));
  return event;
}

describe("Files canonical 选择交互", () => {
  it.each(["ctrlKey", "metaKey"] as const)(
    "%s切换选择保留首个文件，目录修饰点击不展开",
    (modifier) => {
      mount();
      click("b.ts", { [modifier]: true });
      expect(selected()).toEqual(["a.ts", "b.ts"]);
      expect(open).toHaveBeenLastCalledWith("/work/a.ts", { isPreview: true });
      click("a.ts", { [modifier]: true });
      expect(selected()).toEqual(["b.ts"]);
      expect(open).toHaveBeenLastCalledWith("/work/b.ts", { isPreview: true });
      click("src", { [modifier]: true });
      expect(selected()).toEqual(["src", "b.ts"]);
      expect(toggle).not.toHaveBeenCalled();
      open.mockClear();
      click("b.ts", { [modifier]: true });
      expect(selected()).toEqual(["src"]);
      expect(open).not.toHaveBeenCalled();
      click("src");
      expect(toggle).toHaveBeenCalledExactlyOnceWith("/work/src");
      expect(
        host
          .querySelector('[role="tree"]')
          ?.getAttribute("aria-multiselectable"),
      ).toBe("true");
    },
  );

  it("Shift点击按可见树范围选择，反向选择保留anchor且只打开首个文件", () => {
    mount();
    click("c.ts", { shiftKey: true });
    expect(selected()).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(open).toHaveBeenCalledExactlyOnceWith("/work/a.ts", {
      isPreview: true,
    });
    click("src", { shiftKey: true });
    expect(selected()).toEqual(["src", "a.ts"]);
    expect(toggle).not.toHaveBeenCalled();
    click("c.ts");
    click("a.ts", { shiftKey: true });
    expect(selected()).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(open).toHaveBeenLastCalledWith("/work/a.ts", { isPreview: true });
  });

  it("没有anchor的Shift点击只选目标，Mod+Shift范围合并既有选择", () => {
    mount({ selectedPath: null });
    click("c.ts", { shiftKey: true });
    expect(selected()).toEqual(["c.ts"]);
    click("a.ts", { metaKey: true });
    click("b.ts", { metaKey: true, shiftKey: true });
    expect(selected()).toEqual(["a.ts", "b.ts", "c.ts"]);
    // Set 插入顺序决定消费者首项，不能按DOM顺序偷偷换成a.ts。
    expect(open).toHaveBeenLastCalledWith("/work/c.ts", { isPreview: true });
  });

  it("Shift方向键扩选及反向收缩，普通方向键只移动焦点", () => {
    mount();
    act(() => row("a.ts").focus());
    expect(press("ArrowDown", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(row("b.ts"));
    expect(selected()).toEqual(["a.ts", "b.ts"]);
    press("ArrowDown", { shiftKey: true });
    expect(selected()).toEqual(["a.ts", "b.ts", "c.ts"]);
    press("ArrowUp", { shiftKey: true });
    expect(selected()).toEqual(["a.ts", "b.ts"]);
    open.mockClear();
    press("ArrowDown");
    expect(document.activeElement).toBe(row("c.ts"));
    expect(selected()).toEqual(["a.ts", "b.ts"]);
    expect(open).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "metaKey"] as const)(
    "%s+Space只切换焦点项，同修饰键+A全选可见路径",
    (modifier) => {
      mount();
      act(() => row("b.ts").focus());
      expect(press(" ", { [modifier]: true }).defaultPrevented).toBe(true);
      expect(selected()).toEqual(["a.ts", "b.ts"]);
      press(" ", { [modifier]: true });
      expect(selected()).toEqual(["a.ts"]);
      expect(press("A", { [modifier]: true }).defaultPrevented).toBe(true);
      expect(selected()).toEqual(["src", "a.ts", "b.ts", "c.ts"]);
      expect(document.activeElement).toBe(row("b.ts"));
      expect(open).toHaveBeenLastCalledWith("/work/a.ts", { isPreview: true });
    },
  );

  it.each(["selectedPath", "scope", "resetKey"] as const)(
    "受控%s变化丢弃旧多选；无关重渲染保留当前选择",
    (field) => {
      const render = mount();
      click("b.ts", { metaKey: true });
      render();
      expect(selected()).toEqual(["a.ts", "b.ts"]);
      if (field === "selectedPath") render({ selectedPath: "/work/c.ts" });
      else if (field === "scope") render({ scope: "/other" });
      else render({ resetKey: {} });
      expect(selected()).toEqual([field === "selectedPath" ? "c.ts" : "a.ts"]);
      render({ scope: "/work", selectedPath: "/work/a.ts", resetKey: cache });
      expect(selected()).toEqual(["a.ts"]);
    },
  );

  it("虚拟化全选覆盖离屏项，只发送一个预览动作且End可聚焦最后项", () => {
    const large: DirectoryListing = {
      ...cache["/work"],
      entries: Array.from({ length: 1000 }, (_, index) => ({
        name: `file${index}.ts`,
        path: `/work/file${index}.ts`,
        isDir: false,
        size: 0,
        modifiedAt: 0,
      })),
    };
    const largeRows = getDirectoryTreeRows("/work", { "/work": large }, {}, {});
    mount({
      rows: largeRows,
      filePaths: new Set(large.entries.map((entry) => entry.path)),
      selectedPath: null,
    });
    const first = host.querySelector<HTMLButtonElement>('[role="treeitem"]')!;
    act(() => first.focus());
    press("a", { metaKey: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[role="treeitem"]').length).toBeLessThan(50);
    press("End");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    const last = largeRows.at(-1);
    expect(document.activeElement?.getAttribute("data-item-path")).toBe(
      last?.kind === "entry" ? last.entry.path : null,
    );
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("IME组合键不扩选；空目录与目录焦点不会伪造文件打开", () => {
    const render = mount();
    act(() => row("a.ts").focus());
    expect(
      press("ArrowDown", { shiftKey: true, isComposing: true })
        .defaultPrevented,
    ).toBe(false);
    expect(selected()).toEqual(["a.ts"]);
    expect(open).not.toHaveBeenCalled();
    click("src");
    expect(selected()).toEqual(["src"]);
    expect(open).not.toHaveBeenCalled();
    render({ rows: [], selectedPath: null, resetKey: {} });
    expect(selected()).toEqual([]);
  });
});
