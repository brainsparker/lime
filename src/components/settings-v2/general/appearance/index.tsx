/**
 * @file index.tsx
 * @description 通用设置 - 外观与推荐行为
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { getConfig, saveConfig, type Config } from "@/lib/api/appConfig";
import { useI18nPatch } from "@/i18n/legacy-patch/I18nPatchProvider";
import { changeLimeLocale } from "@/i18n/createI18n";
import {
  UI_LOCALE_OPTIONS,
  normalizeLocalePreference,
  resolveLocaleOptionLabel,
  toLegacyPatchLanguage,
  type LocalePreference,
} from "@/i18n/locales";
import { useTranslation } from "react-i18next";
import {
  LIME_COLOR_SCHEME_CHANGED_EVENT,
  LIME_COLOR_SCHEMES,
  LIME_COLOR_SCHEME_STORAGE_KEY,
  applyLimeColorScheme,
  getLimeColorScheme,
  loadLimeColorSchemeId,
  persistLimeColorScheme,
  type LimeColorSchemeChangedEventDetail,
  type LimeColorSchemeId,
} from "@/lib/appearance/colorSchemes";
import {
  LIME_THEME_CHANGED_EVENT,
  LIME_THEME_MODE_OPTIONS,
  LIME_THEME_STORAGE_KEY,
  applyLimeThemeMode,
  loadLimeThemeMode,
  persistLimeThemeMode,
  type LimeThemeChangedEventDetail,
  type LimeThemeMode,
} from "@/lib/appearance/themeMode";

import {
  AppearanceSettingsView,
  AppearanceLoadingSkeleton,
  type ThemeOption,
  type LanguageOption,
} from "./AppearanceSettingsView";

const THEME_OPTION_ICONS: Record<LimeThemeMode, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

function resolveResponseLanguageOptionLabel(
  preference: LocalePreference,
  t: ReturnType<typeof useTranslation<"settings">>["t"],
): string {
  if (preference === "auto") {
    return t(
      "settings.appearance.responseLanguage.options.auto.label",
      "自动判断",
    );
  }

  return resolveLocaleOptionLabel(preference);
}

export function AppearanceSettings() {
  const { t } = useTranslation("settings");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<LimeThemeMode>("system");
  const [colorSchemeId, setColorSchemeId] =
    useState<LimeColorSchemeId>("dream-blossom");
  const [language, setLanguageState] = useState<LocalePreference>("zh-CN");
  const [agentResponseLanguage, setAgentResponseLanguage] =
    useState<LocalePreference>("auto");
  const [
    appendSelectedTextToRecommendation,
    setAppendSelectedTextToRecommendation,
  ] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { setLanguage: setI18nLanguage } = useI18nPatch();

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedConfig = await getConfig();
      setConfig(loadedConfig);
      setLanguageState(normalizeLocalePreference(loadedConfig.language));
      setAgentResponseLanguage(
        normalizeLocalePreference(
          loadedConfig.workspace_preferences?.agent_response_language,
        ),
      );
      setAppendSelectedTextToRecommendation(
        loadedConfig.chat_appearance?.append_selected_text_to_recommendation ??
          true,
      );
    } catch (err) {
      console.error("加载外观设置失败:", err);
      setError(
        t("settings.appearance.error.load", "加载外观设置失败，请稍后重试。"),
      );
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const refreshAppearance = () => {
      const nextTheme = loadLimeThemeMode();
      const nextColorSchemeId = loadLimeColorSchemeId();
      setTheme(nextTheme);
      setColorSchemeId(nextColorSchemeId);
      applyLimeThemeMode(nextTheme);
      applyLimeColorScheme(nextColorSchemeId);
    };

    const handleThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<LimeThemeChangedEventDetail>).detail;
      setTheme(detail?.themeMode ?? loadLimeThemeMode());
    };

    const handleColorSchemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<LimeColorSchemeChangedEventDetail>)
        .detail;
      setColorSchemeId(detail?.colorSchemeId ?? loadLimeColorSchemeId());
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (
        event.key === LIME_THEME_STORAGE_KEY ||
        event.key === LIME_COLOR_SCHEME_STORAGE_KEY
      ) {
        refreshAppearance();
      }
    };

    refreshAppearance();
    void loadConfig();

    window.addEventListener(LIME_THEME_CHANGED_EVENT, handleThemeChanged);
    window.addEventListener(
      LIME_COLOR_SCHEME_CHANGED_EVENT,
      handleColorSchemeChanged,
    );
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      window.removeEventListener(LIME_THEME_CHANGED_EVENT, handleThemeChanged);
      window.removeEventListener(
        LIME_COLOR_SCHEME_CHANGED_EVENT,
        handleColorSchemeChanged,
      );
      window.removeEventListener("storage", handleStorageChanged);
    };
  }, [loadConfig]);

  const themeOptions = useMemo<ThemeOption[]>(
    () =>
      LIME_THEME_MODE_OPTIONS.map((option) => ({
        id: option.id,
        icon: THEME_OPTION_ICONS[option.id],
        label: t(
          `settings.appearance.theme.options.${option.id}.label`,
          option.label,
        ),
        description: t(
          `settings.appearance.theme.options.${option.id}.description`,
          option.description,
        ),
      })),
    [t],
  );

  const colorSchemeOptions = useMemo(
    () =>
      LIME_COLOR_SCHEMES.map((option) => ({
        ...option,
        label: t(
          `settings.appearance.colorScheme.options.${option.id}.label`,
          option.label,
        ),
        description: t(
          `settings.appearance.colorScheme.options.${option.id}.description`,
          option.description,
        ),
      })),
    [t],
  );

  const currentThemeLabel =
    themeOptions.find((option) => option.id === theme)?.label ??
    t("settings.appearance.theme.options.system.label", "跟随系统");
  const currentColorSchemeLabel =
    colorSchemeOptions.find((option) => option.id === colorSchemeId)?.label ??
    getLimeColorScheme(colorSchemeId).label;

  const workspaceSummary = useMemo(
    () => ({
      themeLabel: currentThemeLabel,
      colorSchemeLabel: currentColorSchemeLabel,
      languageLabel: resolveLocaleOptionLabel(language),
      responseLanguageLabel: resolveResponseLanguageOptionLabel(
        agentResponseLanguage,
        t,
      ),
    }),
    [
      agentResponseLanguage,
      currentColorSchemeLabel,
      currentThemeLabel,
      language,
      t,
    ],
  );

  const languageOptions = useMemo<LanguageOption[]>(
    () =>
      UI_LOCALE_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        hint: t(option.hintKey, option.fallbackHint),
      })),
    [t],
  );
  const responseLanguageOptions = useMemo<LanguageOption[]>(
    () =>
      UI_LOCALE_OPTIONS.map((option) => ({
        id: option.id,
        label:
          option.id === "auto"
            ? t(
                "settings.appearance.responseLanguage.options.auto.label",
                "自动判断",
              )
            : option.label,
        hint: t(
          `settings.appearance.responseLanguage.options.${option.id}.hint`,
          option.id === "auto"
            ? "根据最近输入和当前上下文选择回复语言。"
            : option.fallbackHint,
        ),
      })),
    [t],
  );

  const handleThemeChange = useCallback((nextTheme: LimeThemeMode) => {
    const resolvedTheme = persistLimeThemeMode(nextTheme);
    setTheme(resolvedTheme);
  }, []);

  const handleColorSchemeChange = useCallback(
    (nextColorSchemeId: LimeColorSchemeId) => {
      const resolvedId = persistLimeColorScheme(nextColorSchemeId);
      setColorSchemeId(resolvedId);
    },
    [],
  );

  const handleRandomColorScheme = useCallback(() => {
    const candidates = LIME_COLOR_SCHEMES.filter(
      (scheme) => scheme.id !== colorSchemeId,
    );
    const nextScheme =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      LIME_COLOR_SCHEMES[0];
    handleColorSchemeChange(nextScheme.id);
  }, [colorSchemeId, handleColorSchemeChange]);

  const handleLanguageChange = useCallback(
    async (nextLanguage: LocalePreference) => {
      if (!config) {
        return;
      }

      const previousConfig = config;
      const previousLanguage = language;
      const nextConfig = {
        ...config,
        language: nextLanguage,
      };

      setError(null);
      setConfig(nextConfig);
      setLanguageState(nextLanguage);
      setI18nLanguage(toLegacyPatchLanguage(nextLanguage));

      try {
        await changeLimeLocale(nextLanguage);
        await saveConfig(nextConfig);
      } catch (err) {
        console.error("保存语言设置失败:", err);
        setConfig(previousConfig);
        setLanguageState(previousLanguage);
        setI18nLanguage(toLegacyPatchLanguage(previousLanguage));
        await changeLimeLocale(previousLanguage);
        setError(
          t(
            "settings.appearance.error.saveLanguage",
            "保存语言设置失败，请重试。",
          ),
        );
      }
    },
    [config, language, setI18nLanguage, t],
  );

  const handleAgentResponseLanguageChange = useCallback(
    async (nextLanguage: LocalePreference) => {
      if (!config) {
        return;
      }

      const previousConfig = config;
      const previousLanguage = agentResponseLanguage;
      const nextConfig: Config = {
        ...config,
        workspace_preferences: {
          ...(config.workspace_preferences || {}),
          agent_response_language: nextLanguage,
        },
      };

      setError(null);
      setConfig(nextConfig);
      setAgentResponseLanguage(nextLanguage);

      try {
        await saveConfig(nextConfig);
      } catch (err) {
        console.error("保存回复语言设置失败:", err);
        setConfig(previousConfig);
        setAgentResponseLanguage(previousLanguage);
        setError(
          t(
            "settings.appearance.error.saveResponseLanguage",
            "保存回复语言设置失败，请重试。",
          ),
        );
      }
    },
    [agentResponseLanguage, config, t],
  );

  const handleRecommendationSelectionToggle = useCallback(
    async (checked: boolean) => {
      if (!config) {
        return;
      }

      const previousValue = appendSelectedTextToRecommendation;
      const previousConfig = config;
      const nextConfig = {
        ...config,
        chat_appearance: {
          ...(config.chat_appearance || {}),
          append_selected_text_to_recommendation: checked,
        },
      };

      setError(null);
      setAppendSelectedTextToRecommendation(checked);
      setConfig(nextConfig);

      try {
        await saveConfig(nextConfig);
        window.dispatchEvent(new CustomEvent("chat-appearance-config-changed"));
      } catch (err) {
        console.error("保存推荐上下文设置失败:", err);
        setAppendSelectedTextToRecommendation(previousValue);
        setConfig(previousConfig);
        setError(
          t(
            "settings.appearance.error.saveChatAppearance",
            "保存聊天外观设置失败，请重试。",
          ),
        );
      }
    },
    [appendSelectedTextToRecommendation, config, t],
  );

  if (loading) {
    return <AppearanceLoadingSkeleton />;
  }

  return (
    <AppearanceSettingsView
      theme={theme}
      colorSchemeId={colorSchemeId}
      language={language}
      agentResponseLanguage={agentResponseLanguage}
      appendSelectedTextToRecommendation={appendSelectedTextToRecommendation}
      config={Boolean(config)}
      error={error}
      themeOptions={themeOptions}
      colorSchemeOptions={colorSchemeOptions}
      languageOptions={languageOptions}
      responseLanguageOptions={responseLanguageOptions}
      currentThemeLabel={currentThemeLabel}
      currentColorSchemeLabel={currentColorSchemeLabel}
      workspaceSummary={workspaceSummary}
      loadConfig={loadConfig}
      handleThemeChange={handleThemeChange}
      handleColorSchemeChange={handleColorSchemeChange}
      handleRandomColorScheme={handleRandomColorScheme}
      handleLanguageChange={handleLanguageChange}
      handleAgentResponseLanguageChange={handleAgentResponseLanguageChange}
      handleRecommendationSelectionToggle={handleRecommendationSelectionToggle}
    />
  );
}
