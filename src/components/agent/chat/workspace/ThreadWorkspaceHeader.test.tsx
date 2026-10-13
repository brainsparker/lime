import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ThreadWorkspaceHeader } from "./ThreadWorkspaceHeader";

beforeEach(async () => {
  await changeLimeLocale("zh-CN");
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  document.body.innerHTML = "";
  await changeLimeLocale("en-US");
});

describe("ThreadWorkspaceHeader", () => {
  it("应集中展示 active Thread 标题、状态、工作目录和上下文操作", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ThreadWorkspaceHeader
          sessionId="thread-1"
          title="对齐 Codex App GUI"
          status="running"
          workingDirectory="/workspace/lime"
          canAcceptDirectInput={false}
          actions={<button data-testid="header-action">打开位置</button>}
        />,
      );
    });

    expect(
      container
        .querySelector('[data-testid="thread-workspace-header"]')
        ?.getAttribute("data-header-placement"),
    ).toBe("titlebar");
    expect(
      container.querySelector('[data-testid="thread-workspace-header-title"]')
        ?.textContent,
    ).toBe("对齐 Codex App GUI");
    expect(
      container.querySelector('[data-testid="thread-workspace-header-status"]')
        ?.textContent,
    ).toContain("处理中");
    expect(
      container.querySelector(
        '[data-testid="thread-workspace-header-directory"]',
      )?.textContent,
    ).toContain("/workspace/lime");
    expect(
      container
        .querySelector('[data-testid="thread-workspace-header"]')
        ?.getAttribute("data-can-accept-direct-input"),
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="header-action"]'),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-testid="thread-workspace-header-actions"]')
        ?.getAttribute("data-header-action-overflow"),
    ).toBe("scroll");
    expect(
      container.querySelector('[data-testid="thread-workspace-header-actions"]')
        ?.className,
    ).toContain("overflow-x-auto");

    act(() => root.unmount());
  });

  it("应通过标题栏就地重命名提交给 workspace owner", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onRename = vi.fn().mockResolvedValue(undefined);
    const prompt = vi.spyOn(window, "prompt");

    act(() => {
      root.render(
        <ThreadWorkspaceHeader
          sessionId="thread-1"
          title="旧 Thread 名称"
          status="done"
          workingDirectory="/workspace/lime"
          onRename={onRename}
          onFork={vi.fn()}
          onArchive={vi.fn()}
        />,
      );
    });

    expect(
      container.querySelector('[data-testid="thread-workspace-header-status"]')
        ?.textContent,
    ).toContain("已完成");
    expect(
      container.querySelector(
        '[data-testid="thread-workspace-header-directory"]',
      )?.textContent,
    ).toContain("/workspace/lime");

    act(() => {
      (
        container.querySelector(
          '[data-testid="thread-workspace-header-action-menu"]',
        ) as HTMLButtonElement
      )?.click();
    });
    expect(container.querySelector('[role="menuitem"]')?.textContent).toContain(
      "重命名",
    );
    expect(
      container
        .querySelector('[data-testid="thread-workspace-header-action-menu"]')
        ?.getAttribute("title"),
    ).toBe("更多操作");
    expect(
      document.body.querySelector(
        '[data-testid="thread-workspace-header-fork"]',
      )?.textContent,
    ).toContain("分叉对话");
    expect(
      document.body.querySelector(
        '[data-testid="thread-workspace-header-archive"]',
      )?.textContent,
    ).toContain("归档");

    await act(async () => {
      (container.querySelector('[role="menuitem"]') as HTMLElement)?.click();
    });

    const input = container.querySelector(
      '[data-testid="thread-workspace-header-title-input"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("旧 Thread 名称");
    expect(input.getAttribute("aria-label")).toBe("重命名对话");
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    await act(async () => {
      valueSetter?.call(input, "  新的 Thread 名称  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(prompt).not.toHaveBeenCalled();
    expect(onRename).toHaveBeenCalledWith("新的 Thread 名称");
    expect(
      container.querySelector('[data-testid="thread-workspace-header-status"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="thread-workspace-header-directory"]',
      ),
    ).not.toBeNull();

    act(() => {
      (
        container.querySelector(
          '[data-testid="thread-workspace-header-action-menu"]',
        ) as HTMLButtonElement
      )?.click();
    });
    expect(
      document.body.querySelector(
        '[data-testid="thread-workspace-header-fork"]',
      ),
    ).not.toBeNull();
    expect(
      document.body.querySelector(
        '[data-testid="thread-workspace-header-archive"]',
      ),
    ).not.toBeNull();

    prompt.mockRestore();
    act(() => root.unmount());
  });

  it("应把 fork 和 archive 操作交给 workspace owner", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onFork = vi.fn().mockResolvedValue(undefined);
    const onArchive = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <ThreadWorkspaceHeader
          sessionId="thread-1"
          title="当前 Thread"
          status="done"
          workingDirectory={null}
          onFork={onFork}
          onArchive={onArchive}
        />,
      );
    });

    act(() => {
      (
        container.querySelector(
          '[data-testid="thread-workspace-header-action-menu"]',
        ) as HTMLButtonElement
      )?.click();
    });
    const menuRoot = document.body;
    const menuItems = menuRoot.querySelectorAll('[role="menuitem"]');
    expect(menuItems).toHaveLength(2);

    await act(async () => {
      (menuItems[0] as HTMLElement)?.click();
    });
    expect(onFork).toHaveBeenCalledTimes(1);

    act(() => {
      (
        container.querySelector(
          '[data-testid="thread-workspace-header-action-menu"]',
        ) as HTMLButtonElement
      )?.click();
    });
    await act(async () => {
      const archiveItems = menuRoot.querySelectorAll('[role="menuitem"]');
      (archiveItems[1] as HTMLElement)?.click();
    });
    expect(onArchive).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });

  it("标题栏只切换既有右侧活动面，不再自建摘要层", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onToggleSummary = vi.fn();

    act(() => {
      root.render(
        <ThreadWorkspaceHeader
          sessionId="thread-1"
          title="当前 Thread"
          status="running"
          workingDirectory="/workspace/lime"
          summaryOpen={false}
          onToggleSummary={onToggleSummary}
        />,
      );
    });

    const toggle = container.querySelector(
      '[data-testid="thread-workspace-summary-toggle"]',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[data-testid="thread-workspace-summary"]'),
    ).toBeNull();

    act(() => {
      toggle.click();
    });

    expect(onToggleSummary).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="thread-workspace-summary"]'),
    ).toBeNull();

    act(() => root.unmount());
  });
});
