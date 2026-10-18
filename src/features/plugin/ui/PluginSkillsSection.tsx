import { useEffect, useState, useSyncExternalStore } from "react";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import {
  cloudAccountIdentity,
  getCloudAccount,
  subscribeCloudAccount,
} from "@/lib/cloudAccount";
import { PluginSkillPreview } from "./PluginSkillPreview";

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
  const accountIdentity = useSyncExternalStore(
    subscribeCloudAccount,
    () => cloudAccountIdentity(getCloudAccount()),
    () => null,
  );
  const [target, setTarget] = useState<{
    skill: PluginSkill;
    accountIdentity: string | null;
  } | null>(null);
  useEffect(() => {
    setTarget(null);
  }, [accountIdentity, detail]);
  if (!detail.skills.length) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold text-[color:var(--lime-text-strong)]">
        {t("plugin.catalog.v2.detail.skills")}
      </h3>
      <div className="mt-2 space-y-1">
        {detail.skills.map((skill) => (
          <button
            key={skill.path ?? skill.name}
            type="button"
            className="block w-full rounded-md px-2 py-2 text-left hover:bg-[color:var(--lime-surface-hover)]"
            onClick={() => setTarget({ skill, accountIdentity })}
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
        ))}
      </div>
      {target && target.accountIdentity === accountIdentity ? (
        <PluginSkillPreview
          key={`${detail.summary.id}:${target.skill.name}:${target.skill.path ?? ""}:${accountIdentity}`}
          detail={detail}
          skill={target.skill}
          accountIdentity={accountIdentity}
          title={pluginSkillDisplayName(target.skill)}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </section>
  );
}
