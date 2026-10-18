import { useTranslation } from "react-i18next";
import type {
  PluginShareAccess,
  PluginShareContext,
  PluginShareTarget,
} from "./PluginShareViewModel";

export function PluginShareAccessPanel({
  context,
  access,
  targets,
  disabled,
  canManage,
  onAccessChange,
  onTargetsChange,
}: {
  context: PluginShareContext;
  access: PluginShareAccess;
  targets: PluginShareTarget[];
  disabled: boolean;
  canManage: boolean;
  onAccessChange: (access: PluginShareAccess) => void;
  onTargetsChange: (targets: PluginShareTarget[]) => void;
}) {
  const { t } = useTranslation("agent");
  const principals = context.sharePrincipals ?? [];
  return (
    <section className="space-y-4" aria-label={t("plugin.share.accessTitle")}>
      <h3 className="font-medium">{t("plugin.share.accessTitle")}</h3>
      <label className="flex items-center justify-between gap-3">
        <span>{t("plugin.share.generalAccess")}</span>
        <select
          value={access}
          disabled={disabled || !canManage}
          onChange={(event) =>
            onAccessChange(event.currentTarget.value as PluginShareAccess)
          }
          className="rounded-md border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-2 text-sm"
          data-testid="plugin-share-access"
        >
          {(["PRIVATE", "UNLISTED", "LISTED"] as const).map((value) => (
            <option
              key={value}
              value={value}
              disabled={
                value !== "PRIVATE" &&
                context.canPublishToWorkspace !== true &&
                value !== context.discoverability
              }
            >
              {t(`plugin.share.access.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-5 text-[color:var(--lime-text-muted)]">
        {t(`plugin.share.accessDescription.${access}`)}
      </p>
      <ul className="space-y-3">
        {principals
          .filter((principal) => principal.principalType !== "workspace")
          .map((principal) => {
            const target = targets.find(
              (item) =>
                item.principalType === principal.principalType &&
                item.principalId === principal.principalId,
            );
            if (principal.role !== "owner" && !target) return null;
            return (
              <li
                key={`${principal.principalType}:${principal.principalId}`}
                className="flex items-center justify-between gap-3"
                data-testid="plugin-share-principal"
              >
                <span className="min-w-0 break-words">
                  {principal.name || principal.principalId}
                </span>
                {principal.role === "owner" ? (
                  <span className="text-sm text-[color:var(--lime-text-muted)]">
                    {t("plugin.share.role.owner")}
                  </span>
                ) : (
                  <select
                    className="rounded-md border border-[color:var(--lime-surface-border)] bg-[color:var(--lime-surface)] p-2 text-sm"
                    aria-label={t("plugin.share.principalRole", {
                      name: principal.name || principal.principalId,
                    })}
                    value={target?.role}
                    disabled={disabled || !canManage}
                    onChange={(event) =>
                      onTargetsChange(
                        event.currentTarget.value === "remove"
                          ? targets.filter((item) => item !== target)
                          : targets.map((item) =>
                              item === target
                                ? {
                                    ...item,
                                    role: event.currentTarget.value as
                                      | "reader"
                                      | "editor",
                                  }
                                : item,
                            ),
                      )
                    }
                  >
                    <option value="reader">
                      {t("plugin.share.role.reader")}
                    </option>
                    <option value="editor">
                      {t("plugin.share.role.editor")}
                    </option>
                    <option value="remove">
                      {t("plugin.share.removeAccess")}
                    </option>
                  </select>
                )}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
