import React, { act, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollapsibleUserMessageContent } from "./CollapsibleUserMessageContent";
import {
  VirtualizedTurnList,
  type VirtualizedTurnListApi,
} from "./VirtualizedTurnList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const VIEWPORT_HEIGHT = 600;
const ROW_HEIGHT = 200;
const FULL_HEIGHT = 1200;
const PROBE_KEY = "turn-8";
const ANCHOR_KEY = "turn-10";

type TestResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;

interface TestResizeObserver {
  targets: Set<Element>;
  callback: TestResizeObserverCallback;
}

interface ScrollTopClamp {
  reason: "layout" | "set";
  before: number;
  after: number;
  scrollHeight: number;
}

const observers: TestResizeObserver[] = [];
const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    bottom: top + height,
    left: 0,
    right: 600,
    width: 600,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function rowHeight(row: HTMLElement): number {
  const viewport = row.querySelector<HTMLElement>(
    '[data-testid="user-message-content-viewport"]',
  );
  if (!viewport) return ROW_HEIGHT;
  const maxHeight = Number.parseFloat(viewport.style.maxHeight);
  return (
    (Number.isFinite(maxHeight)
      ? Math.min(maxHeight, FULL_HEIGHT)
      : FULL_HEIGHT) +
    (row.querySelector('[data-testid="user-message-content-toggle"]') ? 24 : 0)
  );
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets = new Set<Element>();
      constructor(public callback: TestResizeObserverCallback) {
        observers.push(this);
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
      }
    },
  );
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function () {
      const container = this.closest<HTMLElement>(
        '[data-testid="measurement-scroll-container"]',
      );
      if (!container) return originalRect.call(this);
      if (this === container) return rect(0, VIEWPORT_HEIGHT);
      const prefixOffset = Number(container.dataset.prefixOffset ?? 0);
      if (this.dataset.testid === "virtualized-turn-list")
        return rect(
          prefixOffset - container.scrollTop,
          Number.parseFloat(this.style.height),
        );
      const row = this.closest<HTMLElement>("[data-turn-key]");
      if (!row) return originalRect.call(this);
      const top =
        prefixOffset +
        Number.parseFloat(row.parentElement!.style.top) -
        container.scrollTop;
      if (this === row) return rect(top, rowHeight(row));
      if (this.dataset.testid === "user-message-content-full")
        return rect(top, FULL_HEIGHT);
      if (this.dataset.testid === "user-message-content-viewport") {
        const maxHeight = Number.parseFloat(this.style.maxHeight);
        return rect(
          top,
          Number.isFinite(maxHeight)
            ? Math.min(maxHeight, FULL_HEIGHT)
            : FULL_HEIGHT,
        );
      }
      return originalRect.call(this);
    },
  );
  const originalStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    (element as HTMLElement).dataset.testid === "user-message-content-full"
      ? ({ lineHeight: "10px" } as CSSStyleDeclaration)
      : originalStyle(element),
  );
});

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  observers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mountMeasuredList({
  count = 30,
  prefixOffset = 0,
  clampScrollTop = false,
}: {
  count?: number;
  prefixOffset?: number;
  clampScrollTop?: boolean;
} = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const entries = Array.from({ length: count }, (_, index) => ({
    id: `turn-${index}`,
    estimatedHeightPx: ROW_HEIGHT,
  }));
  const containerRef = { current: null as HTMLDivElement | null };
  const following = { current: true };
  const mounts = new Map<string, number>();
  const unmounts = new Map<string, number>();
  const scrollClamps: ScrollTopClamp[] = [];
  let storedScrollTop = 0;
  let api: VirtualizedTurnListApi | null = null;
  let collapse!: () => void;
  const isFollowingTail = () => following.current;
  const holdViewport = () => {
    following.current = false;
  };
  const setScrollTop = (top: number) => {
    if (containerRef.current) containerRef.current.scrollTop = top;
  };
  const scrollToTail = () => {
    const container = containerRef.current;
    if (container)
      container.scrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight,
      );
  };
  const onApiChange = (next: VirtualizedTurnListApi | null) => {
    api = next;
  };
  const attachContainer = (element: HTMLDivElement | null) => {
    containerRef.current = element;
    if (!element) return;
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: VIEWPORT_HEIGHT,
    });
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      get: () =>
        prefixOffset +
        Number.parseFloat(
          element.querySelector<HTMLElement>(
            '[data-testid="virtualized-turn-list"]',
          )?.style.height || "0",
        ),
    });
    if (clampScrollTop) {
      // 浏览器在内容高度收缩后也会限制已有滚动位置；只模拟物理边界。
      const clamp = (before: number, reason: ScrollTopClamp["reason"]) => {
        const scrollHeight = element.scrollHeight;
        const after = Math.max(
          0,
          Math.min(before, Math.max(0, scrollHeight - element.clientHeight)),
        );
        if (before !== after)
          scrollClamps.push({ reason, before, after, scrollHeight });
        return after;
      };
      Object.defineProperty(element, "scrollTop", {
        configurable: true,
        get: () => {
          storedScrollTop = clamp(storedScrollTop, "layout");
          return storedScrollTop;
        },
        set: (top: number) => {
          storedScrollTop = clamp(top, "set");
        },
      });
    }
  };
  function Row({
    id,
    collapsedLineCount,
  }: {
    id: string;
    collapsedLineCount: number;
  }) {
    useLayoutEffect(() => {
      mounts.set(id, (mounts.get(id) ?? 0) + 1);
      return () => {
        unmounts.set(id, (unmounts.get(id) ?? 0) + 1);
      };
    }, [id]);
    return id === PROBE_KEY ? (
      <CollapsibleUserMessageContent
        content="完整长正文"
        collapsedLineCount={collapsedLineCount}
      >
        <p>完整长正文</p>
      </CollapsibleUserMessageContent>
    ) : (
      <p>{id}</p>
    );
  }
  function Parent() {
    const [collapsedLineCount, setCollapsedLineCount] = useState(200);
    collapse = () => setCollapsedLineCount(20);
    return (
      <div
        ref={attachContainer}
        data-testid="measurement-scroll-container"
        data-prefix-offset={prefixOffset}
      >
        {prefixOffset > 0 && <div style={{ height: prefixOffset }} />}
        <VirtualizedTurnList
          entries={entries}
          scrollContainerRef={containerRef}
          isFollowingTail={isFollowingTail}
          scrollToTail={scrollToTail}
          setScrollTop={setScrollTop}
          holdViewport={holdViewport}
          onApiChange={onApiChange}
          renderEntry={(entry) => (
            <Row id={entry.id} collapsedLineCount={collapsedLineCount} />
          )}
        />
      </div>
    );
  }
  act(() => root.render(<Parent />));
  const row = (key: string) => {
    const element = host.querySelector<HTMLElement>(`[data-turn-key="${key}"]`);
    if (!element) throw new Error(`Missing row ${key}`);
    return element;
  };
  const revealAnchor = () =>
    act(() => {
      following.current = false;
      // 从公开几何接口进入正文中部；oracle只读真实DOM位置，不复制保锚算法。
      setScrollTop(
        prefixOffset + api!.getEntryGeometry(ANCHOR_KEY)!.startPx + 40,
      );
      containerRef.current!.dispatchEvent(new Event("scroll"));
    });
  const notifyProbeResize = () =>
    act(() => {
      const target = row(PROBE_KEY);
      const observer = observers.find((candidate) =>
        candidate.targets.has(target),
      );
      if (!observer) throw new Error("Missing row ResizeObserver");
      observer.callback(
        [
          {
            target,
            borderBoxSize: [
              { blockSize: target.getBoundingClientRect().height },
            ],
          } as unknown as ResizeObserverEntry,
        ],
        observer as unknown as ResizeObserver,
      );
    });
  return {
    host,
    row,
    mounts,
    unmounts,
    scrollClamps,
    container: containerRef.current!,
    revealAnchor,
    collapse: () => act(() => collapse()),
    notifyProbeResize,
    beginNavigation: (key: string) => {
      let completion!: Promise<void>;
      act(() => {
        completion = api!.scrollToKey(key, undefined, { align: "top" });
      });
      return completion;
    },
    scrollBy: (delta: number) =>
      act(() => {
        containerRef.current!.scrollTop += delta;
        containerRef.current!.dispatchEvent(new Event("scroll"));
      }),
  };
}

