import type { TFunction } from "i18next";
import type { EnvironmentPreview } from "@/lib/api/appConfig";

type EnvironmentSettingsTranslate = TFunction<"settings", undefined>;

export const INPUT_CLASS_NAME =
  "w-full rounded-[16px] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-border focus:ring-2 focus:ring-ring/20";
export const SECONDARY_BUTTON_CLASS_NAME =
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
export const PRIMARY_BUTTON_CLASS_NAME =
  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm  transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

export function formatSourceLabel(
  t: EnvironmentSettingsTranslate,
  source: string,
  fallbackLabel?: string,
): string {
  switch (source) {
    case "override":
      return t("settings.environment.source.override");
    case "shell_import":
      return t("settings.environment.source.shellImport");
    case "web_search":
      return t("settings.environment.source.webSearch");
    case "process":
      return t("settings.environment.source.process");
    default:
      return fallbackLabel || source;
  }
}

export function resolveShellImportMeta(
  t: EnvironmentSettingsTranslate,
  status?: string,
) {
  switch (status) {
    case "ok":
      return {
        label: t("settings.environment.status.imported"),
        className: "border-primary/20 bg-primary/10 text-primary",
      };
    case "disabled":
      return {
        label: t("settings.environment.status.disabled"),
        className: "border-border bg-muted text-muted-foreground",
      };
    case "error":
      return {
        label: t("settings.environment.status.error"),
        className: "border-destructive/20 bg-destructive/10 text-destructive",
      };
    case "timeout":
      return {
        label: t("settings.environment.status.timeout"),
        className:
          "border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)]",
      };
    default:
      return {
        label: t("settings.environment.status.pending"),
        className:
          "border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)]",
      };
  }
}

export function formatDuration(
  t: EnvironmentSettingsTranslate,
  durationMs?: number | null,
) {
  if (durationMs == null || durationMs < 0) {
    return t("settings.environment.duration.notRecorded");
  }
  return t("settings.environment.duration.ms", {
    duration: durationMs,
  });
}

export function formatShellImportMessage(
  t: EnvironmentSettingsTranslate,
  shellImport?: EnvironmentPreview["shellImport"],
) {
  if (!shellImport) {
    return t("settings.environment.shellImport.previewMessage.fallback");
  }

  switch (shellImport.status) {
    case "ok":
      return t("settings.environment.shellImport.previewMessage.ok", {
        count: shellImport.importedCount,
      });
    case "disabled":
      return t("settings.environment.shellImport.previewMessage.disabled");
    case "timeout":
      return t("settings.environment.shellImport.previewMessage.timeout", {
        duration: formatDuration(t, shellImport.durationMs),
      });
    case "error":
      return t("settings.environment.shellImport.previewMessage.error", {
        message: shellImport.message.replace(/^Shell 环境导入失败[:：]\s*/, ""),
      });
    default:
      return (
        shellImport.message ||
        t("settings.environment.shellImport.previewMessage.fallback")
      );
  }
}
