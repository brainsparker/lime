import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import { skillPreviewQueryOptions } from "../model/skillPreviewQueries";
import {
  projectSkillMarkdown,
  renderSkillMarkdown,
} from "@/components/skills/skillMarkdownPreview";
import type { PluginSkill } from "./PluginSkillsSection";

export function PluginSkillPreview({
  detail,
  skill,
  title,
  accountIdentity,
  accountVersion,
  onClose,
  headerActions,
  footer,
}: {
  detail: AppServerPluginDetail;
  skill: PluginSkill;
  title: string;
  accountIdentity: string | null;
  accountVersion: number;
  onClose: () => void;
  headerActions?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation("agent");
  const { data, error, isFetching, refetch } = useQuery(
    skillPreviewQueryOptions({
      detail,
      skill,
      accountIdentity,
      accountVersion,
    }),
  );
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          className="lime-workbench-theme-scope lime-workbench-surface-scope fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-6 text-[color:var(--lime-text-strong)] shadow-xl"
          data-testid="plugin-skill-preview"
          onCloseAutoFocus={(event) => {
            if (opener?.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[color:var(--lime-text-muted)]">
                {skill.description}
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {headerActions}
              <Dialog.Close
                className="rounded-full p-1.5 hover:bg-[color:var(--lime-surface-hover)]"
                aria-label={t("plugin.catalog.v2.close")}
              >
                <X size={18} />
              </Dialog.Close>
            </div>
          </div>
          <div
            className="mt-4 min-h-0 overflow-auto"
            data-testid="plugin-skill-contents"
          >
            {isFetching && data === undefined ? (
              <p role="status">{t("plugin.skillPreview.loading")}</p>
            ) : error ? (
              <div role="alert">
                <p>{t("plugin.skillPreview.error")}</p>
                <button
                  type="button"
                  className="mt-3 rounded-full border border-[color:var(--lime-surface-border)] px-4 py-2 text-sm hover:bg-[color:var(--lime-surface-hover)]"
                  onClick={() => void refetch()}
                >
                  {t("plugin.skillPreview.retry")}
                </button>
              </div>
            ) : !projectSkillMarkdown(data?.contents ?? "", title).trim() ? (
              <p>{t("plugin.skillPreview.empty")}</p>
            ) : (
              renderSkillMarkdown(data?.contents ?? "", title)
            )}
          </div>
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
