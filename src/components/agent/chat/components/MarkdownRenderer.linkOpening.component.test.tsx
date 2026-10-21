import { act } from "react";
import { expect, it, vi } from "vitest";
import {
  getMarkdownRendererMocks,
  renderMarkdownHarness,
} from "./MarkdownRenderer.testHarness";

it.each([
  ["paragraph", "Website ready: [Guide](https://example.org/guide)"],
  ["heading", "## [Guide](https://example.org/guide)"],
  ["quote", "> [Guide](https://example.org/guide)"],
  ["table", "| Guide |\n| --- |\n| [Guide](https://example.org/guide) |"],
])(
  "keeps a %s link focused and clickable across a projection rerender",
  (_, content) => {
    const { container, rerender } = renderMarkdownHarness(content, {
      onQuoteContent: vi.fn(),
    });
    const link = container.querySelector<HTMLAnchorElement>("a")!;
    link.focus();
    act(() =>
      link.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 1 }),
      ),
    );
    rerender(content, { onQuoteContent: vi.fn() });
    expect(container.querySelector("a")).toBe(link);
    expect(document.activeElement).toBe(link);
    const event = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    act(() => link.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(
      getMarkdownRendererMocks().openExternalUrlWithSystemBrowser,
    ).toHaveBeenCalledExactlyOnceWith("https://example.org/guide");
  },
);
