import { useTranslation } from "react-i18next";
import type { WebSearchDraft } from "./webSearchConfig";
import { parseCsv } from "./webSearchConfig";

export function useWebSearchPresentation(draft: WebSearchDraft) {
  const { t } = useTranslation("settings");
  const tavilyKeyConfigured = draft.tavilyApiKey.trim().length > 0;
  const bingSearchKeyConfigured = draft.bingSearchApiKey.trim().length > 0;
  const googleSearchKeyConfigured = draft.googleSearchApiKey.trim().length > 0;
  const googleSearchEngineConfigured =
    draft.googleSearchEngineId.trim().length > 0;
  const mseCustomEngineReady =
    draft.mseCustomEngineName.trim().length > 0 &&
    draft.mseCustomEngineTemplate.trim().includes("{query}");
  const pexelsKeyConfigured = draft.pexelsApiKey.trim().length > 0;
  const pixabayKeyConfigured = draft.pixabayApiKey.trim().length > 0;
  const filledLabel = t("settings.webSearch.status.filled");
  const missingLabel = t("settings.webSearch.status.missing");
  const readyLabel = t("settings.webSearch.status.ready");
  const notConfiguredLabel = t("settings.webSearch.status.notConfigured");
  const googleEngineLabel = t("settings.webSearch.engine.google");
  const xiaohongshuEngineLabel = t("settings.webSearch.engine.xiaohongshu");
  const tavilyProviderLabel = t("settings.webSearch.provider.tavily");
  const multiSearchEngineProviderLabel = t(
    "settings.webSearch.provider.multiSearchEngine",
  );
  const duckduckgoInstantProviderLabel = t(
    "settings.webSearch.provider.duckduckgoInstant",
  );
  const bingSearchApiProviderLabel = t(
    "settings.webSearch.provider.bingSearchApi",
  );
  const googleCustomSearchProviderLabel = t(
    "settings.webSearch.provider.googleCustomSearch",
  );
  const googleCseProviderLabel = t("settings.webSearch.provider.googleCse");
  const pexelsProviderLabel = t("settings.webSearch.provider.pexels");
  const pixabayProviderLabel = t("settings.webSearch.provider.pixabay");
  const credentialStatusLabel = (name: string, configured: boolean) =>
    t("settings.webSearch.status.credential", {
      name,
      status: configured ? filledLabel : missingLabel,
    });

  const providerChainPreview =
    parseCsv(draft.providerPriority).length > 0
      ? parseCsv(draft.providerPriority).join(" -> ")
      : t("settings.webSearch.providerChain.auto");

  return {
    tavilyKeyConfigured,
    bingSearchKeyConfigured,
    googleSearchKeyConfigured,
    googleSearchEngineConfigured,
    mseCustomEngineReady,
    pexelsKeyConfigured,
    pixabayKeyConfigured,
    filledLabel,
    missingLabel,
    readyLabel,
    notConfiguredLabel,
    googleEngineLabel,
    xiaohongshuEngineLabel,
    tavilyProviderLabel,
    multiSearchEngineProviderLabel,
    duckduckgoInstantProviderLabel,
    bingSearchApiProviderLabel,
    googleCustomSearchProviderLabel,
    googleCseProviderLabel,
    pexelsProviderLabel,
    pixabayProviderLabel,
    credentialStatusLabel,
    providerChainPreview,
  };
}
