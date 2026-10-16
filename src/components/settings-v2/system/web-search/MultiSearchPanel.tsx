import { Layers3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TabsContent } from "@/components/ui/tabs";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { SurfacePanel, FieldBlock, StatusPill } from "./WebSearchFields";
import type { WebSearchFormProps } from "./webSearchConfig";
import {
  INPUT_CLASS_NAME,
  TEXT_BUTTON_CLASS_NAME,
  MSE_DOC_URL,
  openExternalUrl,
} from "./webSearchPresentation";
import { useWebSearchPresentation } from "./useWebSearchPresentation";

export function MultiSearchPanel({ draft, change }: WebSearchFormProps) {
  const { t } = useTranslation("settings");
  const { mseCustomEngineReady, readyLabel, notConfiguredLabel } =
    useWebSearchPresentation(draft);
  return (
    <TabsContent value="mse" className="mt-0">
      <SurfacePanel
        icon={Layers3}
        title={t("settings.webSearch.mse.title")}
        description={t("settings.webSearch.mse.description")}
        tipAriaLabel={t("settings.webSearch.mse.tipAria")}
        aside={
          <StatusPill
            active={mseCustomEngineReady}
            label={t("settings.webSearch.mse.customTemplateStatus", {
              status: mseCustomEngineReady ? readyLabel : notConfiguredLabel,
            })}
          />
        }
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <div className="space-y-4">
              <FieldBlock
                label={t("settings.webSearch.mse.priority.label")}
                htmlFor="web-search-mse-priority"
              >
                <>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => void openExternalUrl(MSE_DOC_URL)}
                      className={TEXT_BUTTON_CLASS_NAME}
                    >
                      {t("settings.webSearch.mse.action.viewDesign")}
                    </button>
                  </div>
                  <input
                    id="web-search-mse-priority"
                    value={draft.msePriority}
                    onChange={(e) => change("msePriority", e.target.value)}
                    placeholder={t(
                      "settings.webSearch.mse.priority.placeholder",
                    )}
                    className={INPUT_CLASS_NAME}
                  />
                </>
              </FieldBlock>

              <div className="grid gap-3 sm:grid-cols-3">
                <FieldBlock
                  label={t("settings.webSearch.mse.maxPerEngine.label")}
                  htmlFor="web-search-mse-max-per-engine"
                >
                  <input
                    id="web-search-mse-max-per-engine"
                    value={draft.mseMaxResultsPerEngine}
                    onChange={(e) =>
                      change("mseMaxResultsPerEngine", e.target.value)
                    }
                    className={INPUT_CLASS_NAME}
                  />
                </FieldBlock>
                <FieldBlock
                  label={t("settings.webSearch.mse.maxTotal.label")}
                  htmlFor="web-search-mse-max-total"
                >
                  <input
                    id="web-search-mse-max-total"
                    value={draft.mseMaxTotalResults}
                    onChange={(e) =>
                      change("mseMaxTotalResults", e.target.value)
                    }
                    className={INPUT_CLASS_NAME}
                  />
                </FieldBlock>
                <FieldBlock
                  label={t("settings.webSearch.mse.timeout.label")}
                  htmlFor="web-search-mse-timeout"
                >
                  <input
                    id="web-search-mse-timeout"
                    value={draft.mseTimeoutMs}
                    onChange={(e) => change("mseTimeoutMs", e.target.value)}
                    className={INPUT_CLASS_NAME}
                  />
                </FieldBlock>
              </div>

              <FieldBlock
                label={t("settings.webSearch.mse.customName.label")}
                htmlFor="web-search-mse-custom-engine-name"
              >
                <input
                  id="web-search-mse-custom-engine-name"
                  value={draft.mseCustomEngineName}
                  onChange={(e) =>
                    change("mseCustomEngineName", e.target.value)
                  }
                  placeholder={t(
                    "settings.webSearch.mse.customName.placeholder",
                  )}
                  className={INPUT_CLASS_NAME}
                />
              </FieldBlock>

              <FieldBlock
                label={t("settings.webSearch.mse.customTemplate.label")}
                htmlFor="web-search-mse-custom-engine-template"
              >
                <input
                  id="web-search-mse-custom-engine-template"
                  value={draft.mseCustomEngineTemplate}
                  onChange={(e) =>
                    change("mseCustomEngineTemplate", e.target.value)
                  }
                  placeholder={t(
                    "settings.webSearch.mse.customTemplate.placeholder",
                  )}
                  className={INPUT_CLASS_NAME}
                />
              </FieldBlock>
            </div>
          </article>

          <article className="rounded-[24px] border border-border bg-muted/40 p-4">
            <div className="space-y-4">
              <div className="rounded-[20px] border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{t("settings.webSearch.mse.suggestion.title")}</span>
                  <WorkbenchInfoTip
                    ariaLabel={t("settings.webSearch.mse.suggestion.tipAria")}
                    content={t("settings.webSearch.mse.suggestion.tip")}
                    tone="slate"
                  />
                </div>
              </div>
              <div className="rounded-[20px] border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">
                  {t("settings.webSearch.mse.templateStatus.title")}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mseCustomEngineReady
                    ? t("settings.webSearch.mse.templateStatus.ready", {
                        name: draft.mseCustomEngineName,
                      })
                    : t("settings.webSearch.mse.templateStatus.notReady")}
                </p>
              </div>
            </div>
          </article>
        </div>
      </SurfacePanel>
    </TabsContent>
  );
}
