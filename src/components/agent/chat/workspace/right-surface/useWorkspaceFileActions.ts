import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePublicFileAction } from "@/components/artifact/usePublicFileAction";
import { saveFileCopy } from "@/lib/artifact/saveFileCopy";
import { hasDesktopHostInvokeCapability } from "@/lib/desktop-runtime";
import { openTarget } from "@/lib/openInTargets";
import type { OpenInParams } from "@/lib/api/openInTypes";
import { useFileTabLifecycle } from "../text-file-editor/fileTabLifecycleContext";
import type { WorkspaceFileMenuActions } from "./workspaceFileContextMenuItems";

/** 树与标签只拥有菜单时序；保存和复制继续委托现有文件owner。 */
export function useWorkspaceFileActions(
  scope: object,
  path: string | null,
  isTargetCurrent: () => boolean,
  options: OpenInParams & { openMode?: "file" | "workspace" } = {},
): WorkspaceFileMenuActions {
  const { t } = useTranslation("workspace");
  const lifecycle = useFileTabLifecycle();
  const publicFileAction = usePublicFileAction(path ?? "");
  const current = useRef({ scope, mounted: false });
  const pending = useRef<object | null>(null);
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    current.current = { scope, mounted: true };
    pending.current = null;
    setBusy(false);
    return () => {
      current.current.mounted = false;
    };
  }, [scope]);

  const run = async (action: (isCurrent: () => boolean) => Promise<void>) => {
    const isCurrent = () =>
      current.current.mounted &&
      current.current.scope === scope &&
      isTargetCurrent();
    if (!path || pending.current || !isCurrent()) return;
    const operation = {};
    pending.current = operation;
    setBusy(true);
    try {
      await action(isCurrent);
    } catch {
      if (isCurrent()) toast.error(t("workspace.fileActions.actionFailed"));
    } finally {
      if (pending.current === operation) {
        pending.current = null;
        if (current.current.mounted) setBusy(false);
      }
    }
  };
  return {
    canSaveAs: hasDesktopHostInvokeCapability(),
    busy: busy || publicFileAction.busy,
    openTarget: (target) =>
      run(async () => {
        await openTarget({
          ...options,
          path: path!,
          target: target.target,
          appPath: target.appPath,
        });
      }),
    copyPath: () =>
      run(async () => {
        if (!navigator.clipboard?.writeText)
          throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(path!);
      }),
    saveAs: () =>
      run(async (isCurrent) => {
        const saved = await (lifecycle?.saveFile(path!) ??
          Promise.resolve(true));
        if (!isCurrent()) return;
        if (!saved) {
          toast.error(t("workspace.fileActions.saveFailed"));
          return;
        }
        await publicFileAction.run(path, (isPublicCurrent) =>
          saveFileCopy(
            path!,
            t("workspace.artifactPreviewHeader.saveAs"),
            () => isCurrent() && isPublicCurrent(),
          ),
        );
      }),
  };
}
