import { act } from "react";
import { createRoot } from "react-dom/client";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  workbookControllersAtom,
  type WorkbookController,
} from "@/components/artifact/workbook/WorkbookController";
import { FileTabLifecycleProvider } from "../text-file-editor/FileTabLifecycle";
import type { FileTabLifecycle } from "../text-file-editor/fileTabLifecycleContext";
import { useWorkspaceFileActions } from "./useWorkspaceFileActions";

const boundary = vi.hoisted(() => ({
  save: vi.fn(),
  copy: vi.fn(),
  clipboard: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { error: boundary.error } }));
vi.mock("@/lib/desktop-host/dialog", () => ({ save: boundary.save }));
vi.mock("@/lib/api/fileBrowser", () => ({ copyFile: boundary.copy }));
vi.mock("@/lib/desktop-runtime", () => ({
  hasDesktopHostInvokeCapability: () => true,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const cleanup: Array<() => void> = [];
const path = "/work/source.xlsx";
function mount({
  saveFile = vi.fn(async () => true),
  flush = vi.fn(async () => true),
} = {}) {
  const store = createStore();
  store
    .get(workbookControllersAtom)
    .set(path, { flushPublicFile: flush } as unknown as WorkbookController);
  const lifecycle: FileTabLifecycle = {
    register: () => () => {},
    saveFile,
    isTabCurrent: () => true,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let latest!: ReturnType<typeof useWorkspaceFileActions>;
  let current = true;
  let mounted = true;
  function Probe({ scope, filePath }: { scope: object; filePath: string }) {
    latest = useWorkspaceFileActions(scope, filePath, () => current);
    return null;
  }
  const render = (scope: object, filePath = path) =>
    act(() =>
      root.render(
        <Provider store={store}>
          <FileTabLifecycleProvider lifecycle={lifecycle}>
            <Probe scope={scope} filePath={filePath} />
          </FileTabLifecycleProvider>
        </Provider>,
      ),
    );
  const unmount = () => {
    if (!mounted) return;
    act(() => root.unmount());
    host.remove();
    mounted = false;
  };
  cleanup.push(unmount);
  render({});
  return {
    get: () => latest,
    render,
    unmount,
    invalidate: () => {
      current = false;
    },
    saveFile,
    flush,
  };
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  boundary.save.mockResolvedValue("/export/copy.xlsx");
  boundary.copy.mockResolvedValue(undefined);
  boundary.clipboard.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: boundary.clipboard },
  });
});
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

describe("树与标签共享文件动作", () => {
  it("文本save、现有文档flush、原生对话框、同一copy gateway严格串行", async () => {
    const order: string[] = [];
    const hook = mount({
      saveFile: vi.fn(async () => {
        order.push("text-save");
        return true;
      }),
      flush: vi.fn(async () => {
        order.push("document-flush");
        return true;
      }),
    });
    boundary.save.mockImplementation(async () => {
      order.push("dialog");
      return "/export/copy.xlsx";
    });
    boundary.copy.mockImplementation(async () => {
      order.push("copy");
    });
    await act(async () => hook.get().saveAs());
    expect(order).toEqual(["text-save", "document-flush", "dialog", "copy"]);
    expect(hook.saveFile).toHaveBeenCalledExactlyOnceWith(path);
    expect(boundary.save).toHaveBeenCalledExactlyOnceWith({
      title: "workspace.artifactPreviewHeader.saveAs",
      defaultPath: path,
    });
    expect(boundary.copy).toHaveBeenCalledExactlyOnceWith(
      path,
      "/export/copy.xlsx",
    );
    expect(hook.get().busy).toBe(false);
  });

  it.each(["text", "document"])(
    "%s保存失败保留原编辑，不打开对话框且可重试",
    async (stage) => {
      const hook = mount({
        saveFile: vi.fn(async () => stage !== "text"),
        flush: vi.fn(async () => stage !== "document"),
      });
      await act(async () => hook.get().saveAs());
      expect(boundary.save).not.toHaveBeenCalled();
      expect(boundary.copy).not.toHaveBeenCalled();
      expect(boundary.error).toHaveBeenCalledExactlyOnceWith(
        "workspace.fileActions.saveFailed",
      );
      expect(hook.get().busy).toBe(false);
      hook.saveFile.mockResolvedValue(true);
      hook.flush.mockResolvedValue(true);
      await act(async () => hook.get().saveAs());
      expect(boundary.copy).toHaveBeenCalledTimes(1);
    },
  );

  it("在途保存合并重复动作；新菜单scope令旧flush失去打开对话框的权限", async () => {
    const saving = deferred<boolean>();
    const hook = mount({ saveFile: vi.fn(() => saving.promise) });
    let action!: Promise<void>;
    await act(async () => {
      action = hook.get().saveAs();
      await hook.get().saveAs();
    });
    expect(hook.saveFile).toHaveBeenCalledTimes(1);
    expect(hook.get().busy).toBe(true);
    hook.render({});
    await act(async () => {
      saving.resolve(true);
      await action;
    });
    expect(boundary.save).not.toHaveBeenCalled();
    expect(boundary.error).not.toHaveBeenCalled();
  });

  it.each(["scope", "target", "unmount"])(
    "原生对话框等待期间%s变化拒绝迟到复制",
    async (change) => {
      const dialog = deferred<string>();
      boundary.save.mockReturnValue(dialog.promise);
      const hook = mount();
      let action!: Promise<void>;
      await act(async () => {
        action = hook.get().saveAs();
      });
      expect(boundary.save).toHaveBeenCalledTimes(1);
      if (change === "scope") hook.render({});
      else if (change === "target") hook.invalidate();
      else hook.unmount();
      await act(async () => {
        dialog.resolve("/export/old.xlsx");
        await action;
      });
      expect(boundary.copy).not.toHaveBeenCalled();
      expect(boundary.error).not.toHaveBeenCalled();
    },
  );

  it("取消另存为不复制，也不报告失败", async () => {
    boundary.save.mockResolvedValue(null);
    const hook = mount();
    await act(async () => hook.get().saveAs());
    expect(boundary.copy).not.toHaveBeenCalled();
    expect(boundary.error).not.toHaveBeenCalled();
  });

  it.each(["dialog", "copy", "clipboard"])(
    "%s失败使用公共错误出口并释放动作锁",
    async (stage) => {
      const hook = mount();
      const failing =
        stage === "dialog"
          ? boundary.save
          : stage === "copy"
            ? boundary.copy
            : boundary.clipboard;
      failing.mockRejectedValueOnce(new Error("permission denied"));
      await act(async () =>
        stage === "clipboard" ? hook.get().copyPath() : hook.get().saveAs(),
      );
      expect(boundary.error).toHaveBeenCalledExactlyOnceWith(
        "workspace.fileActions.actionFailed",
      );
      expect(hook.get().busy).toBe(false);
    },
  );

  it("复制只取真实path；scope退出后的迟到剪贴板失败不显示旧错误", async () => {
    const copying = deferred<void>();
    boundary.clipboard.mockReturnValue(copying.promise);
    const hook = mount();
    let action!: Promise<void>;
    await act(async () => {
      action = hook.get().copyPath();
    });
    expect(boundary.clipboard).toHaveBeenCalledExactlyOnceWith(path);
    hook.render({}, "/work/new.xlsx");
    await act(async () => {
      copying.reject(new Error("old request failed"));
      await action;
    });
    expect(boundary.error).not.toHaveBeenCalled();
    expect(boundary.save).not.toHaveBeenCalled();
  });
});
