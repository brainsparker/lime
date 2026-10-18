import type { ReactNode } from "react";
import type { UnifiedTabStripEntry } from "./UnifiedTabStripRenderer";

export type SlotPosition = "left" | "center" | "right";
export type Align = "start" | "center" | "end";

export interface HeaderEntry {
  align: Align;
  allowsThreadContentOverlap: boolean;
  node: ReactNode;
  order: number;
}

export interface HeaderActionEntry extends HeaderEntry {
  actionId: string;
}

export type ContentLayout =
  | "default"
  | "full-bleed"
  | "custom-titlebar"
  | "thread-edge-scroll";

export interface PageHeaderEntry {
  node: ReactNode;
  contentFade: boolean;
  divider: boolean;
  desktopPlacement: string;
  separator: boolean;
}

export interface LayoutEntry {
  layout: ContentLayout;
}

interface ContentBounds {
  left: number;
  right: number;
}

export function createShellRegistry() {
  const slots = new Map<SlotPosition, Map<string, HeaderEntry>>();
  const ids = new Map<SlotPosition, string[]>();
  const listeners = new Set<() => void>();
  let unifiedTabStrip: UnifiedTabStripEntry | null = null;
  let pageHeader: PageHeaderEntry | null = null;
  let primary: LayoutEntry | null = null;
  let fallback: LayoutEntry | null = null;
  let contentBounds: ContentBounds | null = null;
  let snapshot: Record<SlotPosition, HeaderActionEntry[]> & {
    pageHeader: PageHeaderEntry | null;
    unifiedTabStrip: UnifiedTabStripEntry | null;
    layout: ContentLayout;
    contentBounds: ContentBounds | null;
  } = {
    left: [],
    center: [],
    right: [],
    pageHeader,
    unifiedTabStrip,
    layout: "default",
    contentBounds,
  };
  const publish = () => {
    const entries = (slot: SlotPosition) =>
      (ids.get(slot) ?? [])
        .flatMap((actionId) => {
          const entry = slots.get(slot)?.get(actionId);
          return entry ? [{ actionId, ...entry }] : [];
        })
        .sort((a, b) => a.order - b.order);
    snapshot = {
      left: entries("left"),
      center: entries("center"),
      right: entries("right"),
      pageHeader,
      unifiedTabStrip,
      layout: primary?.layout ?? fallback?.layout ?? "default",
      contentBounds,
    };
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setUnifiedTabStrip(entry: UnifiedTabStripEntry) {
      unifiedTabStrip = entry;
      publish();
    },
    removeUnifiedTabStrip(entry: UnifiedTabStripEntry | null) {
      if (unifiedTabStrip !== entry) return;
      unifiedTabStrip = null;
      publish();
    },
    setPageHeader(entry: PageHeaderEntry | null) {
      pageHeader = entry;
      publish();
    },
    setLayout(isFallback: boolean, entry: LayoutEntry) {
      if (isFallback) fallback = entry;
      else primary = entry;
      publish();
    },
    removeLayout(isFallback: boolean, entry: LayoutEntry | null) {
      if (isFallback ? fallback !== entry : primary !== entry) return;
      if (isFallback) fallback = null;
      else primary = null;
      publish();
    },
    setContentBounds(bounds: ContentBounds | null) {
      if (
        contentBounds?.left === bounds?.left &&
        contentBounds?.right === bounds?.right
      )
        return;
      contentBounds = bounds;
      publish();
    },
    update(slot: SlotPosition, actionId: string, entry: HeaderEntry) {
      let byId = slots.get(slot);
      if (!byId) {
        byId = new Map();
        slots.set(slot, byId);
      }
      byId.set(actionId, entry);
      publish();
    },
    register(slot: SlotPosition, actionId: string) {
      const current = ids.get(slot) ?? [];
      if (!current.includes(actionId)) {
        ids.set(slot, [...current, actionId]);
        publish();
      }
    },
    remove(slot: SlotPosition, actionId: string, entry: HeaderEntry | null) {
      if (slots.get(slot)?.get(actionId) !== entry) return;
      slots.get(slot)?.delete(actionId);
      ids.set(
        slot,
        (ids.get(slot) ?? []).filter((id) => id !== actionId),
      );
      publish();
    },
  };
}
