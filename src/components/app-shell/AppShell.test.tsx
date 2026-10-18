import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppShell,
  AppShellContent,
  AppShellHeader,
  Header,
  HeaderAction,
  MainContentLayout,
  UnifiedTabStrip,
} from "./AppShell";
import { HeaderToolbar } from "./HeaderToolbar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const disposers: Array<() => void> = [];
function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const rerender = (next: ReactNode) => act(() => root.render(next));
  rerender(node);
  disposers.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return { container, rerender };
}
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.restoreAllMocks();
});
const labels = (node: Element) =>
  Array.from(node.querySelectorAll("button"), (button) => button.textContent);

describe("共享窗口页头", () => {
  it("工具栏尺寸和动作密度切换保留编辑焦点与动作实例", () => {
    const activate = vi.fn();
    const view = (compact: boolean) => (
      <HeaderToolbar size={compact ? "pane" : "header"} inset={!compact}>
        <input aria-label="title" defaultValue="draft" />
        <HeaderToolbar.Actions
          compact={compact}
          secondary={<button onClick={activate}>secondary</button>}
        >
          <button onClick={activate}>primary</button>
        </HeaderToolbar.Actions>
      </HeaderToolbar>
    );
    const { container, rerender } = mount(view(false));
    const editor = container.querySelector("input")!;
    const secondary = container.querySelector("button")!;
    editor.value = "unsaved";
    editor.focus();
    rerender(view(true));
    expect(document.activeElement).toBe(editor);
    expect(editor.value).toBe("unsaved");
    expect(container.querySelector("button")).toBe(secondary);
    act(() => secondary.click());
    expect(activate).toHaveBeenCalledOnce();
    expect(container.querySelector("[compact],[secondary]")).toBeNull();
  });
  it("unified接管普通Header，隐藏strip仍保留主工具栏，清理不复活旧注册", () => {
    const oldToolbar = <button>old</button>;
    const currentToolbar = <button>current</button>;
    const contentTab = <button role="tab">content</button>;
    const view = (old: boolean, latest: boolean, visible = true) => (
      <StrictMode>
        <AppShell>
          <AppShellHeader />
          <Header>
            <button>ordinary</button>
          </Header>
          {old ? (
            <UnifiedTabStrip
              key="old"
              mode="split"
              isVisible
              desktopPlacement="titlebar"
              mainTabId="old-tab"
              mainTabPanelId="old-pane"
              mainToolbar={oldToolbar}
            />
          ) : null}
          {latest ? (
            <UnifiedTabStrip
              key="latest"
              mode="split"
              isVisible={visible}
              desktopPlacement="titlebar"
              mainTabId="main-tab"
              mainTabPanelId="main-pane"
              mainToolbar={currentToolbar}
            >
              {contentTab}
            </UnifiedTabStrip>
          ) : null}
        </AppShell>
      </StrictMode>
    );
    const { container, rerender } = mount(view(true, true));
    const header = container.querySelector("header")!;
    expect(labels(header)).toEqual(["current", "content"]);
    rerender(view(false, true, false));
    expect(
      header.querySelector("[data-app-shell-unified-tab-strip]"),
    ).toBeNull();
    expect(labels(header)).toContain("current");
    expect(labels(header)).not.toContain("ordinary");
    rerender(view(false, false));
    expect(labels(header)).toEqual(["ordinary"]);
    const second = mount(view(true, true));
    second.rerender(view(true, false));
    expect(labels(second.container)).toEqual(["ordinary"]);
  });

  it("unified按desktopPlacement进入page，独立scope不会污染窗口标题", () => {
    const { container } = mount(
      <>
        <AppShell>
          <AppShellHeader />
          <AppShellContent pageSurface>
            <UnifiedTabStrip
              mode="split"
              isVisible={false}
              mainTabId="page-tab"
              mainTabPanelId="page-pane"
              mainToolbar={<button>page toolbar</button>}
            />
          </AppShellContent>
        </AppShell>
        <AppShell>
          <AppShellHeader />
          <Header>other scope</Header>
        </AppShell>
      </>,
    );
    const [one, two] = container.querySelectorAll("header");
    expect(labels(one)).toEqual([]);
    expect(labels(two)).toEqual([]);
    expect(two.textContent).toBe("other scope");
    expect(container.querySelector("main")?.textContent).toBe("page toolbar");
  });
  it("页面内容只在共享窗口页头出现，更新保留焦点，退出删除旧标题", () => {
    const onClick = vi.fn();
    const view = (title: string | null, inline = false) => (
      <AppShell>
        <AppShellHeader />
        <AppShellContent pageSurface>
          {title ? (
            <Header
              inline={inline}
              separator
              contentFade={false}
              divider={false}
            >
              <button onClick={onClick}>{title}</button>
            </Header>
          ) : null}
        </AppShellContent>
      </AppShell>
    );
    const { container, rerender } = mount(view("thread A"));
    const header = container.querySelector("header")!;
    const content = container.querySelector("main")!;
    const button = header.querySelector("button")!;
    button.focus();
    expect(content.querySelector("button")).toBeNull();
    rerender(view("thread B"));
    expect(header.querySelector("button")).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(labels(header)).toEqual(["thread B"]);
    expect(
      header
        .querySelector("[data-app-shell-page-header]")
        ?.getAttribute("data-content-fade"),
    ).toBe("false");
    act(() => button.click());
    expect(onClick).toHaveBeenCalledOnce();
    rerender(view("inline", true));
    expect(labels(header)).toEqual([]);
    expect(labels(content)).toEqual(["inline"]);
    rerender(view(null));
    expect(container.querySelector("[data-app-shell-page-header]")).toBeNull();
    expect(labels(content)).toEqual([]);
  });

  it("primary覆盖fallback，移除最新注册不复活旧实例，full-bleed保留共享动作", () => {
    const view = (old: boolean, latest: boolean, fallback: boolean) => (
      <StrictMode>
        <AppShell>
          <AppShellHeader />
          <HeaderAction actionId="sidebar-trigger" slotPosition="left">
            <button>sidebar</button>
          </HeaderAction>
          {fallback ? <MainContentLayout layout="full-bleed" fallback /> : null}
          {old ? (
            <MainContentLayout key="old" layout="custom-titlebar" />
          ) : null}
          {latest ? (
            <MainContentLayout key="latest" layout="thread-edge-scroll" />
          ) : null}
          <AppShellContent pageSurface>
            <Header>
              <button>thread</button>
            </Header>
          </AppShellContent>
        </AppShell>
      </StrictMode>
    );
    const { container, rerender } = mount(view(true, true, true));
    const content = container.querySelector("main")!;
    expect(content.dataset.mainContentLayout).toBe("thread-edge-scroll");
    expect(content.style.marginTop).toBe("44px");
    rerender(view(true, false, true));
    expect(content.dataset.mainContentLayout).toBe("full-bleed");
    expect(content.style.marginTop).toBe("0px");
    expect(labels(container.querySelector("header")!)).toEqual([
      "sidebar",
      "thread",
    ]);
    rerender(view(false, false, false));
    expect(content.dataset.mainContentLayout).toBe("default");
    expect(content.style.marginTop).toBe("44px");
    const second = mount(view(true, true, true));
    second.rerender(view(false, true, true));
    expect(
      second.container.querySelector("main")?.dataset.mainContentLayout,
    ).toBe("thread-edge-scroll");
  });

  it("布局换槽和scope隔离，custom-titlebar只移除页面内容", () => {
    const view = (fallback: boolean) => (
      <>
        <AppShell>
          <AppShellHeader />
          <MainContentLayout layout="custom-titlebar" fallback={fallback} />
          <HeaderAction actionId="action">
            <button>action</button>
          </HeaderAction>
          <AppShellContent pageSurface>
            <Header>
              <button>hidden page</button>
            </Header>
          </AppShellContent>
        </AppShell>
        <AppShell>
          <AppShellHeader />
          <AppShellContent pageSurface>
            <Header>
              <button>other page</button>
            </Header>
          </AppShellContent>
        </AppShell>
      </>
    );
    const { container, rerender } = mount(view(false));
    rerender(view(true));
    const [one, two] = container.querySelectorAll("header");
    expect(one.dataset.mainContentLayout).toBe("custom-titlebar");
    expect(two.dataset.mainContentLayout).toBe("default");
    expect(labels(one)).toEqual(["action"]);
    expect(labels(two)).toEqual(["other page"]);
  });

  it("页面页头随主内容宽度变化并避让左右窗口动作", () => {
    let contentLeft = 340;
    let contentRight = 900;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const bounds = this.hasAttribute("data-app-shell-content")
          ? [contentLeft, contentRight]
          : this.dataset.appShellHeaderSlot === "start"
            ? [92, 128]
            : [930, 980];
        return {
          left: bounds[0],
          right: bounds[1],
          top: 0,
          bottom: 44,
          width: bounds[1] - bounds[0],
          height: 44,
          x: bounds[0],
          y: 0,
          toJSON() {},
        };
      },
    );
    const view = (overlap = false) => (
      <AppShell>
        <AppShellHeader reserveWindowControls />
        <HeaderAction
          actionId="sidebar"
          slotPosition="left"
          allowsThreadContentOverlap={overlap}
        >
          <button>sidebar</button>
        </HeaderAction>
        <HeaderAction
          actionId="right"
          slotPosition="right"
          allowsThreadContentOverlap={overlap}
        >
          <button>right</button>
        </HeaderAction>
        <AppShellContent pageSurface>
          <Header>page</Header>
        </AppShellContent>
      </AppShell>
    );
    const { container, rerender } = mount(view());
    const titlebar = container.querySelector<HTMLElement>(
      "[data-app-shell-main-titlebar]",
    )!;
    expect(titlebar.style.left).toBe("340px");
    expect(titlebar.style.right).toBe(`${window.innerWidth - 900}px`);
    contentLeft = 52;
    contentRight = window.innerWidth;
    act(() => window.dispatchEvent(new Event("resize")));
    expect(titlebar.style.left).toBe("134px");
    expect(titlebar.style.right).toBe(`${window.innerWidth - 930 + 6}px`);
    rerender(view(true));
    expect(titlebar.style.left).toBe("92px");
    expect(titlebar.style.right).toBe("8px");
  });

  it("动作进入共享槽，更新内容与顺序时保持按钮焦点和唯一入口", () => {
    const onClick = vi.fn();
    const view = (label: string, order: number) => (
      <AppShell>
        <AppShellHeader />
        <section data-testid="page">
          <HeaderAction actionId="first" slotPosition="left" order={order}>
            <button onClick={onClick}>{label}</button>
          </HeaderAction>
          <HeaderAction actionId="second" slotPosition="left">
            <button>second</button>
          </HeaderAction>
        </section>
      </AppShell>
    );
    const { container, rerender } = mount(view("first", 0));
    const header = container.querySelector("header")!;
    const button = header.querySelector("button")!;
    expect(container.querySelector("section button")).toBeNull();
    button.focus();
    rerender(view("updated", 0));
    expect(labels(header)).toEqual(["updated", "second"]);
    expect(document.activeElement).toBe(button);
    act(() => button.click());
    expect(onClick).toHaveBeenCalledOnce();
    rerender(view("updated", 2));
    expect(labels(header)).toEqual(["second", "updated"]);
    expect(
      header.querySelectorAll('[data-header-action-id="first"]'),
    ).toHaveLength(1);
  });

  it("旧实例卸载不能删除同 ID 的新动作，删除新实例不复活旧动作", () => {
    const view = (old: boolean, latest: boolean) => (
      <AppShell>
        <AppShellHeader />
        {old ? (
          <HeaderAction key="old" actionId="toggle">
            <button>old</button>
          </HeaderAction>
        ) : null}
        {latest ? (
          <HeaderAction key="latest" actionId="toggle">
            <button>latest</button>
          </HeaderAction>
        ) : null}
      </AppShell>
    );
    const first = mount(view(true, true));
    expect(labels(first.container)).toEqual(["latest"]);
    first.rerender(view(false, true));
    expect(labels(first.container)).toEqual(["latest"]);
    first.rerender(view(false, false));
    expect(labels(first.container)).toEqual([]);
    const second = mount(view(true, true));
    second.rerender(view(true, false));
    expect(labels(second.container)).toEqual([]);
  });

  it("scope 隔离，StrictMode 重挂载与换槽不会留下重复动作", () => {
    const view = (slot: "left" | "right") => (
      <StrictMode>
        <AppShell>
          <AppShellHeader />
          <HeaderAction actionId="toggle" slotPosition={slot}>
            <button>workspace one</button>
          </HeaderAction>
        </AppShell>
        <AppShell>
          <AppShellHeader />
          <HeaderAction actionId="toggle" slotPosition="left">
            <button>workspace two</button>
          </HeaderAction>
        </AppShell>
      </StrictMode>
    );
    const { container, rerender } = mount(view("left"));
    const [one, two] = container.querySelectorAll("header");
    expect(labels(one)).toEqual(["workspace one"]);
    expect(labels(two)).toEqual(["workspace two"]);
    rerender(view("right"));
    expect(
      one.querySelector('[data-app-shell-header-slot="start"] button'),
    ).toBeNull();
    expect(
      one.querySelector('[data-app-shell-header-slot="end"] button')
        ?.textContent,
    ).toBe("workspace one");
    expect(labels(two)).toEqual(["workspace two"]);
  });

  it("侧栏动作阻止标题内容穿入，空槽不允许重叠", () => {
    const view = (sidebar: boolean) => (
      <AppShell>
        <AppShellHeader />
        <HeaderAction
          actionId="history"
          slotPosition="left"
          allowsThreadContentOverlap
        >
          <button>history</button>
        </HeaderAction>
        {sidebar ? (
          <HeaderAction actionId="sidebar-trigger" slotPosition="left">
            <button>sidebar</button>
          </HeaderAction>
        ) : null}
      </AppShell>
    );
    const { container, rerender } = mount(view(true));
    const start = container.querySelector(
      '[data-app-shell-header-slot="start"]',
    );
    expect(start?.hasAttribute("data-app-shell-thread-content-overlap")).toBe(
      false,
    );
    rerender(view(false));
    expect(start?.getAttribute("data-app-shell-thread-content-overlap")).toBe(
      "true",
    );
    expect(
      container
        .querySelector('[data-app-shell-header-slot="end"]')
        ?.hasAttribute("data-app-shell-thread-content-overlap"),
    ).toBe(false);
  });
});
