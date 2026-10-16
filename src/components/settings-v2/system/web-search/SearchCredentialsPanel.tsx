import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsContent } from "@/components/ui/tabs";
import { SurfacePanel, FieldBlock, SecretInput } from "./WebSearchFields";
import type { WebSearchFormProps } from "./webSearchConfig";
import {
  INPUT_CLASS_NAME,
  TEXT_BUTTON_CLASS_NAME,
  TAVILY_APPLY_URL,
  TAVILY_DOC_URL,
  BING_SEARCH_APPLY_URL,
  BING_SEARCH_DOC_URL,
  GOOGLE_SEARCH_API_APPLY_URL,
  GOOGLE_SEARCH_DOC_URL,
  GOOGLE_SEARCH_CSE_URL,
  openExternalUrl,
} from "./webSearchPresentation";

export function SearchCredentialsPanel({ draft, change }: WebSearchFormProps) {
  const { t } = useTranslation("settings");
  return (
    <TabsContent value="providers" className="mt-0">
      <SurfacePanel
        icon={ShieldCheck}
        title={t("settings.webSearch.providers.title")}
        description={t("settings.webSearch.providers.description")}
        tipAriaLabel={t("settings.webSearch.providers.tipAria")}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <FieldBlock
              label={t("settings.webSearch.providers.tavily.label")}
              htmlFor="web-search-tavily-key"
              hint={t("settings.webSearch.providers.tavily.hint")}
              tipAriaLabel={t("settings.webSearch.providers.tavily.tipAria")}
            >
              <>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(TAVILY_APPLY_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.providers.tavily.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(TAVILY_DOC_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.action.viewDocs")}
                  </button>
                </div>
                <SecretInput
                  id="web-search-tavily-key"
                  value={draft.tavilyApiKey}
                  placeholder={t(
                    "settings.webSearch.providers.tavily.placeholder",
                  )}
                  onChange={(value) => change("tavilyApiKey", value)}
                />
              </>
            </FieldBlock>
          </article>

          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <FieldBlock
              label={t("settings.webSearch.providers.bing.label")}
              htmlFor="web-search-bing-key"
              hint={t("settings.webSearch.providers.bing.hint")}
              tipAriaLabel={t("settings.webSearch.providers.bing.tipAria")}
            >
              <>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(BING_SEARCH_APPLY_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.providers.bing.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(BING_SEARCH_DOC_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.action.viewDocs")}
                  </button>
                </div>
                <SecretInput
                  id="web-search-bing-key"
                  value={draft.bingSearchApiKey}
                  placeholder={t(
                    "settings.webSearch.providers.bing.placeholder",
                  )}
                  onChange={(value) => change("bingSearchApiKey", value)}
                />
              </>
            </FieldBlock>
          </article>

          <article className="rounded-[24px] border border-border bg-muted/40 p-4 xl:col-span-2">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.74fr)]">
              <FieldBlock
                label={t("settings.webSearch.providers.googleApi.label")}
                htmlFor="web-search-google-key"
                hint={t("settings.webSearch.providers.googleApi.hint")}
                tipAriaLabel={t(
                  "settings.webSearch.providers.googleApi.tipAria",
                )}
              >
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void openExternalUrl(GOOGLE_SEARCH_API_APPLY_URL)
                      }
                      className={TEXT_BUTTON_CLASS_NAME}
                    >
                      {t("settings.webSearch.providers.googleApi.apply")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void openExternalUrl(GOOGLE_SEARCH_DOC_URL)
                      }
                      className={TEXT_BUTTON_CLASS_NAME}
                    >
                      {t("settings.webSearch.action.viewDocs")}
                    </button>
                  </div>
                  <SecretInput
                    id="web-search-google-key"
                    value={draft.googleSearchApiKey}
                    placeholder={t(
                      "settings.webSearch.providers.googleApi.placeholder",
                    )}
                    onChange={(value) => change("googleSearchApiKey", value)}
                  />
                </>
              </FieldBlock>

              <FieldBlock
                label={t("settings.webSearch.providers.googleEngine.label")}
                htmlFor="web-search-google-engine-id"
                hint={t("settings.webSearch.providers.googleEngine.hint")}
                tipAriaLabel={t(
                  "settings.webSearch.providers.googleEngine.tipAria",
                )}
              >
                <>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        void openExternalUrl(GOOGLE_SEARCH_CSE_URL)
                      }
                      className={TEXT_BUTTON_CLASS_NAME}
                    >
                      {t("settings.webSearch.providers.googleEngine.create")}
                    </button>
                  </div>
                  <input
                    id="web-search-google-engine-id"
                    value={draft.googleSearchEngineId}
                    onChange={(e) =>
                      change("googleSearchEngineId", e.target.value)
                    }
                    placeholder={t(
                      "settings.webSearch.providers.googleEngine.placeholder",
                    )}
                    className={INPUT_CLASS_NAME}
                  />
                </>
              </FieldBlock>
            </div>
          </article>
        </div>
      </SurfacePanel>
    </TabsContent>
  );
}
