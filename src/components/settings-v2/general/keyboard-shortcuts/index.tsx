import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getRegisteredCommands, subscribeCommands } from "@/lib/commands/registry";
import { formatShortcutTokens, resolveHotkeyPlatform } from "@/lib/hotkeys/platform";
import { useDesktopPreferences } from "@/hooks/useDesktopPreferences";
import { effectiveDesktopPreferences } from "@/lib/api/desktopPreferences";
import type { ExternalBrowserLinkShortcut } from "@/lib/api/appConfigTypes";
import { PreferenceMenu } from "../browser/PreferenceMenu";

export function KeyboardShortcutsSettings() {
  const { t } = useTranslation("settings");
  const { t: navigation } = useTranslation("navigation");
  const { configured, error, pending, refresh, save } = useDesktopPreferences();
  const [query, setQuery] = useState("");
  const commands = useSyncExternalStore(subscribeCommands, getRegisteredCommands, getRegisteredCommands);
  const platform = resolveHotkeyPlatform(typeof navigator === "undefined" ? undefined : navigator);
  const primary = platform === "mac" ? "⌘" : "Ctrl";
  const alt = platform === "mac" ? "⌥" : "Alt";
  const click = t("settings.keyboardShortcuts.click");
  const options: { value: ExternalBrowserLinkShortcut; label: string }[] = [
    { value: "unassigned", label: t("settings.keyboardShortcuts.unassigned") },
    { value: "primary", label: `${primary}+${click}` },
    { value: "alt", label: `${alt}+${click}` },
    { value: "primary-shift", label: `${platform === "mac" ? "⇧⌘" : "Ctrl+Shift"}+${click}` },
  ];
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase();
  const matches = (text: string) => text.normalize("NFKC").toLocaleLowerCase().includes(needle);
  const title = t("settings.keyboardShortcuts.externalLink");
  const description = t("settings.keyboardShortcuts.externalLinkDescription");
  const filtered = commands.filter((command) => matches(`${navigation(command.titleKey)} ${command.descriptionKey ? navigation(command.descriptionKey) : ""}`));
  return <div className="space-y-6 pb-8" aria-busy={pending}>
    <h1 className="text-xl font-semibold">{t("settings.tab.keyboardShortcuts")}</h1>
    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("settings.keyboardShortcuts.search")} placeholder={t("settings.keyboardShortcuts.search")} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    {error ? <div role="alert" className="text-sm text-destructive">
      {t(error === "save" ? "settings.keyboardShortcuts.saveError" : "settings.browser.error.load")}
      {error === "load" ? <button type="button" onClick={() => void refresh()} className="ml-3">{t("settings.browser.retry")}</button> : null}
    </div> : null}
    <div>
      {filtered.map((command) => <div key={command.id} className="flex min-h-14 items-center justify-between gap-6 border-b border-border py-3 text-sm">
        <span>{navigation(command.titleKey)}</span>
        <span className="flex gap-3">{command.bindings.map((binding) => <kbd key={binding} className="rounded border border-border px-2 py-1 text-xs">{formatShortcutTokens(binding, platform).join(" ")}</kbd>)}</span>
      </div>)}
      {matches(`${title} ${description}`) ? <PreferenceMenu label={title} description={description} targetId="keyboard-external-browser-link" value={effectiveDesktopPreferences(configured ?? undefined)["external-browser-link-shortcut"]} options={options} disabled={!configured || pending} onChange={(value) => void save("external-browser-link-shortcut", value)} /> : null}
    </div>
  </div>;
}
