import { act, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VirtualizedTurnList,
  type VirtualizedTurnListApi,
} from "./VirtualizedTurnList";

const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];
type TestResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver,
) => void;
const observers: Array<{
  callback: TestResizeObserverCallback;
  targets: Set<Element>;
}> = [];
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
});
afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  observers.length = 0;
  vi.unstubAllGlobals();
});
function harness(count = 1000, retainedKeys: string[] = [], listOffset = 0) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  const containerRef: RefObject<HTMLDivElement | null> = { current: null };
  const following = { current: true };
  let api: VirtualizedTurnListApi | null = null;
  const onApiChange = (next: VirtualizedTurnListApi | null) => {
    api = next;
  };
  let entries = Array.from({ length: count }, (_, index) => ({
    id: `turn-${index}`,
  }));
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
  const attachContainer = (element: HTMLDivElement | null) => {
    containerRef.current = element;
    if (element) {
      Object.defineProperty(element, "clientHeight", {
        configurable: true,
        value: 600,
      });
      Object.defineProperty(element, "scrollHeight", {
        configurable: true,
        get: () =>
          Number.parseFloat(
            element.querySelector<HTMLElement>(
              "[data-testid=virtualized-turn-list]",
            )?.style.height || "0",
          ),
      });
    }
  };
  const render = (focusedKey?: string, focusRequestKey?: number) =>
    act(() =>
      root.render(
        <div ref={attachContainer}>
          <VirtualizedTurnList
            entries={entries}
            scrollContainerRef={containerRef}
            isFollowingTail={isFollowingTail}
            scrollToTail={scrollToTail}
            setScrollTop={setScrollTop}
            holdViewport={holdViewport}
            retainedKeys={retainedKeys}
            focusedKey={focusedKey}
            focusRequestKey={focusRequestKey}
            onApiChange={onApiChange}
            renderEntry={(entry) => <button>{entry.id}</button>}
          />
        </div>,
      ),
    );
  render();
  const list = host.querySelector<HTMLElement>(
    "[data-testid=virtualized-turn-list]",
  )!;
  Object.defineProperty(list, "offsetTop", {
    configurable: true,
    get: () => listOffset,
  });
  const scroll = (top: number) =>
    act(() => {
      following.current = false;
      setScrollTop(top);
      containerRef.current?.dispatchEvent(new Event("scroll"));
    });
  const resize = (key: string, height: number) =>
    act(() => {
      const target = host.querySelector(`[data-turn-key="${key}"]`)!;
      const observer = observers.find((candidate) =>
        candidate.targets.has(target),
      )!;
      observer.callback(
        [
          {
            target,
            borderBoxSize: [{ blockSize: height }],
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });
  return {
    host,
    containerRef,
    following,
    getApi: () => api!,
    scroll,
    resize,
    render,
    setListOffset: (next: number) => {
      listOffset = next;
    },
    prepend: () => {
      entries = [{ id: "older" }, ...entries];
      render();
    },
  };
}

describe("VirtualizedTurnList", () => {
  it("unmounts offscreen React rows even when all history is loaded", () => {
    const view = harness();
    expect(
      view.host.querySelectorAll("[data-turn-key]").length,
    ).toBeLessThanOrEqual(7);
    expect(view.host.textContent).toContain("turn-999");
    view.scroll(0);
    expect(view.host.textContent).toContain("turn-0");
    expect(view.host.textContent).not.toContain("turn-999");
    const list = view.host.querySelector<HTMLElement>(
      "[data-testid=virtualized-turn-list]",
    )!;
    expect(list.dataset.totalEntries).toBe("1000");
    expect(Number(list.dataset.offscreenCount)).toBeGreaterThan(990);
  });
  it("preserves the reading anchor on prepend and ResizeObserver height changes", () => {
    const view = harness();
    view.scroll(29200);
    view.resize("turn-98", 480);
    expect(view.containerRef.current?.scrollTop).toBe(29400);
    expect(view.host.textContent).toContain("turn-100");
    view.prepend();
    expect(view.containerRef.current?.scrollTop).toBe(29692);
    expect(view.host.textContent).toContain("turn-100");
  });
  it("follows tail growth and preserves older reading while a running tail is retained", () => {
    const view = harness(1000, ["turn-999"]);
    const before = view.containerRef.current!.scrollTop;
    view.resize("turn-999", 680);
    expect(view.containerRef.current!.scrollTop).toBe(before + 400);
    view.scroll(29200);
    view.resize("turn-999", 880);
    expect(view.containerRef.current!.scrollTop).toBe(29200);
    expect(
      view.host.querySelectorAll("[data-turn-key]").length,
    ).toBeLessThanOrEqual(9);
  });
  it.each(["keydown", "wheel", "touchmove"] as const)(
    "captures the physical viewport on %s before the queued scroll event arrives",
    (eventType) => {
      const view = harness();
      const container = view.containerRef.current!;
      act(() => {
        container.scrollTop = 29200;
        const event =
          eventType === "keydown"
            ? new KeyboardEvent(eventType, { key: "PageUp", bubbles: true })
            : eventType === "wheel"
              ? new WheelEvent(eventType, { deltaY: -80, bubbles: true })
              : new Event(eventType, { bubbles: true });
        container.dispatchEvent(event);
        view.following.current = false;
      });
      view.prepend();
      expect(container.scrollTop).toBe(29492);
      expect(view.host.textContent).toContain("turn-100");
      expect(
        view.host.querySelectorAll("[data-turn-key]").length,
      ).toBeLessThanOrEqual(9);
    },
  );
  it("preserves the visible anchor when pagination removes content above the list", () => {
    const view = harness(1000, [], 80);
    view.scroll(29280);
    view.setListOffset(0);
    view.prepend();
    expect(view.containerRef.current!.scrollTop).toBe(29492);
    expect(view.host.textContent).toContain("turn-100");
  });
  it("materializes and reveals a distant focused owner without mounting the intervening history", () => {
    const view = harness(1000, ["turn-20"]);
    view.render("turn-20", 1);
    expect(view.following.current).toBe(false);
    expect(view.containerRef.current!.scrollTop).toBe(5680);
    expect(view.host.textContent).toContain("turn-20");
    expect(
      view.host.querySelectorAll("[data-turn-key]").length,
    ).toBeLessThanOrEqual(9);
  });
  it("keeps a keyboard-focused row mounted until focus leaves it", () => {
    const view = harness();
    const button = view.host.querySelector(
      "[data-turn-key=turn-999] button",
    ) as HTMLButtonElement;
    act(() => button.focus());
    view.scroll(0);
    expect(button.isConnected).toBe(true);
    expect(document.activeElement).toBe(button);
    act(() => button.blur());
    expect(button.isConnected).toBe(false);
  });
  it("exposes canonical geometry and settles superseded or aborted navigation", async () => {
    const view = harness();
    const api = view.getApi();
    expect(api.getEntryGeometry("turn-100")).toEqual({
      startPx: 29200,
      endPx: 29480,
    });
    let first: Promise<void>;
    let second: Promise<void>;
    const abort = new AbortController();
    act(() => {
      first = api.scrollToKey("turn-20");
      second = api.scrollToKey("turn-100", undefined, { signal: abort.signal });
      abort.abort();
    });
    await expect(first!).resolves.toBeUndefined();
    await expect(second!).resolves.toBeUndefined();
    expect(view.host.textContent).toContain("turn-100");
    expect(view.host.textContent).not.toContain("turn-20");
    let done: Promise<void>;
    act(() => {
      done = api.scrollToKey("turn-200");
    });
    await act(async () => {
      await done!;
    });
    expect(view.host.textContent).toContain("turn-200");
    expect(
      view.host.querySelectorAll("[data-turn-key]").length,
    ).toBeLessThanOrEqual(9);
  });
});
