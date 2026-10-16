import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsContent } from "@/components/ui/tabs";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { SurfacePanel, FieldBlock, StatusPill } from "./WebSearchFields";
import type {
  WebSearchFormProps,
  SearchEngine,
  WebSearchProvider,
} from "./webSearchConfig";
import { INPUT_CLASS_NAME } from "./webSearchPresentation";
import { useWebSearchPresentation } from "./useWebSearchPresentation";

export function SearchChainPanel({ draft, change }: WebSearchFormProps) {
  const { t } = useTranslation("settings");
  const {
    tavilyKeyConfigured,
    bingSearchKeyConfigured,
    googleSearchKeyConfigured,
    googleSearchEngineConfigured,
    googleEngineLabel,
    tavilyProviderLabel,
    multiSearchEngineProviderLabel,
    duckduckgoInstantProviderLabel,
    bingSearchApiProviderLabel,
    googleCustomSearchProviderLabel,
    googleCseProviderLabel,
    credentialStatusLabel,
    providerChainPreview,
  } = useWebSearchPresentation(draft);
  return (
    <TabsContent value="search" className="mt-0">
      <SurfacePanel
        icon={Search}
        title={t("settings.webSearch.searchChain.title")}
        description={t("settings.webSearch.searchChain.description")}
        tipAriaLabel={t("settings.webSearch.searchChain.tipAria")}
        aside={
          <>
            <StatusPill
              active={draft.engine === "google"}
              label={
                draft.engine === "google"
                  ? t("settings.webSearch.searchChain.engineStatus.google")
                  : t("settings.webSearch.searchChain.engineStatus.xiaohongshu")
              }
            />
            <StatusPill
              active={draft.provider === "duckduckgo_instant"}
              label={t("settings.webSearch.summary.provider", {
                provider: draft.provider,
              })}
            />
          </>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <div className="space-y-4">
              <FieldBlock
                label={t("settings.webSearch.searchChain.engine.label")}
                htmlFor="web-search-engine"
                hint={t("settings.webSearch.searchChain.engine.hint")}
                tipAriaLabel={t(
                  "settings.webSearch.searchChain.engine.tipAria",
                )}
              >
                <select
                  id="web-search-engine"
                  value={draft.engine}
                  onChange={(e) =>
                    change("engine", e.target.value as SearchEngine)
                  }
                  className={`${INPUT_CLASS_NAME} h-11`}
                >
                  <option value="google">{googleEngineLabel}</option>
                  <option value="xiaohongshu">
                    {t("settings.webSearch.engine.xiaohongshu")}
                  </option>
                </select>
              </FieldBlock>

              <FieldBlock
                label={t("settings.webSearch.searchChain.provider.label")}
                htmlFor="web-search-provider"
              >
                <select
                  id="web-search-provider"
                  value={draft.provider}
                  onChange={(e) =>
                    change("provider", e.target.value as WebSearchProvider)
                  }
                  className={`${INPUT_CLASS_NAME} h-11`}
                >
                  <option value="tavily">{tavilyProviderLabel}</option>
                  <option value="multi_search_engine">
                    {multiSearchEngineProviderLabel}
                  </option>
                  <option value="duckduckgo_instant">
                    {duckduckgoInstantProviderLabel}
                  </option>
                  <option value="bing_search_api">
                    {bingSearchApiProviderLabel}
                  </option>
                  <option value="google_custom_search">
                    {googleCustomSearchProviderLabel}
                  </option>
                </select>
              </FieldBlock>

              <FieldBlock
                label={t(
                  "settings.webSearch.searchChain.providerPriority.label",
                )}
                htmlFor="web-search-provider-priority"
                hint={t("settings.webSearch.searchChain.providerPriority.hint")}
                tipAriaLabel={t(
                  "settings.webSearch.searchChain.providerPriority.tipAria",
                )}
              >
                <input
                  id="web-search-provider-priority"
                  value={draft.providerPriority}
                  onChange={(e) => change("providerPriority", e.target.value)}
                  placeholder={t(
                    "settings.webSearch.searchChain.providerPriority.placeholder",
                  )}
                  className={INPUT_CLASS_NAME}
                />
              </FieldBlock>
            </div>
          </article>

          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <div className="space-y-4">
              <div className="rounded-[20px] border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">
                  {t("settings.webSearch.searchChain.credentialsStatus.title")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill
                    active={tavilyKeyConfigured}
                    label={credentialStatusLabel(
                      tavilyProviderLabel,
                      tavilyKeyConfigured,
                    )}
                  />
                  <StatusPill
                    active={bingSearchKeyConfigured}
                    label={credentialStatusLabel(
                      bingSearchApiProviderLabel,
                      bingSearchKeyConfigured,
                    )}
                  />
                  <StatusPill
                    active={googleSearchKeyConfigured}
                    label={credentialStatusLabel(
                      googleCustomSearchProviderLabel,
                      googleSearchKeyConfigured,
                    )}
                  />
                  <StatusPill
                    active={googleSearchEngineConfigured}
                    label={credentialStatusLabel(
                      googleCseProviderLabel,
                      googleSearchEngineConfigured,
                    )}
                  />
                </div>
              </div>

              <div className="rounded-[20px] border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>
                    {t("settings.webSearch.searchChain.fallbackPreview.title")}
                  </span>
                  <WorkbenchInfoTip
                    ariaLabel={t(
                      "settings.webSearch.searchChain.fallbackPreview.tipAria",
                    )}
                    content={t(
                      "settings.webSearch.searchChain.fallbackPreview.tip",
                    )}
                    tone="slate"
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {providerChainPreview}
                </p>
              </div>

              <div className="rounded-[20px] border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>
                    {t("settings.webSearch.searchChain.suggestion.title")}
                  </span>
                  <WorkbenchInfoTip
                    ariaLabel={t(
                      "settings.webSearch.searchChain.suggestion.tipAria",
                    )}
                    content={t("settings.webSearch.searchChain.suggestion.tip")}
                    tone="slate"
                  />
                </div>
              </div>
            </div>
          </article>
        </div>
      </SurfacePanel>
    </TabsContent>
  );
}
