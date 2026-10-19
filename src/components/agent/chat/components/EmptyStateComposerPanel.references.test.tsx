import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderPanel } from "./EmptyStateComposerPanel.testFixtures";

describe("EmptyStateComposerPanel attachments", () => {
  it("首页空态输入区应展示本地路径 chip 并支持移除", () => {
    const onRemovePathReference = vi.fn();
    const container = renderPanel({
      pathReferences: [
        {
          id: "dir:/Users/lime/Downloads",
          path: "/Users/lime/Downloads",
          name: "Downloads",
          isDir: true,
          size: null,
          mimeType: null,
          source: "file_manager",
        },
      ],
      onRemovePathReference,
    });

    expect(
      container.querySelector('[data-testid="inputbar-path-reference-chip"]')
        ?.textContent,
    ).toContain("Downloads");
    expect(container.textContent).not.toContain("/Users/lime/Downloads");

    const removeButton = container.querySelector(
      'button[aria-label="移除路径 Downloads"]',
    ) as HTMLButtonElement | null;

    act(() => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRemovePathReference).toHaveBeenCalledWith(
      "dir:/Users/lime/Downloads",
    );
  });

  it("首页文本文件附件只提供移除操作", () => {
    const onRemovePathReference = vi.fn();
    const reference = {
      id: "file:/Users/lime/brief.md",
      path: "/Users/lime/brief.md",
      name: "brief.md",
      isDir: false,
      size: 128,
      mimeType: "text/markdown",
      source: "file_manager" as const,
    };
    const container = renderPanel({
      pathReferences: [reference],
      onRemovePathReference,
    });

    expect(container.textContent).toContain("brief.md");
    expect(container.textContent).toContain("本地文件");
    expect(container.textContent).not.toContain("/Users/lime/brief.md");

    const chip = container.querySelector(
      '[data-testid="inputbar-path-reference-chip"]',
    );
    expect(
      Array.from(chip?.querySelectorAll("button") ?? []).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["移除路径 brief.md"]);

    act(() => {
      chip
        ?.querySelector("button")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRemovePathReference).toHaveBeenCalledExactlyOnceWith(reference.id);
  });
});
