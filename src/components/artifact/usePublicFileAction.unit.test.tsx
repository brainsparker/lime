import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  presentationControllersAtom,
  type PresentationController,
} from "./presentation/PresentationController";
import {
  workbookControllersAtom,
  type WorkbookController,
} from "./workbook/WorkbookController";
import { usePublicFileAction } from "./usePublicFileAction";

const { toastError, translate } = vi.hoisted(() => ({
  toastError: vi.fn(),
  translate: (key: string) => key,
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

const cleanups: Array<() => void> = [];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function renderFileAction(store = createStore(), initialScope = "file-a") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let value: ReturnType<typeof usePublicFileAction>;
  let mounted = true;
  function Probe({ scope }: { scope: string }) {
    value = usePublicFileAction(scope);
    return null;
  }
  const render = (scope: string) => {
    act(() => {
      root.render(
        <Provider store={store}>
          <Probe scope={scope} />
        </Provider>,
      );
    });
  };
  const unmount = () => {
    if (!mounted) return;
    act(() => root.unmount());
    container.remove();
    mounted = false;
  };
  cleanups.push(unmount);
  render(initialScope);
  return { getValue: () => value, render, unmount };
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  vi.clearAllMocks();
});

describe("usePublicFileAction", () => {
  it("Workbook 保存失败阻止动作，并释放锁供成功重试", async () => {
    const path = "/workspace/book.xlsx";
    const flush = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const store = createStore();
    store.get(workbookControllersAtom).set(path, {
      flushPublicFile: flush,
    } as WorkbookController);
    const unrelatedFlush = vi.fn(async () => true);
    store.get(presentationControllersAtom).set("/workspace/other.pptx", {
      flushPublicFile: unrelatedFlush,
    } as PresentationController);
    const hook = renderFileAction(store);
    const action = vi.fn();

    await act(async () => {
      expect(await hook.getValue().run(path, action)).toBe(false);
    });
    expect(action).not.toHaveBeenCalled();
    expect(unrelatedFlush).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("workspace.fileActions.saveFailed");
    expect(hook.getValue().busy).toBe(false);

    await act(async () => {
      expect(await hook.getValue().run(path, action)).toBe(true);
    });
    expect(flush).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(1);
    expect(hook.getValue().busy).toBe(false);
  });

  it("同一事件轮次的并行动作在保存前被锁定，动作完成后才释放", async () => {
    const saving = deferred<boolean>();
    const performing = deferred<void>();
    const flush = vi.fn(() => saving.promise);
    const store = createStore();
    const path = "/workspace/slides.pptx";
    store.get(presentationControllersAtom).set(path, {
      flushPublicFile: flush,
    } as PresentationController);
    const hook = renderFileAction(store);
    const download = vi.fn(() => performing.promise);
    const open = vi.fn();
    let first!: Promise<boolean>;

    await act(async () => {
      first = hook.getValue().run(path, download);
      expect(await hook.getValue().run(path, open)).toBe(false);
    });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
    expect(hook.getValue().busy).toBe(true);

    await act(async () => saving.resolve(true));
    expect(download).toHaveBeenCalledTimes(1);
    await act(async () => {
      expect(await hook.getValue().run(path, open)).toBe(false);
    });
    expect(open).not.toHaveBeenCalled();
    expect(hook.getValue().busy).toBe(true);

    await act(async () => {
      performing.resolve();
      expect(await first).toBe(true);
    });
    expect(hook.getValue().busy).toBe(false);
    await act(async () => {
      expect(await hook.getValue().run(path, open)).toBe(true);
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    "保存期间 scope A→B→A 后取消旧动作且不显示旧错误：%s",
    async (saved) => {
      const saving = deferred<boolean>();
      const flush = vi.fn(() => saving.promise);
      const path = "/workspace/slides.pptx";
      const store = createStore();
      store.get(presentationControllersAtom).set(path, {
        flushPublicFile: flush,
      } as PresentationController);
      const hook = renderFileAction(store);
      const action = vi.fn();
      let result!: Promise<boolean>;
      act(() => {
        result = hook.getValue().run(path, action);
      });
      hook.render("file-b");
      hook.render("file-a");

      await act(async () => {
        saving.resolve(saved);
        expect(await result).toBe(false);
      });

      expect(action).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
      expect(hook.getValue().busy).toBe(false);
      await act(async () => {
        expect(await hook.getValue().run(null, action)).toBe(true);
      });
      expect(action).toHaveBeenCalledTimes(1);
    },
  );

  it("卸载后保存完成不执行外部动作或显示迟到错误", async () => {
    const saving = deferred<boolean>();
    const store = createStore();
    const path = "/workspace/slides.pptx";
    store.get(presentationControllersAtom).set(path, {
      flushPublicFile: () => saving.promise,
    } as PresentationController);
    const hook = renderFileAction(store);
    const action = vi.fn();
    let result!: Promise<boolean>;
    act(() => {
      result = hook.getValue().run(path, action);
    });
    hook.unmount();

    await act(async () => {
      saving.resolve(false);
      expect(await result).toBe(false);
    });
    expect(action).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("文件动作抛错后释放锁，并允许同 scope 重试", async () => {
    const hook = renderFileAction();
    const action = vi.fn().mockRejectedValueOnce(new Error("read failed"));
    await act(async () => {
      expect(await hook.getValue().run(null, action)).toBe(false);
    });
    expect(toastError).toHaveBeenCalledWith(
      "workspace.fileActions.actionFailed",
    );
    expect(hook.getValue().busy).toBe(false);

    action.mockResolvedValue(undefined);
    await act(async () => {
      expect(await hook.getValue().run(null, action)).toBe(true);
    });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
