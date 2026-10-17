import { SettingsTabs } from "@/types/settings";

interface SettingsSearchDocument {
  section: SettingsTabs;
  targetId: string;
  labelKey: string;
  termKeys: readonly string[];
  localProfile?: boolean;
  path?: string;
}

// 只登记 current 页面上的静态消息；不索引用户资料、配置值或凭证。
export const settingsSearchDocuments: readonly SettingsSearchDocument[] = [
  {
    section: SettingsTabs.Profile,
    targetId: "profile-displayName",
    labelKey: "settings.profile.field.displayName.label",
    termKeys: ["settings.profile.field.displayName.placeholder"],
    localProfile: true,
  },
  {
    section: SettingsTabs.Profile,
    targetId: "profile-bio",
    labelKey: "settings.profile.field.bio.label",
    termKeys: ["settings.profile.field.bio.placeholder"],
    localProfile: true,
  },
  ...(["enable", "timeout"] as const).map((field) => ({
    section: SettingsTabs.Environment,
    targetId: `environment-shell-${field}`,
    labelKey: `settings.environment.shellImport.${field}.label`,
    termKeys: [`settings.environment.shellImport.${field}.tip`],
  })),
  {
    section: SettingsTabs.Environment,
    targetId: "environment-overrides",
    labelKey: "settings.environment.overrides.title",
    termKeys: ["settings.environment.overrides.description"],
  },
  ...(["workspace", "plan", "shell", "network"] as const).map((field) => ({
    section: SettingsTabs.ExecutionPolicy,
    targetId: `execution-policy-${field}`,
    labelKey: `settings.executionPolicy.${field}.title`,
    termKeys: [`settings.executionPolicy.${field}.description`],
  })),
  ...(
    [
      ["search", "engine", "searchChain.engine", true],
      ["search", "provider", "searchChain.provider", false],
      ["search", "provider-priority", "searchChain.providerPriority", true],
      ["providers", "tavily-key", "providers.tavily", true],
      ["providers", "bing-key", "providers.bing", true],
      ["providers", "google-key", "providers.googleApi", true],
      ["providers", "google-engine-id", "providers.googleEngine", true],
      ["mse", "mse-priority", "mse.priority", false],
      ["mse", "mse-max-per-engine", "mse.maxPerEngine", false],
      ["mse", "mse-max-total", "mse.maxTotal", false],
      ["mse", "mse-timeout", "mse.timeout", false],
      ["mse", "mse-custom-engine-name", "mse.customName", false],
      ["mse", "mse-custom-engine-template", "mse.customTemplate", false],
      ["images", "pexels-key", "images.pexels", true],
      ["images", "pixabay-key", "images.pixabay", true],
    ] as const
  ).map(([path, field, message, hasHint]) => ({
    section: SettingsTabs.WebSearch,
    targetId: `web-search-${field}`,
    path,
    labelKey: `settings.webSearch.${message}.label`,
    termKeys: hasHint ? [`settings.webSearch.${message}.hint`] : [],
  })),
  ...(
    [
      ["memory", "enabled", "toggle.aria", "hero.description"],
      ["memory", "store", "everyday.title", "everyday.description"],
      [
        "soul",
        "style",
        "soul.styleProfile.title",
        "soul.styleProfile.description",
      ],
      ["soul", "templates", "soul.template.title", "soul.template.description"],
      [
        "advanced",
        "embedding",
        "embedding.providerSelect.title",
        "embedding.providerSelect.description",
      ],
      ["advanced", "export", "soul.export.title", "soul.export.description"],
      ["advanced", "import", "soul.import.title", "soul.import.description"],
    ] as const
  ).map(([path, field, label, description]) => ({
    section: SettingsTabs.Memory,
    targetId: `memory-${field}`,
    path,
    labelKey: `settings.memory.${label}`,
    termKeys: [`settings.memory.${description}`],
  })),
  ...(
    [
      ["theme", "theme"],
      ["skin", "colorScheme"],
      ["language", "language"],
      ["response-language", "responseLanguage"],
      ["recommendation", "recommendation.appendSelected"],
    ] as const
  ).map(([field, message]) => ({
    section: SettingsTabs.Appearance,
    targetId: `appearance-${field}`,
    labelKey: `settings.appearance.${message}.title`,
    termKeys: [`settings.appearance.${message}.tip`],
  })),
];
