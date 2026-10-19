import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewThreadSidePanelTab } from "./ReviewThreadSidePanelTab";
import {
  ReviewThreadSidePanelProjectionContext,
  type ReviewThreadSidePanelProjection,
} from "./ReviewThreadSidePanelProjection";
import {
  isWorkspaceFilesSurfaceAvailable,
  selectWorkspaceFileChangePaths,
} from "./workspaceFiles";

const git = vi.hoisted(() => ({
  diff: vi.fn(),
  status: vi.fn(),
  commits: vi.fn(),
}));
vi.mock("@/lib/api/projectGit", () => ({
  readProjectGitDiff: git.diff,
  readProjectGitStatus: git.status,
  listProjectGitCommits: git.commits,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const roots: Array<{ root: Root; container: HTMLDivElement }> = [];
const scrollIntoView = vi.fn();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  git.status.mockResolvedValue({
    hasGitRepository: true,
    currentBranch: "main",
    repositoryRoot: "/workspace",
    uncommittedFileCount: 1,
  });
  git.diff.mockResolvedValue({
    hasGitRepository: true,
    patch: "",
    uncommittedFileCount: 0,
  });
});
afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.resetAllMocks();
});

function mount(
  projection: ReviewThreadSidePanelProjection,
  props: Partial<React.ComponentProps<typeof ReviewThreadSidePanelTab>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (value: ReviewThreadSidePanelProjection) =>
    act(() =>
      root.render(
        <ReviewThreadSidePanelProjectionContext.Provider value={value}>
          <ReviewThreadSidePanelTab {...props} />
        </ReviewThreadSidePanelProjectionContext.Provider>,
      ),
    );
  render(projection);
  roots.push({ root, container });
  return { container, render };
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });
function click(container: HTMLElement, selector: string) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  act(() => button!.click());
}

