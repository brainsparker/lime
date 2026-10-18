import {
  Check,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  Unplug,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  pluginDescription,
  pluginDisplayName,
  type PluginCatalogEntry,
} from "./PluginCatalogPageViewModel";

export function PluginCatalogCard({
  entry,
  isSelected,
  busy,
  menuOpen,
  onSelect,
  onMenuToggle,
  onToggle,
  onUninstall,
  onInstall,
  onShare,
}: {
  entry: PluginCatalogEntry;
  isSelected: boolean;
  busy: boolean;
  menuOpen: boolean;
  onSelect: () => void;
  onMenuToggle: () => void;
  onToggle: () => void;
  onUninstall: () => void;
  onInstall: () => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation("agent");
  const { plugin, marketplace } = entry;
  const isBusy = busy;
  return (
    <article
      className={`min-w-0 rounded-lg border bg-[color:var(--lime-surface)] p-4 transition ${
        isSelected
          ? "border-[color:var(--lime-surface-border-strong)] shadow-sm"
          : "border-[color:var(--lime-surface-border)] hover:border-[color:var(--lime-surface-border-strong)]"
      }`}
      data-testid={`plugin-catalog-card-${plugin.id}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => onSelect()}
          data-testid={`plugin-catalog-select-${plugin.id}`}
        >
          <h2 className="truncate text-base font-semibold text-[color:var(--lime-text-strong)]">
            {pluginDisplayName(plugin)}
          </h2>
          <p className="mt-1 truncate text-xs text-[color:var(--lime-text-muted)]">
            {plugin.id} ·{" "}
            {t("plugin.catalog.v2.version", {
              version: plugin.version,
            })}
          </p>
        </button>
        {plugin.installed ? (
          <div className="relative shrink-0">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-surface-hover)] hover:text-[color:var(--lime-text-strong)]"
              onClick={() => onMenuToggle()}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("plugin.catalog.v2.moreActions")}
              data-testid={`plugin-catalog-actions-${plugin.id}`}
            >
              <MoreHorizontal size={17} />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-9 z-10 min-w-[150px] overflow-hidden rounded-lg border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] py-1 shadow-lg shadow-slate-950/10"
                role="menu"
              >
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium hover:bg-[color:var(--lime-surface-hover)]"
                  onClick={() => onToggle()}
                  role="menuitem"
                  data-testid={`plugin-catalog-toggle-${plugin.id}`}
                >
                  {plugin.enabled ? <Unplug size={15} /> : <Check size={15} />}
                  {plugin.enabled
                    ? t("plugin.catalog.v2.disable")
                    : t("plugin.catalog.v2.enable")}
                </button>
                <button
                  type="button"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    onUninstall();
                  }}
                  role="menuitem"
                  data-testid={`plugin-catalog-uninstall-${plugin.id}`}
                >
                  <X size={15} />
                  {t("plugin.catalog.v2.uninstall")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-[color:var(--lime-text-muted)]">
        {pluginDescription(plugin) ||
          t("plugin.catalog.v2.descriptionFallback")}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--lime-text-muted)]">
        <span className="rounded-full bg-[color:var(--lime-surface-hover)] px-2.5 py-1 font-medium">
          {marketplace.interface?.displayName || marketplace.name}
        </span>
        {plugin.installed ? (
          <span
            className={plugin.enabled ? "text-emerald-700" : "text-amber-700"}
          >
            {plugin.enabled
              ? t("plugin.catalog.v2.status.enabled")
              : t("plugin.catalog.v2.status.disabled")}
          </span>
        ) : null}
      </div>
      {onShare ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-[color:var(--lime-text-strong)] underline-offset-4 hover:underline"
          onClick={onShare}
          disabled={busy}
          data-testid={`plugin-catalog-share-${plugin.id}`}
        >
          {t("plugin.share.manage")}
        </button>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-[color:var(--lime-text-muted)]">
          {plugin.authPolicy === "ON_USE"
            ? t("plugin.catalog.v2.auth.onUse")
            : plugin.authPolicy}
        </span>
        {plugin.installed ? (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[color:var(--lime-surface-border)] px-3 text-xs font-semibold text-[color:var(--lime-text-strong)] hover:bg-[color:var(--lime-surface-hover)]"
            onClick={() => onSelect()}
            data-testid={`plugin-catalog-details-${plugin.id}`}
          >
            {t("plugin.catalog.v2.details")}
            <ExternalLink size={13} />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[color:var(--lime-text-strong)] px-3 text-xs font-semibold text-[color:var(--lime-surface)] hover:opacity-90"
            onClick={() => {
              onInstall();
            }}
            disabled={
              busy ||
              plugin.installPolicy === "NOT_AVAILABLE" ||
              plugin.availability === "DISABLED_BY_ADMIN"
            }
            data-testid={`plugin-catalog-install-${plugin.id}`}
          >
            {isBusy ? (
              <LoaderCircle size={13} className="animate-spin" />
            ) : null}
            {t("plugin.catalog.v2.install")}
          </button>
        )}
      </div>
    </article>
  );
}
