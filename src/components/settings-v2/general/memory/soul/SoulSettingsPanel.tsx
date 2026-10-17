import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MemorySoulConfig } from "@/lib/api/memoryConfigTypes";
import { hasSoulContent } from "@/lib/soul/soulConfig";
import type { SoulStyleProfileId } from "@/lib/soul/style-profiles";
import { StyleProfileSection } from "./StyleProfileSection";

type SoulTemplateId = "balanced" | "direct" | "creator";

export interface SoulTemplateDefinition {
  id: SoulTemplateId;
  titleKey: string;
  descriptionKey: string;
  summaryKey: string;
  communicationKeys: string[];
  avoidKeys: string[];
}

interface SoulSettingsPanelProps {
  soul: MemorySoulConfig;
  templates: readonly SoulTemplateDefinition[];
  handleSoulTemplateApply: (template: SoulTemplateDefinition) => void;
  handleSoulStyleProfileChange: (id: SoulStyleProfileId) => void;
  handleSoulReset: () => void;
  showMessage: (message: string) => void;
}

export function SoulSettingsPanel({
  soul,
  templates,
  handleSoulTemplateApply,
  handleSoulStyleProfileChange,
  handleSoulReset,
  showMessage,
}: SoulSettingsPanelProps) {
  const { t } = useTranslation("settings");
  const soulEnabledWithContent = soul.enabled && hasSoulContent(soul);
  const soulPreviewItems = [
    {
      id: "summary",
      labelKey: "settings.memory.soul.current.summary",
      values: soul.summary ? [soul.summary] : [],
    },
    {
      id: "communication",
      labelKey: "settings.memory.soul.current.communication",
      values: soul.communication_style ?? [],
    },
    {
      id: "avoid",
      labelKey: "settings.memory.soul.current.avoid",
      values: soul.avoid ?? [],
    },
    {
      id: "depth",
      labelKey: "settings.memory.soul.current.depth",
      values: soul.explanation_depth ? [soul.explanation_depth] : [],
    },
    {
      id: "challenge",
      labelKey: "settings.memory.soul.current.challenge",
      values: soul.challenge_style ? [soul.challenge_style] : [],
    },
  ].filter((item) => item.values.length > 0);

  return (
    <section
      className="rounded-md border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-950/5"
      data-testid="settings-memory-soul-panel"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">
              {t("settings.memory.soul.title")}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {t("settings.memory.soul.description")}
            </p>
          </div>
        </div>
        <div
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
          data-testid="settings-memory-soul-current-status"
          data-state={soulEnabledWithContent ? "enabled" : "disabled"}
        >
          {soulEnabledWithContent
            ? t("settings.memory.soul.current.enabled")
            : t("settings.memory.soul.current.disabled")}
        </div>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              {soulEnabledWithContent
                ? (soul.name ?? t("settings.memory.soul.current.title"))
                : t("settings.memory.soul.current.emptyTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {soulEnabledWithContent
                ? t("settings.memory.soul.current.description")
                : t("settings.memory.soul.current.emptyDescription")}
            </p>
          </div>
        </div>
        {soulPreviewItems.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {soulPreviewItems.map((item) => (
              <div
                key={item.id}
                className="rounded-md bg-white p-3 ring-1 ring-slate-200"
              >
                <p className="text-xs font-semibold text-slate-500">
                  {t(item.labelKey)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.values.map((value) => (
                    <span
                      key={value}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs leading-5 text-slate-700"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div data-settings-search-target="memory-style" tabIndex={-1}>
        <StyleProfileSection
          value={soul.style_profile_id}
          onChange={handleSoulStyleProfileChange}
          showMessage={showMessage}
          t={t}
        />
      </div>

      <div
        data-settings-search-target="memory-templates"
        tabIndex={-1}
        className="mt-5"
      >
        <p className="text-sm font-semibold text-slate-950">
          {t("settings.memory.soul.template.title")}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t("settings.memory.soul.template.description")}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {templates.map((template) => {
            return (
              <div
                key={template.id}
                className="flex min-h-[168px] flex-col justify-between rounded-md border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {t(template.titleKey)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {t(template.descriptionKey)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSoulTemplateApply(template)}
                  data-testid={`settings-memory-soul-template-${template.id}`}
                  className="mt-4 rounded-md border border-slate-950 bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  {t("settings.memory.soul.template.apply")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div>
          <p className="text-xs font-semibold text-slate-700">
            {t("settings.memory.soul.boundary.title")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("settings.memory.soul.boundary.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSoulReset}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
        >
          {t("settings.memory.soul.action.reset")}
        </button>
      </div>
    </section>
  );
}
