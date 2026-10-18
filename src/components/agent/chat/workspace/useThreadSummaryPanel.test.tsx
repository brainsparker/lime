import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PersistedAtomReadResult,
  PersistedAtomUpdateEvent,
} from "@/lib/api/persistedAtomTypes";
import { SUMMARY_PANEL_PIN_ATOM_KEY as key } from "@/lib/api/persistedAtomTypes";
import {
  useThreadSummaryPanel,
  type ThreadSummaryPanelState,
} from "./useThreadSummaryPanel";
import { ThreadSummaryLayout } from "./ThreadSummaryLayout";

const gateway = vi.hoisted(() => ({
  read: vi.fn(),
  update: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@/lib/api/persistedAtoms", () => ({
  sendPersistedAtomState: gateway.read,
  updatePersistedAtomState: gateway.update,
  listenPersistedAtomUpdates: gateway.listen,
}));
let root: Root, container: HTMLDivElement, state: ThreadSummaryPanelState;
let width: number,
  resized: () => void,
  notify: (event: PersistedAtomUpdateEvent) => void;
const receipt = (
  value: boolean,
  storeRevision: number,
): PersistedAtomReadResult => ({
  key,
  storeRevision,
  persistence: { state: "saved", savedRevision: storeRevision },
  outcome: "ready",
  data: { queryKind: "value", value },
});
function Harness({ threadId = "thread-1" }: { threadId?: string | null }) {
  state = useThreadSummaryPanel(threadId);
  return (
    <ThreadSummaryLayout
      state={state}
      panel={<button>Canonical summary action</button>}
    >
      <input defaultValue="Unsent draft" />
    </ThreadSummaryLayout>
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  gateway.read.mockReset().mockResolvedValue(receipt(true, 0));
  gateway.update.mockReset().mockImplementation(async (request) => ({
    key,
    storeRevision: 1,
    persistence: { state: "pending", savedRevision: 0 },
    outcome: "applied",
    changed: true,
    entry: null,
    value: request.mutation.value,
  }));
  gateway.listen.mockReset().mockImplementation(async (handler) => {
    notify = handler;
    return vi.fn();
  });
  width = 1200;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      width,
      height: 800,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 800,
      toJSON: () => ({}),
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Summary layout and persisted pin lifecycle", () => {
  it("toggles the Main pin in wide panes and preserves the same editable draft instance", async () => {
    await act(async () => root.render(<Harness />));
    const input = container.querySelector("input");
    expect(state.displayMode).toBe("shift");
    expect(state.contentShift).toBe(-154);
    expect(
      container.querySelector("[data-testid=thread-summary-inline]"),
    ).not.toBeNull();
    await act(async () => state.onOpenChange(true));
    expect(gateway.update).toHaveBeenCalledExactlyOnceWith({
      key,
      mutation: { op: "set", value: false },
    });
    expect(state.isPinned).toBe(false);
    expect(state.contentShift).toBe(0);
    expect(
      container.querySelector("[data-testid=thread-summary-inline]"),
    ).toBeNull();
    expect(container.querySelector("input")).toBe(input);
    expect(input?.value).toBe("Unsent draft");
  });

  it("overlay toggles only the popover, then closes it on resize without rewriting the pin", async () => {
    width = 900;
    await act(async () => root.render(<Harness />));
    act(() => state.onOpenChange(true));
    expect(state.isPopoverOpen).toBe(true);
    expect(state.contentShift).toBe(0);
    expect(gateway.update).not.toHaveBeenCalled();
    width = 1600;
    act(() => resized());
    expect(state.displayMode).toBe("gutter");
    expect(state.isPopoverOpen).toBe(false);
    expect(state.isInline).toBe(true);
    expect(gateway.update).not.toHaveBeenCalled();
  });

  it("discards an older read after a newer cross-window revision", async () => {
    let resolveOld: (value: PersistedAtomReadResult) => void = () => undefined;
    gateway.read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await act(async () => root.render(<Harness />));
    gateway.read.mockResolvedValueOnce(receipt(false, 2));
    await act(async () =>
      notify({
        event: "persisted-atom-update",
        key,
        storeRevision: 2,
        persistence: { state: "saved", savedRevision: 2 },
      }),
    );
    expect(state.isPinned).toBe(false);
    await act(async () => resolveOld(receipt(true, 0)));
    expect(state.isPinned).toBe(false);
  });

  it("keeps the accepted pin on write failure and exposes a recoverable persistence error", async () => {
    gateway.update.mockRejectedValue(new Error("bridge unavailable"));
    await act(async () => root.render(<Harness />));
    await act(async () => state.onOpenChange(true));
    expect(state.isPinned).toBe(true);
    expect(state.persistenceError).toBe(true);
    expect(state.pinDisabled).toBe(false);
  });

  it("releases the pending write lock when the scene is disabled and re-enabled", async () => {
    let resolveWrite!: (value: unknown) => void;
    gateway.update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve;
        }),
    );
    await act(async () => root.render(<Harness />));
    act(() => state.onOpenChange(true));
    expect(state.pinDisabled).toBe(true);
    await act(async () => root.render(<Harness threadId={null} />));
    gateway.read.mockResolvedValue(receipt(false, 1));
    await act(async () =>
      resolveWrite({
        key,
        outcome: "applied",
        value: false,
        storeRevision: 1,
        persistence: { state: "saved", savedRevision: 1 },
      }),
    );
    await act(async () => root.render(<Harness />));
    expect(state.isPinned).toBe(false);
    expect(state.pinDisabled).toBe(false);
  });
});
