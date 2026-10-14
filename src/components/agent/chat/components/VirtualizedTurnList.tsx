import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  buildThreadLayout,
  getThreadRange,
  preserveThreadAnchor,
  type ThreadVirtualizerEntry,
} from "../projection/threadVirtualizer";

export interface VirtualizedTurnListSnapshot {
  mountedKeys: string[];
  startIndex: number;
  endIndex: number;
  offscreenCount: number;
}

export interface VirtualizedTurnListApi {
  getEntryGeometry: (key: string) => { startPx: number; endPx: number } | null;
  scrollToKey: (
    key: string,
    getTargetElement?: (row: HTMLElement) => HTMLElement | null,
    options?: { align?: "top" | "center"; signal?: AbortSignal },
  ) => Promise<void>;
}

interface NavigationRequest {
  key: string;
  align: "top" | "center";
  getTargetElement?: (row: HTMLElement) => HTMLElement | null;
  complete: () => void;
}

interface VirtualizedTurnListProps<T extends ThreadVirtualizerEntry> {
  entries: readonly T[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  isFollowingTail: () => boolean;
  scrollToTail: (behavior: "auto" | "smooth") => void;
  setScrollTop: (top: number) => void;
  holdViewport: () => void;
  retainedKeys?: readonly string[];
  focusedKey?: string | null;
  focusRequestKey?: number;
  getFocusedElement?: (row: HTMLElement) => HTMLElement | null;
  onApiChange?: (api: VirtualizedTurnListApi | null) => void;
  onRangeChange?: (snapshot: VirtualizedTurnListSnapshot) => void;
  renderEntry: (entry: T, index: number) => ReactNode;
}

/** Owns DOM materialization only; entries and pagination remain canonical. */
export function VirtualizedTurnList<T extends ThreadVirtualizerEntry>({
  entries,
  scrollContainerRef,
  isFollowingTail,
  scrollToTail,
  setScrollTop,
  holdViewport,
  retainedKeys = [],
  focusedKey,
  focusRequestKey = 0,
  getFocusedElement,
  onApiChange,
  onRangeChange,
  renderEntry,
}: VirtualizedTurnListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const heightsRef = useRef(new Map<string, number>());
  const elementsRef = useRef(new Map<string, HTMLDivElement>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const [focusedDomKey, setFocusedDomKey] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<NavigationRequest | null>(null);
  const navigationRequestRef = useRef<NavigationRequest | null>(null);
  const [measuredHeights, setMeasuredHeights] = useState(
    new Map<string, number>(),
  );
  const [viewport, setViewport] = useState({
    top: Number.POSITIVE_INFINITY,
    height: 800,
  });
  const viewportRef = useRef(viewport);
  const previousLayoutRef = useRef<ReturnType<typeof buildThreadLayout> | null>(
    null,
  );
  const layout = useMemo(
    () => buildThreadLayout(entries, measuredHeights),
    [entries, measuredHeights],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const offset = useCallback(() => {
    const list = listRef.current;
    const container = scrollContainerRef.current;
    if (!list || !container) return 0;
    const rect = list.getBoundingClientRect();
    return rect.height > 0
      ? rect.top - container.getBoundingClientRect().top + container.scrollTop
      : list.offsetTop;
  }, [scrollContainerRef]);
  const updateViewport = useCallback(
    (top?: number) => {
      const container = scrollContainerRef.current;
      const height = container?.clientHeight || 800;
      const listOffset = offset();
      const next = {
        top: Math.max(0, top ?? (container?.scrollTop ?? 0) - listOffset),
        height,
      };
      viewportRef.current = next;
      setViewport((previous) =>
        previous.top === next.top && previous.height === next.height
          ? previous
          : next,
      );
    },
    [offset, scrollContainerRef],
  );
  const viewportTop = Number.isFinite(viewport.top)
    ? viewport.top
    : Math.max(0, layout.totalHeight - viewport.height);
  const previousLayout = previousLayoutRef.current;
  // Select rows against the same anchor that the layout effect will commit.
  // New heights with the old top can unmount and remeasure the overscan rows.
  const top =
    previousLayout && previousLayout !== layout
      ? isFollowingTail()
        ? Math.max(0, layout.totalHeight - viewport.height)
        : preserveThreadAnchor(previousLayout, layout, viewportTop)
      : viewportTop;
  const range = getThreadRange(layout, top, viewport.height);
  const mountedIndices = new Set<number>();
  for (let index = range.startIndex; index < range.endIndex; index += 1)
    mountedIndices.add(index);
  for (const key of [...retainedKeys, focusedDomKey, navigation?.key]) {
    if (!key) continue;
    const index = layout.indexByKey.get(key);
    if (index !== undefined) mountedIndices.add(index);
  }
  const indices = [...mountedIndices].sort((a, b) => a - b);
  const keysSignature = indices
    .map((index) => entries[index].id)
    .join("\u0000");

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const previous = previousLayoutRef.current;
    const currentOffset = offset();
    const previousTop = Number.isFinite(viewportRef.current.top)
      ? viewportRef.current.top
      : Math.max(0, layout.totalHeight - (container.clientHeight || 800));
    previousLayoutRef.current = layout;
    if (isFollowingTail()) {
      updateViewport(
        Math.max(0, layout.totalHeight - (container.clientHeight || 800)),
      );
      scrollToTail("auto");
    } else if (previous && previous !== layout) {
      const nextTop = preserveThreadAnchor(previous, layout, previousTop);
      // DOM shrink can clamp scrollTop before this effect; commit the anchor
      // position directly instead of adding a delta to the clamped position.
      setScrollTop(currentOffset + nextTop);
      updateViewport(nextTop);
    } else updateViewport();
  }, [
    layout,
    isFollowingTail,
    offset,
    scrollContainerRef,
    scrollToTail,
    setScrollTop,
    updateViewport,
  ]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (isFollowingTail()) {
      scrollToTail("auto");
      updateViewport(
        Math.max(
          0,
          layoutRef.current.totalHeight - (container.clientHeight || 800),
        ),
      );
    } else updateViewport();
    previousLayoutRef.current ??= layoutRef.current;
    const onScroll = () => updateViewport();
    container.addEventListener("scroll", onScroll, { passive: true });
    // Capture the physical viewport before user input stops tail following.
    // The next layout must not restore the last programmatic tail target.
    const inputEvents = ["keydown", "wheel", "touchmove"] as const;
    for (const event of inputEvents) {
      container.addEventListener(event, onScroll, {
        capture: true,
        passive: true,
      });
    }
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (isFollowingTail()) {
              scrollToTail("auto");
              updateViewport(
                Math.max(
                  0,
                  layoutRef.current.totalHeight -
                    (container.clientHeight || 800),
                ),
              );
            } else updateViewport();
          });
    resize?.observe(container);
    return () => {
      container.removeEventListener("scroll", onScroll);
      for (const event of inputEvents) {
        container.removeEventListener(event, onScroll, { capture: true });
      }
      resize?.disconnect();
    };
  }, [
    isFollowingTail,
    offset,
    scrollContainerRef,
    scrollToTail,
    updateViewport,
  ]);

  const recordHeight = useCallback((key: string, height: number) => {
    if (
      height <= 0 ||
      Math.abs((heightsRef.current.get(key) ?? -1) - height) < 0.5
    )
      return false;
    heightsRef.current.set(key, height);
    return true;
  }, []);

  const api = useMemo<VirtualizedTurnListApi>(
    () => ({
      getEntryGeometry: (key) => {
        const current = layoutRef.current;
        const index = current.indexByKey.get(key);
        return index === undefined
          ? null
          : {
              startPx: current.offsets[index],
              endPx: current.offsets[index] + current.heights[index],
            };
      },
      scrollToKey: (key, getTargetElement, options) => {
        navigationRequestRef.current?.complete();
        if (options?.signal?.aborted) return Promise.resolve();
        const current = layoutRef.current;
        const index = current.indexByKey.get(key);
        const container = scrollContainerRef.current;
        if (index === undefined || !container) return Promise.resolve();
        holdViewport();
        const nextTop = Math.max(
          0,
          current.offsets[index] +
            current.heights[index] / 2 -
            (container.clientHeight || 800) / 2,
        );
        setScrollTop(offset() + nextTop);
        updateViewport(nextTop);
        return new Promise<void>((resolve) => {
          const complete = () => {
            options?.signal?.removeEventListener("abort", complete);
            if (navigationRequestRef.current === request) {
              navigationRequestRef.current = null;
              setNavigation(null);
            }
            resolve();
          };
          const request: NavigationRequest = {
            key,
            align: options?.align ?? "center",
            getTargetElement,
            complete,
          };
          navigationRequestRef.current = request;
          setNavigation(request);
          options?.signal?.addEventListener("abort", complete, { once: true });
        });
      },
    }),
    [holdViewport, offset, scrollContainerRef, setScrollTop, updateViewport],
  );

  useEffect(() => {
    onApiChange?.(api);
    return () => {
      onApiChange?.(null);
      navigationRequestRef.current?.complete();
    };
  }, [api, onApiChange]);

  useLayoutEffect(() => {
    if (!navigation) return;
    const row = elementsRef.current.get(navigation.key);
    const container = scrollContainerRef.current;
    if (!row || !container) return;
    const frame = window.requestAnimationFrame(() => {
      if (navigationRequestRef.current !== navigation) return;
      const target = navigation.getTargetElement?.(row) ?? row;
      const rect = target.getBoundingClientRect();
      if (rect.height > 0) {
        const delta =
          rect.top -
          container.getBoundingClientRect().top -
          (navigation.align === "top"
            ? 10
            : container.clientHeight / 2 - rect.height / 2);
        setScrollTop(container.scrollTop + delta);
        updateViewport();
      }
      navigation.complete();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    navigation,
    measuredHeights,
    scrollContainerRef,
    setScrollTop,
    updateViewport,
  ]);
  useLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((records) => {
      let changed = false;
      for (const record of records) {
        const key = (record.target as HTMLElement).dataset.turnKey;
        if (key && elementsRef.current.get(key) === record.target) {
          const box = record.borderBoxSize?.[0];
          changed =
            recordHeight(
              key,
              box?.blockSize ?? record.target.getBoundingClientRect().height,
            ) || changed;
        }
      }
      if (changed) setMeasuredHeights(new Map(heightsRef.current));
    });
    observerRef.current = observer;
    for (const element of elementsRef.current.values())
      observer.observe(element);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [recordHeight]);
  useLayoutEffect(() => {
    let changed = false;
    for (const [key, element] of elementsRef.current) {
      changed =
        recordHeight(key, element.getBoundingClientRect().height) || changed;
    }
    if (changed) setMeasuredHeights(new Map(heightsRef.current));
  }, [keysSignature, recordHeight]);

  const navigationRef = useRef<string | null>(null);
  const focusedKeyExists = Boolean(
    focusedKey && layout.indexByKey.has(focusedKey),
  );
  useEffect(() => {
    if (!focusedKey || !focusRequestKey) return;
    const request = `${focusedKey}:${focusRequestKey}`;
    if (navigationRef.current === request) return;
    if (!focusedKeyExists) return;
    navigationRef.current = request;
    const controller = new AbortController();
    void api.scrollToKey(focusedKey, getFocusedElement, {
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [focusedKey, focusRequestKey, api, getFocusedElement, focusedKeyExists]);

  useLayoutEffect(() => {
    onRangeChange?.({
      mountedKeys: keysSignature ? keysSignature.split("\u0000") : [],
      startIndex: range.startIndex,
      endIndex: range.endIndex,
      offscreenCount: entries.length - indices.length,
    });
  }, [
    keysSignature,
    range.startIndex,
    range.endIndex,
    entries.length,
    indices.length,
    onRangeChange,
  ]);

  return (
    <div
      ref={listRef}
      data-testid="virtualized-turn-list"
      data-total-entries={entries.length}
      data-start-index={range.startIndex}
      data-end-index={range.endIndex}
      data-offscreen-count={entries.length - indices.length}
      className="relative w-full shrink-0"
      style={{ height: layout.totalHeight }}
      onFocusCapture={(event) =>
        setFocusedDomKey(
          (event.target as HTMLElement).closest<HTMLElement>("[data-turn-key]")
            ?.dataset.turnKey ?? null,
        )
      }
      onBlurCapture={(event) => {
        const next = event.relatedTarget as HTMLElement | null;
        setFocusedDomKey(
          next && listRef.current?.contains(next)
            ? (next.closest<HTMLElement>("[data-turn-key]")?.dataset.turnKey ??
                null)
            : null,
        );
      }}
    >
      {indices.map((index) => {
        const entry = entries[index];
        return (
          <div
            key={entry.id}
            className="absolute inset-x-0"
            style={{ top: layout.offsets[index] }}
          >
            <div
              data-turn-key={entry.id}
              ref={(element) => {
                const previous = elementsRef.current.get(entry.id);
                if (previous) observerRef.current?.unobserve(previous);
                if (element) {
                  elementsRef.current.set(entry.id, element);
                  observerRef.current?.observe(element);
                } else elementsRef.current.delete(entry.id);
              }}
            >
              {renderEntry(entry, index)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
