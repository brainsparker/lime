import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
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
  reconcilePlugins,
  readPlugin,
  setPluginEnabled,
  uninstallPlugin,
} from "@/lib/api/pluginCatalog";
import type { PluginsPageParams } from "@/types/page";
import { getProject } from "@/lib/api/project";
import {
  cloudAccountIdentity,
  getCloudAccount,
  subscribeCloudAccount,
} from "@/lib/cloudAccount";
import { PluginCatalogCard } from "./PluginCatalogCard";
import { PluginCatalogDialogs } from "./PluginCatalogDialogs";
import { PluginShareDialog } from "./PluginShareDialog";
import { mergePluginShareCatalog } from "./PluginShareViewModel";
import { listPluginShares } from "@/lib/api/pluginShare";
import { PluginDetailPanel } from "./PluginDetailPanel";
import {
  filterPluginCatalog,
  pluginCatalogEntries,
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
  const accountIdentity = useSyncExternalStore(
    subscribeCloudAccount,
    () => cloudAccountIdentity(getCloudAccount()),
    () => null,
  );
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
  const [shareTarget, setShareTarget] = useState<{
    entry: PluginCatalogEntry;
    accountIdentity: string;
  } | null>(null);
  const projectId = pageParams?.currentProjectId;
  const refreshRequest = useRef<symbol | null>(null);
  const catalogAccount = useRef<string | null>();

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
      const params = project?.rootPath ? { cwds: [project.rootPath] } : {};
      if (accountIdentity) {
        await reconcilePlugins({ reason: "plugin-catalog-refresh" });
        if (
          request !== refreshRequest.current ||
          accountIdentity !== cloudAccountIdentity(getCloudAccount())
        )
          return;
      }
      const response = { ...(await listPlugins(params)) };
      if (
        request !== refreshRequest.current ||
        accountIdentity !== cloudAccountIdentity(getCloudAccount())
      )
        return;
      const remoteErrors: string[] = [];
      if (accountIdentity) {
        const [remote, shares] = await Promise.allSettled([
          listPlugins({
            ...params,
            marketplaceKinds: [
              "workspace-directory",
              "created-by-me-remote",
              "shared-with-me",
            ],
          }),
          listPluginShares(),
        ]);
        if (remote.status === "fulfilled") {
          response.marketplaces = [
            ...response.marketplaces,
            ...remote.value.marketplaces,
          ];
          response.marketplaceLoadErrors = [
            ...(response.marketplaceLoadErrors ?? []),
            ...(remote.value.marketplaceLoadErrors ?? []),
          ];
        } else
          remoteErrors.push(
            remote.reason instanceof Error
              ? remote.reason.message
              : String(remote.reason),
          );
        if (shares.status === "fulfilled") {
          response.marketplaces = mergePluginShareCatalog(
            response.marketplaces,
            shares.value,
            t("plugin.share.createdByMe"),
          );
        } else
          remoteErrors.push(
            shares.reason instanceof Error
              ? shares.reason.message
              : String(shares.reason),
          );
      }
      if (request !== refreshRequest.current) return;
      if (accountIdentity !== cloudAccountIdentity(getCloudAccount())) return;
      catalogAccount.current = accountIdentity;
      setMarketplaces(response.marketplaces);
      const plugins = response.marketplaces.flatMap(
        (marketplace) => marketplace.plugins,
      );
      const loadErrors = [
        ...(response.marketplaceLoadErrors ?? []).map((error) => error.message),
        ...remoteErrors,
      ];
      if (loadErrors.length) setError(loadErrors.join("\n"));
      setSelectedId((current) => {
        if (current && plugins.some((plugin) => plugin.id === current)) {
          return current;
        }
        return plugins[0]?.id ?? null;
      });
    } catch (cause) {
      if (
        request !== refreshRequest.current ||
        accountIdentity !== cloudAccountIdentity(getCloudAccount())
      )
        return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
    } finally {
      if (request === refreshRequest.current) setLoading(false);
    }
  }, [projectId, accountIdentity, t]);

  useEffect(() => {
    catalogAccount.current = undefined;
    setMarketplaces([]);
    setInstallTarget(null);
    setShareTarget(null);
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
    if (!selected || catalogAccount.current !== accountIdentity) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    void Promise.resolve()
      .then(() =>
        readPlugin(
          pluginLocation(selected, t("plugin.catalog.v2.invalidRemoteId")),
        ),
      )
      .then((response) => {
        if (
          !cancelled &&
          accountIdentity === cloudAccountIdentity(getCloudAccount())
        ) {
          setDetail(response.plugin);
        }
      })
      .catch((cause) => {
        if (
          !cancelled &&
          accountIdentity === cloudAccountIdentity(getCloudAccount())
        ) {
          setDetail(null);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entries, selectedId, accountIdentity, t]);

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
        ...pluginLocation(
          installTarget,
          t("plugin.catalog.v2.invalidRemoteId"),
        ),
        installAttemptId: crypto.randomUUID(),
      });
      if (accountIdentity !== cloudAccountIdentity(getCloudAccount())) return;
      await refresh();
      if (accountIdentity !== cloudAccountIdentity(getCloudAccount())) return;
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
  }, [installTarget, refresh, t, accountIdentity]);

  const handleToggle = useCallback(
    async (plugin: AppServerPluginSummary) => {
      setBusyId(plugin.id);
      setActionMenuId(null);
      try {
        if (accountIdentity !== cloudAccountIdentity(getCloudAccount())) return;
        if (plugin.source.type === "remote" && !plugin.remotePluginId) {
          throw new Error("remote plugin preference requires a plugin ID");
        }
        await setPluginEnabled(
          plugin.source.type === "remote"
            ? {
                remotePluginId: plugin.remotePluginId!,
                enabled: !plugin.enabled,
              }
            : { pluginId: plugin.id, enabled: !plugin.enabled },
        );
        await refresh();
      } catch {
        if (accountIdentity === cloudAccountIdentity(getCloudAccount())) {
          setError(t("plugin.catalog.v2.toggleFailed"));
        }
      } finally {
        setBusyId(null);
      }
    },
    [refresh, accountIdentity, t],
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

        {loading && entries.length === 0 ? (
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
              {filteredPlugins.map((entry) => (
                <PluginCatalogCard
                  key={entry.plugin.id}
                  entry={entry}
                  isSelected={selectedId === entry.plugin.id}
                  busyId={busyId}
                  menuOpen={actionMenuId === entry.plugin.id}
                  onSelect={() => setSelectedId(entry.plugin.id)}
                  onMenuToggle={() =>
                    setActionMenuId((current) =>
                      current === entry.plugin.id ? null : entry.plugin.id,
                    )
                  }
                  onToggle={() => void handleToggle(entry.plugin)}
                  onUninstall={() => {
                    setActionMenuId(null);
                    setUninstallTarget(entry.plugin);
                  }}
                  onInstall={() => setInstallTarget(entry)}
                  onShare={
                    accountIdentity &&
                    (entry.plugin.source.type === "local" ||
                      entry.plugin.shareContext)
                      ? () => setShareTarget({ entry, accountIdentity })
                      : undefined
                  }
                />
              ))}
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

      <PluginCatalogDialogs
        installTarget={installTarget}
        uninstallTarget={uninstallTarget}
        busyId={busyId}
        onInstall={() => void handleInstall()}
        onUninstall={() => void handleUninstall()}
        onCancelInstall={() => setInstallTarget(null)}
        onCancelUninstall={() => setUninstallTarget(null)}
      />
      {shareTarget && shareTarget.accountIdentity === accountIdentity ? (
        <PluginShareDialog
          key={`${shareTarget.accountIdentity}:${shareTarget.entry.plugin.id}`}
          entry={shareTarget.entry}
          accountIdentity={shareTarget.accountIdentity}
          onClose={() => {
            setShareTarget(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
