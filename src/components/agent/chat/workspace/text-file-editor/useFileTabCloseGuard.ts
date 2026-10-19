import { createElement, useCallback, useRef, useState } from "react";
import type { ThreadSidePanelTab } from "../right-surface/threadSidePanelTabs";
import { DiscardFileChangesDialog } from "./FileTabLifecycle";
import type { FileTabCloseHandler, Register } from "./fileTabLifecycleContext";

/** 关闭许可绑定完整内容实例与save对象；异步旧确认不能关闭同路径的新标签。 */
export function useFileTabCloseGuard(
  tabs: readonly ThreadSidePanelTab[],
  close: (tabId: string) => void,
) {
  const current = useRef({ tabs, close });
  current.current = { tabs, close };
  const handlers = useRef(new Map<ThreadSidePanelTab, FileTabCloseHandler>());
  const pending = useRef(new Set<ThreadSidePanelTab>());
  const [confirmation, setConfirmation] = useState<{
    tab: ThreadSidePanelTab;
    handler: FileTabCloseHandler;
  } | null>(null);
  const register = useCallback<Register>((tab, handler) => {
    handlers.current.set(tab, handler);
    return () => {
      if (handlers.current.get(tab) === handler) handlers.current.delete(tab);
    };
  }, []);
  const isTabCurrent = useCallback(
    (tab: ThreadSidePanelTab) => current.current.tabs.includes(tab),
    [],
  );
  const valid = useCallback(
    (tab: ThreadSidePanelTab, handler: FileTabCloseHandler) =>
      current.current.tabs.includes(tab) &&
      handlers.current.get(tab) === handler,
    [],
  );
  // 文件外部动作与关闭共用同一个save对象；保存结果不得跨内容实例回流。
  const saveFile = useCallback(
    async (path: string): Promise<boolean> => {
      const tab = current.current.tabs.find((entry) => entry.filePath === path);
      if (!tab) return true;
      const handler = handlers.current.get(tab);
      if (!handler) return true;
      const saved = await handler.saveUntilClean().catch(() => false);
      return saved && valid(tab, handler);
    },
    [valid],
  );
  const requestClose = async (tabId: string) => {
    const tab = current.current.tabs.find((tab) => tab.tabId === tabId);
    if (!tab || pending.current.has(tab)) return;
    const handler = handlers.current.get(tab);
    if (!handler || !handler.hasUnsavedChanges()) {
      current.current.close(tabId);
      return;
    }
    pending.current.add(tab);
    const saved = await handler.saveUntilClean().catch(() => false);
    pending.current.delete(tab);
    if (!valid(tab, handler)) return;
    if (saved) current.current.close(tabId);
    else setConfirmation({ tab, handler });
  };
  return {
    register,
    saveFile,
    isTabCurrent,
    requestClose: (tabId: string) => {
      void requestClose(tabId);
    },
    confirmation: confirmation
      ? createElement(DiscardFileChangesDialog, {
          onCancel: () => setConfirmation(null),
          onDiscard: () => {
            if (valid(confirmation.tab, confirmation.handler)) {
              confirmation.handler.discard();
              current.current.close(confirmation.tab.tabId);
            }
            setConfirmation(null);
          },
        })
      : null,
  };
}
