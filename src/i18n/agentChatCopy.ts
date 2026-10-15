import i18n from "i18next";
import { limeI18nResources } from "./createI18n";
import {
  FALLBACK_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "./locales";

function interpolateCopy(
  text: string,
  values: Record<string, unknown>,
): string {
  return Object.entries(values).reduce(
    (nextText, [name, value]) =>
      nextText.split(`{{${name}}}`).join(String(value ?? "")),
    text,
  );
}

function resolveCurrentLocale(): SupportedLocale {
  const documentLocale =
    typeof document !== "undefined" ? document.documentElement.lang : "";
  return normalizeLocale(
    documentLocale ||
      (i18n.isInitialized ? i18n.language : "") ||
      FALLBACK_LOCALE,
  );
}

function normalizeTranslatedCopy(
  value: unknown,
  fullKey: string,
): string | null {
  if (
    typeof value === "string" &&
    value.trim() &&
    value !== fullKey &&
    value !== "undefined"
  ) {
    return value;
  }

  return null;
}

export function resolveAgentChatCopy(
  key: string,
  defaultValue: string,
  values: Record<string, unknown> = {},
): string {
  const fullKey = `agentChat.${key}`;
  const locale = resolveCurrentLocale();
  const localeResource = limeI18nResources[locale].agent;
  const translated = localeResource[fullKey as keyof typeof localeResource];
  const text = normalizeTranslatedCopy(translated, fullKey) ?? defaultValue;
  return interpolateCopy(text, values);
}

export function resolveRequiredAgentChatCopy(
  key: string,
  values: Record<string, unknown> = {},
): string {
  const fullKey = `agentChat.${key}`;
  const locale = resolveCurrentLocale();
  const localeResource = limeI18nResources[locale].agent;
  const sourceResource =
    locale === FALLBACK_LOCALE
      ? localeResource
      : limeI18nResources[FALLBACK_LOCALE].agent;
  const resourceFallback =
    localeResource[fullKey] ?? sourceResource[fullKey] ?? fullKey;
  const translated = localeResource[fullKey] ?? resourceFallback;
  const text =
    normalizeTranslatedCopy(translated, fullKey) ??
    normalizeTranslatedCopy(resourceFallback, fullKey) ??
    fullKey;
  return interpolateCopy(text, values);
}
