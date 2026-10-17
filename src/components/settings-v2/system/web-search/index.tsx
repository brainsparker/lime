import { Search, ShieldCheck, Layers3, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";
import { useWebSearchDraft } from "./useWebSearchDraft";
import { useWebSearchPresentation } from "./useWebSearchPresentation";
import {
  ACTION_BUTTON_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
} from "./webSearchPresentation";
import { SearchChainPanel } from "./SearchChainPanel";
import { SearchCredentialsPanel } from "./SearchCredentialsPanel";
import { MultiSearchPanel } from "./MultiSearchPanel";
import { ImageSearchPanel } from "./ImageSearchPanel";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pb-20">
      <div className="h-[228px] animate-pulse rounded-[30px] border border-border bg-muted" />
      <div className="h-[520px] animate-pulse rounded-[26px] border border-border bg-background" />
    </div>
  );
}

export function WebSearchSettings({
  initialTab = "search",
}: {
  initialTab?: string;
}) {
  const { t } = useTranslation("settings");
  const {
    draft,
    change,
    dirty: hasUnsavedChanges,
    loading,
    saving,
    ready,
    message,
    reload,
    save,
    reset,
  } = useWebSearchDraft();
  const { googleEngineLabel, xiaohongshuEngineLabel } =
    useWebSearchPresentation(draft);
  useSettingsDraft({ dirty: hasUnsavedChanges, saving });
  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 pb-20">
      {message ? (
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-sm shadow-sm",
            message.type === "error"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <span>{message.text}</span>
          {message.type === "error" && !ready ? (
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-current/15 bg-background/80 px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
            >
              {t("settings.webSearch.action.reload")}
            </button>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={!ready} className="min-w-0">
        <Tabs defaultValue={initialTab} className="space-y-5">
          <section className="rounded-[26px] border border-border bg-background px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
                    {t("settings.webSearch.title")}
                  </h1>
                  <WorkbenchInfoTip
                    ariaLabel={t("settings.webSearch.hero.tipAria")}
                    content={t("settings.webSearch.hero.tip")}
                    tone="mint"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.webSearch.description")}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t("settings.webSearch.summary.engine", {
                      engine:
                        draft.engine === "google"
                          ? googleEngineLabel
                          : xiaohongshuEngineLabel,
                    })}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {t("settings.webSearch.summary.provider", {
                      provider: draft.provider,
                    })}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium",
                      hasUnsavedChanges
                        ? "border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)]"
                        : "border-primary/20 bg-primary/10 text-primary",
                    )}
                  >
                    {t("settings.webSearch.summary.status", {
                      status: hasUnsavedChanges
                        ? t("settings.webSearch.status.pendingSave")
                        : t("settings.webSearch.status.saved"),
                    })}
                  </span>
                </div>

                <TabsList className="grid h-auto w-full grid-cols-2 rounded-[20px] border border-border bg-muted p-1 shadow-sm lg:grid-cols-4 xl:w-[640px]">
                  <TabsTrigger
                    value="search"
                    data-testid="web-search-tab-search"
                    className="gap-2 rounded-[14px] px-3 py-3"
                  >
                    <Search className="h-4 w-4" />
                    {t("settings.webSearch.tabs.searchChain")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="providers"
                    data-testid="web-search-tab-providers"
                    className="gap-2 rounded-[14px] px-3 py-3"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {t("settings.webSearch.tabs.providerCredentials")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="mse"
                    data-testid="web-search-tab-mse"
                    className="gap-2 rounded-[14px] px-3 py-3"
                  >
                    <Layers3 className="h-4 w-4" />
                    {t("settings.webSearch.tabs.mse")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="images"
                    data-testid="web-search-tab-images"
                    className="gap-2 rounded-[14px] px-3 py-3"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {t("settings.webSearch.tabs.imageSearch")}
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </section>

          <SearchChainPanel draft={draft} change={change} />

          <SearchCredentialsPanel draft={draft} change={change} />

          <MultiSearchPanel draft={draft} change={change} />

          <ImageSearchPanel draft={draft} change={change} />
        </Tabs>

        <div className="sticky bottom-0 rounded-[24px] border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {hasUnsavedChanges
                ? t("settings.webSearch.status.unsavedChanges")
                : t("settings.webSearch.status.allSaved")}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="web-search-cancel"
                onClick={reset}
                disabled={!ready || !hasUnsavedChanges || saving}
                className={ACTION_BUTTON_CLASS_NAME}
              >
                {t("settings.webSearch.action.cancel")}
              </button>
              <button
                type="button"
                data-testid="web-search-save"
                onClick={() => void save()}
                disabled={!ready || !hasUnsavedChanges || saving}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                {saving
                  ? t("settings.webSearch.action.saving")
                  : t("settings.webSearch.action.save")}
              </button>
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
