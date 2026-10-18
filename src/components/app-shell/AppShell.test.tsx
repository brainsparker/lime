import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell, AppShellHeader, HeaderAction } from "./AppShell";

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
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));
const labels = (node: Element) =>
  Array.from(node.querySelectorAll("button"), (button) => button.textContent);

describe("共享窗口页头", () => {
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
