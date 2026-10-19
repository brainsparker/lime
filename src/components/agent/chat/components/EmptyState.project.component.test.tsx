import {
  mockReadProjectGitStatus,
  mockCheckoutProjectGitBranch,
  mockCreateProjectGitBranch,
  renderEmptyState,
  flushAsyncEffects,
  waitForProjectContextSelector,
  updateFieldValue,
} from "./EmptyState.testFixtures";

import { act } from "react";

import { describe, expect, it, vi } from "vitest";

describe("EmptyState project current integration", () => {
  it("通用首页项目包含 Git 目录时应显示启动模式和分支菜单", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 1,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);
    await waitForProjectContextSelector(
      container,
      '[data-testid="composer-utility-branch"]',
    );

    const projectContextBar = container.querySelector(
      '[data-testid="composer-utility-bar"]',
    );

    expect(projectContextBar).toBeTruthy();
    expect(
      projectContextBar?.querySelector(
        '[data-testid="composer-utility-mode-menu"]',
      ),
    ).toBeTruthy();
    expect(
      projectContextBar?.querySelector(
        '[data-testid="composer-utility-branch"]',
      ),
    ).toBeTruthy();
    expect(projectContextBar?.textContent).toContain("启动模式");
    expect(projectContextBar?.textContent).toContain("在本地处理");
    expect(projectContextBar?.textContent).toContain("新工作树");
    expect(projectContextBar?.textContent).toContain("未提交：1 个文件");
    expect(projectContextBar?.textContent).toContain("main");
    expect(projectContextBar?.textContent).toContain("feature/demo");
  });

  it("通用首页项目分支菜单应通过后端切换分支", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });
    mockCheckoutProjectGitBranch.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "feature/demo",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);

    const featureBranch = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("feature/demo"),
    );
    expect(featureBranch).toBeTruthy();

    await act(async () => {
      featureBranch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockCheckoutProjectGitBranch).toHaveBeenCalledWith(
      "/workspace/lime",
      "feature/demo",
    );
    expect(
      container.querySelector('[data-testid="composer-utility-bar"]')
        ?.textContent,
    ).toContain("feature/demo");
  });

  it("通用首页项目分支搜索回车应通过后端创建并检出新分支", async () => {
    mockReadProjectGitStatus.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "main",
      branches: ["feature/demo", "main"],
      uncommittedFileCount: 0,
    });
    mockCreateProjectGitBranch.mockResolvedValue({
      rootPath: "/workspace/lime",
      repositoryRoot: "/workspace/lime",
      hasGitRepository: true,
      currentBranch: "feature/new",
      branches: ["feature/demo", "feature/new", "main"],
      uncommittedFileCount: 0,
    });

    const container = renderEmptyState({
      activeTheme: "general",
      onLaunchBrowserAssist: vi.fn(),
      projectId: "lime",
      openedProjects: [
        {
          id: "lime",
          name: "lime",
          rootPath: "/workspace/lime",
        },
      ],
    });

    await flushAsyncEffects(6);

    const branchSearch = container.querySelector(
      'input[placeholder="搜索分支"]',
    ) as HTMLInputElement | null;
    updateFieldValue(branchSearch, "feature/new");

    await act(async () => {
      branchSearch?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
        }),
      );
      await Promise.resolve();
    });

    expect(mockCreateProjectGitBranch).toHaveBeenCalledWith(
      "/workspace/lime",
      "feature/new",
    );
    expect(
      container.querySelector('[data-testid="composer-utility-bar"]')
        ?.textContent,
    ).toContain("feature/new");
  });
});
