import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { revealPathInFinder } from "@/lib/api/fileSystem";
import { saveFileCopy } from "@/lib/artifact/saveFileCopy";
import { usePublicFileAction } from "./usePublicFileAction";

/** 本地 viewer 的默认文件动作；尚无首选 target 时 Open 委托文件管理器。 */
export function ArtifactPreviewHeader({ path }: { path: string }) {
  const { t } = useTranslation("workspace");
  const { run, busy } = usePublicFileAction(path);
  const openInFolder = () => {
    void run(path, () => revealPathInFinder(path));
  };
  return (
    <div
      data-artifact-preview-header
      className="flex h-7 shrink-0 items-center rounded-lg text-xs"
    >
      <button
        type="button"
        disabled={busy}
        aria-label={t("workspace.artifactPreviewHeader.open")}
        onClick={openInFolder}
        className="flex h-full items-center rounded-s-lg px-2 outline-none hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {t("workspace.artifactPreviewHeader.open")}
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
                void run(path, (isCurrent) =>
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
