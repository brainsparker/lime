import type { TFunction } from "i18next";

type PolicySourceLayerId =
  | "default"
  | "persisted"
  | "organization"
  | "user"
  | "runtime"
  | "request";

export interface PolicySourceLayerView {
  id: PolicySourceLayerId;
  order: number;
  editable: boolean;
  active: boolean;
  detail: string;
}

export const FIELD_CLASS_NAME =
  "w-full rounded-[16px] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-border focus:ring-2 focus:ring-ring/20";
export const SELECT_CLASS_NAME =
  "w-full rounded-[16px] border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-border focus:ring-2 focus:ring-ring/20";
export const PRIMARY_BUTTON_CLASS_NAME =
  "inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm  transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";
export const SECONDARY_BUTTON_CLASS_NAME =
  "inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
export const DANGER_BUTTON_CLASS_NAME =
  "inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-foreground transition hover:border-destructive/30 hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50";

export function statusPillClassName(active: boolean) {
  return active
    ? "border-primary/20 bg-primary/10 text-primary"
    : "border-border bg-muted text-muted-foreground";
}

export function sourceLayerPillClassName(params: {
  active: boolean;
  editable: boolean;
}) {
  if (params.editable) {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  if (params.active) {
    return "border-[color:var(--lime-warning-border)] bg-[color:var(--lime-warning-soft)] text-[color:var(--lime-warning)]";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function buildPolicySourceLayers(params: {
  hasCustomPolicy: boolean;
  shellRuleCount: number;
  networkRuleCount: number;
  toolOverrideCount: number;
  t: TFunction<"settings", undefined>;
}): PolicySourceLayerView[] {
  return [
    {
      id: "default",
      order: 1,
      editable: false,
      active: true,
      detail: params.t("settings.executionPolicy.sources.default.detail"),
    },
    {
      id: "persisted",
      order: 2,
      editable: true,
      active: params.hasCustomPolicy,
      detail: params.t("settings.executionPolicy.sources.persisted.detail", {
        shellRules: params.shellRuleCount,
        networkRules: params.networkRuleCount,
        toolOverrides: params.toolOverrideCount,
      }),
    },
    {
      id: "organization",
      order: 3,
      editable: false,
      active: false,
      detail: params.t("settings.executionPolicy.sources.organization.detail"),
    },
    {
      id: "user",
      order: 4,
      editable: false,
      active: false,
      detail: params.t("settings.executionPolicy.sources.user.detail"),
    },
    {
      id: "runtime",
      order: 5,
      editable: false,
      active: false,
      detail: params.t("settings.executionPolicy.sources.runtime.detail"),
    },
    {
      id: "request",
      order: 6,
      editable: false,
      active: false,
      detail: params.t("settings.executionPolicy.sources.request.detail"),
    },
  ];
}
