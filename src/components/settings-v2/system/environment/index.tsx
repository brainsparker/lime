import { useCallback, useMemo } from "react";
import {
  Layers3,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Terminal,
  Trash2,
  Variable,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkbenchInfoTip } from "@/components/media/WorkbenchInfoTip";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { EnvironmentVariableOverride } from "@/lib/api/appConfig";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";
import { createEmptyVariable } from "./environmentConfig";
import { useEnvironmentSettingsDraft } from "./useEnvironmentSettingsDraft";
import { FieldBlock, LoadingSkeleton, SurfacePanel } from "./EnvironmentFields";
import { EnvironmentPreviewPanel } from "./EnvironmentPreviewPanel";
import {
  INPUT_CLASS_NAME,
  PRIMARY_BUTTON_CLASS_NAME,
  SECONDARY_BUTTON_CLASS_NAME,
  formatDuration,
  formatShellImportMessage,
  resolveShellImportMeta,
} from "./environmentPresentation";

export function EnvironmentSettings() {
  const { t } = useTranslation("settings");
  const {
    draft: environment,
    change,
    dirty: hasUnsavedChanges,
    loading,
    ready,
    preview,
    refreshingPreview,
    saving,
    message,
    refreshPreview,
    reload,
    save,
  } = useEnvironmentSettingsDraft();

  useSettingsDraft({ dirty: hasUnsavedChanges, saving });

  const updateVariable = useCallback(
    (index: number, patch: Partial<EnvironmentVariableOverride>) => {
      change(
        "variables",
        environment.variables.map((item, currentIndex) =>
          currentIndex === index ? { ...item, ...patch } : item,
        ),
      );
    },
    [change, environment.variables],
  );

  const addVariable = useCallback(() => {
    change("variables", [...environment.variables, createEmptyVariable()]);
  }, [change, environment.variables]);

  const removeVariable = useCallback(
    (index: number) => {
      change(
        "variables",
        environment.variables.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      );
    },
    [change, environment.variables],
  );

  const summary = useMemo(() => {
    const enabledOverrides = environment.variables.filter(
      (entry) => entry.enabled && entry.key.trim(),
    ).length;
    const shellImportMeta = resolveShellImportMeta(
      t,
      preview?.shellImport.status,
    );

    return {
      shellImportMeta,
      overrideCount: environment.variables.length,
      enabledOverrides,
      previewCount: preview?.entries.length ?? 0,
    };
  }, [environment.variables, preview, t]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 pb-8">
      {message ? (
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-sm shadow-sm ",
            message.type === "success"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive",
          )}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>{message.text}</span>
          </div>
          {message.type === "error" && !ready ? (
            <button
              type="button"
              onClick={() => reload()}
              className="rounded-full border border-current/20 bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-background/90"
            >
              {t("settings.environment.action.reload")}
            </button>
          ) : null}
        </div>
      ) : null}

      <fieldset disabled={!ready} className="min-w-0 space-y-6">
        <section className="rounded-[26px] border border-border bg-background px-5 py-4 shadow-sm ">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
                  {t("settings.environment.hero.title")}
                </h1>
                <WorkbenchInfoTip
                  ariaLabel={t("settings.environment.hero.tipAria")}
                  content={t("settings.environment.hero.tip")}
                  tone="mint"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("settings.environment.hero.description")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <span
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  summary.shellImportMeta.className,
                )}
              >
                {t("settings.environment.summary.shellImport", {
                  status: summary.shellImportMeta.label,
                })}
              </span>
              <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t("settings.environment.summary.overrides", {
                  enabled: summary.enabledOverrides,
                  total: summary.overrideCount,
                })}
              </span>
              <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {t("settings.environment.summary.previewVariables", {
                  count: summary.previewCount,
                })}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 rounded-[20px] border border-border bg-muted/60 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {t("settings.environment.summary.imported", {
                    count: preview?.shellImport.importedCount ?? 0,
                  })}
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                  {t("settings.environment.summary.duration", {
                    duration: formatDuration(
                      t,
                      preview?.shellImport.durationMs,
                    ),
                  })}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {formatShellImportMessage(t, preview?.shellImport)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshPreview()}
                disabled={refreshingPreview || saving}
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    refreshingPreview ? "animate-spin" : "",
                  )}
                />
                {t("settings.environment.action.refreshPreview")}
              </button>
              <button
                type="button"
                data-testid="environment-save"
                onClick={() => void save()}
                disabled={saving || !ready || !hasUnsavedChanges}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                <Save className="h-4 w-4" />
                {saving
                  ? t("settings.environment.action.saving")
                  : t("settings.environment.action.save")}
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,0.84fr)]">
          <div className="space-y-6">
            <SurfacePanel
              icon={Terminal}
              title={t("settings.environment.shellImport.title")}
              description={t("settings.environment.shellImport.description")}
              tipAriaLabel={t("settings.environment.shellImport.tipAria")}
              aside={
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    summary.shellImportMeta.className,
                  )}
                >
                  {summary.shellImportMeta.label}
                </span>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div
                  className="rounded-[22px] border border-border bg-muted/60 p-4"
                  data-settings-search-target="environment-shell-enable"
                  tabIndex={-1}
                  aria-label={t(
                    "settings.environment.shellImport.enable.label",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {t("settings.environment.shellImport.enable.label")}
                        </p>
                        <WorkbenchInfoTip
                          ariaLabel={t(
                            "settings.environment.shellImport.enable.tipAria",
                          )}
                          content={t(
                            "settings.environment.shellImport.enable.tip",
                          )}
                          tone="slate"
                        />
                      </div>
                    </div>
                    <Switch
                      aria-label={t(
                        "settings.environment.shellImport.enable.aria",
                      )}
                      checked={environment.shellImportEnabled}
                      onCheckedChange={(checked) =>
                        change("shellImportEnabled", checked)
                      }
                    />
                  </div>
                </div>

                <div
                  className="rounded-[22px] border border-border bg-muted/60 p-4"
                  data-settings-search-target="environment-shell-timeout"
                  tabIndex={-1}
                  aria-label={t(
                    "settings.environment.shellImport.timeout.label",
                  )}
                >
                  <FieldBlock
                    label={t("settings.environment.shellImport.timeout.label")}
                    htmlFor="environment-shell-import-timeout"
                    hint={t("settings.environment.shellImport.timeout.tip")}
                    tipAriaLabel={t(
                      "settings.environment.shellImport.timeout.tipAria",
                    )}
                  >
                    <input
                      id="environment-shell-import-timeout"
                      type="number"
                      min={100}
                      max={30000}
                      step={100}
                      value={environment.shellImportTimeout}
                      onChange={(event) =>
                        change("shellImportTimeout", event.target.value)
                      }
                      className={INPUT_CLASS_NAME}
                    />
                  </FieldBlock>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.environment.shellImport.status.title")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {preview
                      ? formatShellImportMessage(t, preview.shellImport)
                      : t("settings.environment.shellImport.status.empty")}
                  </p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.environment.shellImport.imported.title")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {preview?.shellImport.importedCount ?? 0}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("settings.environment.shellImport.imported.description")}
                  </p>
                </div>
                <div className="rounded-[22px] border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {t("settings.environment.shellImport.duration.title")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {formatDuration(t, preview?.shellImport.durationMs)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("settings.environment.shellImport.duration.description")}
                  </p>
                </div>
              </div>
            </SurfacePanel>

            <SurfacePanel
              icon={Variable}
              searchTarget="environment-overrides"
              title={t("settings.environment.overrides.title")}
              description={t("settings.environment.overrides.description")}
              tipAriaLabel={t("settings.environment.overrides.tipAria")}
              aside={
                <button
                  type="button"
                  onClick={addVariable}
                  className={SECONDARY_BUTTON_CLASS_NAME}
                >
                  <Plus className="h-4 w-4" />
                  {t("settings.environment.overrides.action.add")}
                </button>
              }
            >
              {environment.variables.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border bg-muted/60 p-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t("settings.environment.overrides.empty.title")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t("settings.environment.overrides.empty.description")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {environment.variables.map((entry, index) => (
                    <article
                      key={index}
                      className="rounded-[22px] border border-border bg-muted/60 p-4"
                    >
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_180px_56px]">
                        <FieldBlock
                          label={t("settings.environment.variable.name.label")}
                          htmlFor={`environment-variable-key-${index}`}
                        >
                          <input
                            id={`environment-variable-key-${index}`}
                            type="text"
                            value={entry.key}
                            onChange={(event) =>
                              updateVariable(index, { key: event.target.value })
                            }
                            placeholder={t(
                              "settings.environment.variable.name.placeholder",
                            )}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldBlock>

                        <FieldBlock
                          label={t("settings.environment.variable.value.label")}
                          htmlFor={`environment-variable-value-${index}`}
                        >
                          <input
                            id={`environment-variable-value-${index}`}
                            type="text"
                            value={entry.value}
                            onChange={(event) =>
                              updateVariable(index, {
                                value: event.target.value,
                              })
                            }
                            placeholder={t(
                              "settings.environment.variable.value.placeholder",
                            )}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldBlock>

                        <div className="flex flex-col justify-between gap-3 rounded-[18px] border border-border bg-background p-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {t(
                                  "settings.environment.variable.enabled.label",
                                )}
                              </p>
                              <WorkbenchInfoTip
                                ariaLabel={t(
                                  "settings.environment.variable.enabled.tipAria",
                                  {
                                    index: index + 1,
                                  },
                                )}
                                content={t(
                                  "settings.environment.variable.enabled.tip",
                                )}
                                tone="slate"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                entry.enabled
                                  ? "border-primary/20 bg-primary/10 text-primary"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {entry.enabled
                                ? t("settings.environment.variable.enabled.on")
                                : t(
                                    "settings.environment.variable.enabled.off",
                                  )}
                            </span>
                            <Switch
                              aria-label={t(
                                "settings.environment.variable.enabled.aria",
                                {
                                  index: index + 1,
                                },
                              )}
                              checked={entry.enabled}
                              onCheckedChange={(checked) =>
                                updateVariable(index, { enabled: checked })
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeVariable(index)}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                            title={t(
                              "settings.environment.variable.delete.title",
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SurfacePanel>
          </div>

          <div className="space-y-6">
            <SurfacePanel
              icon={Layers3}
              title={t("settings.environment.merge.title")}
              description={t("settings.environment.merge.description")}
              tipAriaLabel={t("settings.environment.merge.tipAria")}
            >
              <div className="space-y-3">
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {t("settings.environment.merge.priority1.title")}
                      </p>
                      <WorkbenchInfoTip
                        ariaLabel={t(
                          "settings.environment.merge.priority1.tipAria",
                        )}
                        content={t("settings.environment.merge.priority1.tip")}
                        tone="slate"
                      />
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {t("settings.environment.merge.priority1.badge")}
                    </span>
                  </div>
                </div>
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {t("settings.environment.merge.priority2.title")}
                      </p>
                      <WorkbenchInfoTip
                        ariaLabel={t(
                          "settings.environment.merge.priority2.tipAria",
                        )}
                        content={t("settings.environment.merge.priority2.tip")}
                        tone="slate"
                      />
                    </div>
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {t("settings.environment.merge.priority2.badge")}
                    </span>
                  </div>
                </div>
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {t("settings.environment.merge.compat.title")}
                      </p>
                      <WorkbenchInfoTip
                        ariaLabel={t(
                          "settings.environment.merge.compat.tipAria",
                        )}
                        content={t("settings.environment.merge.compat.tip")}
                        tone="slate"
                      />
                    </div>
                    <span className="rounded-full border border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] px-3 py-1 text-xs font-medium text-[color:var(--lime-warning)]">
                      {t("settings.environment.merge.compat.badge")}
                    </span>
                  </div>
                </div>
              </div>
            </SurfacePanel>

            <SurfacePanel
              icon={ShieldAlert}
              title={t("settings.environment.tips.title")}
              description={t("settings.environment.tips.description")}
              tipAriaLabel={t("settings.environment.tips.tipAria")}
            >
              <div className="space-y-3">
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t("settings.environment.tips.mask.title")}
                    </p>
                    <WorkbenchInfoTip
                      ariaLabel={t("settings.environment.tips.mask.tipAria")}
                      content={t("settings.environment.tips.mask.tip")}
                      tone="slate"
                    />
                  </div>
                </div>
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t("settings.environment.tips.preview.title")}
                    </p>
                    <WorkbenchInfoTip
                      ariaLabel={t("settings.environment.tips.preview.tipAria")}
                      content={t("settings.environment.tips.preview.tip")}
                      tone="slate"
                    />
                  </div>
                </div>
                <div className="rounded-[22px] border border-border bg-muted/60 p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t("settings.environment.tips.crossPlatform.title")}
                    </p>
                    <WorkbenchInfoTip
                      ariaLabel={t(
                        "settings.environment.tips.crossPlatform.tipAria",
                      )}
                      content={t("settings.environment.tips.crossPlatform.tip")}
                      tone="slate"
                    />
                  </div>
                </div>
              </div>
            </SurfacePanel>
          </div>
        </div>

        <EnvironmentPreviewPanel preview={preview} />
      </fieldset>
    </div>
  );
}
