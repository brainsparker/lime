import { useEffect, useState, useSyncExternalStore } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import {
  cloudAccountIdentity,
  cloudAccountIdentityVersion,
  getCloudAccount,
} from "@/lib/cloudAccount";
import {
  skillPreviewQueryClient,
  subscribeSkillPreviewAccount,
} from "../model/skillPreviewQueries";
import { PluginSkillPreview } from "./PluginSkillPreview";
import { PluginSkillToggle } from "./PluginSkillToggle";
import { usePluginSkillPreferences } from "../model/usePluginSkillPreferences";

export type PluginSkill = AppServerPluginDetail["skills"][number];

function pluginSkillDisplayName(skill: PluginSkill): string {
  return (
    skill.interface?.displayName || skill.name.split(":").at(-1) || skill.name
  );
}

export function PluginSkillsSection({
  detail,
  t,
}: {
  detail: AppServerPluginDetail;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const accountVersion = useSyncExternalStore(
    subscribeSkillPreviewAccount,
    cloudAccountIdentityVersion,
    () => 0,
  );
  const accountIdentity = cloudAccountIdentity(getCloudAccount());
  const preferences = usePluginSkillPreferences(detail, accountVersion);
  const [target, setTarget] = useState<{
    skill: PluginSkill;
    accountVersion: number;
  } | null>(null);
  useEffect(() => {
    setTarget(null);
  }, [accountVersion, detail]);
  if (!detail.skills.length) return null;
  const control = (skill: PluginSkill) =>
    preferences.installed ? (
      <PluginSkillToggle
        name={pluginSkillDisplayName(skill)}
        checked={skill.enabled}
        disabled={
          preferences.busy ||
          preferences.adminDisabled ||
          (!skill.enabled && preferences.requiresAppConnection)
        }
        reason={
          preferences.adminDisabled
            ? t("plugin.skillPreference.adminDisabled")
            : !skill.enabled && preferences.requiresAppConnection
              ? t("plugin.skillPreference.connectApps")
              : undefined
        }
        onChange={(enabled) => void preferences.setEnabled(skill.name, enabled)}
        t={t}
      />
    ) : null;
  const failure = preferences.error ? (
    <div
      role="alert"
      className="mt-2 text-xs text-[color:var(--lime-text-muted)]"
    >
      <p>
        {t(
          preferences.error.kind === "save"
            ? "plugin.skillPreference.saveFailed"
            : "plugin.skillPreference.refreshFailed",
        )}
      </p>
      {preferences.error.kind === "refresh" ? (
        <button
          type="button"
          className="mt-1 underline disabled:opacity-50"
          onClick={() =>
            void preferences.retryRefresh(preferences.error!.skillName)
          }
        >
          {t("plugin.skillPreview.retry")}
        </button>
      ) : null}
    </div>
  ) : null;
  const previewSkill = preferences.detail.skills.find(
    (skill) => skill.name === target?.skill.name,
  );
  return (
    <section>
      <h3 className="text-xs font-semibold text-[color:var(--lime-text-strong)]">
        {t("plugin.catalog.v2.detail.skills")}
      </h3>
      <div className="mt-2 space-y-1">
        {preferences.detail.skills.map((skill) => (
          <div
            key={skill.path ?? skill.name}
            className="flex items-center gap-3"
          >
            <button
              type="button"
              className="block w-full rounded-md px-2 py-2 text-left hover:bg-[color:var(--lime-surface-hover)]"
              onClick={() => setTarget({ skill, accountVersion })}
              data-testid="plugin-skill-card"
            >
              <span className="block text-sm font-medium">
                {pluginSkillDisplayName(skill)}
              </span>
              <span className="block text-xs text-[color:var(--lime-text-muted)]">
                {skill.interface?.shortDescription ||
                  skill.shortDescription ||
                  skill.description}
              </span>
            </button>
            {control(skill)}
          </div>
        ))}
      </div>
      {failure}
      {target && target.accountVersion === accountVersion ? (
        <QueryClientProvider client={skillPreviewQueryClient}>
          <PluginSkillPreview
            key={`${detail.summary.id}:${target.skill.name}:${target.skill.path ?? ""}:${accountVersion}`}
            detail={detail}
            skill={target.skill}
            accountIdentity={accountIdentity}
            accountVersion={accountVersion}
            title={pluginSkillDisplayName(target.skill)}
            onClose={() => setTarget(null)}
            headerActions={previewSkill ? control(previewSkill) : null}
            footer={failure}
          />
        </QueryClientProvider>
      ) : null}
    </section>
  );
}