describe("ReviewThreadSidePanelTab", () => {
  it("消费原有 thread patch，选择定位 diff，明确打开按钮才调用外部应用", async () => {
    const onOpenFile = vi.fn();
    const projection = {
      workspaceRoot: "/workspace",
      changeView: {
        reviewThreadId: "thread-1",
        onOpenFile,
        items: [
          {
            id: "add",
            path: "src/add.ts",
            changeKind: "added",
            previousContent: null,
            currentContent: "export const added = true;",
          },
          {
            id: "update",
            path: "src/update.ts",
            previousContent: "old",
            currentContent: "new",
          },
          {
            id: "delete",
            path: "src/delete.ts",
            changeKind: "deleted",
            previousContent: "deleted",
            currentContent: null,
          },
          {
            id: "rename",
            path: "src/old.ts",
            destinationPath: "src/renamed.ts",
            changeKind: "renamed",
          },
        ],
      },
    };
    const { container } = mount(projection);
    await flush();
    expect(git.diff).not.toHaveBeenCalled();
    expect(
      container
        .querySelector('[data-testid="workspace-changes-surface"]')
        ?.getAttribute("data-review-thread-id"),
    ).toBe("thread-1");
    const tree = '[data-testid="canvas-workbench-change-item"]';
    click(container, `${tree}[data-review-path="src/update.ts"]`);
    expect(
      container
        .querySelector(
          '[data-testid="canvas-workbench-change-diff-file"][data-selected="true"]',
        )
        ?.getAttribute("data-review-path"),
    ).toBe("src/update.ts");
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    expect(onOpenFile).not.toHaveBeenCalled();
    click(container, '[data-testid="canvas-workbench-changes-open-file"]');
    expect(onOpenFile).toHaveBeenCalledWith("src/update.ts");
    click(container, `${tree}[data-review-path="src/delete.ts"]`);
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="canvas-workbench-changes-open-file"]',
      )?.disabled,
    ).toBe(true);
    expect(container.textContent).toContain("deleted");
    click(container, `${tree}[data-review-path="src/old.ts"]`);
    click(container, '[data-testid="canvas-workbench-changes-open-file"]');
    expect(onOpenFile).toHaveBeenLastCalledWith("src/renamed.ts");
  });

  it("目标文件使用独立打开动作且从 canonical patch 定位", async () => {
    const onOpenResultFile = vi.fn();
    const { container } = mount(
      {
        changeView: {
          reviewThreadId: "thread-1",
          items: [
            {
              id: "one",
              path: "src/one.ts",
              previousContent: "a",
              currentContent: "b",
            },
            {
              id: "two",
              path: "src/two.ts",
              previousContent: "c",
              currentContent: "d",
            },
          ],
        },
      },
      { target: { relativePath: "src/two.ts" }, onOpenResultFile },
    );
    await flush();
    expect(
      container
        .querySelector(
          '[data-testid="canvas-workbench-change-diff-file"][data-selected="true"]',
        )
        ?.getAttribute("data-review-path"),
    ).toBe("src/two.ts");
    expect(onOpenResultFile).not.toHaveBeenCalled();
    click(container, '[data-testid="workspace-changes-surface-open"]');
    expect(onOpenResultFile).toHaveBeenCalledWith("src/two.ts");
  });

  it("空 thread 复用 Git review owner，失败可重试并展示实际 diff", async () => {
    git.diff
      .mockRejectedValueOnce(new Error("git unavailable"))
      .mockResolvedValueOnce({
        hasGitRepository: true,
        patch: [
          "diff --git a/src/new.ts b/src/new.ts",
          "new file mode 100644",
          "--- /dev/null",
          "+++ b/src/new.ts",
          "@@ -0,0 +1 @@",
          "+export const value = 1;",
        ].join("\n"),
      });
    const { container } = mount({
      workspaceRoot: "/workspace",
      changeView: { reviewThreadId: "thread-empty", items: [] },
    });
    await flush();
    expect(
      container
        .querySelector('[data-testid="workspace-changes-surface"]')
        ?.getAttribute("data-review-thread-id"),
    ).toBe("thread-empty");
    expect(
      container.querySelector('[data-testid="canvas-workbench-changes-error"]')
        ?.textContent,
    ).toContain("git unavailable");
    click(container, '[data-testid="canvas-workbench-changes-retry"]');
    await flush();
    expect(git.diff).toHaveBeenLastCalledWith(
      "/workspace",
      3,
      "unstaged",
      undefined,
    );
    expect(container.textContent).toContain("export const value = 1;");
    expect(
      container.querySelector('[data-review-path="src/new.ts"]'),
    ).not.toBeNull();
  });

  it("切换 workspace/thread 后忽略之前 Git 请求", async () => {
    let resolveOld!: (value: unknown) => void;
    git.diff.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const { container, render } = mount({
      workspaceRoot: "/old",
      changeView: { reviewThreadId: "old", items: [] },
    });
    render({
      workspaceRoot: "/new",
      changeView: { reviewThreadId: "new", items: [] },
    });
    await flush();
    await act(async () =>
      resolveOld({
        hasGitRepository: true,
        patch:
          "diff --git a/stale.ts b/stale.ts\n--- a/stale.ts\n+++ b/stale.ts\n@@ -1 +1 @@\n-old\n+STALE",
        uncommittedFileCount: 1,
      }),
    );
    expect(container.textContent).not.toContain("STALE");
    expect(
      container
        .querySelector('[data-testid="workspace-changes-surface"]')
        ?.getAttribute("data-review-thread-id"),
    ).toBe("new");
  });

  it("无目标、Git workspace 和 patch 时不提供 files；patch 路径去重", () => {
    expect(
      selectWorkspaceFileChangePaths([
        { type: "patch", paths: ["src/a.ts", " ", "src/a.ts"] },
      ]),
    ).toEqual(["src/a.ts"]);
    expect(isWorkspaceFilesSurfaceAvailable({})).toBe(false);
    expect(
      isWorkspaceFilesSurfaceAvailable({ projectRootPath: "/workspace" }),
    ).toBe(true);
    expect(
      isWorkspaceFilesSurfaceAvailable({
        threadItems: [{ type: "patch", paths: ["src/a.ts"] }],
      }),
    ).toBe(true);
  });
});
