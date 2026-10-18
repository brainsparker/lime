import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import { readPluginSkill } from "@/lib/api/pluginCatalog";
import { readFileBytes } from "@/lib/api/fileBrowser";
import { cloudAccountIdentity, getCloudAccount } from "@/lib/cloudAccount";
import {
  projectSkillMarkdown,
  renderSkillMarkdown,
} from "@/components/skills/skillMarkdownPreview";
import type { PluginSkill } from "./PluginSkillsSection";

type Contents =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; contents: string | null };

export function PluginSkillPreview({
  detail,
  skill,
  title,
  accountIdentity,
  onClose,
}: {
  detail: AppServerPluginDetail;
  skill: PluginSkill;
  title: string;
  accountIdentity: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("agent");
  const [state, setState] = useState<Contents>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const remoteId = detail.summary.remotePluginId;
  const remoteSource = detail.summary.source.type === "remote";

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    const read = async () => {
      if (skill.path != null) {
        return new TextDecoder("utf-8", { fatal: true }).decode(
          await readFileBytes(skill.path),
        );
      }
      if (!remoteSource || !remoteId || !accountIdentity)
        throw new Error("missing skill location");
      const response = await readPluginSkill(
        {
          remoteMarketplaceName: detail.marketplaceName,
          remotePluginId: remoteId,
          skillName: skill.name,
        },
        { signal: controller.signal },
      );
      return response.contents ?? null;
    };
    const current = () =>
      !controller.signal.aborted &&
      accountIdentity === cloudAccountIdentity(getCloudAccount());
    void read().then(
      (contents) => {
        if (current()) setState({ status: "ready", contents });
      },
      () => {
        if (current()) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [
    accountIdentity,
    attempt,
    detail.marketplaceName,
    remoteId,
    remoteSource,
    skill.name,
    skill.path,
  ]);

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
            <Dialog.Close
              className="rounded-full p-1.5 hover:bg-[color:var(--lime-surface-hover)]"
              aria-label={t("plugin.catalog.v2.close")}
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div
            className="mt-4 min-h-0 overflow-auto"
            data-testid="plugin-skill-contents"
          >
            {state.status === "loading" ? (
              <p role="status">{t("plugin.skillPreview.loading")}</p>
            ) : state.status === "error" ? (
              <div role="alert">
                <p>{t("plugin.skillPreview.error")}</p>
                <button
                  type="button"
                  className="mt-3 rounded-full border border-[color:var(--lime-surface-border)] px-4 py-2 text-sm hover:bg-[color:var(--lime-surface-hover)]"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  {t("plugin.skillPreview.retry")}
                </button>
              </div>
            ) : !projectSkillMarkdown(state.contents ?? "", title).trim() ? (
              <p>{t("plugin.skillPreview.empty")}</p>
            ) : (
              renderSkillMarkdown(state.contents ?? "", title)
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
