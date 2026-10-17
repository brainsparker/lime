import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Unplug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AppServerPluginDetail,
  AppServerPluginSummary,
  AppServerPluginMarketplaceEntry,
} from "@/lib/api/appServerTypes";
import {
  installPlugin,
  listPlugins,
  readPlugin,
  setPluginEnabled,
  uninstallPlugin,
} from "@/lib/api/pluginCatalog";
import type { PluginsPageParams } from "@/types/page";
import { getProject } from "@/lib/api/project";
import { PluginDetailPanel } from "./PluginDetailPanel";
import {
  filterPluginCatalog,
  pluginCatalogEntries,
  pluginDescription,
  pluginDisplayName,
  pluginLocation,
  type PluginCatalogEntry,
  type PluginCatalogView,
} from "./PluginCatalogPageViewModel";

export function PluginCatalogPage({
  pageParams,
}: {
  pageParams?: PluginsPageParams;
}) {
  const { t } = useTranslation("agent");
  const [marketplaces, setMarketplaces] = useState<
    AppServerPluginMarketplaceEntry[]
  >([]);
  const entries = useMemo(
    () => pluginCatalogEntries(marketplaces),
    [marketplaces],
  );
  const plugins = useMemo(
    () => entries.map((entry) => entry.plugin),
    [entries],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    pageParams?.selectedPluginId ?? null,
  );
  const [detail, setDetail] = useState<AppServerPluginDetail | null>(null);
  const [view, setView] = useState<PluginCatalogView>(
    pageParams?.statusFilter === "installed" ? "installed" : "all",
  );
  const [query, setQuery] = useState(pageParams?.query ?? "");
  const [source, setSource] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [installTarget, setInstallTarget] = useState<PluginCatalogEntry | null>(
    null,
  );
  const [uninstallTarget, setUninstallTarget] =
    useState<AppServerPluginSummary | null>(null);
  const projectId = pageParams?.currentProjectId;
  const refreshRequest = useRef<symbol | null>(null);

  // 侧栏在同一页面内切换目录、安装态和详情时同步路由参数。
  useEffect(() => {
    setSelectedId(pageParams?.selectedPluginId ?? null);
    setView(pageParams?.statusFilter === "installed" ? "installed" : "all");
    setQuery(pageParams?.query ?? "");
    setSource("all");
  }, [pageParams]);

  const refresh = useCallback(async () => {
    const request = Symbol();
    refreshRequest.current = request;
    setLoading(true);
    setError(null);
    try {
      const project = projectId ? await getProject(projectId) : null;
      if (request !== refreshRequest.current) return;
      const response = await listPlugins(
        project?.rootPath ? { cwds: [project.rootPath] } : {},
      );
      if (request !== refreshRequest.current) return;
      setMarketplaces(response.marketplaces);
      const plugins = response.marketplaces.flatMap(
        (marketplace) => marketplace.plugins,
      );
      if (response.marketplaceLoadErrors?.length) {
        setError(
          response.marketplaceLoadErrors
            .map((error) => error.message)
            .join("\n"),
        );
      }
      setSelectedId((current) => {
        if (current && plugins.some((plugin) => plugin.id === current)) {
          return current;
        }
        return plugins[0]?.id ?? null;
      });
    } catch (cause) {
      if (request !== refreshRequest.current) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
    } finally {
      if (request === refreshRequest.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setMarketplaces([]);
    setInstallTarget(null);
    setUninstallTarget(null);
    setActionMenuId(null);
    void refresh();
    return () => {
      refreshRequest.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const selected = entries.find(({ plugin }) => plugin.id === selectedId);
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    void readPlugin(pluginLocation(selected))
      .then((response) => {
        if (!cancelled) {
          setDetail(response.plugin);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setDetail(null);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entries, selectedId]);

  const filteredPlugins = useMemo(
    () => filterPluginCatalog(entries, { query, source, view }),
    [entries, query, source, view],
  );
  const sources = useMemo(
    () =>
      Array.from(
        new Set(marketplaces.map((marketplace) => marketplace.name)),
      ).sort(),
    [marketplaces],
  );
  const selectedSummary =
    plugins.find((plugin) => plugin.id === selectedId) ?? null;

  const handleInstall = useCallback(async () => {
    if (!installTarget) {
      return;
    }
    const pluginId = installTarget.plugin.id;
    setBusyId(pluginId);
    try {
      const response = await installPlugin({
        ...pluginLocation(installTarget),
        installAttemptId: crypto.randomUUID(),
      });
      await refresh();
      setSelectedId(pluginId);
      if (response.appsNeedingAuth.length) {
        toast.info(
          t("plugin.catalog.v2.appsNeedAuth", {
            names: response.appsNeedingAuth.map((app) => app.name).join(", "),
          }),
        );
      }
      setInstallTarget(null);
      toast.success(t("plugin.catalog.v2.installSuccess"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }, [installTarget, refresh, t]);

  const handleToggle = useCallback(
    async (plugin: AppServerPluginSummary) => {
      setBusyId(plugin.id);
      setActionMenuId(null);
      try {
        await setPluginEnabled({
          pluginId: plugin.id,
          enabled: !plugin.enabled,
        });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const handleUninstall = useCallback(async () => {
    if (!uninstallTarget) {
      return;
    }
    const pluginId = uninstallTarget.id;
    setBusyId(pluginId);
    try {
      await uninstallPlugin({ pluginId });
      await refresh();
      setSelectedId((current) => (current === pluginId ? null : current));
      setDetail(null);
      toast.success(t("plugin.catalog.v2.uninstallSuccess"));
      setUninstallTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }, [refresh, t, uninstallTarget]);

  const clearError = () => setError(null);

  return (
    <div className="lime-workbench-theme-scope lime-workbench-surface-scope flex min-h-0 flex-1 flex-col overflow-auto bg-[color:var(--lime-surface-soft)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-7 xl:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--lime-text-muted)]">
              <PackageCheck size={15} />
              {t("plugin.catalog.v2.eyebrow")}
            </div>
            <h1 className="mt-2 text-[28px] font-semibold text-[color:var(--lime-text-strong)]">
              {t("plugin.catalog.v2.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--lime-text-muted)]">
              {t("plugin.catalog.v2.description")}
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3 border-b border-[color:var(--lime-surface-border)] pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "installed"] as const).map((nextView) => (
              <button
                key={nextView}
                type="button"
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                  view === nextView
                    ? "bg-[color:var(--lime-text-strong)] text-[color:var(--lime-surface)]"
                    : "text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-surface-hover)] hover:text-[color:var(--lime-text-strong)]"
                }`}
                onClick={() => setView(nextView)}
                data-testid={`plugin-catalog-view-${nextView}`}
              >
                {t(`plugin.catalog.v2.view.${nextView}`)}
                <span className="text-xs opacity-70">
                  {nextView === "all"
                    ? plugins.length
                    : plugins.filter((plugin) => plugin.installed).length}
                </span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:w-[310px]">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--lime-text-muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                className="h-9 w-full rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] pl-10 pr-4 text-sm text-[color:var(--lime-text-strong)] outline-none placeholder:text-[color:var(--lime-text-muted)] focus:border-[color:var(--lime-surface-border-strong)]"
                placeholder={t("plugin.catalog.v2.searchPlaceholder")}
                aria-label={t("plugin.catalog.v2.searchLabel")}
                data-testid="plugin-catalog-search"
              />
            </label>
            <label className="relative flex min-w-[150px] items-center">
              <SlidersHorizontal
                size={15}
                className="pointer-events-none absolute left-3 text-[color:var(--lime-text-muted)]"
              />
              <select
                value={source}
                onChange={(event) => setSource(event.currentTarget.value)}
                className="h-9 w-full appearance-none rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] pl-9 pr-8 text-sm font-medium text-[color:var(--lime-text-strong)] outline-none focus:border-[color:var(--lime-surface-border-strong)]"
                aria-label={t("plugin.catalog.v2.sourceLabel")}
                data-testid="plugin-catalog-source-filter"
              >
                <option value="all">{t("plugin.catalog.v2.source.all")}</option>
                {sources.map((item) => (
                  <option key={item} value={item}>
                    {marketplaces.find(
                      (marketplace) => marketplace.name === item,
                    )?.interface?.displayName || item}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 text-[color:var(--lime-text-muted)]"
              />
            </label>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] text-[color:var(--lime-text-muted)] transition hover:bg-[color:var(--lime-surface-hover)] hover:text-[color:var(--lime-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void refresh()}
              disabled={loading}
              title={t("plugin.catalog.v2.refresh")}
              aria-label={t("plugin.catalog.v2.refresh")}
              data-testid="plugin-catalog-refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </section>

        {error ? (
          <div
            className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
            data-testid="plugin-catalog-error"
          >
            <div className="flex min-w-0 items-start gap-2">
              <CircleAlert size={17} className="mt-0.5 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 hover:bg-rose-100"
              onClick={clearError}
              title={t("plugin.catalog.v2.dismissError")}
              aria-label={t("plugin.catalog.v2.dismissError")}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div
            className="flex min-h-[280px] items-center justify-center text-sm text-[color:var(--lime-text-muted)]"
            data-testid="plugin-catalog-loading"
          >
            <LoaderCircle size={18} className="mr-2 animate-spin" />
            {t("plugin.catalog.v2.loading")}
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div
            className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] px-6 text-center"
            data-testid="plugin-catalog-empty"
          >
            <Sparkles
              size={24}
              className="text-[color:var(--lime-text-muted)]"
            />
            <p className="mt-3 text-sm font-semibold text-[color:var(--lime-text-strong)]">
              {plugins.length === 0
                ? t("plugin.catalog.v2.empty.noPlugins")
                : t("plugin.catalog.v2.empty.noMatches")}
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-[color:var(--lime-text-muted)]">
              {t("plugin.catalog.v2.empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <section
              className="grid min-w-0 grid-cols-1 content-start gap-3 md:grid-cols-2"
              data-testid="plugin-catalog-list"
            >
              {filteredPlugins.map((entry) => {
                const { plugin, marketplace } = entry;
                const isSelected = selectedId === plugin.id;
                const isBusy = busyId === plugin.id;
                return (
                  <article
                    key={`${plugin.id}:${plugin.version}`}
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
                        onClick={() => setSelectedId(plugin.id)}
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
                            onClick={() =>
                              setActionMenuId((current) =>
                                current === plugin.id ? null : plugin.id,
                              )
                            }
                            aria-haspopup="menu"
                            aria-expanded={actionMenuId === plugin.id}
                            aria-label={t("plugin.catalog.v2.moreActions")}
                            data-testid={`plugin-catalog-actions-${plugin.id}`}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                          {actionMenuId === plugin.id ? (
                            <div
                              className="absolute right-0 top-9 z-10 min-w-[150px] overflow-hidden rounded-lg border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] py-1 shadow-lg shadow-slate-950/10"
                              role="menu"
                            >
                              <button
                                type="button"
                                className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium hover:bg-[color:var(--lime-surface-hover)]"
                                onClick={() => void handleToggle(plugin)}
                                role="menuitem"
                                data-testid={`plugin-catalog-toggle-${plugin.id}`}
                              >
                                {plugin.enabled ? (
                                  <Unplug size={15} />
                                ) : (
                                  <Check size={15} />
                                )}
                                {plugin.enabled
                                  ? t("plugin.catalog.v2.disable")
                                  : t("plugin.catalog.v2.enable")}
                              </button>
                              <button
                                type="button"
                                className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                                onClick={() => {
                                  setActionMenuId(null);
                                  setUninstallTarget(plugin);
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
                          className={
                            plugin.enabled
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {plugin.enabled
                            ? t("plugin.catalog.v2.status.enabled")
                            : t("plugin.catalog.v2.status.disabled")}
                        </span>
                      ) : null}
                    </div>
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
                          onClick={() => setSelectedId(plugin.id)}
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
                            setInstallTarget(entry);
                          }}
                          disabled={
                            Boolean(busyId) ||
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
              })}
            </section>

            <PluginDetailPanel
              summary={selectedSummary}
              detail={detail}
              t={t}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      {installTarget ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/25 px-4"
          role="presentation"
        >
          <div
            className="w-full max-w-[520px] rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plugin-catalog-install-title"
            data-testid="plugin-catalog-install-review"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--lime-text-muted)]">
                  {t("plugin.catalog.v2.review.eyebrow")}
                </p>
                <h2
                  id="plugin-catalog-install-title"
                  className="mt-1 text-lg font-semibold text-[color:var(--lime-text-strong)]"
                >
                  {t("plugin.catalog.v2.review.title")}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full p-1.5 text-[color:var(--lime-text-muted)] hover:bg-[color:var(--lime-surface-hover)]"
                onClick={() => setInstallTarget(null)}
                aria-label={t("plugin.catalog.v2.close")}
              >
                <X size={17} />
              </button>
            </div>
            {installTarget ? (
              <div className="mt-5 rounded-lg border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-[color:var(--lime-text-strong)]">
                      {pluginDisplayName(installTarget.plugin)}
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--lime-text-muted)]">
                      {installTarget.plugin.id} ·{" "}
                      {t("plugin.catalog.v2.version", {
                        version: installTarget.plugin.version,
                      })}
                    </p>
                  </div>
                  <ShieldCheck
                    size={19}
                    className="shrink-0 text-emerald-700"
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-[color:var(--lime-text-muted)]">
                  {pluginDescription(installTarget.plugin) ||
                    t("plugin.catalog.v2.descriptionFallback")}
                </p>
                <p className="mt-3 truncate text-xs text-[color:var(--lime-text-muted)]">
                  {t("plugin.catalog.v2.review.source", {
                    name:
                      installTarget.marketplace.interface?.displayName ||
                      installTarget.marketplace.name,
                  })}
                </p>
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-full border border-[color:var(--lime-surface-border)] px-4 text-sm font-semibold text-[color:var(--lime-text-strong)] hover:bg-[color:var(--lime-surface-hover)]"
                onClick={() => setInstallTarget(null)}
              >
                {t("plugin.catalog.v2.cancel")}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--lime-text-strong)] px-5 text-sm font-semibold text-[color:var(--lime-surface)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleInstall()}
                disabled={!installTarget || Boolean(busyId)}
                data-testid="plugin-catalog-confirm-install"
              >
                {busyId ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <PackageCheck size={15} />
                )}
                {t("plugin.catalog.v2.confirmInstall")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {uninstallTarget ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/25 px-4"
          role="presentation"
        >
          <div
            className="w-full max-w-[420px] rounded-xl border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            data-testid="plugin-catalog-uninstall-confirm"
          >
            <h2 className="text-lg font-semibold text-[color:var(--lime-text-strong)]">
              {t("plugin.catalog.v2.uninstallTitle", {
                name: pluginDisplayName(uninstallTarget),
              })}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--lime-text-muted)]">
              {t("plugin.catalog.v2.uninstallDescription")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 rounded-full border border-[color:var(--lime-surface-border)] px-4 text-sm font-semibold text-[color:var(--lime-text-strong)] hover:bg-[color:var(--lime-surface-hover)]"
                onClick={() => setUninstallTarget(null)}
              >
                {t("plugin.catalog.v2.cancel")}
              </button>
              <button
                type="button"
                className="h-9 rounded-full bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleUninstall()}
                disabled={Boolean(busyId)}
              >
                {t("plugin.catalog.v2.confirmUninstall")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
