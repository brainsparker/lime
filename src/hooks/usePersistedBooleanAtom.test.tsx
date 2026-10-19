import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FILE_TREE_OPEN_ATOM_KEY as key } from "@/lib/api/persistedAtomTypes";
import { usePersistedBooleanAtom } from "./usePersistedBooleanAtom";
import { configureBooleanGateway } from "./usePersistedBooleanAtom.testFixtures";

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
let root: Root,
  container: HTMLDivElement,
  fixture: ReturnType<typeof configureBooleanGateway>;
const states: Record<string, ReturnType<typeof usePersistedBooleanAtom>> = {};
function Pane({
  name = "Files",
  enabled = true,
}: {
  name?: string;
  enabled?: boolean;
}) {
  const state = usePersistedBooleanAtom(key, enabled);
  states[name] = state;
  return (
    <button onClick={() => void state.setValue(!state.value)}>
      {name}:{String(state.value)}
    </button>
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  fixture = configureBooleanGateway(gateway);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Host boolean projection", () => {
  it("shares the saved file tree value across mounted Files and Changes projections", async () => {
    await act(async () =>
      root.render(
        <>
          <Pane />
          <Pane name="Changes" />
        </>,
      ),
    );
    expect(states.Files.value).toBe(false);
    expect(states.Changes.value).toBe(false);
    await act(async () => states.Files.setValue(true));
    expect(states.Files.value).toBe(true);
    expect(states.Changes.value).toBe(true);
    expect(gateway.update).toHaveBeenCalledExactlyOnceWith({
      key,
      mutation: { op: "set", value: true },
    });
  });

  it("rejects an older initial read after a newer Host notification", async () => {
    let resolve!: (result: unknown) => void;
    const old = fixture.read(key);
    gateway.read.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => root.render(<Pane />));
    await act(async () => fixture.set(key, true, 2));
    expect(states.Files.value).toBe(true);
    await act(async () => resolve(old));
    expect(states.Files.value).toBe(true);
  });

  it("preserves the accepted value and permits retry after a rejected write", async () => {
    await act(async () => root.render(<Pane />));
    gateway.update.mockRejectedValueOnce(new Error("unavailable"));
    await act(async () => states.Files.setValue(true));
    expect(states.Files).toMatchObject({
      value: false,
      error: true,
      updating: false,
    });
    await act(async () => states.Files.setValue(true));
    expect(states.Files).toMatchObject({
      value: true,
      error: false,
      updating: false,
    });
  });

  it("does not release a new scene write lock when an older write finishes", async () => {
    const finish: Array<(value: unknown) => void> = [];
    gateway.update.mockImplementation(
      () => new Promise((resolve) => finish.push(resolve)),
    );
    await act(async () => root.render(<Pane />));
    act(() => {
      void states.Files.setValue(true);
      void states.Files.setValue(true);
    });
    expect(gateway.update).toHaveBeenCalledTimes(1);
    await act(async () => root.render(<Pane enabled={false} />));
    await act(async () => root.render(<Pane />));
    act(() => {
      void states.Files.setValue(true);
    });
    const receipt = {
      ...fixture.read(key),
      outcome: "applied",
      changed: true,
      entry: null,
      value: true,
    };
    await act(async () => finish[0](receipt));
    expect(states.Files.updating).toBe(true);
    expect(states.Files.value).toBe(false);
    await act(async () => finish[1](receipt));
    expect(states.Files).toMatchObject({ value: true, updating: false });
  });
});
