import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isWorkspaceFilesSurfaceAvailable,
  selectGitPatchChangePaths,
  selectWorkspaceFileChangePaths,
} from "./workspaceFiles";
import { WorkspaceFilesSurface } from "./WorkspaceFilesSurface";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const copy: Record<string, string> = {
        "agentChat.canvasWorkbench.tabs.files": "文件",
        "agentChat.fileChangesSummary.openFile": "打开文件",
        "agentChat.activityPanel.changes": "变更",
        "agentChat.filesSurface.gitChangesLoading": "正在读取工作区变更",
        "agentChat.filesSurface.gitChangesError": "无法读取工作区变更",
        "agentChat.filesSurface.gitChangesEmpty": "工作区没有文件变更",
        "agentChat.filesSurface.gitChangesRefresh": "刷新工作区变更",
      };
      return copy[key] ?? key;
    },
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
      size?: string;
    }
  >(({ children, variant: _variant, size: _size, ...props }, ref) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )),
}));

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

function renderSurface(
  props?: Partial<React.ComponentProps<typeof WorkspaceFilesSurface>>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <WorkspaceFilesSurface
        target={{
          relativePath: "outputs/result.md",
          title: "result.md",
        }}
        onOpenResultFile={vi.fn()}
        {...props}
      />,
    );
  });

  mountedRoots.push({ root, container });
  return container;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (!mounted) {
      break;
    }
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  }
  vi.clearAllMocks();
});

