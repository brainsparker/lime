import { SurfacePanel } from "./EnvironmentFields";
import { useState } from "react";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EnvironmentPreview } from "@/lib/api/appConfig";
import {
  SECONDARY_BUTTON_CLASS_NAME,
  formatSourceLabel,
} from "./environmentPresentation";

export function EnvironmentPreviewPanel({
  preview,
}: {
  preview: EnvironmentPreview | null;
}) {
  const { t } = useTranslation("settings");
  const [showValues, setShowValues] = useState(false);
  return (
    <SurfacePanel
      icon={ShieldAlert}
      title={t("settings.environment.preview.title")}
      description={t("settings.environment.preview.description")}
      tipAriaLabel={t("settings.environment.preview.tipAria")}
      aside={
        <>
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {showValues
              ? t("settings.environment.preview.badge.showing")
              : t("settings.environment.preview.badge.masked")}
          </span>
          <button
            type="button"
            onClick={() => setShowValues((prev) => !prev)}
            className={SECONDARY_BUTTON_CLASS_NAME}
          >
            {showValues ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {showValues
              ? t("settings.environment.preview.action.hide")
              : t("settings.environment.preview.action.show")}
          </button>
        </>
      }
    >
      {!preview || preview.entries.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-border bg-muted/60 p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("settings.environment.preview.empty.title")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("settings.environment.preview.empty.description")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-border bg-background">
          <div className="hidden grid-cols-[220px_minmax(0,1fr)_180px] border-b border-border bg-muted/80 px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <span>{t("settings.environment.preview.column.variable")}</span>
            <span>{t("settings.environment.preview.column.value")}</span>
            <span>{t("settings.environment.preview.column.source")}</span>
          </div>
          <div className="divide-y divide-border">
            {preview.entries.map((entry) => (
              <article
                key={entry.key}
                className="grid gap-4 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)_180px] md:items-start"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:hidden">
                    {t("settings.environment.preview.column.variable")}
                  </p>
                  <p className="font-mono text-sm font-medium text-foreground">
                    {entry.key}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:hidden">
                    {t("settings.environment.preview.column.value")}
                  </p>
                  <p className="rounded-[16px] border border-border bg-muted/70 px-3 py-2 font-mono text-sm break-all text-muted-foreground">
                    {showValues || !entry.sensitive
                      ? entry.value
                      : entry.maskedValue}
                  </p>
                  {entry.overriddenSources.length > 0 ? (
                    <p className="text-xs leading-5 text-[color:var(--lime-warning)]">
                      {t("settings.environment.preview.overriddenSources", {
                        sources: entry.overriddenSources
                          .map((source) => formatSourceLabel(t, source))
                          .join(
                            t("settings.environment.preview.sourceSeparator"),
                          ),
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:hidden">
                    {t("settings.environment.preview.column.source")}
                  </p>
                  <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {formatSourceLabel(t, entry.source, entry.sourceLabel)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </SurfacePanel>
  );
}
