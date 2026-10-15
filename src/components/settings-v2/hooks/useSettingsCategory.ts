/**
 * 将 current 设置章节投影为已翻译的分组导航。
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import type { SettingsGroupKey, SettingsTabs } from "@/types/settings";
import { settingsSections } from "../sections";

export interface CategoryItem {
  key: SettingsTabs;
  label: string;
  icon: LucideIcon;
  experimental?: boolean;
}

export interface CategoryGroup {
  key: SettingsGroupKey;
  title: string;
  items: CategoryItem[];
}

export function useSettingsCategory(): CategoryGroup[] {
  const { t } = useTranslation("settings");
  return useMemo(() => {
    const groups = new Map<SettingsGroupKey, CategoryGroup>();
    for (const section of settingsSections) {
      let group = groups.get(section.group);
      if (!group) {
        group = {
          key: section.group,
          title: t(`settings.group.${section.group}`),
          items: [],
        };
        groups.set(section.group, group);
      }
      group.items.push({
        key: section.key,
        label: t(section.labelKey),
        icon: section.icon,
        ...(section.experimental ? { experimental: true } : {}),
      });
    }
    return [...groups.values()];
  }, [t]);
}
