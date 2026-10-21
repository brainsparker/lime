import { useTranslation } from "react-i18next";
import { useDesktopPreferences } from "@/hooks/useDesktopPreferences";
import { effectiveDesktopPreferences } from "@/lib/api/desktopPreferences";
import type { LinkOpenTarget } from "@/lib/api/appConfigTypes";
import { PreferenceMenu } from "./PreferenceMenu";

export function BrowserUseSettings() {
  const { t } = useTranslation("settings");
  const { configured, error, pending, refresh, save } = useDesktopPreferences();
  const effective = effectiveDesktopPreferences(configured ?? undefined);
  const options: { value: LinkOpenTarget; label: string }[] = [
    { value: "in-app-browser", label: t("settings.browser.inApp") },
    { value: "external-browser", label: t("settings.browser.external") },
  ];
  return (
    <div
      className="space-y-6 pb-8"
      aria-busy={pending || (!configured && !error)}
    >
      <h1 className="text-xl font-semibold">{t("settings.tab.browser")}</h1>
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 text-sm text-destructive"
        >
          {t(`settings.browser.error.${error}`)}
          {error === "load" ? (
            <button type="button" onClick={() => void refresh()}>
              {t("settings.browser.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      <section aria-labelledby="browser-general">
        <h2
          id="browser-general"
          className="text-sm font-medium text-muted-foreground"
        >
          {t("settings.browser.general")}
        </h2>
        <PreferenceMenu
          label={t("settings.browser.web")}
          targetId="browser-web-target"
          value={effective["open-link-in-target-preference"]}
          options={options}
          disabled={!configured || pending}
          onChange={(value) =>
            void save("open-link-in-target-preference", value)
          }
        />
        <PreferenceMenu
          label={t("settings.browser.local")}
          description={t("settings.browser.localDescription")}
          targetId="browser-local-target"
          value={effective["open-local-url-in-target-preference"]}
          options={options}
          disabled={!configured || pending}
          onChange={(value) =>
            void save("open-local-url-in-target-preference", value)
          }
        />
      </section>
    </div>
  );
}
