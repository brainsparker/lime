import { useMemo, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { modelSupportsTaskFamily } from "@/lib/model/inferModelCapabilities";
import type { ModelTaskFamily } from "@/lib/types/modelRegistry";
import type { ServiceModelConfigKey } from "@/lib/serviceModels";
import { cn } from "@/lib/utils";
import { ImageGenSettings } from "../image-gen";
import { SettingModelSelectorField } from "../shared/SettingModelSelectorField";
import { useAutoDismissMessage } from "../shared/useAutoDismissMessage";
import { VideoGenSettings } from "../video-gen";
import { VoiceSettings } from "../voice";
import {
  DEFAULT_IMAGE_COUNT,
  MIN_IMAGE_COUNT,
  MAX_IMAGE_COUNT,
  getSectionPreference,
  useMediaServicesDraft,
} from "./useMediaServicesDraft";

interface ServiceModelSectionDefinition {
  key: ServiceModelConfigKey;
  title: string;
  description: string;
  modelHint: string;
  taskFamilies: ModelTaskFamily[];
  supportsModelSelection?: boolean;
  allowDisable?: boolean;
  allowCustomPrompt?: boolean;
  emptyHint?: string;
}

type MediaServicesTranslate = TFunction<"settings", undefined>;

function isConfirmationTarget(target: EventTarget | null) {
  return (
    target instanceof Element && Boolean(target.closest('[role="alertdialog"]'))
  );
}

function createServiceModelSections(
  t: MediaServicesTranslate,
): ServiceModelSectionDefinition[] {
  return [
    {
      key: "responsive_chat",
      title: t("settings.mediaServices.sections.responsiveChat.title"),
      description: t(
        "settings.mediaServices.sections.responsiveChat.description",
      ),
      modelHint: t("settings.mediaServices.sections.responsiveChat.modelHint"),
      taskFamilies: ["chat"],
    },
    {
      key: "topic",
      title: t("settings.mediaServices.sections.topic.title"),
      description: t("settings.mediaServices.sections.topic.description"),
      modelHint: t("settings.mediaServices.sections.topic.modelHint"),
      taskFamilies: ["chat", "reasoning"],
    },
    {
      key: "generation_topic",
      title: t("settings.mediaServices.sections.generationTopic.title"),
      description: t(
        "settings.mediaServices.sections.generationTopic.description",
      ),
      modelHint: t("settings.mediaServices.sections.generationTopic.modelHint"),
      taskFamilies: ["vision_understanding", "chat", "reasoning"],
    },
    {
      key: "translation",
      title: t("settings.mediaServices.sections.translation.title"),
      description: t("settings.mediaServices.sections.translation.description"),
      modelHint: t("settings.mediaServices.sections.translation.modelHint"),
      taskFamilies: ["chat", "reasoning"],
    },
    {
      key: "history_compress",
      title: t("settings.mediaServices.sections.historyCompress.title"),
      description: t(
        "settings.mediaServices.sections.historyCompress.description",
      ),
      modelHint: t("settings.mediaServices.sections.historyCompress.modelHint"),
      taskFamilies: ["chat", "reasoning"],
    },
    {
      key: "agent_meta",
      title: t("settings.mediaServices.sections.agentMeta.title"),
      description: t("settings.mediaServices.sections.agentMeta.description"),
      modelHint: t("settings.mediaServices.sections.agentMeta.modelHint"),
      taskFamilies: ["chat", "reasoning"],
    },
    {
      key: "input_completion",
      title: t("settings.mediaServices.sections.inputCompletion.title"),
      description: t(
        "settings.mediaServices.sections.inputCompletion.description",
      ),
      modelHint: t("settings.mediaServices.sections.inputCompletion.modelHint"),
      taskFamilies: ["chat", "reasoning"],
      supportsModelSelection: false,
      allowDisable: true,
    },
    {
      key: "prompt_rewrite",
      title: t("settings.mediaServices.sections.promptRewrite.title"),
      description: t(
        "settings.mediaServices.sections.promptRewrite.description",
      ),
      modelHint: t("settings.mediaServices.sections.promptRewrite.modelHint"),
      taskFamilies: ["chat", "reasoning"],
      allowDisable: true,
    },
    {
      key: "resource_prompt_rewrite",
      title: t("settings.mediaServices.sections.resourcePromptRewrite.title"),
      description: t(
        "settings.mediaServices.sections.resourcePromptRewrite.description",
      ),
      modelHint: t(
        "settings.mediaServices.sections.resourcePromptRewrite.modelHint",
      ),
      taskFamilies: ["chat", "reasoning"],
      allowDisable: true,
      allowCustomPrompt: true,
    },
  ];
}

function SettingCard({
  title,
  description,
  children,
  headerExtra,
  tipAriaLabel,
  dimmed = false,
  searchTarget,
}: {
  title: string;
  description: string;
  children: ReactNode;
  headerExtra?: ReactNode;
  tipAriaLabel: string;
  dimmed?: boolean;
  searchTarget?: string;
}) {
  return (
    <section
      data-settings-search-target={searchTarget}
      tabIndex={searchTarget ? -1 : undefined}
      className={cn(
        "overflow-visible rounded-[24px] border border-slate-200/80 bg-white shadow-sm shadow-slate-950/5",
        dimmed && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          <WorkbenchInfoTip
            ariaLabel={tipAriaLabel}
            content={description}
            tone="slate"
          />
        </div>
        {headerExtra}
      </div>
      <div className="divide-y divide-slate-200/80 border-t border-slate-200/80">
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
  searchTarget,
}: {
  label: string;
  description: string;
  children: ReactNode;
  searchTarget?: string;
}) {
  return (
    <div
      data-settings-search-target={searchTarget}
      tabIndex={searchTarget ? -1 : undefined}
      className="grid gap-3 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center"
    >
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-800">{label}</Label>
        <p className="text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function MediaServicesSettings() {
  const { t } = useTranslation("settings");
  const { message, showMessage } = useAutoDismissMessage();
  const [promptEditors, setPromptEditors] = useState<
    Partial<Record<ServiceModelConfigKey, boolean>>
  >({});
  const {
    config,
    promptDrafts,
    imageCountDraft,
    imageCountInput,
    imageCountInvalid,
    changePrompt,
    commitPrompt,
    changeImageCount,
    commitImageCount,
    updateServiceModelPreference,
  } = useMediaServicesDraft((type) =>
    showMessage(
      type,
      t(
        type === "success"
          ? "settings.mediaServices.message.saved"
          : "settings.mediaServices.message.saveFailed",
      ),
    ),
  );

  const serviceModelSections = useMemo(
    () => createServiceModelSections(t),
    [t],
  );

  const sectionViews = useMemo(() => {
    return serviceModelSections.map((section) => {
      const preference = getSectionPreference(config, section.key);

      return {
        section,
        preference,
        disabled: Boolean(section.allowDisable && preference.enabled === false),
      };
    });
  }, [config, serviceModelSections]);

  return (
    <div className="max-w-[860px] space-y-5 pb-8">
      <section className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
            {t("settings.mediaServices.title")}
          </h1>
          <WorkbenchInfoTip
            ariaLabel={t("settings.mediaServices.hero.tipAria")}
            content={t("settings.mediaServices.hero.tip")}
            tone="mint"
          />
        </div>
        <p className="text-sm text-slate-500">
          {t("settings.mediaServices.description")}
        </p>
      </section>

      {sectionViews.map(({ section, preference, disabled }) => {
        const promptDraft =
          promptDrafts[section.key] ?? preference.customPrompt ?? "";
        const promptVisible =
          Boolean(section.allowCustomPrompt) &&
          (Boolean(promptDraft) ||
            Boolean(preference.customPrompt) ||
            promptEditors[section.key]);

        return (
          <SettingCard
            key={section.key}
            searchTarget={`media-service-${section.key.replaceAll("_", "-")}`}
            title={section.title}
            description={section.description}
            tipAriaLabel={t("settings.mediaServices.card.tipAria", {
              title: section.title,
            })}
            dimmed={disabled}
            headerExtra={
              section.allowDisable ? (
                <Switch
                  checked={preference.enabled ?? true}
                  disabled={!config}
                  onCheckedChange={(enabled) => {
                    updateServiceModelPreference(section.key, (current) => ({
                      ...current,
                      enabled,
                    }));
                  }}
                />
              ) : undefined
            }
          >
            {section.supportsModelSelection === false ? (
              <SettingRow
                label={t("settings.mediaServices.common.currentBehavior.label")}
                description={section.modelHint}
              >
                <div className="rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  {t(
                    "settings.mediaServices.common.inputCompletion.currentBehavior",
                  )}
                </div>
              </SettingRow>
            ) : (
              <SettingModelSelectorField
                label={t("settings.mediaServices.common.model.label")}
                description={section.modelHint}
                disabled={!config || disabled}
                emptyStateTitle={t(
                  "settings.mediaServices.common.model.emptyTitle",
                )}
                emptyStateDescription={
                  section.emptyHint ??
                  t("settings.mediaServices.common.model.emptyDescription")
                }
                providerType={preference.preferredProviderId ?? ""}
                setProviderType={(value) => {
                  const preferredProviderId = value.trim() || undefined;
                  updateServiceModelPreference(section.key, (current) => ({
                    ...current,
                    preferredProviderId,
                    preferredModelId:
                      preferredProviderId &&
                      preferredProviderId === current.preferredProviderId
                        ? current.preferredModelId
                        : undefined,
                  }));
                }}
                model={preference.preferredModelId ?? ""}
                setModel={(value) => {
                  updateServiceModelPreference(section.key, (current) => ({
                    ...current,
                    preferredModelId: value.trim() || undefined,
                  }));
                }}
                modelFilter={(model) =>
                  section.taskFamilies.some((taskFamily) =>
                    modelSupportsTaskFamily(model, taskFamily),
                  )
                }
              />
            )}

            {section.allowCustomPrompt ? (
              <SettingRow
                label={t("settings.mediaServices.customPrompt.label")}
                description={t(
                  "settings.mediaServices.customPrompt.description",
                )}
              >
                {promptVisible ? (
                  <Textarea
                    value={promptDraft}
                    disabled={!config || disabled}
                    placeholder={t(
                      "settings.mediaServices.customPrompt.placeholder",
                    )}
                    className="min-h-[120px] rounded-2xl border-slate-200 bg-white text-sm text-slate-900 shadow-none focus-visible:ring-slate-300"
                    onChange={(event) => {
                      changePrompt(section.key, event.target.value);
                    }}
                    onBlur={(event) => {
                      if (!isConfirmationTarget(event.relatedTarget))
                        commitPrompt(section.key, event.target.value);
                    }}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!config || disabled}
                    className="h-11 w-full rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setPromptEditors((currentEditors) => ({
                        ...currentEditors,
                        [section.key]: true,
                      }));
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("settings.mediaServices.customPrompt.add")}
                  </Button>
                )}
              </SettingRow>
            ) : null}
          </SettingCard>
        );
      })}

      <SettingCard
        title={t("settings.mediaServices.imageSettings.title")}
        description={t("settings.mediaServices.imageSettings.description")}
        tipAriaLabel={t("settings.mediaServices.card.tipAria", {
          title: t("settings.mediaServices.imageSettings.title"),
        })}
      >
        <SettingRow
          searchTarget="media-image-count"
          label={t("settings.mediaServices.imageSettings.count.label")}
          description={t(
            "settings.mediaServices.imageSettings.count.description",
          )}
        >
          <div className="flex items-center gap-4">
            <Slider
              value={[imageCountDraft]}
              min={MIN_IMAGE_COUNT}
              max={MAX_IMAGE_COUNT}
              step={1}
              disabled={!config}
              className="flex-1"
              onValueChange={(values) => {
                changeImageCount(String(values[0] ?? DEFAULT_IMAGE_COUNT));
              }}
              onValueCommit={(values) => {
                commitImageCount(values[0] ?? DEFAULT_IMAGE_COUNT);
              }}
            />
            <Input
              type="number"
              min={MIN_IMAGE_COUNT}
              max={MAX_IMAGE_COUNT}
              inputMode="numeric"
              value={imageCountInput}
              aria-invalid={imageCountInvalid || undefined}
              disabled={!config}
              className="h-11 w-20 rounded-2xl border-slate-200 bg-white text-center text-slate-900 shadow-none focus-visible:ring-slate-300"
              onChange={(event) => {
                changeImageCount(event.target.value);
              }}
              onBlur={(event) => {
                if (!isConfirmationTarget(event.relatedTarget))
                  commitImageCount(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
        </SettingRow>
      </SettingCard>

      <ImageGenSettings />
      <VideoGenSettings />
      <VoiceSettings />

      {message ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[20px] border px-4 py-3",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      ) : null}
    </div>
  );
}