describe("WorkspaceFilesSurface", () => {
  it("应展示目标文件并通过打开按钮回调相对路径", () => {
    const onOpenResultFile = vi.fn();
    const container = renderSurface({ onOpenResultFile });

    expect(
      container.querySelector('[data-testid="workspace-files-surface"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="workspace-files-surface-path"]')
        ?.textContent,
    ).toBe("outputs/result.md");
    expect(container.textContent).toContain("result.md");

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="workspace-files-surface-open"]',
        )
        ?.click();
    });

    expect(onOpenResultFile).toHaveBeenCalledWith("outputs/result.md");
  });

  it("应列出同一线程已有的补丁路径", () => {
    const container = renderSurface({
      changedPaths: ["src/app.ts", "src/app.ts", "README.md"],
    });

    expect(
      Array.from(
        container.querySelectorAll(
          '[data-testid="workspace-files-surface-change"]',
        ),
      ).map((node) => node.textContent),
    ).toEqual(["src/app.ts", "README.md"]);
    expect(
      selectWorkspaceFileChangePaths([
        { type: "command_execution" },
        { type: "patch", paths: ["src/app.ts", " "] },
        { type: "patch", paths: ["src/app.ts", "README.md"] },
      ]),
    ).toEqual(["src/app.ts", "README.md"]);
  });

  it("同一线程已有补丁路径时应允许打开文件面", () => {
    const threadItems = [
      { type: "command_execution" },
      { type: "patch", paths: ["src/app.ts"] },
    ];

    expect(
      isWorkspaceFilesSurfaceAvailable({
        threadItems,
      }),
    ).toBe(true);
    expect(
      isWorkspaceFilesSurfaceAvailable({
        targetRelativePath: "  ",
        threadItems: [{ type: "command_execution" }],
      }),
    ).toBe(false);
    expect(
      isWorkspaceFilesSurfaceAvailable({
        targetRelativePath: "outputs/result.md",
      }),
    ).toBe(true);
    expect(
      isWorkspaceFilesSurfaceAvailable({
        projectRootPath: "/workspace/lime",
      }),
    ).toBe(true);
  });

  it("工作区 git diff 路径并入同一变更列表", async () => {
    const patch = [
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1 @@",
      "+export const value = 1;",
    ].join("\n");
    const readGitDiff = vi.fn().mockResolvedValue({
      rootPath: "/workspace/lime",
      hasGitRepository: true,
      patch,
      uncommittedFileCount: 1,
    });
    const container = renderSurface({
      target: null,
      projectRootPath: "/workspace/lime",
      changedPaths: ["src/app.ts"],
      readGitDiff,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(readGitDiff).toHaveBeenCalledWith("/workspace/lime");
    expect(selectGitPatchChangePaths(patch)).toEqual(["src/new.ts"]);
    expect(
      Array.from(
        container.querySelectorAll(
          '[data-testid="workspace-files-surface-change"]',
        ),
      ).map((node) => node.textContent),
    ).toEqual(["src/app.ts", "src/new.ts"]);
  });

  it("git diff 为空或失败时展示对应状态", async () => {
    const emptyDiff = vi.fn().mockResolvedValue({
      rootPath: "/workspace/lime",
      hasGitRepository: true,
      patch: "",
      uncommittedFileCount: 0,
    });
    const emptyContainer = renderSurface({
      target: null,
      projectRootPath: "/workspace/lime",
      changedPaths: [],
      readGitDiff: emptyDiff,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      emptyContainer.querySelector(
        '[data-testid="workspace-files-surface-git-empty"]',
      )?.textContent,
    ).toBe("工作区没有文件变更");

    const failedDiff = vi.fn().mockRejectedValue(new Error("git unavailable"));
    const errorContainer = renderSurface({
      target: null,
      projectRootPath: "/workspace/other",
      changedPaths: [],
      readGitDiff: failedDiff,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      errorContainer.querySelector(
        '[data-testid="workspace-files-surface-git-error"]',
      )?.textContent,
    ).toBe("无法读取工作区变更");
  });

  it("刷新会再次读取同一项目根的 git diff", async () => {
    const firstPatch = [
      "diff --git a/src/old.ts b/src/old.ts",
      "--- a/src/old.ts",
      "+++ b/src/old.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");
    const secondPatch = [
      "diff --git a/src/next.ts b/src/next.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/next.ts",
      "@@ -0,0 +1 @@",
      "+next",
    ].join("\n");
    const readGitDiff = vi
      .fn()
      .mockResolvedValueOnce({
        rootPath: "/workspace/lime",
        hasGitRepository: true,
        patch: firstPatch,
        uncommittedFileCount: 1,
      })
      .mockResolvedValueOnce({
        rootPath: "/workspace/lime",
        hasGitRepository: true,
        patch: secondPatch,
        uncommittedFileCount: 1,
      });
    const container = renderSurface({
      target: null,
      projectRootPath: "/workspace/lime",
      changedPaths: [],
      readGitDiff,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-testid="workspace-files-surface-change"]')
        ?.textContent,
    ).toBe("src/old.ts");

    const refresh = container.querySelector<HTMLButtonElement>(
      '[data-testid="workspace-files-surface-git-refresh"]',
    );
    expect(refresh?.textContent).toBe("刷新工作区变更");
    await act(async () => {
      refresh?.click();
      await Promise.resolve();
    });

    expect(readGitDiff).toHaveBeenCalledTimes(2);
    expect(readGitDiff).toHaveBeenNthCalledWith(2, "/workspace/lime");
    expect(
      container.querySelector('[data-testid="workspace-files-surface-change"]')
        ?.textContent,
    ).toBe("src/next.ts");
  });

  it("没有项目根时不显示工作区变更刷新", () => {
    const container = renderSurface({
      projectRootPath: "  ",
      changedPaths: ["src/app.ts"],
    });

    expect(
      container.querySelector(
        '[data-testid="workspace-files-surface-git-refresh"]',
      ),
    ).toBeNull();
  });

  it("没有目标文件时不显示打开按钮", () => {
    const container = renderSurface({
      target: null,
      changedPaths: ["src/app.ts"],
      onOpenResultFile: vi.fn(),
    });

    expect(
      container.querySelector('[data-testid="workspace-files-surface-open"]'),
    ).toBeNull();
    expect(container.textContent).toContain("变更");
    expect(
      container.querySelector('[data-testid="workspace-files-surface-change"]')
        ?.textContent,
    ).toBe("src/app.ts");
  });
});
