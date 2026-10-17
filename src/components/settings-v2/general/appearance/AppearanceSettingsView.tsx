import type { ReactNode } from "react";
import {
  Check,
  Languages,
  MessageCircle,
  Palette,
  Sparkles,
  Shuffle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  resolveLocaleOptionLabel,
  type LocalePreference,
} from "@/i18n/locales";
import type {
  LimeColorSchemeId,
  LIME_COLOR_SCHEMES,
} from "@/lib/appearance/colorSchemes";
import type { LimeThemeMode } from "@/lib/appearance/themeMode";

export interface ThemeOption {
  id: LimeThemeMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface LanguageOption {
  id: LocalePreference;
  label: string;
  hint: string;
}

interface SurfacePanelProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  tipAriaLabel?: string;
  aside?: ReactNode;
  children: ReactNode;
}

const ACTIVE_OPTION_CARD_CLASS =
  "border-[color:var(--lime-surface-border-strong)] bg-[image:var(--lime-home-card-surface-strong)] text-[color:var(--lime-text-strong)] shadow-sm shadow-slate-950/10";

const INACTIVE_OPTION_CARD_CLASS =
  "border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] text-[color:var(--lime-text)] hover:border-[color:var(--lime-surface-border-strong)] hover:bg-[color:var(--lime-surface-hover)] hover:text-[color:var(--lime-text-strong)]";

const HEADER_INFO_PILL_CLASS =
  "rounded-full border border-[color:var(--lime-info-border)] bg-[color:var(--lime-info-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--lime-info)]";

const HEADER_SUCCESS_PILL_CLASS =
  "rounded-full border border-[color:var(--lime-surface-border-strong)] bg-[color:var(--lime-brand-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--lime-brand-strong)]";

const CURRENT_INFO_PILL_CLASS =
  "rounded-full border border-[color:var(--lime-info-border)] bg-[color:var(--lime-info-soft)] px-3 py-1 text-xs font-medium text-[color:var(--lime-info)]";

const CURRENT_SUCCESS_PILL_CLASS =
  "rounded-full border border-[color:var(--lime-surface-border-strong)] bg-[color:var(--lime-brand-soft)] px-3 py-1 text-xs font-medium text-[color:var(--lime-brand-strong)]";

const CONTEXT_STATUS_PILL_CLASS =
  "rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-soft)] px-3 py-1 text-xs font-medium text-[color:var(--lime-text-muted)]";

function SurfacePanel({
  icon: Icon,
  iconClassName,
  title,
  description,
  tipAriaLabel,
  aside,
  children,
}: SurfacePanelProps) {
  return (
    <article className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-950/5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon className={cn("h-4 w-4 text-sky-600", iconClassName)} />
            {title}
            <WorkbenchInfoTip
              ariaLabel={tipAriaLabel ?? `${title}说明`}
              content={description}
              tone="slate"
            />
          </div>
        </div>
        {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </article>
  );
}

export function AppearanceLoadingSkeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="h-[132px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="h-[320px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
        <div className="h-[320px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
      </div>
      <div className="h-[420px] animate-pulse rounded-[26px] border border-slate-200/80 bg-white" />
    </div>
  );
}

interface AppearanceSettingsViewProps {
  theme: LimeThemeMode;
  colorSchemeId: LimeColorSchemeId;
  language: LocalePreference;
  agentResponseLanguage: LocalePreference;
  appendSelectedTextToRecommendation: boolean;
  config: boolean;
  error: string | null;
  themeOptions: readonly ThemeOption[];
  colorSchemeOptions: readonly (Omit<
    (typeof LIME_COLOR_SCHEMES)[number],
    "label" | "description"
  > & { label: string; description: string })[];
  languageOptions: readonly LanguageOption[];
  responseLanguageOptions: readonly LanguageOption[];
  currentThemeLabel: string;
  currentColorSchemeLabel: string;
  workspaceSummary: {
    themeLabel: string;
    colorSchemeLabel: string;
    languageLabel: string;
    responseLanguageLabel: string;
  };
  loadConfig: () => Promise<void>;
  handleThemeChange: (theme: LimeThemeMode) => void;
  handleColorSchemeChange: (id: LimeColorSchemeId) => void;
  handleRandomColorScheme: () => void;
  handleLanguageChange: (language: LocalePreference) => Promise<void>;
  handleAgentResponseLanguageChange: (
    language: LocalePreference,
  ) => Promise<void>;
  handleRecommendationSelectionToggle: (checked: boolean) => Promise<void>;
}

