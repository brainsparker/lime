import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileTabCloseGuard } from "./useFileTabCloseGuard";
import type { ThreadSidePanelTab } from "../right-surface/threadSidePanelTabs";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const mounted: Array<{ root: Root; node: HTMLDivElement }> = [];
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  for (const { root, node } of mounted.splice(0)) {
    act(() => root.unmount());
    node.remove();
  }
});
const tab = (): ThreadSidePanelTab => ({
  kind: "files",
  tabId: "file:/work/file",
  filePath: "/work/file",
  contentInstance: crypto.randomUUID(),
});
function mount(initial: ThreadSidePanelTab[]) {
  const node = document.createElement("div");
  document.body.appendChild(node);
  const root = createRoot(node);
  mounted.push({ root, node });
  const close = vi.fn();
  let latest!: ReturnType<typeof useFileTabCloseGuard>;
  function Probe({ tabs }: { tabs: ThreadSidePanelTab[] }) {
    latest = useFileTabCloseGuard(tabs, close);
    return latest.confirmation;
  }
  const render = (tabs: ThreadSidePanelTab[]) =>
    act(() => root.render(<Probe tabs={tabs} />));
  render(initial);
  return { get: () => latest, render, close };
}
function handler(save = vi.fn(async () => true)) {
  return {
    hasUnsavedChanges: () => true,
    saveUntilClean: save,
    discard: vi.fn(),
  };
}
describe("file tab close lifecycle", () => {
  it("文件外部动作委托同一saveUntilClean，不关闭或放弃当前标签", async () => {
    const file = tab(),
      view = mount([file]),
      h = handler();
    view.get().register(file, h);
    expect(await view.get().saveFile(file.filePath!)).toBe(true);
    expect(h.saveUntilClean).toHaveBeenCalledTimes(1);
    expect(h.discard).not.toHaveBeenCalled();
    expect(view.close).not.toHaveBeenCalled();
    expect(view.get().isTabCurrent(file)).toBe(true);
    expect(await view.get().saveFile("/work/not-open")).toBe(true);
  });
  it.each(["replace", "handler", "close"])(
    "外部保存期间%s使旧save结果失效",
    async (change) => {
      const file = tab(),
        view = mount([file]);
      let finish!: (value: boolean) => void;
      const h = handler(
        vi.fn(
          () =>
            new Promise<boolean>((resolve) => {
              finish = resolve;
            }),
        ),
      );
      view.get().register(file, h);
      const saving = view.get().saveFile(file.filePath!);
      if (change === "replace") view.render([tab()]);
      else if (change === "handler") view.get().register(file, handler());
      else view.render([]);
      finish(true);
      expect(await saving).toBe(false);
      expect(h.discard).not.toHaveBeenCalled();
      expect(view.close).not.toHaveBeenCalled();
    },
  );
  it("外部保存失败只返回false，不出现关闭确认或放弃编辑", async () => {
    const file = tab(),
      view = mount([file]),
      h = handler(vi.fn(async () => false));
    view.get().register(file, h);
    expect(await view.get().saveFile(file.filePath!)).toBe(false);
    expect(view.get().confirmation).toBeNull();
    expect(h.discard).not.toHaveBeenCalled();
    expect(view.close).not.toHaveBeenCalled();
  });
  it("同一实例保存成功才关闭；重复关闭合并", async () => {
    const file = tab(),
      view = mount([file]);
    let finish!: (value: boolean) => void;
    const h = handler(
      vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    view.get().register(file, h);
    act(() => {
      view.get().requestClose(file.tabId);
      view.get().requestClose(file.tabId);
    });
    expect(view.close).not.toHaveBeenCalled();
    expect(h.saveUntilClean).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(true);
    });
    expect(view.close).toHaveBeenCalledWith(file.tabId);
    expect(h.discard).not.toHaveBeenCalled();
  });
  it("保存失败先继续查看；明确放弃才关闭", async () => {
    const file = tab(),
      view = mount([file]),
      h = handler(vi.fn(async () => false));
    view.get().register(file, h);
    await act(async () => view.get().requestClose(file.tabId));
    expect(view.close).not.toHaveBeenCalled();
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="discard-file-changes-confirm"]',
    );
    expect(confirm).not.toBeNull();
    act(() => confirm!.click());
    expect(h.discard).toHaveBeenCalledTimes(1);
    expect(view.close).toHaveBeenCalledWith(file.tabId);
  });
  it("确认打开后同路径重开，旧确认无权删除新实例", async () => {
    const file = tab(),
      view = mount([file]),
      old = handler(vi.fn(async () => false));
    const unregister = view.get().register(file, old);
    await act(async () => view.get().requestClose(file.tabId));
    const replacement = tab();
    view.render([replacement]);
    unregister();
    view.get().register(replacement, handler());
    act(() =>
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="discard-file-changes-confirm"]',
        )!
        .click(),
    );
    expect(view.close).not.toHaveBeenCalled();
    expect(old.discard).not.toHaveBeenCalled();
  });
  it("保存期间同一tab的save回调被替换，拒绝旧关闭结果", async () => {
    const file = tab(),
      view = mount([file]);
    let finish!: (value: boolean) => void;
    const old = handler(
      vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    view.get().register(file, old);
    act(() => view.get().requestClose(file.tabId));
    view.get().register(file, handler());
    await act(async () => finish(true));
    expect(view.close).not.toHaveBeenCalled();
  });
});
