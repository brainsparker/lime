import { describe, expect, it } from "vitest";
import { getLimeI18n } from "@/i18n/createI18n";
import { SettingsTabs } from "@/types/settings";
import { settingsSections } from "./sections";
import type { CategoryGroup } from "./hooks/useSettingsCategory";
import { searchSettings, isSettingsSearchTarget } from "./settingsSearch";
import { settingsSearchDocuments } from "./settingsSearchDocuments";

const localize = (locale = "en-US") => {
  const t = getLimeI18n().getFixedT(locale, "settings");
  const groups: CategoryGroup[] = [];
  for (const section of settingsSections) {
    let group = groups.find((value) => value.key === section.group);
    if (!group) {
      group = {
        key: section.group,
        title: t(`settings.group.${section.group}`),
        items: [],
      };
      groups.push(group);
    }
    group.items.push({
      key: section.key,
      label: t(section.labelKey),
      icon: section.icon,
    });
  }
  return { t, groups };
};
const search = (query: string, localProfile = true) => {
  const { t, groups } = localize();
  return searchSettings(query, groups, t, localProfile);
};

describe("current settings search projection", () => {
  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s resolves current static targets with existing messages",
    (locale) => {
      const { t, groups } = localize(locale);
      for (const document of settingsSearchDocuments) {
        expect(t(document.labelKey)).not.toBe(document.labelKey);
        for (const key of document.termKeys) expect(t(key)).not.toBe(key);
        expect(
          searchSettings(t(document.labelKey), groups, t, true),
        ).toContainEqual(
          expect.objectContaining({
            section: document.section,
            targetId: document.targetId,
          }),
        );
      }
    },
  );
  it("matches descriptions and multiple words from the same target and panel", () => {
    const { t } = localize();
    const description = t("settings.environment.overrides.description");
    expect(search(description)).toContainEqual(
      expect.objectContaining({ targetId: "environment-overrides" }),
    );
    expect(search("profile bio")).toContainEqual(
      expect.objectContaining({ targetId: "profile-bio" }),
    );
    expect(search("display bio")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });
  it("normalizes width and case, prioritizes panel titles and returns one result per panel", () => {
    const results = search("ＰＲＯＦＩＬＥ");
    expect(results[0]).toMatchObject({ section: SettingsTabs.Profile });
    expect(results[0].targetId).toBeUndefined();
    const broad = search("a");
    expect(new Set(broad.map((result) => result.section)).size).toBe(
      broad.length,
    );
  });
  it("derives titles from all current sections, with no extra section registry", () => {
    const { t, groups } = localize();
    for (const section of settingsSections) {
      expect(
        searchSettings(t(section.labelKey), groups, t, false),
      ).toContainEqual({
        section: section.key,
        label: t(section.labelKey),
        panelLabel: t(section.labelKey),
      });
    }
    expect(search("fixture private profile value")).toEqual([]);
  });
  it("excludes local fields in managed account mode but preserves the Profile title", () => {
    expect(search("bio", false)).toEqual([]);
    expect(search("profile", false)).toContainEqual(
      expect.objectContaining({ section: SettingsTabs.Profile }),
    );
    expect(
      isSettingsSearchTarget(SettingsTabs.Profile, "profile-bio", false),
    ).toBe(false);
  });
  it("rejects unknown, cross-section and selector-shaped targets", () => {
    expect(
      isSettingsSearchTarget(SettingsTabs.Profile, "profile-bio", true),
    ).toBe(true);
    for (const target of [
      "missing",
      "environment-overrides",
      'profile-bio"] input, *',
    ]) {
      expect(isSettingsSearchTarget(SettingsTabs.Profile, target, true)).toBe(
        false,
      );
    }
  });
});