export function AppearanceSettingsView({
  theme,
  colorSchemeId,
  language,
  agentResponseLanguage,
  appendSelectedTextToRecommendation,
  config,
  error,
  themeOptions,
  colorSchemeOptions,
  languageOptions,
  responseLanguageOptions,
  currentThemeLabel,
  currentColorSchemeLabel,
  workspaceSummary,
  loadConfig,
  handleThemeChange,
  handleColorSchemeChange,
  handleRandomColorScheme,
  handleLanguageChange,
  handleAgentResponseLanguageChange,
  handleRecommendationSelectionToggle,
}: AppearanceSettingsViewProps) {
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-6 pb-8">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-[20px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm shadow-slate-950/5">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
          >
            {t("settings.appearance.action.reload", "重新加载")}
          </button>
        </div>
      ) : null}

      <section className="rounded-[26px] border border-slate-200/80 bg-white px-5 py-3.5 shadow-sm shadow-slate-950/5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
                {t("settings.appearance.hero.title", "外观")}
              </h1>
              <WorkbenchInfoTip
                ariaLabel={t(
                  "settings.appearance.hero.tipAria",
                  "外观设置总览说明",
                )}
                content={t(
                  "settings.appearance.hero.tip",
                  "管理主题、界面语言、回复语言，以及推荐问题的上下文带入方式。",
                )}
                tone="mint"
              />
            </div>
            <p className="text-[13px] text-slate-500">
              {t(
                "settings.appearance.hero.description",
                "管理主题、界面语言、回复语言和推荐行为。",
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
            <span className={HEADER_INFO_PILL_CLASS}>
              {t("settings.appearance.summary.theme", {
                theme: workspaceSummary.themeLabel,
                defaultValue: "主题：{{theme}}",
              })}
            </span>
            <span className={HEADER_SUCCESS_PILL_CLASS}>
              {t("settings.appearance.summary.colorScheme", {
                colorScheme: workspaceSummary.colorSchemeLabel,
                defaultValue: "配色：{{colorScheme}}",
              })}
            </span>
            <span className={HEADER_SUCCESS_PILL_CLASS}>
              {t("settings.appearance.summary.language", {
                language: workspaceSummary.languageLabel,
                defaultValue: "语言：{{language}}",
              })}
            </span>
            <span className={HEADER_INFO_PILL_CLASS}>
              {t("settings.appearance.summary.responseLanguage", {
                language: workspaceSummary.responseLanguageLabel,
                defaultValue: "回复：{{language}}",
              })}
            </span>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
        <SurfacePanel
          icon={Palette}
          iconClassName="text-sky-600"
          title={t("settings.appearance.base.title", "基础外观")}
          description={t(
            "settings.appearance.base.description",
            "先确定全局主题、界面语言和回复语言，再统一工作区里的视觉节奏。",
          )}
          tipAriaLabel={t("settings.appearance.base.tipAria", "基础外观说明")}
        >
          <div className="space-y-5">
            <div
              data-settings-search-target="appearance-theme"
              tabIndex={-1}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t("settings.appearance.theme.title", "主题模式")}
                    </h3>
                    <WorkbenchInfoTip
                      ariaLabel={t(
                        "settings.appearance.theme.tipAria",
                        "主题模式说明",
                      )}
                      content={t(
                        "settings.appearance.theme.tip",
                        "优先控制整个应用的明暗观感，适配不同设备环境。",
                      )}
                      tone="slate"
                    />
                  </div>
                </div>
                <span className={CURRENT_INFO_PILL_CLASS}>
                  {t("settings.appearance.current.theme", {
                    theme: currentThemeLabel,
                    defaultValue: "当前：{{theme}}",
                  })}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {themeOptions.map((option) => {
                  const active = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleThemeChange(option.id)}
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-left transition shadow-sm",
                        active
                          ? ACTIVE_OPTION_CARD_CLASS
                          : INACTIVE_OPTION_CARD_CLASS,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-current/10 bg-current/10">
                          <option.icon className="h-5 w-5" />
                        </div>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <p className="mt-4 text-sm font-semibold">
                        {option.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs leading-5",
                          active ? "text-slate-600" : "text-slate-500",
                        )}
                      >
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-settings-search-target="appearance-skin"
              tabIndex={-1}
              className="rounded-[24px] border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface-soft)] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[color:var(--lime-text-strong)]">
                      {t("settings.appearance.colorScheme.title", "全局皮肤")}
                    </h3>
                    <WorkbenchInfoTip
                      ariaLabel={t(
                        "settings.appearance.colorScheme.tipAria",
                        "全局皮肤说明",
                      )}
                      content={t(
                        "settings.appearance.colorScheme.tip",
                        "同时切换应用外壳、侧栏、主舞台、卡片和输入区；明暗观感仍由主题模式控制。",
                      )}
                      tone="slate"
                    />
                  </div>
                </div>
                <span className={CURRENT_SUCCESS_PILL_CLASS}>
                  {t("settings.appearance.current.colorScheme", {
                    colorScheme: currentColorSchemeLabel,
                    defaultValue: "当前：{{colorScheme}}",
                  })}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={handleRandomColorScheme}
                  className={cn(
                    "rounded-[20px] border px-4 py-4 text-left shadow-sm transition",
                    INACTIVE_OPTION_CARD_CLASS,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] text-[color:var(--lime-brand-strong)]">
                      <Shuffle className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-semibold">
                    {t("settings.appearance.colorScheme.random.title", "随机")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--lime-text-muted)]">
                    {t(
                      "settings.appearance.colorScheme.random.description",
                      "每次点击随机切换一套全局皮肤。",
                    )}
                  </p>
                </button>
                {colorSchemeOptions.map((option) => {
                  const active = colorSchemeId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleColorSchemeChange(option.id)}
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-left shadow-sm transition",
                        active
                          ? ACTIVE_OPTION_CARD_CLASS
                          : INACTIVE_OPTION_CARD_CLASS,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          {option.swatches.map((swatch) => (
                            <span
                              key={swatch}
                              aria-hidden="true"
                              className="h-5 w-5 rounded-full border border-white/80 shadow-sm shadow-slate-950/10"
                              style={{ backgroundColor: swatch }}
                            />
                          ))}
                        </div>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <p className="mt-4 text-sm font-semibold">
                        {option.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-xs leading-5",
                          active
                            ? "text-[color:var(--lime-text)]"
                            : "text-[color:var(--lime-text-muted)]",
                        )}
                      >
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-settings-search-target="appearance-language"
              tabIndex={-1}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {t("settings.appearance.language.title", "界面语言")}
                      </h3>
                      <WorkbenchInfoTip
                        ariaLabel={t("settings.appearance.language.tipAria", {
                          title: t(
                            "settings.appearance.language.title",
                            "界面语言",
                          ),
                          defaultValue: "{{title}}说明",
                        })}
                        content={t(
                          "settings.appearance.language.tip",
                          "切换设置、工作区与提示文案的主要显示语言。",
                        )}
                        tone="slate"
                      />
                    </div>
                  </div>
                </div>
                <span className={CURRENT_SUCCESS_PILL_CLASS}>
                  {t("settings.appearance.language.current", {
                    language: resolveLocaleOptionLabel(language),
                    defaultValue: "当前：{{language}}",
                  })}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {languageOptions.map((option) => {
                  const active = language === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!config}
                      onClick={() => void handleLanguageChange(option.id)}
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-left transition shadow-sm",
                        active
                          ? ACTIVE_OPTION_CARD_CLASS
                          : INACTIVE_OPTION_CARD_CLASS,
                        !config && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{option.label}</p>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs leading-5",
                          active ? "text-slate-600" : "text-slate-500",
                        )}
                      >
                        {option.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-settings-search-target="appearance-response-language"
              tabIndex={-1}
              className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {t(
                          "settings.appearance.responseLanguage.title",
                          "回复语言",
                        )}
                      </h3>
                      <WorkbenchInfoTip
                        ariaLabel={t(
                          "settings.appearance.responseLanguage.tipAria",
                          "回复语言说明",
                        )}
                        content={t(
                          "settings.appearance.responseLanguage.tip",
                          "控制对话默认回复语言；不影响界面语言、浏览器站点语言或内容产物目标语言。",
                        )}
                        tone="slate"
                      />
                    </div>
                  </div>
                </div>
                <span className={CURRENT_INFO_PILL_CLASS}>
                  {t("settings.appearance.responseLanguage.current", {
                    language: workspaceSummary.responseLanguageLabel,
                    defaultValue: "当前：{{language}}",
                  })}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {responseLanguageOptions.map((option) => {
                  const active = agentResponseLanguage === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={!config}
                      onClick={() =>
                        void handleAgentResponseLanguageChange(option.id)
                      }
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-left transition shadow-sm",
                        active
                          ? ACTIVE_OPTION_CARD_CLASS
                          : INACTIVE_OPTION_CARD_CLASS,
                        !config && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{option.label}</p>
                        {active ? <Check className="h-4 w-4" /> : null}
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs leading-5",
                          active ? "text-slate-600" : "text-slate-500",
                        )}
                      >
                        {option.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SurfacePanel>
      </section>

      <SurfacePanel
        icon={Sparkles}
        iconClassName="text-emerald-600"
        title={t("settings.appearance.recommendation.title", "推荐行为")}
        description={t(
          "settings.appearance.recommendation.description",
          "控制推荐问题是否自动带上当前选中内容，减少重复粘贴上下文。",
        )}
        tipAriaLabel={t(
          "settings.appearance.recommendation.tipAria",
          "推荐行为说明",
        )}
      >
        <article className="rounded-[24px] border border-slate-200/80 bg-slate-50/60 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t(
                      "settings.appearance.recommendation.innerTitle",
                      "推荐行为",
                    )}
                  </h3>
                  <WorkbenchInfoTip
                    ariaLabel={t(
                      "settings.appearance.recommendation.innerTipAria",
                      "推荐行为说明",
                    )}
                    content={t(
                      "settings.appearance.recommendation.innerTip",
                      "控制首页推荐问题是否自动带上当前选中内容，减少重复粘贴上下文。",
                    )}
                    tone="slate"
                  />
                </div>
              </div>
            </div>

            <div
              data-settings-search-target="appearance-recommendation"
              tabIndex={-1}
              className="rounded-[20px] border border-slate-200 bg-white/80 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {t(
                        "settings.appearance.recommendation.appendSelected.title",
                        "推荐自动附带选中内容",
                      )}
                    </h4>
                    <WorkbenchInfoTip
                      ariaLabel={t(
                        "settings.appearance.recommendation.appendSelected.tipAria",
                        "推荐自动附带选中内容说明",
                      )}
                      content={t(
                        "settings.appearance.recommendation.appendSelected.tip",
                        "在文档或画布中有选区时，推荐问题会自动把该段内容作为上下文带入，减少手工复制粘贴。",
                      )}
                      tone="slate"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      appendSelectedTextToRecommendation
                        ? CURRENT_SUCCESS_PILL_CLASS
                        : CONTEXT_STATUS_PILL_CLASS
                    }
                  >
                    {appendSelectedTextToRecommendation
                      ? t("settings.appearance.status.enabled", "已开启")
                      : t("settings.appearance.status.disabled", "已关闭")}
                  </span>
                  <Switch
                    checked={appendSelectedTextToRecommendation}
                    onCheckedChange={(checked) => {
                      void handleRecommendationSelectionToggle(checked);
                    }}
                    aria-label={t(
                      "settings.appearance.recommendation.appendSelected.toggleAria",
                      "切换推荐自动附带选中内容",
                    )}
                    disabled={!config}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>
      </SurfacePanel>
    </div>
  );
}
