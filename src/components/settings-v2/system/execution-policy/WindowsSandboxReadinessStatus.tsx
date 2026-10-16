import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  readWindowsSandboxReadiness,
  startWindowsSandboxSetup,
  subscribeWindowsSandboxNotifications,
  type WindowsSandboxNotification,
  type WindowsSandboxReadiness,
} from "@/lib/api/windowsSandbox";
import { cn } from "@/lib/utils";
import { isWindowsDesktopPlatform } from "./windowsSandboxPlatform";

type ReadinessState = WindowsSandboxReadiness | "checking" | "error";
type SetupState = "idle" | "starting" | "completed" | "failed";

const STATUS_STYLES: Record<ReadinessState, string> = {
  checking: "border-border bg-muted text-muted-foreground",
  ready: "border-primary/20 bg-primary/10 text-primary",
  notConfigured: "border-border bg-muted text-muted-foreground",
  updateRequired:
    "border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)]",
  error: "border-destructive/20 bg-destructive/10 text-foreground",
};

const SETUP_STYLES: Record<SetupState, string> = {
  idle: "text-muted-foreground",
  starting: "text-primary",
  completed: "text-primary",
  failed: "text-foreground",
};

const STATUS_ICONS: Record<ReadinessState, typeof CheckCircle2> = {
  checking: CircleDashed,
  ready: CheckCircle2,
  notConfigured: CircleDashed,
  updateRequired: AlertCircle,
  error: AlertCircle,
};

export function WindowsSandboxReadinessStatus() {
  const { t } = useTranslation("settings");
  const [status, setStatus] = useState<ReadinessState>("checking");
  const [setupState, setSetupState] = useState<SetupState>("idle");
  const [setupMode, setSetupMode] = useState<"elevated" | "unelevated" | null>(
    null,
  );
  const [setupError, setSetupError] = useState<string | null>(null);
  const [worldWritableWarning, setWorldWritableWarning] = useState<
    | Extract<
        WindowsSandboxNotification,
        { method: "windows/worldWritableWarning" }
      >["params"]
    | null
  >(null);

  const refresh = useCallback(async () => {
    setStatus("checking");
    try {
      setStatus(await readWindowsSandboxReadiness());
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!isWindowsDesktopPlatform()) return;
    const unsubscribe = subscribeWindowsSandboxNotifications((notification) => {
      if (notification.method === "windowsSandbox/setupCompleted") {
        setSetupMode(notification.params.mode);
        setSetupState(notification.params.success ? "completed" : "failed");
        setSetupError(notification.params.error ?? null);
        if (notification.params.success) {
          void refresh();
        }
        return;
      }
      setWorldWritableWarning(notification.params);
    });
    void refresh();
    return unsubscribe;
  }, [refresh]);

  const startSetup = useCallback(async (mode: "elevated" | "unelevated") => {
    setSetupMode(mode);
    setSetupState("starting");
    setSetupError(null);
    try {
      const response = await startWindowsSandboxSetup({ mode });
      if (!response.started) {
        setSetupState("failed");
        setSetupError("windowsSandbox/setupStart was not accepted");
      }
    } catch (error) {
      setSetupState("failed");
      setSetupError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  if (!isWindowsDesktopPlatform()) {
    return null;
  }

  const StatusIcon = STATUS_ICONS[status];

  return (
    <div
      className="mt-4 flex min-h-[76px] items-start justify-between gap-4 border-t border-border pt-4"
      data-status={status}
      data-testid="windows-sandbox-readiness"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("settings.executionPolicy.windowsSandbox.title")}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              STATUS_STYLES[status],
            )}
          >
            <StatusIcon
              className={cn("h-3.5 w-3.5", {
                "animate-spin": status === "checking",
              })}
            />
            {t(`settings.executionPolicy.windowsSandbox.status.${status}`)}
          </span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t(`settings.executionPolicy.windowsSandbox.detail.${status}`)}
        </p>
        {setupState !== "idle" && (
          <p
            className={cn("text-xs leading-5", SETUP_STYLES[setupState])}
            data-testid="windows-sandbox-setup-state"
          >
            {t(`settings.executionPolicy.windowsSandbox.setup.${setupState}`, {
              mode: setupMode
                ? t(`settings.executionPolicy.windowsSandbox.mode.${setupMode}`)
                : "",
              error: setupError ?? "",
            })}
          </p>
        )}
        {worldWritableWarning && (
          <div
            className="mt-2 border-l-2 border-amber-400 pl-3 text-xs leading-5 text-[color:var(--lime-warning)]"
            data-testid="windows-sandbox-world-writable-warning"
          >
            <p className="font-medium">
              {t("settings.executionPolicy.windowsSandbox.warning.title")}
            </p>
            <p>
              {t(
                worldWritableWarning.failedScan
                  ? "settings.executionPolicy.windowsSandbox.warning.failedScan"
                  : "settings.executionPolicy.windowsSandbox.warning.found",
                {
                  count:
                    worldWritableWarning.samplePaths.length +
                    worldWritableWarning.extraCount,
                },
              )}
            </p>
            {worldWritableWarning.samplePaths.length > 0 && (
              <p className="break-all">
                {worldWritableWarning.samplePaths.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-wait disabled:opacity-50"
          aria-label={t(
            "settings.executionPolicy.windowsSandbox.action.refresh",
          )}
          title={t("settings.executionPolicy.windowsSandbox.action.refresh")}
          disabled={status === "checking" || setupState === "starting"}
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <div
          className="inline-flex overflow-hidden rounded-md border border-border bg-background"
          role="group"
          aria-label={t("settings.executionPolicy.windowsSandbox.action.setup")}
        >
          {(["unelevated", "elevated"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="border-l border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground first:border-l-0 hover:bg-muted/40 hover:text-foreground disabled:cursor-wait disabled:opacity-50"
              disabled={status === "checking" || setupState === "starting"}
              onClick={() => void startSetup(mode)}
            >
              {t(`settings.executionPolicy.windowsSandbox.mode.${mode}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