describe("VirtualizedTurnList dynamic measurement", () => {
  it("锚点上方overscan行从全文变短时保留可见行位置和原组件实例", () => {
    const view = mountMeasuredList();
    view.revealAnchor();
    const anchor = view.row(ANCHOR_KEY);
    const probe = view.row(PROBE_KEY);
    const anchorTop = anchor.getBoundingClientRect().top;
    const mountsBefore = view.mounts.get(PROBE_KEY);
    expect(anchorTop).toBe(-40);
    expect(probe.getBoundingClientRect().bottom).toBeLessThan(0);
    expect(probe.getBoundingClientRect().height).toBe(FULL_HEIGHT);
    view.collapse();
    expect(probe.getBoundingClientRect().height).toBe(224);
    let resizeError: unknown;
    try {
      view.notifyProbeResize();
    } catch (error) {
      resizeError = error;
    }
    expect(
      resizeError,
      `probe mounts=${view.mounts.get(PROBE_KEY)}, unmounts=${view.unmounts.get(PROBE_KEY) ?? 0}`,
    ).toBeUndefined();
    expect(view.row(ANCHOR_KEY)).toBe(anchor);
    expect(anchor.getBoundingClientRect().top).toBe(anchorTop);
    expect(view.row(PROBE_KEY)).toBe(probe);
    expect(view.mounts.get(PROBE_KEY)).toBe(mountsBefore);
    expect(view.unmounts.get(PROBE_KEY) ?? 0).toBe(0);
  });
  it.each([0, 160])(
    "14条列表收缩触发原生scrollTop限制后保锚（前置高度 %i）",
    (prefixOffset) => {
      const view = mountMeasuredList({
        count: 14,
        prefixOffset,
        clampScrollTop: true,
      });
      view.revealAnchor();
      const anchor = view.row(ANCHOR_KEY);
      const probe = view.row(PROBE_KEY);
      const anchorTop = anchor.getBoundingClientRect().top;
      const scrollHeightBefore = view.container.scrollHeight;
      const clampsBefore = view.scrollClamps.length;
      const probeMounts = view.mounts.get(PROBE_KEY);
      const anchorMounts = view.mounts.get(ANCHOR_KEY);
      const probeUnmounts = view.unmounts.get(PROBE_KEY) ?? 0;
      const anchorUnmounts = view.unmounts.get(ANCHOR_KEY) ?? 0;
      expect(anchorTop).toBe(-40);
      expect(probe.getBoundingClientRect().bottom).toBeLessThan(0);
      expect(probe.getBoundingClientRect().height).toBe(FULL_HEIGHT);
      view.collapse();
      expect(probe.getBoundingClientRect().height).toBe(224);
      view.notifyProbeResize();
      const layoutClamps = view.scrollClamps
        .slice(clampsBefore)
        .filter(({ reason }) => reason === "layout");
      expect(view.container.scrollHeight).toBeLessThan(scrollHeightBefore);
      expect(layoutClamps.length).toBeGreaterThan(0);
      expect(layoutClamps.every(({ before, after }) => before > after)).toBe(
        true,
      );
      expect(view.row(ANCHOR_KEY)).toBe(anchor);
      expect(
        anchor.getBoundingClientRect().top,
        `native layout clamps=${JSON.stringify(layoutClamps)}`,
      ).toBe(anchorTop);
      expect(view.row(PROBE_KEY)).toBe(probe);
      expect(view.mounts.get(PROBE_KEY)).toBe(probeMounts);
      expect(view.mounts.get(ANCHOR_KEY)).toBe(anchorMounts);
      expect(view.unmounts.get(PROBE_KEY) ?? 0).toBe(probeUnmounts);
      expect(view.unmounts.get(ANCHOR_KEY) ?? 0).toBe(anchorUnmounts);
    },
  );
  it("收缩发生于scrollToKey待提交时保留目标并完成导航，旧请求不覆盖后续阅读", async () => {
    const frames = new Map<number, (timestamp: number) => void>();
    let frameId = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: (timestamp: number) => void) => {
        frames.set(++frameId, callback);
        return frameId;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const flushFrames = () =>
      act(() => {
        const pending = [...frames.values()];
        frames.clear();
        for (const callback of pending) callback(0);
      });
    const view = mountMeasuredList();
    view.revealAnchor();
    const target = view.row("turn-11");
    const probe = view.row(PROBE_KEY);
    const targetMounts = view.mounts.get("turn-11");
    const probeMounts = view.mounts.get(PROBE_KEY);
    let completed = false;
    const completion = view.beginNavigation("turn-11").then(() => {
      completed = true;
    });
    expect(frames.size).toBe(1);
    expect(completed).toBe(false);
    const pendingTop = target.getBoundingClientRect().top;
    view.collapse();
    expect(probe.getBoundingClientRect().height).toBe(224);
    view.notifyProbeResize();
    expect(completed).toBe(false);
    expect(view.row("turn-11")).toBe(target);
    expect(view.mounts.get("turn-11")).toBe(targetMounts);
    expect(view.row(PROBE_KEY)).toBe(probe);
    expect(view.mounts.get(PROBE_KEY)).toBe(probeMounts);
    expect(target.getBoundingClientRect().top).toBe(pendingTop);
    expect(frames.size).toBe(1);
    flushFrames();
    await act(async () => {
      await Promise.resolve();
    });
    expect(completed).toBe(true);
    await completion;
    expect(view.row("turn-11")).toBe(target);
    expect(target.getBoundingClientRect().top).toBe(10);
    expect(frames.size).toBe(0);
    view.scrollBy(75);
    const readingTop = target.getBoundingClientRect().top;
    expect(readingTop).toBe(-65);
    flushFrames();
    expect(target.isConnected).toBe(true);
    expect(target.getBoundingClientRect().top).toBe(readingTop);
    const nextTarget = view.row("turn-12");
    let nextCompleted = false;
    const nextCompletion = view.beginNavigation("turn-12").then(() => {
      nextCompleted = true;
    });
    expect(frames.size).toBe(1);
    flushFrames();
    await act(async () => {
      await Promise.resolve();
    });
    expect(nextCompleted).toBe(true);
    await nextCompletion;
    expect(view.row("turn-12")).toBe(nextTarget);
    expect(nextTarget.getBoundingClientRect().top).toBe(10);
  });
});
