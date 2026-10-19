import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestionList, type SuggestionItem } from "./SuggestionList";

const dispose: (() => void)[] = [];
afterEach(() => dispose.splice(0).forEach((close) => close()));

function mount(items: SuggestionItem[], query = "") {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const editor = document.createElement("div");
  editor.tabIndex = 0;
  editor.setAttribute("aria-controls", "previous-controls");
  document.body.append(editor, container);
  const root = createRoot(container);
  const onError = vi.fn(),
    onRequestClose = vi.fn();
  const render = (nextItems = items, nextQuery = query) =>
    act(() =>
      root.render(
        <SuggestionList
          label="Context"
          sections={[{ id: "current", title: "Current", items: nextItems }]}
          query={nextQuery}
          keyboardTarget={editor}
          noResults="Empty"
          {...{ onError, onRequestClose }}
        />,
      ),
    );
  render();
  editor.focus();
  const key = (value: string) =>
    act(() =>
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: value,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
  const selected = () =>
    container
      .querySelector('[aria-selected="true"]')
      ?.getAttribute("data-suggestion-key");
  dispose.push(() => {
    act(() => root.unmount());
    editor.remove();
    container.remove();
  });
  return {
    container,
    editor,
    root,
    key,
    selected,
    render,
    onError,
    onRequestClose,
  };
}

describe("SuggestionList keyboard and async behavior", () => {
  it("skips disabled items, retains an available identity across reorder, and resets for another query", () => {
    const a = { key: "a", label: "A", onSelect: vi.fn() };
    const b = { key: "b", label: "B", onSelect: vi.fn() };
    const disabled = {
      key: "blocked",
      label: "Blocked",
      disabled: true,
      onSelect: vi.fn(),
    };
    const view = mount([disabled, a, b]);
    expect(view.selected()).toBe("a");
    view.key("ArrowDown");
    expect(view.selected()).toBe("b");
    view.render([b, disabled, a]);
    expect(view.selected()).toBe("b");
    view.render([a, disabled, b], "changed");
    expect(view.selected()).toBe("a");
    view.key("ArrowUp");
    expect(view.selected()).toBe("b");
    view.render([disabled, a]);
    expect(view.selected()).toBe("a");
    expect(document.activeElement).toBe(view.editor);
    const option = document.getElementById(
      view.editor.getAttribute("aria-activedescendant")!,
    );
    expect(option?.getAttribute("data-suggestion-key")).toBe("a");
    expect(disabled.onSelect).not.toHaveBeenCalled();
  });

  it("allows retry after a failed selection and suppresses duplicate click/Enter while pending", async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const onSelect = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const view = mount([{ key: "async", label: "Async", onSelect }]);
    view.key("Enter");
    view.key("Enter");
    act(() =>
      view.container.querySelector<HTMLButtonElement>("button")!.click(),
    );
    expect(onSelect).toHaveBeenCalledOnce();
    const failure = new Error("unavailable");
    await act(async () => {
      reject(failure);
      await Promise.resolve();
    });
    expect(view.onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(view.selected()).toBe("async");
    view.key("Enter");
    await act(async () => Promise.resolve());
    expect(onSelect).toHaveBeenCalledTimes(2);
    view.key("Escape");
    expect(view.onRequestClose).toHaveBeenCalledOnce();
    act(() => view.root.unmount());
    expect(view.editor.getAttribute("aria-controls")).toBe("previous-controls");
    expect(view.editor.hasAttribute("aria-activedescendant")).toBe(false);
    dispose.pop();
    view.editor.remove();
    view.container.remove();
  });
});
