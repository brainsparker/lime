import type { TFunction } from "i18next";
import type { SettingsTabs } from "@/types/settings";
import type { CategoryGroup } from "./hooks/useSettingsCategory";
import { settingsSearchDocuments } from "./settingsSearchDocuments";

export interface SettingsSearchResult {
  section: SettingsTabs;
  label: string;
  panelLabel: string;
  targetId?: string;
}

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().trim();

export function isSettingsSearchTarget(
  section: SettingsTabs,
  targetId: string,
  localProfile: boolean,
): boolean {
  return Boolean(getSettingsSearchDocument(section, targetId, localProfile));
}

export function getSettingsSearchDocument(
  section: SettingsTabs,
  targetId: string | undefined,
  localProfile: boolean,
) {
  return settingsSearchDocuments.find(
    (document) =>
      document.section === section &&
      document.targetId === targetId &&
      (!document.localProfile || localProfile),
  );
}

export function searchSettings(
  query: string,
  groups: CategoryGroup[],
  t: TFunction<"settings", undefined>,
  localProfile: boolean,
): SettingsSearchResult[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const matches = (value: string) => {
    const text = normalize(value);
    return terms.every((term) => text.includes(term));
  };
  const results: Array<SettingsSearchResult & { score: number }> = [];
  for (const group of groups) {
    for (const item of group.items) {
      const panel = { section: item.key, panelLabel: item.label };
      if (matches(item.label) || matches(group.title)) {
        results.push({ ...panel, label: item.label, score: 3 });
        continue;
      }
      let best: (SettingsSearchResult & { score: number }) | undefined;
      for (const document of settingsSearchDocuments) {
        if (
          document.section !== item.key ||
          (document.localProfile && !localProfile)
        )
          continue;
        const label = t(document.labelKey);
        const text = [
          item.label,
          label,
          ...document.termKeys.map((key) => t(key)),
        ].join(" ");
        if (!matches(text)) continue;
        const score = matches(label) ? 2 : 1;
        if (!best || score > best.score) {
          best = { ...panel, label, targetId: document.targetId, score };
        }
      }
      if (best) results.push(best);
    }
  }
  return results
    .sort((a, b) => b.score - a.score)
    .map(({ score: _score, ...result }) => result);
}
