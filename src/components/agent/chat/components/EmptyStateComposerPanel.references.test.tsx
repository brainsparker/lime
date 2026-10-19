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

  it("首页空态输入区的文本文件 chip 应支持设为项目资料", () => {
    const onImportPathReferenceAsKnowledge = vi.fn();
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
      onImportPathReferenceAsKnowledge,
    });

    expect(container.textContent).toContain("brief.md");
    expect(container.textContent).toContain("本地文件");
    expect(container.textContent).not.toContain("/Users/lime/brief.md");

    const importButton = container.querySelector(
      'button[aria-label="设为项目资料 brief.md"]',
    ) as HTMLButtonElement | null;
    expect(importButton).toBeTruthy();

    act(() => {
      importButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onImportPathReferenceAsKnowledge).toHaveBeenCalledWith(reference);
  });
});
