import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, FolderOpen, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCloudAccount } from "@/lib/cloudAccount";
import {
  pluginDisplayName,
  type PluginCatalogEntry,
} from "./PluginCatalogPageViewModel";
import { PluginShareAccessPanel } from "./PluginShareAccessPanel";
import {
  pluginShareAccessTargets,
  pluginShareDraftKey,
  pluginSharePermissions,
  pluginShareTargets,
  type PluginShareAccess,
  type PluginShareTarget,
} from "./PluginShareViewModel";
import { usePluginShare } from "./usePluginShare";

const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-[color:var(--lime-surface-border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--lime-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";

export function PluginShareDialog({
  entry,
  accountIdentity,
  onClose,
}: {
  entry: PluginCatalogEntry;
  accountIdentity: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("agent");
  const share = usePluginShare(entry, accountIdentity, onClose);
  const [access, setAccess] = useState<PluginShareAccess>("PRIVATE");
  const [targets, setTargets] = useState<PluginShareTarget[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const account = getCloudAccount()?.account;
  const { context, pending } = share;
  const permissions = pluginSharePermissions(context, account?.userId ?? "");
  const dirty =
    Boolean(context) &&
    pluginShareDraftKey(access, targets) !==
      pluginShareDraftKey(
        context?.discoverability ?? "PRIVATE",
        pluginShareTargets(context?.sharePrincipals ?? []),
      );

  useEffect(() => {
    setAccess(context?.discoverability ?? "PRIVATE");
    setTargets(pluginShareTargets(context?.sharePrincipals ?? []));
    setCopied(false);
  }, [context]);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          className="lime-workbench-theme-scope lime-workbench-surface-scope fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-6 text-[color:var(--lime-text-strong)] shadow-xl"
          data-testid="plugin-share-dialog"
          onCloseAutoFocus={(event) => {
            if (opener?.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
          onInteractOutside={(event) => {
            if (pending || dirty || confirmDelete) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {t("plugin.share.title", {
                  name: pluginDisplayName(entry.plugin),
                })}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-[color:var(--lime-text-muted)]">
                {t("plugin.share.description")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-full p-1.5 hover:bg-[color:var(--lime-surface-hover)] disabled:opacity-50"
              disabled={Boolean(pending)}
              aria-label={t("plugin.catalog.v2.close")}
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          {share.error ? (
            <div
              role="alert"
              className="mt-4 break-words text-sm text-red-600"
              data-testid="plugin-share-error"
            >
              {share.error}
            </div>
          ) : null}
          {!share.loaded ? (
            <div className="mt-5">
              {share.error ? (
                <button className={buttonClass} onClick={share.retry}>
                  {t("plugin.share.retry")}
                </button>
              ) : (
                <p role="status">{t("plugin.share.loading")}</p>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-5 text-sm">
              {!context ? (
                <>
                  <p>{t("plugin.share.createDescription")}</p>
                  <button
                    className={buttonClass}
                    disabled={Boolean(pending) || !share.pluginPath}
                    onClick={() => void share.saveVersion()}
                    data-testid="plugin-share-create"
                  >
                    {t("plugin.share.create")}
                  </button>
                </>
              ) : (
                <>
                  <PluginShareAccessPanel
                    context={context}
                    access={access}
                    targets={targets}
                    disabled={Boolean(pending)}
                    canManage={permissions.owner}
                    onAccessChange={setAccess}
                    onTargetsChange={setTargets}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className={buttonClass}
                      disabled={Boolean(pending) || dirty || !context.shareUrl}
                      onClick={async () => {
                        setCopied(false);
                        await share.copyLink(() => setCopied(true));
                      }}
                      data-testid="plugin-share-copy"
                    >
                      <Copy size={15} />
                      {t(
                        copied
                          ? "plugin.share.copied"
                          : "plugin.share.copyLink",
                      )}
                    </button>
                    {permissions.owner ? (
                      <button
                        className={buttonClass}
                        disabled={Boolean(pending) || !dirty || !account}
                        onClick={() =>
                          void share.saveAccess(
                            access,
                            pluginShareAccessTargets(
                              access,
                              targets,
                              account!.tenantId,
                            ),
                          )
                        }
                        data-testid="plugin-share-save-access"
                      >
                        {t("plugin.share.saveAccess")}
                      </button>
                    ) : null}
                  </div>
                  <section className="space-y-3 border-t border-[color:var(--lime-surface-border)] pt-4">
                    <h3 className="font-medium">
                      {t("plugin.share.editTitle")}
                    </h3>
                    {share.pluginPath ? (
                      <>
                        <p
                          className="break-all text-xs text-[color:var(--lime-text-muted)]"
                          data-testid="plugin-share-local-path"
                        >
                          {share.pluginPath}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={buttonClass}
                            disabled={Boolean(pending)}
                            onClick={() => void share.openDirectory()}
                          >
                            <FolderOpen size={15} />
                            {t("plugin.share.openDirectory")}
                          </button>
                          {permissions.editor ? (
                            <button
                              className={buttonClass}
                              disabled={Boolean(pending) || dirty}
                              onClick={() => void share.saveVersion()}
                              data-testid="plugin-share-update"
                            >
                              {t("plugin.share.updateVersion")}
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : context.discoverability !== "LISTED" ? (
                      <button
                        className={buttonClass}
                        disabled={Boolean(pending)}
                        onClick={() => void share.checkout()}
                        data-testid="plugin-share-checkout"
                      >
                        {t("plugin.share.checkout")}
                      </button>
                    ) : (
                      <p className="text-[color:var(--lime-text-muted)]">
                        {t("plugin.share.listedEditDescription")}
                      </p>
                    )}
                  </section>
                  {permissions.owner ? (
                    <section className="border-t border-[color:var(--lime-surface-border)] pt-4">
                      {confirmDelete ? (
                        <div
                          className="space-y-3"
                          data-testid="plugin-share-delete-confirm"
                        >
                          <p>{t("plugin.share.deleteDescription")}</p>
                          <div className="flex justify-end gap-2">
                            <button
                              className={buttonClass}
                              disabled={Boolean(pending)}
                              onClick={() => setConfirmDelete(false)}
                            >
                              {t("plugin.catalog.v2.cancel")}
                            </button>
                            <button
                              className={`${buttonClass} text-red-600`}
                              disabled={Boolean(pending)}
                              onClick={() => void share.revoke()}
                              data-testid="plugin-share-confirm-delete"
                            >
                              {t("plugin.share.confirmDelete")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="text-red-600 hover:underline disabled:opacity-50"
                          disabled={Boolean(pending) || dirty}
                          onClick={() => setConfirmDelete(true)}
                          data-testid="plugin-share-delete"
                        >
                          {t("plugin.share.delete")}
                        </button>
                      )}
                    </section>
                  ) : null}
                </>
              )}
              {pending ? (
                <p
                  className="flex items-center gap-2 text-[color:var(--lime-text-muted)]"
                  role="status"
                >
                  <LoaderCircle size={15} className="animate-spin" />
                  {t(`plugin.share.pending.${pending}`)}
                </p>
              ) : null}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
