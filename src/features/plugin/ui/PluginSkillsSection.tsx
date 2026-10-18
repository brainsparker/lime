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
  const [target, setTarget] = useState<{
    skill: PluginSkill;
    accountVersion: number;
  } | null>(null);
  useEffect(() => {
    setTarget(null);
  }, [accountVersion, detail]);
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
        ))}
      </div>
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
          />
        </QueryClientProvider>
      ) : null}
    </section>
  );
}
