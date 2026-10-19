import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Artifact } from "@/lib/artifact/types";
import {
  presentationControllersAtom,
  type PresentationController,
} from "@/components/artifact/presentation/PresentationController";
import {
  CanvasWorkbenchLayout,
  type CanvasWorkbenchLayoutProps,
} from "./CanvasWorkbenchLayout";
import type { CanvasWorkbenchShell } from "./canvas-workbench";
import { configureBooleanGateway } from "@/hooks/usePersistedBooleanAtom.testFixtures";

const atomGateway = vi.hoisted(() => ({
  read: vi.fn(),
  update: vi.fn(),
  listen: vi.fn(),
}));
vi.mock("@/lib/api/persistedAtoms", () => ({
  sendPersistedAtomState: atomGateway.read,
  updatePersistedAtomState: atomGateway.update,
  listenPersistedAtomUpdates: atomGateway.listen,
}));

type ShellProps = ComponentProps<typeof CanvasWorkbenchShell>;
const boundary = vi.hoisted(() => ({
  shell: null as ShellProps | null,
  listDirectory: vi.fn(),
  toastError: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock("sonner", () => ({
  toast: { error: boundary.toastError, success: vi.fn(), info: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: boundary.translate,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@/lib/api/fileBrowser", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/api/fileBrowser")>()),
  listDirectory: boundary.listDirectory,
}));
vi.mock("./canvas-workbench", async (importActual) => ({
  ...(await importActual<typeof import("./canvas-workbench")>()),
  // 显式 shell 边界夹具；DocumentState、fileAction 和 Jotai owner 均使用真实实现。
  CanvasWorkbenchShell: (props: ShellProps) => {
    boundary.shell = props;
    return (
      <div ref={props.shellRef} data-testid="navigation-surface">
        {props.documentContext?.content}
      </div>
    );
  },
}));

const cleanups: Array<() => void> = [];
const originalPath = "/workspace/original.pptx";
function artifact(id: string, path: string, content = id): Artifact {
  return {
    id,
    type: "document",
    title: path.split("/").at(-1)!,
    content,
    status: "complete",
    meta: { filePath: path, sourcePath: path, previewArtifact: true },
    position: { start: 0, end: 0 },
    createdAt: 1,
    updatedAt: 1,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function shell(): ShellProps {
  if (!boundary.shell) throw new Error("Workbench shell 尚未渲染");
  return boundary.shell;
}
function visiblePath(): string | undefined {
  const target = shell().documentContext?.target;
  return target && target.kind !== "empty"
    ? target.absolutePath || target.filePath
    : undefined;
}
function editor(
  store: ReturnType<typeof createStore>,
  path: string,
  flush: () => Promise<boolean>,
) {
  store.get(presentationControllersAtom).set(path, {
    flushPublicFile: flush,
  } as PresentationController);
}
function mountWorkbench(
  overrides: Partial<CanvasWorkbenchLayoutProps> = {},
  store = createStore(),
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let props: CanvasWorkbenchLayoutProps = {
    artifacts: [artifact("original", originalPath)],
    canvasState: null,
    taskFiles: [],
    workspaceRoot: "/workspace",
    defaultPreview: null,
    loadFilePreview: vi.fn(async (path) => ({
      path,
      content: "file preview",
      isBinary: false,
      size: 12,
      error: null,
    })),
    onOpenPath: vi.fn(async () => {}),
    onRevealPath: vi.fn(async () => {}),
    onClose: vi.fn(),
    ...overrides,
  };
  const render = () => {
    act(() => {
      root.render(
        <Provider store={store}>
          <CanvasWorkbenchLayout {...props} />
        </Provider>,
      );
    });
  };
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    act(() => root.unmount());
    container.remove();
    mounted = false;
  };
  cleanups.push(unmount);
  render();
  return {
    container,
    props,
    unmount,
    rerender: (next: Partial<CanvasWorkbenchLayoutProps>) => {
      props = { ...props, ...next };
      render();
    },
  };
}
async function invoke(action: (props: ShellProps) => void) {
  await act(async () => action(shell()));
}
async function settle() {
  await act(async () => {});
}

beforeEach(() => {
  configureBooleanGateway(atomGateway);
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  boundary.listDirectory.mockImplementation(async (path: string) => ({
    path,
    parentPath: null,
    entries: [],
    error: null,
  }));
});
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  boundary.shell = null;
  vi.clearAllMocks();
});

describe("Workbench 保存前导航", () => {
  it("Changes consumes the same saved file tree setting instead of local state", async () => {
    const gateway = configureBooleanGateway(atomGateway);
    mountWorkbench();
    await act(async () => undefined);
    expect(shell().changesFilesPanelOpen).toBe(false);
    await act(async () => shell().onToggleChangesFilesPanel?.());
    expect(shell().changesFilesPanelOpen).toBe(true);
    await act(async () => gateway.set("app-shell-file-tree-open", false, 5));
    expect(shell().changesFilesPanelOpen).toBe(false);
  });

  it.each([
    {
      name: "tab 选择",
      action: (s: ShellProps) => s.onSelectTab("outputs"),
      next: "outputs",
    },
    {
      name: "新建工具",
      action: (s: ShellProps) => s.onNewToolTab("terminal"),
      next: "terminal:1",
    },
    {
      name: "预览模式",
      action: (s: ShellProps) => s.onSelectPreviewMode("markdown"),
      next: "markdown",
    },
    {
      name: "Shell 关闭",
      action: (s: ShellProps) => s.onClose?.(),
      next: "code",
    },
  ])(
    "$name 等待保存，失败保留视图且不自旋，重试成功才执行",
    async ({ action, next }) => {
      const saving = deferred<boolean>();
      const flush = vi.fn(() => saving.promise);
      const store = createStore();
      editor(store, originalPath, flush);
      const mounted = mountWorkbench({}, store);
      await settle();

      await invoke(action);
      expect(flush).toHaveBeenCalledTimes(1);
      expect(shell().contentTab).toBe("code");
      expect(mounted.props.onClose).not.toHaveBeenCalled();
      await act(async () => saving.resolve(false));
      await settle();
      expect(shell().contentTab).toBe("code");
      expect(visiblePath()).toBe(originalPath);
      expect(mounted.props.onClose).not.toHaveBeenCalled();
      expect(flush).toHaveBeenCalledTimes(1);
      expect(boundary.toastError).toHaveBeenCalledWith(
        "workspace.fileActions.saveFailed",
      );

      flush.mockImplementation(async () => true);
      await invoke(action);
      expect(flush).toHaveBeenCalledTimes(2);
      expect(shell().contentTab).toBe(next);
      if (next === "code")
        expect(mounted.props.onClose).toHaveBeenCalledTimes(1);
    },
  );

  it("文件选择在保存成功前不进入读取或 loading，重复导航共用同一个锁", async () => {
    const saving = deferred<boolean>();
    const flush = vi.fn(() => saving.promise);
    const store = createStore();
    editor(store, originalPath, flush);
    const mounted = mountWorkbench({}, store);
    await settle();

    await invoke((s) => {
      s.onSelectFile("/workspace/next.pptx");
      s.onNewToolTab("terminal");
      s.onSelectTab("outputs");
    });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(mounted.props.loadFilePreview).not.toHaveBeenCalled();
    expect(visiblePath()).toBe(originalPath);
    expect(shell().documentContext?.target.kind).toBe("artifact");

    await act(async () => saving.resolve(false));
    expect(mounted.props.loadFilePreview).not.toHaveBeenCalled();
    expect(shell().documentSelectionKey).toBe("artifact:original");
    flush.mockImplementation(async () => true);
    await invoke((s) => s.onSelectFile("/workspace/next.pptx"));
    expect(mounted.props.loadFilePreview).toHaveBeenCalledWith(
      "/workspace/next.pptx",
    );
    expect(visiblePath()).toBe("/workspace/next.pptx");
  });

  it("同路径重开失败仍保留当前文件；实际文件与外层 artifact 不同也保存实际 owner", async () => {
    const originalFlush = vi.fn(async () => true);
    const currentFlush = vi.fn(async () => true);
    const store = createStore();
    editor(store, originalPath, originalFlush);
    editor(store, "/workspace/current.pptx", currentFlush);
    const mounted = mountWorkbench({}, store);
    await settle();
    await invoke((s) => s.onNewToolTab("project-files"));
    await invoke((s) => s.onSelectFile("/workspace/current.pptx"));
    expect(visiblePath()).toBe("/workspace/current.pptx");
    const originalSaveCount = originalFlush.mock.calls.length;
    const readCount = vi.mocked(mounted.props.loadFilePreview).mock.calls
      .length;
    const saving = deferred<boolean>();
    currentFlush.mockImplementation(() => saving.promise);

    await invoke((s) => s.onSelectFile("/workspace/current.pptx"));
    expect(currentFlush).toHaveBeenCalledTimes(1);
    expect(mounted.props.loadFilePreview).toHaveBeenCalledTimes(readCount);
    await act(async () => saving.resolve(false));
    expect(visiblePath()).toBe("/workspace/current.pptx");
    expect(shell().documentContext?.target.kind).toBe("synthetic-artifact");
    expect(originalFlush).toHaveBeenCalledTimes(originalSaveCount);

    currentFlush.mockImplementation(async () => true);
    await invoke((s) => s.onSelectFile("/workspace/current.pptx"));
    expect(mounted.props.loadFilePreview).toHaveBeenCalledTimes(readCount + 1);
    expect(currentFlush).toHaveBeenCalledTimes(2);
  });

  it("项目文件预览模式与当前 tab 关闭都保存当前文件，失败保留工具 tab", async () => {
    const store = createStore();
    editor(
      store,
      originalPath,
      vi.fn(async () => true),
    );
    const flush = vi.fn(async () => true);
    editor(store, "/workspace/current.pptx", flush);
    mountWorkbench({}, store);
    await settle();
    await invoke((s) => s.onNewToolTab("project-files"));
    await invoke((s) => s.onSelectFile("/workspace/current.pptx"));
    expect(shell().projectFilesPreviewMode).toBe("code");
    flush.mockImplementation(async () => false);

    await invoke((s) => s.onSelectProjectFilesPreviewMode("markdown"));
    expect(shell().projectFilesPreviewMode).toBe("code");
    await invoke((s) => s.onCloseTab?.("project-files:1"));
    expect(shell().contentTab).toBe("project-files:1");
    expect(shell().tabs.some((tab) => tab.key === "project-files:1")).toBe(
      true,
    );

    flush.mockImplementation(async () => true);
    await invoke((s) => s.onSelectProjectFilesPreviewMode("markdown"));
    expect(shell().projectFilesPreviewMode).toBe("markdown");
    await invoke((s) => s.onCloseTab?.("project-files:1"));
    expect(shell().tabs.some((tab) => tab.key === "project-files:1")).toBe(
      false,
    );
    expect(flush).toHaveBeenCalledTimes(4);
  });

  it("预览请求等目标入库和保存成功后才切换并确认；失败同请求不反复保存", async () => {
    const saving = deferred<boolean>();
    const flush = vi.fn(() => saving.promise);
    const store = createStore();
    editor(store, originalPath, flush);
    const next = artifact("next", "/workspace/next.pptx");
    const ack = vi.fn();
    const request = {
      requestKey: 1,
      selectionKey: "artifact:next",
      filePath: "/workspace/next.pptx",
    };
    const mounted = mountWorkbench(
      { previewOpenRequest: request, onPreviewOpenRequestHandled: ack },
      store,
    );
    await settle();
    expect(flush).not.toHaveBeenCalled();
    mounted.rerender({ artifacts: [artifact("original", originalPath), next] });
    await settle();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(visiblePath()).toBe(originalPath);
    expect(ack).not.toHaveBeenCalled();

    await act(async () => saving.resolve(false));
    mounted.rerender({
      artifacts: [
        artifact("original", originalPath, "updated projection"),
        next,
      ],
    });
    await settle();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(ack).not.toHaveBeenCalled();
    expect(visiblePath()).toBe(originalPath);
    flush.mockImplementation(async () => true);
    mounted.rerender({ previewOpenRequest: { ...request, requestKey: 2 } });
    await settle();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(visiblePath()).toBe("/workspace/next.pptx");
    expect(ack.mock.calls).toEqual([[2]]);
  });

  it("预览请求 A→B→A 取消旧保存回调；最新请求等待自己的保存结果", async () => {
    const firstSave = deferred<boolean>();
    const latestSave = deferred<boolean>();
    const flush = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementation(() => latestSave.promise);
    const store = createStore();
    editor(store, originalPath, flush);
    const ack = vi.fn();
    const request = {
      requestKey: 1,
      selectionKey: "artifact:next",
      filePath: "/workspace/next.pptx",
    };
    const mounted = mountWorkbench(
      {
        artifacts: [
          artifact("original", originalPath),
          artifact("next", "/workspace/next.pptx"),
          artifact("other", "/workspace/other.pptx"),
        ],
        defaultPreview: {
          selectionKey: "artifact:original",
          title: "original.pptx",
          filePath: originalPath,
          content: "original",
        },
        previewOpenRequest: request,
        onPreviewOpenRequestHandled: ack,
      },
      store,
    );
    await settle();
    mounted.rerender({
      previewOpenRequest: { requestKey: 2, selectionKey: "artifact:other" },
    });
    mounted.rerender({ previewOpenRequest: request });
    await act(async () => firstSave.resolve(true));
    await settle();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(visiblePath()).toBe(originalPath);
    expect(ack).not.toHaveBeenCalled();
    await act(async () => latestSave.resolve(true));
    expect(visiblePath()).toBe("/workspace/next.pptx");
    expect(ack.mock.calls).toEqual([[1]]);
  });

  it("工作区切换取消旧导航且不投影旧工作区文件", async () => {
    const saving = deferred<boolean>();
    const flush = vi.fn(() => saving.promise);
    const store = createStore();
    editor(store, originalPath, flush);
    const mounted = mountWorkbench({}, store);
    await settle();
    await invoke((s) => s.onSelectFile("/workspace/late.pptx"));
    mounted.rerender({
      workspaceRoot: "/different",
      artifacts: [artifact("different", "/different/current.pptx")],
    });
    await settle();
    expect(visiblePath()).toBe("/different/current.pptx");
    expect(mounted.container.textContent).not.toContain("original");
    await act(async () => saving.resolve(true));
    expect(mounted.props.loadFilePreview).not.toHaveBeenCalled();
    expect(visiblePath()).toBe("/different/current.pptx");
  });

  it.each([false, true])(
    "跨文件投影替换等待原文件保存，同身份新投影继续更新：%s",
    async (saved) => {
      const saving = deferred<boolean>();
      const flush = vi.fn(() => saving.promise);
      const store = createStore();
      editor(store, originalPath, flush);
      const mounted = mountWorkbench({}, store);
      await settle();
      mounted.rerender({
        artifacts: [artifact("original", originalPath, "same identity update")],
      });
      expect(mounted.container.textContent).toContain("same identity update");
      expect(flush).not.toHaveBeenCalled();
      mounted.rerender({
        artifacts: [
          artifact("original", "/workspace/replaced.pptx", "replacement"),
        ],
      });
      await settle();
      expect(flush).toHaveBeenCalledTimes(1);
      expect(visiblePath()).toBe(originalPath);
      await act(async () => saving.resolve(saved));
      await settle();
      expect(flush).toHaveBeenCalledTimes(1);
      expect(visiblePath()).toBe(
        saved ? "/workspace/replaced.pptx" : originalPath,
      );
      expect(mounted.container.textContent).toContain(
        saved ? "replacement" : "same identity update",
      );
    },
  );

  it.each([false, true])(
    "自动审查聚焦等待保存且不重复保存：%s",
    async (saved) => {
      const saving = deferred<boolean>();
      const flush = vi.fn(() => saving.promise);
      const store = createStore();
      editor(store, originalPath, flush);
      const defaultPreview = {
        selectionKey: "artifact:original",
        title: "original.pptx",
        filePath: originalPath,
        content: "old",
      };
      const mounted = mountWorkbench({ defaultPreview }, store);
      await settle();
      mounted.rerender({
        defaultPreview: {
          ...defaultPreview,
          content: "new",
          previousContent: "old",
        },
      });
      await settle();
      expect(flush).toHaveBeenCalledTimes(1);
      expect(shell().contentTab).toBe("code");
      await act(async () => saving.resolve(saved));
      await settle();
      expect(shell().contentTab).toBe(saved ? "changes" : "code");
      expect(flush).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])(
    "失效预览模式 fallback 等待保存后决定是否切换：%s",
    async (saved) => {
      const path = "/workspace/preview.txt";
      const saving = deferred<boolean>();
      const flush = vi.fn(async () => true);
      const store = createStore();
      editor(store, path, flush);
      const defaultPreview = {
        selectionKey: "preview",
        title: "preview.txt",
        filePath: path,
        content: "<html><body>preview</body></html>",
      };
      const mounted = mountWorkbench({ artifacts: [], defaultPreview }, store);
      await settle();
      await invoke((s) => s.onSelectPreviewMode("html"));
      expect(shell().contentTab).toBe("html");
      flush.mockImplementation(() => saving.promise);
      const previousSaveCount = flush.mock.calls.length;
      mounted.rerender({
        defaultPreview: { ...defaultPreview, content: "plain text" },
      });
      await settle();
      expect(flush).toHaveBeenCalledTimes(previousSaveCount + 1);
      expect(shell().contentTab).toBe("html");
      await act(async () => saving.resolve(saved));
      await settle();
      expect(shell().contentTab).toBe(saved ? "code" : "html");
      expect(flush).toHaveBeenCalledTimes(previousSaveCount + 1);
    },
  );

  it("会话面板先等待新文档投影就绪，再自动聚焦；不争用同一个保存锁", async () => {
    const store = createStore();
    const flush = vi.fn(async () => true);
    editor(store, originalPath, flush);
    const mounted = mountWorkbench(
      { artifacts: [], sessionView: { renderPanel: () => null } },
      store,
    );
    await settle();
    expect(shell().contentTab).toBe("outputs");
    mounted.rerender({ artifacts: [artifact("original", originalPath)] });
    await settle();
    expect(visiblePath()).toBe(originalPath);
    expect(shell().contentTab).toBe("markdown");
    expect(flush).not.toHaveBeenCalled();
  });

  it("文件读取完成前切换工作区后，迟到读取不能再选中新文件", async () => {
    const reading = deferred<{
      path: string;
      content: string;
      isBinary: boolean;
      size: number;
      error: null;
    }>();
    const load = vi.fn(() => reading.promise);
    const store = createStore();
    editor(
      store,
      originalPath,
      vi.fn(async () => true),
    );
    const mounted = mountWorkbench({ loadFilePreview: load }, store);
    await settle();
    await invoke((s) => s.onSelectFile("/workspace/late.pptx"));
    expect(load).toHaveBeenCalledTimes(1);
    mounted.rerender({
      workspaceRoot: "/different",
      artifacts: [artifact("different", "/different/current.pptx")],
    });
    await settle();
    await act(async () =>
      reading.resolve({
        path: "/workspace/late.pptx",
        content: "late",
        isBinary: false,
        size: 4,
        error: null,
      }),
    );
    expect(visiblePath()).toBe("/different/current.pptx");
    expect(shell().documentSelectionKey).toBe("artifact:different");
  });

  it("注册外层离开 guard 后 Shell 关闭仅获取一次锁，注册读取最新实际可见文件", async () => {
    const saving = deferred<boolean>();
    const store = createStore();
    const originalFlush = vi.fn(async () => true);
    const currentFlush = vi.fn(() => saving.promise);
    editor(store, originalPath, originalFlush);
    editor(store, "/workspace/current.pptx", currentFlush);
    let guard: (() => Promise<boolean>) | null = null;
    const register = vi.fn((next: typeof guard) => {
      guard = next;
    });
    const closed = vi.fn();
    const onClose = vi.fn(async () => {
      if (await guard?.()) closed();
    });
    const mounted = mountWorkbench(
      { onBeforeLeaveChange: register, onClose },
      store,
    );
    await settle();
    await invoke((s) => s.onNewToolTab("project-files"));
    await invoke((s) => s.onSelectFile("/workspace/current.pptx"));
    expect(register).toHaveBeenCalledTimes(1);
    const oldSaveCount = originalFlush.mock.calls.length;
    await invoke((s) => s.onClose?.());
    expect(currentFlush).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    await act(async () => saving.resolve(true));
    expect(closed).toHaveBeenCalledTimes(1);
    expect(originalFlush).toHaveBeenCalledTimes(oldSaveCount);
    mounted.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });
});
