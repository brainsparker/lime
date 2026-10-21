import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarkdownLink } from "./MarkdownLink";
import { LinkOpeningContext } from "./LinkOpeningContext";

const external = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/api/externalUrl", () => ({
  openExternalUrlWithSystemBrowser: external,
}));

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  external.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderLink(
  open: ComponentProps<typeof LinkOpeningContext.Provider>["value"],
  props: ComponentProps<typeof MarkdownLink> = {},
) {
  act(() =>
    root.render(
      <LinkOpeningContext.Provider value={open}>
        <MarkdownLink href="https://docs.example.com/guide" {...props}>
          Guide
        </MarkdownLink>
      </LinkOpeningContext.Provider>,
    ),
  );
  return container.querySelector("a")!;
}

it.each([
  ["click", { metaKey: true, shiftKey: true }],
  ["auxclick", { button: 1, altKey: true }],
] as const)(
  "forwards the original %s to the workspace owner",
  async (type, keys) => {
    const open = vi.fn();
    const anchor = renderLink(open);
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...keys,
    });
    await act(async () => anchor.dispatchEvent(event));
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://docs.example.com/guide",
      expect.objectContaining({ ...keys, nativeEvent: event }),
    );
    expect(external).not.toHaveBeenCalled();
  },
);

it.each(["click", "auxclick"] as const)(
  "honors a canceled %s handler",
  (type) => {
    const open = vi.fn();
    const cancel = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    const anchor = renderLink(open, { onClick: cancel, onAuxClick: cancel });
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: type === "auxclick" ? 1 : 0,
    });
    act(() => anchor.dispatchEvent(event));
    expect(cancel).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(external).not.toHaveBeenCalled();
  },
);

it("keeps right-click available for the native context menu", () => {
  const open = vi.fn();
  const anchor = renderLink(open);
  const event = new MouseEvent("auxclick", {
    bubbles: true,
    cancelable: true,
    button: 2,
  });
  act(() => anchor.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(open).not.toHaveBeenCalled();
  expect(external).not.toHaveBeenCalled();
});

it("keeps page anchors outside the browser routing contract", () => {
  const open = vi.fn();
  const anchor = renderLink(open, { href: "#install" });
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => anchor.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(open).not.toHaveBeenCalled();
  expect(external).not.toHaveBeenCalled();
});

it("uses the system browser for a standalone link without a workspace", async () => {
  const anchor = renderLink(null);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => anchor.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(external).toHaveBeenCalledExactlyOnceWith(
    "https://docs.example.com/guide",
  );
});
