import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CollapsibleUserMessageContent,
  type CollapsibleUserMessageContentProps,
} from "./CollapsibleUserMessageContent";
import { VirtualizedTurnList } from "./VirtualizedTurnList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "agentChat.messageList.userMessage.showMore": "显示更多",
        "agentChat.messageList.userMessage.showLess": "收起",
      };
      return labels[key] ?? key;
    },
  }),
}));

interface RectSpec {
  top: number;
  height: number;
  width?: number;
  left?: number;
}

interface Metrics {
  height: number;
  width: number;
  lineHeight: number | string;
  interactions: Map<string, RectSpec[]>;
}

type TestResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

interface TestObserver {
  targets: Set<Element>;
  callback: TestResizeObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}

const observers: TestObserver[] = [];
const mounted: Array<{ unmount: () => void }> = [];
let metrics: Metrics;

function rectangle({ top, height, width = metrics.width, left = 0 }: RectSpec) {
  return {
    x: left,
    y: top,
    top,
    bottom: top + height,
    left,
    right: left + width,
    height,
    width,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  metrics = {
    height: 600,
    width: 600,
    lineHeight: 20,
    interactions: new Map(),
  };
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      disconnect = vi.fn(() => this.targets.clear());
      constructor(public callback: TestResizeObserverCallback) {
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
    },
  );
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      if (this.dataset.testid === "user-message-content-full") {
        return rectangle({ top: 0, height: metrics.height });
      }
      if (this.dataset.testid === "user-message-content-viewport") {
        const maxHeight = Number.parseFloat(this.style.maxHeight);
        return rectangle({
          top: 0,
          height: Number.isFinite(maxHeight)
            ? Math.min(maxHeight, metrics.height)
            : metrics.height,
        });
      }
      return originalRect.call(this);
    },
  );
  const originalRects = HTMLElement.prototype.getClientRects;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(
    function () {
      const specs = metrics.interactions.get(this.dataset.testid ?? "");
      if (!specs) return originalRects.call(this);
      const rectangles = specs.map(rectangle);
      return Object.assign(rectangles, {
        item: (index: number) => rectangles[index] ?? null,
      }) as unknown as DOMRectList;
    },
  );
  const originalStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    if (
      (element as HTMLElement).dataset.testid === "user-message-content-full"
    ) {
      return {
        lineHeight:
          typeof metrics.lineHeight === "number"
            ? `${metrics.lineHeight}px`
            : metrics.lineHeight,
      } as CSSStyleDeclaration;
    }
    return originalStyle(element);
  });
});

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  observers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fullText = `${"长正文 ".repeat(300)}\n尾部 Markdown **全文** 👩🏽‍💻`;

function mount(options: Partial<CollapsibleUserMessageContentProps> = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root: Root = createRoot(host);
  let unmounted = false;
  let props: CollapsibleUserMessageContentProps = {
    content: fullText,
    children: <p>{fullText}</p>,
    ...options,
  };
  const render = () =>
    act(() => root.render(<CollapsibleUserMessageContent {...props} />));
  const required = <T extends HTMLElement>(testid: string): T => {
    const element = host.querySelector<T>(`[data-testid="${testid}"]`);
    if (!element) throw new Error(`Missing ${testid}`);
    return element;
  };
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    act(() => root.unmount());
    host.remove();
  };
  mounted.push({ unmount });
  render();
  return {
    host,
    unmount,
    required,
    state: () =>
      required("collapsible-user-message-content").dataset
        .userMessageContentState,
    viewport: () => required("user-message-content-viewport"),
    full: () => required("user-message-content-full"),
    toggle: () => required<HTMLButtonElement>("user-message-content-toggle"),
    clickToggle: () =>
      act(() =>
        required<HTMLButtonElement>("user-message-content-toggle").click(),
      ),
    update: (patch: Partial<CollapsibleUserMessageContentProps>) => {
      props = { ...props, ...patch };
      render();
    },
    resize: (patch: Partial<Metrics> = {}) => {
      Object.assign(metrics, patch);
      act(() => {
        for (const observer of observers) {
          if (observer.targets.has(required("user-message-content-full"))) {
            observer.callback([], observer as unknown as ResizeObserver);
          }
        }
      });
    },
  };
}

