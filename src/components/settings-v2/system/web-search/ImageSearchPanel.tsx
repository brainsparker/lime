import { Compass, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsContent } from "@/components/ui/tabs";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import {
  SurfacePanel,
  FieldBlock,
  StatusPill,
  SecretInput,
} from "./WebSearchFields";
import type { WebSearchFormProps } from "./webSearchConfig";
import {
  TEXT_BUTTON_CLASS_NAME,
  PEXELS_APPLY_URL,
  PEXELS_DOC_URL,
  PIXABAY_APPLY_URL,
  PIXABAY_DOC_URL,
  openExternalUrl,
} from "./webSearchPresentation";
import { useWebSearchPresentation } from "./useWebSearchPresentation";

export function ImageSearchPanel({ draft, change }: WebSearchFormProps) {
  const { t } = useTranslation("settings");
  const {
    tavilyKeyConfigured,
    bingSearchKeyConfigured,
    googleSearchKeyConfigured,
    googleSearchEngineConfigured,
    mseCustomEngineReady,
    pexelsKeyConfigured,
    pixabayKeyConfigured,
    readyLabel,
    notConfiguredLabel,
    tavilyProviderLabel,
    bingSearchApiProviderLabel,
    googleCustomSearchProviderLabel,
    googleCseProviderLabel,
    pexelsProviderLabel,
    pixabayProviderLabel,
    credentialStatusLabel,
    providerChainPreview,
  } = useWebSearchPresentation(draft);
  return (
    <TabsContent value="images" className="mt-0 space-y-6">
      <SurfacePanel
        icon={ImageIcon}
        title={t("settings.webSearch.images.title")}
        description={t("settings.webSearch.images.description")}
        tipAriaLabel={t("settings.webSearch.images.tipAria")}
        aside={
          <>
            <StatusPill
              active={pexelsKeyConfigured}
              label={credentialStatusLabel(
                pexelsProviderLabel,
                pexelsKeyConfigured,
              )}
            />
            <StatusPill
              active={pixabayKeyConfigured}
              label={credentialStatusLabel(
                pixabayProviderLabel,
                pixabayKeyConfigured,
              )}
            />
          </>
        }
      >
        <div className="space-y-5">
          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <FieldBlock
              label={t("settings.webSearch.images.pexels.label")}
              htmlFor="web-search-pexels-key"
              hint={t("settings.webSearch.images.pexels.hint")}
              tipAriaLabel={t("settings.webSearch.images.pexels.tipAria")}
            >
              <>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(PEXELS_APPLY_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.images.pexels.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(PEXELS_DOC_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.action.viewDocs")}
                  </button>
                </div>
                <SecretInput
                  id="web-search-pexels-key"
                  value={draft.pexelsApiKey}
                  placeholder={t(
                    "settings.webSearch.images.pexels.placeholder",
                  )}
                  onChange={(value) => change("pexelsApiKey", value)}
                />
              </>
            </FieldBlock>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
              <span>{t("settings.webSearch.images.pexels.note")}</span>
              <WorkbenchInfoTip
                ariaLabel={t("settings.webSearch.images.pexels.noteAria")}
                content={t("settings.webSearch.images.pexels.noteTip", {
                  applyUrl: PEXELS_APPLY_URL,
                })}
                tone="slate"
              />
            </div>
          </article>

          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <FieldBlock
              label={t("settings.webSearch.images.pixabay.label")}
              htmlFor="web-search-pixabay-key"
              hint={t("settings.webSearch.images.pixabay.hint")}
              tipAriaLabel={t("settings.webSearch.images.pixabay.tipAria")}
            >
              <>
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(PIXABAY_APPLY_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.images.pixabay.apply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openExternalUrl(PIXABAY_DOC_URL)}
                    className={TEXT_BUTTON_CLASS_NAME}
                  >
                    {t("settings.webSearch.action.viewDocs")}
                  </button>
                </div>
                <SecretInput
                  id="web-search-pixabay-key"
                  value={draft.pixabayApiKey}
                  placeholder={t(
                    "settings.webSearch.images.pixabay.placeholder",
                  )}
                  onChange={(value) => change("pixabayApiKey", value)}
                />
              </>
            </FieldBlock>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-border bg-background px-4 py-3 text-xs leading-5 text-muted-foreground">
              <span>{t("settings.webSearch.images.pixabay.note")}</span>
              <WorkbenchInfoTip
                ariaLabel={t("settings.webSearch.images.pixabay.noteAria")}
                content={t("settings.webSearch.images.pixabay.noteTip", {
                  applyUrl: PIXABAY_APPLY_URL,
                })}
                tone="slate"
              />
            </div>
          </article>
        </div>
      </SurfacePanel>

      <SurfacePanel
        icon={Compass}
        title={t("settings.webSearch.observability.title")}
        description={t("settings.webSearch.observability.description")}
        tipAriaLabel={t("settings.webSearch.observability.tipAria")}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
            <StatusPill
              active={mseCustomEngineReady}
              label={t(
                "settings.webSearch.observability.mseCustomTemplateStatus",
                {
                  status: mseCustomEngineReady
                    ? readyLabel
                    : notConfiguredLabel,
                },
              )}
            />
          </div>
          <div className="rounded-[20px] border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("settings.webSearch.observability.providerChain.title")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {providerChainPreview}
            </p>
          </div>
          <div className="rounded-[20px] border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("settings.webSearch.observability.imageKeys.title")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pexelsKeyConfigured || pixabayKeyConfigured
                ? t("settings.webSearch.observability.imageKeys.ready")
                : t("settings.webSearch.observability.imageKeys.missing")}
            </p>
          </div>
        </div>
      </SurfacePanel>
    </TabsContent>
  );
}
