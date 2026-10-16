import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  sourceLayerPillClassName,
  type PolicySourceLayerView,
} from "./executionPolicyPresentation";

export function PolicySourceLayerPanel({
  layers,
}: {
  layers: PolicySourceLayerView[];
}) {
  const { t } = useTranslation("settings");

  return (
    <section
      className="rounded-[26px] border border-border bg-background p-5 shadow-sm "
      data-testid="execution-policy-source-layers"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Workflow className="h-4 w-4 text-primary" />
        {t("settings.executionPolicy.sources.title")}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("settings.executionPolicy.sources.description")}
      </p>
      <div className="mt-4 space-y-2">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className="rounded-[18px] border border-border bg-muted/40 px-3 py-3"
            data-testid={`execution-policy-source-${layer.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {layer.order}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {t(`settings.executionPolicy.sources.${layer.id}.title`)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {layer.detail}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  sourceLayerPillClassName({
                    active: layer.active,
                    editable: layer.editable,
                  }),
                )}
              >
                {layer.editable
                  ? t("settings.executionPolicy.sources.badge.editable")
                  : layer.active
                    ? t("settings.executionPolicy.sources.badge.active")
                    : t("settings.executionPolicy.sources.badge.readonly")}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-[18px] border border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] px-3 py-3 text-xs leading-5 text-[color:var(--lime-warning)]">
        {t("settings.executionPolicy.sources.note")}
      </p>
    </section>
  );
}