function interactiveBody() {
  metrics.interactions = new Map([
    ["visible-link", [{ top: 10, height: 20 }]],
    ["tail-link", [{ top: 520, height: 20 }]],
    // inline link 的后一段被裁切，整个互动元素暂停。
    [
      "partial-link",
      [
        { top: 370, height: 20 },
        { top: 390, height: 20 },
      ],
    ],
    ["original-inert-link", [{ top: 540, height: 20 }]],
  ]);
  return (
    <div>
      <a href="#visible" data-testid="visible-link">
        头部链接
      </a>
      <a href="#partial" data-testid="partial-link">
        跨边界链接
      </a>
      <a href="#tail" data-testid="tail-link">
        尾部链接
      </a>
      <a
        href="#original"
        data-testid="original-inert-link"
        ref={(element) => element?.setAttribute("inert", "original")}
      >
        已有 inert
      </a>
    </div>
  );
}

describe("CollapsibleUserMessageContent", () => {
  it("虚拟列表父重渲染只改变JSX身份时不重复同步测量正文", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    mounted.push({
      unmount: () => {
        act(() => root.unmount());
        host.remove();
      },
    });
    const entries = Array.from({ length: 14 }, (_, index) => ({
      id: `turn-${index}`,
    }));
    const containerRef = { current: null as HTMLDivElement | null };
    const isFollowingTail = () => false;
    const scrollToTail = () => undefined;
    const setScrollTop = (top: number) => {
      if (containerRef.current) containerRef.current.scrollTop = top;
    };
    const holdViewport = () => undefined;
    let rerender!: () => void;
    function Parent() {
      const [generation, setGeneration] = React.useState(0);
      rerender = () => setGeneration((current) => current + 1);
      return (
        <div ref={containerRef} data-generation={generation}>
          <VirtualizedTurnList
            entries={entries}
            scrollContainerRef={containerRef}
            isFollowingTail={isFollowingTail}
            scrollToTail={scrollToTail}
            setScrollTop={setScrollTop}
            holdViewport={holdViewport}
            renderEntry={() => (
              <CollapsibleUserMessageContent content={fullText}>
                <p>{fullText}</p>
              </CollapsibleUserMessageContent>
            )}
          />
        </div>
      );
    }
    act(() => root.render(<Parent />));
    const bodies = [
      ...host.querySelectorAll<HTMLElement>(
        '[data-testid="collapsible-user-message-content"]',
      ),
    ];
    expect(bodies.length).toBeGreaterThan(1);
    expect(
      bodies.every(
        (body) => body.dataset.userMessageContentState === "collapsed",
      ),
    ).toBe(true);
    const getStyle = vi.mocked(window.getComputedStyle);
    getStyle.mockClear();
    act(() => {
      rerender();
    });
    expect(getStyle).not.toHaveBeenCalled();
    expect(
      bodies.every(
        (body) =>
          body.isConnected &&
          body.dataset.userMessageContentState === "collapsed",
      ),
    ).toBe(true);
  });

  it("使用真实行高和严格20行加1px阈值，不截断完整内容", () => {
    metrics.height = 401;
    const view = mount();
    expect(view.state()).toBe("short");
    expect(view.host.querySelector("button")).toBeNull();
    view.resize({ height: 401.01 });
    expect(view.state()).toBe("collapsed");
    expect(view.viewport().style.maxHeight).toBe("400px");
    expect(view.full().textContent).toBe(fullText);
    expect(view.toggle().getAttribute("aria-expanded")).toBe("false");
    expect(view.toggle().getAttribute("aria-controls")).toBe(
      view.viewport().id,
    );
    expect(view.toggle().type).toBe("button");
    view.clickToggle();
    expect(view.state()).toBe("expanded");
    expect(view.viewport().style.maxHeight).toBe("");
    expect(view.full().textContent).toBe(fullText);
    expect(view.toggle().textContent).toBe("收起");
  });

  it("仅观察自然内层，按当前行高重测而不硬编码28px", () => {
    metrics.lineHeight = 24;
    metrics.height = 500;
    const view = mount();
    expect(view.viewport().style.maxHeight).toBe("480px");
    expect(observers).toHaveLength(1);
    expect([...observers[0].targets]).toEqual([view.full()]);
    view.resize({ lineHeight: 28 });
    expect(view.state()).toBe("short");
    expect(view.host.querySelector("button")).toBeNull();
    view.resize({ height: 700 });
    expect(view.viewport().style.maxHeight).toBe("560px");
    view.update({ collapsedLineCount: 10 });
    expect(view.viewport().style.maxHeight).toBe("280px");
  });

  it("无效行高或无布局时展示全文，恢复有效测量后才折叠", () => {
    metrics.lineHeight = "normal";
    const view = mount({ children: interactiveBody() });
    expect(view.state()).toBe("unmeasured");
    expect(view.viewport().style.maxHeight).toBe("");
    expect(view.required("tail-link").hasAttribute("inert")).toBe(false);
    view.resize({ lineHeight: 20 });
    expect(view.state()).toBe("collapsed");
    expect(view.required("tail-link").hasAttribute("inert")).toBe(true);
    view.resize({ width: 0 });
    expect(view.state()).toBe("unmeasured");
    expect(view.viewport().style.maxHeight).toBe("");
    expect(view.required("tail-link").hasAttribute("inert")).toBe(false);
    view.resize({ width: 600 });
    expect(view.state()).toBe("collapsed");
  });

  it("重测和content更新尊重用户展开及收起选择", () => {
    const statesBeforeToggle: Array<string | undefined> = [];
    let readState: () => string | undefined = () => undefined;
    const onBeforeToggle = vi.fn(() => statesBeforeToggle.push(readState()));
    const view = mount({ onBeforeToggle });
    readState = view.state;
    view.clickToggle();
    expect(statesBeforeToggle).toEqual(["collapsed"]);
    view.update({ content: "新正文", children: <p>新正文</p> });
    view.resize({ height: 1200, lineHeight: 24 });
    expect(view.state()).toBe("expanded");
    view.resize({ height: 200 });
    expect(view.state()).toBe("short");
    view.resize({ height: 1200 });
    expect(view.state()).toBe("expanded");
    view.clickToggle();
    expect(statesBeforeToggle).toEqual(["collapsed", "expanded"]);
    view.resize({ height: 900 });
    view.update({ content: "再次更新" });
    expect(view.state()).toBe("collapsed");
    expect(onBeforeToggle).toHaveBeenCalledTimes(2);
  });

  it("只暂停被裁切的互动元素，展开时恢复已有inert原值", () => {
    const view = mount({ children: interactiveBody() });
    expect(view.required("visible-link").hasAttribute("inert")).toBe(false);
    expect(view.required("tail-link").hasAttribute("inert")).toBe(true);
    expect(view.required("partial-link").hasAttribute("inert")).toBe(true);
    view.clickToggle();
    expect(view.required("tail-link").hasAttribute("inert")).toBe(false);
    expect(view.required("partial-link").hasAttribute("inert")).toBe(false);
    expect(view.required("original-inert-link").getAttribute("inert")).toBe(
      "original",
    );
    view.clickToggle();
    expect(view.required("tail-link").hasAttribute("inert")).toBe(true);
  });

  it("收起将被隐藏的当前焦点回收到按钮并禁止隐式滚动", () => {
    const view = mount({ children: interactiveBody() });
    view.clickToggle();
    const tail = view.required<HTMLAnchorElement>("tail-link");
    act(() => tail.focus());
    expect(document.activeElement).toBe(tail);
    const toggle = view.toggle();
    const focus = vi.spyOn(toggle, "focus");
    view.clickToggle();
    expect(document.activeElement).toBe(toggle);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(tail.hasAttribute("inert")).toBe(true);
  });

  it("几何不变的重测仍恢复重新可见的互动，并回收新隐藏的焦点", () => {
    const view = mount({ children: interactiveBody() });
    const visible = view.required<HTMLAnchorElement>("visible-link");
    act(() => visible.focus());
    metrics.interactions.set("tail-link", [{ top: 100, height: 20 }]);
    metrics.interactions.set("visible-link", [{ top: 500, height: 20 }]);
    view.resize();
    expect(view.state()).toBe("collapsed");
    expect(view.required("tail-link").hasAttribute("inert")).toBe(false);
    expect(visible.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(view.toggle());
  });

  it("自然高度不变的异步子节点插入和替换也暂停隐藏互动", async () => {
    const view = mount({ children: interactiveBody() });
    const full = view.full();
    const height = full.getBoundingClientRect().height;
    const descendant = full.firstElementChild!;
    metrics.interactions.set("async-button", [{ top: 520, height: 20 }]);
    const button = document.createElement("button");
    button.dataset.testid = "async-button";
    button.textContent = "异步按钮";
    await act(async () => {
      descendant.append(button);
      await Promise.resolve();
    });
    expect(full.getBoundingClientRect().height).toBe(height);
    expect(view.state()).toBe("collapsed");
    expect(button.hasAttribute("inert")).toBe(true);

    metrics.interactions.set("async-link", [{ top: 540, height: 20 }]);
    const link = document.createElement("a");
    link.href = "#async";
    link.dataset.testid = "async-link";
    link.textContent = "替换后的链接";
    await act(async () => {
      button.replaceWith(link);
      await Promise.resolve();
    });
    expect(full.getBoundingClientRect().height).toBe(height);
    expect(button.hasAttribute("inert")).toBe(false);
    expect(link.hasAttribute("inert")).toBe(true);

    await act(async () => {
      link.remove();
      await Promise.resolve();
    });
    expect(link.hasAttribute("inert")).toBe(false);
    expect(view.required("visible-link").hasAttribute("inert")).toBe(false);
  });

  it("content未变的真实子树替换仍由观察器重测并恢复原inert", async () => {
    const view = mount({ children: interactiveBody() });
    const original = view.required("original-inert-link");
    const tail = view.required("tail-link");
    expect(tail.hasAttribute("inert")).toBe(true);
    metrics.height = 200;
    const getStyle = vi.mocked(window.getComputedStyle);
    getStyle.mockClear();
    await act(async () => {
      view.update({
        children: (
          <section>
            <p>{fullText}</p>
          </section>
        ),
      });
      await Promise.resolve();
    });
    expect(getStyle).toHaveBeenCalled();
    expect(view.state()).toBe("short");
    expect(view.viewport().style.maxHeight).toBe("");
    expect(view.full().textContent).toBe(fullText);
    expect(tail.hasAttribute("inert")).toBe(false);
    expect(original.getAttribute("inert")).toBe("original");
    metrics.height = 900;
    await act(async () => {
      view.update({ children: interactiveBody() });
      await Promise.resolve();
    });
    expect(view.state()).toBe("collapsed");
    expect(view.required("tail-link").hasAttribute("inert")).toBe(true);
  });

  it("每个新的匹配reveal只展开一次，不由旧请求或后续resize覆盖手动选择", () => {
    const onBeforeToggle = vi.fn();
    const view = mount({ revealRequestKey: 0, onBeforeToggle });
    expect(view.state()).toBe("collapsed");
    view.update({ revealRequestKey: 1 });
    expect(view.state()).toBe("expanded");
    expect(onBeforeToggle).not.toHaveBeenCalled();
    view.clickToggle();
    view.update({ revealRequestKey: 1, content: "更新正文" });
    view.resize({ height: 800 });
    expect(view.state()).toBe("collapsed");
    view.update({ revealRequestKey: null });
    view.update({ revealRequestKey: 1 });
    expect(view.state()).toBe("collapsed");
    view.update({ revealRequestKey: 2 });
    expect(view.state()).toBe("expanded");
    view.clickToggle();
    view.update({ revealRequestKey: 1 });
    expect(view.state()).toBe("collapsed");
    view.update({ revealRequestKey: 3 });
    expect(view.state()).toBe("expanded");
    expect(onBeforeToggle).toHaveBeenCalledTimes(2);
  });

  it("unmount断开观察并恢复原inert，迟到回调不再改写已卸载节点", () => {
    const view = mount({ children: interactiveBody() });
    const tail = view.required("tail-link");
    const original = view.required("original-inert-link");
    const observer = observers[0];
    view.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(observer.targets.size).toBe(0);
    expect(tail.hasAttribute("inert")).toBe(false);
    expect(original.getAttribute("inert")).toBe("original");
    act(() => observer.callback([], observer as unknown as ResizeObserver));
    expect(tail.hasAttribute("inert")).toBe(false);
    expect(original.getAttribute("inert")).toBe("original");
  });

  it("MutationObserver只观察full子树，重建或卸载后拒绝迟到回调", () => {
    const mutations: Array<{
      callback: () => void;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(public callback: () => void) {
          mutations.push(this);
        }
      },
    );
    const view = mount({ children: interactiveBody() });
    expect(mutations[0].observe).toHaveBeenCalledWith(view.full(), {
      childList: true,
      subtree: true,
    });
    view.update({ collapsedLineCount: 10 });
    expect(mutations[0].disconnect).toHaveBeenCalledOnce();
    expect(mutations).toHaveLength(2);
    const getStyle = vi.mocked(window.getComputedStyle);
    getStyle.mockClear();
    act(() => mutations[0].callback());
    expect(getStyle).not.toHaveBeenCalled();

    const tail = view.required("tail-link");
    const original = view.required("original-inert-link");
    view.unmount();
    expect(mutations[1].disconnect).toHaveBeenCalledOnce();
    getStyle.mockClear();
    act(() => mutations[1].callback());
    expect(getStyle).not.toHaveBeenCalled();
    expect(tail.hasAttribute("inert")).toBe(false);
    expect(original.getAttribute("inert")).toBe("original");
  });
});
