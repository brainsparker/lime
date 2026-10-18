import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

type SlotPosition = "left" | "center" | "right";
type Align = "start" | "center" | "end";

interface HeaderEntry {
  align: Align;
  allowsThreadContentOverlap: boolean;
  node: ReactNode;
  order: number;
}

interface HeaderActionEntry extends HeaderEntry {
  actionId: string;
}

function createHeaderRegistry() {
  const slots = new Map<SlotPosition, Map<string, HeaderEntry>>();
  const ids = new Map<SlotPosition, string[]>();
  const listeners = new Set<() => void>();
  let snapshot: Record<SlotPosition, HeaderActionEntry[]> = {
    left: [],
    center: [],
    right: [],
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

const HeaderContext = createContext<ReturnType<
  typeof createHeaderRegistry
> | null>(null);

function useHeaderRegistry() {
  const registry = useContext(HeaderContext);
  if (!registry) throw new Error("AppShell is missing");
  return registry;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [registry] = useState(createHeaderRegistry);
  return (
    <HeaderContext.Provider value={registry}>{children}</HeaderContext.Provider>
  );
}

export function HeaderAction({
  actionId,
  align = "start",
  allowsThreadContentOverlap = false,
  children,
  order = 0,
  slotPosition = "center",
}: {
  actionId: string;
  align?: Align;
  allowsThreadContentOverlap?: boolean;
  children: ReactNode;
  order?: number;
  slotPosition?: SlotPosition;
}) {
  const registry = useHeaderRegistry();
  const entry = useRef<HeaderEntry | null>(null);
  useLayoutEffect(() => {
    entry.current = {
      align,
      allowsThreadContentOverlap,
      node: children,
      order,
    };
    registry.update(slotPosition, actionId, entry.current);
  }, [
    registry,
    slotPosition,
    actionId,
    align,
    allowsThreadContentOverlap,
    children,
    order,
  ]);
  useLayoutEffect(() => {
    registry.register(slotPosition, actionId);
    return () => registry.remove(slotPosition, actionId, entry.current);
  }, [registry, slotPosition, actionId]);
  return null;
}

function HeaderSlot({
  entries,
  side,
}: {
  entries: HeaderActionEntry[];
  side: "start" | "center" | "end";
}) {
  const start = entries.filter((entry) => entry.align === "start");
  const center = entries.filter((entry) => entry.align === "center");
  const end = entries.filter((entry) => entry.align === "end");
  const action = (entry: HeaderActionEntry, index: number) => (
    <div
      key={entry.actionId}
      data-header-action-id={entry.actionId}
      className="pointer-events-auto flex shrink-0 items-center"
      style={
        {
          WebkitAppRegion: "no-drag",
          marginInlineStart:
            entry.align === "end" && index === 0 ? "auto" : undefined,
        } as CSSProperties
      }
    >
      {entry.node}
    </div>
  );
  return (
    <div
      data-app-shell-header-slot={side}
      data-app-shell-header-obstacle
      data-app-shell-thread-content-overlap={
        (entries.length > 0 &&
          entries.every((entry) => entry.allowsThreadContentOverlap)) ||
        undefined
      }
      className="pointer-events-none flex h-full min-w-0 items-center gap-1.5"
      style={{ marginInlineStart: side === "end" ? "auto" : undefined }}
    >
      {start.map(action)}
      {center.length > 0 ? (
        <div className="mx-auto flex shrink-0 items-center gap-1.5">
          {center.map(action)}
        </div>
      ) : null}
      {end.map(action)}
    </div>
  );
}

export function AppShellHeader({
  reserveWindowControls = false,
}: {
  reserveWindowControls?: boolean;
}) {
  const registry = useHeaderRegistry();
  const entries = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );
  return (
    <header
      data-app-shell-titlebar
      data-testid="app-shell-header"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex h-[44px] min-w-0 items-center gap-1.5"
      style={
        {
          paddingInlineStart: reserveWindowControls ? 92 : 8,
          paddingInlineEnd: 8,
          WebkitAppRegion: "drag",
        } as CSSProperties
      }
    >
      <HeaderSlot entries={entries.left} side="start" />
      <HeaderSlot entries={entries.center} side="center" />
      <HeaderSlot entries={entries.right} side="end" />
    </header>
  );
}
