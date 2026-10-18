import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { presentationControllersAtom } from "./presentation/PresentationController";
import { workbookControllersAtom } from "./workbook/WorkbookController";

/** 文件动作只委托现有编辑 owner；scope 变化取消迟到的外部动作。 */
export function usePublicFileAction(scopeKey: string) {
  const presentations = useAtomValue(presentationControllersAtom);
  const workbooks = useAtomValue(workbookControllersAtom);
  const { t } = useTranslation("workspace");
  const currentScope = useRef(scopeKey);
  const generation = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    if (currentScope.current !== scopeKey) ++generation.current;
    currentScope.current = scopeKey;
  }, [scopeKey]);
  useLayoutEffect(() => {
    ++generation.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (
      path: string | null | undefined,
      action: (isCurrent: () => boolean) => void | Promise<void>,
    ): Promise<boolean> => {
      if (pending.current || !mounted.current) return false;
      const capturedScope = currentScope.current;
      const capturedGeneration = generation.current;
      const isCurrent = () =>
        mounted.current &&
        generation.current === capturedGeneration &&
        currentScope.current === capturedScope;
      pending.current = true;
      setBusy(true);
      try {
        const editor = path
          ? (presentations.get(path) ?? workbooks.get(path))
          : undefined;
        if (editor && !(await editor.flushPublicFile())) {
          if (isCurrent()) toast.error(t("workspace.fileActions.saveFailed"));
          return false;
        }
        if (!isCurrent()) return false;
        await action(isCurrent);
        return isCurrent();
      } catch {
        if (isCurrent()) toast.error(t("workspace.fileActions.actionFailed"));
        return false;
      } finally {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [presentations, workbooks, t],
  );
  return { run, busy };
}
