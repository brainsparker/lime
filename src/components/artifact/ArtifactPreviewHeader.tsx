import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { revealPathInFinder } from "@/lib/api/fileSystem";
import type { OpenInParams, OpenInTarget } from "@/lib/api/openInTypes";
import { saveFileCopy } from "@/lib/artifact/saveFileCopy";
import { hasDesktopHostInvokeCapability } from "@/lib/desktop-runtime";
import { openTarget, useTargetApps } from "@/lib/openInTargets";
import { usePublicFileAction } from "./usePublicFileAction";

/** viewer 复用文件壳的目标投影；外部动作前交还当前编辑 owner 保存。 */
export function ArtifactPreviewHeader({
  path,
  cwd,
  hostId,
  onBeforeFileAction,
}: {
  path: string;
  onBeforeFileAction?: () => boolean | Promise<boolean>;
} & Pick<OpenInParams, "cwd" | "hostId">) {
  const { t } = useTranslation("workspace");
  const native = hasDesktopHostInvokeCapability();
  const apps = useTargetApps({ cwd, hostId, path }, native);
  const primaryTarget = native ? apps.primaryTarget : null;
  const targets = native
    ? apps.visibleTargets.filter((target) => target.target !== "fileManager")
    : [];
  const { run, busy } = usePublicFileAction(
    JSON.stringify([path, cwd ?? null, hostId ?? null]),
  );
  const prepare = (
    action: (isCurrent: () => boolean) => void | Promise<void>,
  ) => {
    void run(path, async (isCurrent) => {
      if (onBeforeFileAction && !(await onBeforeFileAction())) return;
      if (isCurrent()) await action(isCurrent);
    });
  };
  const targetLabel = (target: OpenInTarget) =>
    target.id === "systemDefault"
      ? t("workspace.fileActions.defaultApp")
      : target.label === "File Manager"
        ? t("workspace.fileActions.fileManager")
        : target.label;
  const openApp = (target: OpenInTarget) => {
    prepare(() =>
      openTarget({
        cwd,
        hostId,
        path,
        target: target.target,
        appPath: target.appPath,
        openMode: "file",
      }),
    );
  };
  const openInFolder = () => {
    prepare(() =>
      native
        ? openTarget({
            cwd,
            hostId,
            path,
            target: "fileManager",
            openMode: "file",
          })
        : revealPathInFinder(path),
    );
  };
  const openLabel = primaryTarget
    ? t("workspace.fileActions.openIn", { app: targetLabel(primaryTarget) })
    : t("workspace.artifactPreviewHeader.open");
  return (
    <div
      data-artifact-preview-header
      className="flex h-7 shrink-0 items-center rounded-lg text-xs"
    >
      <button
        type="button"
        disabled={busy}
        aria-label={openLabel}
        title={openLabel}
        onClick={() =>
          primaryTarget ? openApp(primaryTarget) : openInFolder()
        }
        className="flex h-full items-center rounded-s-lg px-2 outline-none hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {primaryTarget?.icon ? (
          <img src={primaryTarget.icon} alt="" className="size-4" />
        ) : (
          t("workspace.artifactPreviewHeader.open")
        )}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={t("workspace.artifactPreviewHeader.openOptions")}
            className="flex h-full w-5 items-center justify-center rounded-e-lg outline-none hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <ChevronDown size={12} aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            data-artifact-preview-menu
            className="z-50 min-w-40 rounded-lg border border-[color:var(--lime-surface-border)] bg-popover p-1 pt-2 text-popover-foreground shadow-md"
          >
            {targets.map((target) => (
              <DropdownMenu.Item
                key={target.id}
                data-open-in-target={target.id}
                disabled={busy}
                onSelect={() => openApp(target)}
                className="flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-[color:var(--lime-chrome-tab-hover)] data-[disabled]:opacity-50"
              >
                {target.icon ? (
                  <img src={target.icon} alt="" className="size-4" />
                ) : null}
                {targetLabel(target)}
              </DropdownMenu.Item>
            ))}
            {native && apps.isPending ? (
              <div
                role="status"
                className="px-2 py-1.5 text-sm text-muted-foreground"
              >
                {t("workspace.artifactPreviewHeader.loadingAvailableApps")}
              </div>
            ) : null}
            {targets.length || (native && apps.isPending) ? (
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
            ) : null}
            <DropdownMenu.Item
              disabled={busy}
              onSelect={openInFolder}
              className="cursor-default select-none rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-[color:var(--lime-chrome-tab-hover)] data-[disabled]:opacity-50"
            >
              {t("workspace.artifactPreviewHeader.openInFolder")}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={busy}
              onSelect={() => {
                prepare((isCurrent) =>
                  saveFileCopy(
                    path,
                    t("workspace.artifactPreviewHeader.saveAs"),
                    isCurrent,
                  ),
                );
              }}
              className="cursor-default select-none rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-[color:var(--lime-chrome-tab-hover)] data-[disabled]:opacity-50"
            >
              {t("workspace.artifactPreviewHeader.saveAs")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
