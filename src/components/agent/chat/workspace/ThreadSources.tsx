import { useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Blocks, Globe, Paperclip, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { composerCommands } from "@/components/input-kit/ComposerCommands";
import { SummarySection, SummaryRow } from "./ThreadSummarySection";

export function ThreadSources({
  threadId,
  projectless,
  hasWebSearch,
  onOpenPluginDirectory,
}: {
  threadId?: string | null;
  projectless: boolean;
  hasWebSearch: boolean;
  onOpenPluginDirectory?: () => void;
}) {
  const { t } = useTranslation("agent");
  const [open, setOpen] = useState(false);
  if (!projectless && !hasWebSearch) return null;
  const label = String(t("agentChat.summary.addSource"));
  const rowClass =
    "flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] outline-none hover:bg-[color:var(--lime-surface-hover)] focus:bg-[color:var(--lime-surface-hover)] data-[disabled]:opacity-50";
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <SummarySection
        sectionKey="tool-sources"
        title={String(t("agentChat.summary.sources"))}
        count={hasWebSearch ? 1 : 0}
        actions={
          <Menu.Trigger asChild>
            <button
              type="button"
              aria-label={label}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </Menu.Trigger>
        }
      >
        {hasWebSearch ? (
          <SummaryRow
            key="web-search"
            icon={<Globe className="h-4 w-4 shrink-0" aria-hidden="true" />}
            label={String(t("agentChat.summary.webSearch"))}
          />
        ) : null}
        {!hasWebSearch ? (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex min-h-7 w-full items-center rounded-lg py-1 text-left text-[13px] text-[color:var(--lime-text-muted)] hover:text-[color:var(--lime-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => setOpen(true)}
          >
            {label}
          </button>
        ) : null}
      </SummarySection>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 min-w-56 rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-1.5 text-[color:var(--lime-text-strong)] shadow-lg"
        >
          <Menu.Item
            className={rowClass}
            disabled={!onOpenPluginDirectory}
            onSelect={onOpenPluginDirectory}
          >
            <Blocks className="h-4 w-4" aria-hidden="true" />
            {String(t("agentChat.summary.plugins"))}
          </Menu.Item>
          <Menu.Item
            className={rowClass}
            disabled={!composerCommands.canRun(threadId)}
            onSelect={() => {
              void composerCommands
                .run("composer.addFiles", threadId)
                .catch(() =>
                  toast.error(
                    String(t("agentChat.inputbar.attachments.failed")),
                  ),
                );
            }}
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {String(t("agentChat.summary.attachFilesOrFolders"))}
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
