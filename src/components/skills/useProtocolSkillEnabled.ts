import { useCallback, useEffect, useRef, useState } from "react";
import { skillsChangedServerNotification } from "@limecloud/app-server-client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { subscribeAppServerNotifications } from "@/lib/api/appServerEventBus";
import type { Skill } from "@/lib/api/skills";
import {
  listProtocolSkillEnabledStates,
  matchProtocolSkillEnabledState,
  writeProtocolSkillEnabled,
  type ProtocolSkillEnabledState,
} from "@/lib/api/skillConfig";

export function useProtocolSkillEnabled() {
  const { t } = useTranslation("agent");
  const [protocolSkillEnabledStates, setProtocolSkillEnabledStates] = useState<
    ProtocolSkillEnabledState[]
  >([]);
  const [protocolSkillEnabledPendingKey, setProtocolSkillEnabledPendingKey] =
    useState<string | null>(null);
  const loadGeneration = useRef(0);

  const loadStates = useCallback(() => {
    const generation = ++loadGeneration.current;
    void listProtocolSkillEnabledStates()
      .then((next) => {
        if (generation !== loadGeneration.current) {
          return;
        }
        setProtocolSkillEnabledStates((current) =>
          current.length === 0 && next.length === 0 ? current : next,
        );
      })
      .catch(() => {
        if (generation !== loadGeneration.current) {
          return;
        }
        setProtocolSkillEnabledStates([]);
      });
  }, []);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  useEffect(() => {
    return subscribeAppServerNotifications({
      onNotifications: (notifications) => {
        if (
          notifications.some(
            (notification) =>
              skillsChangedServerNotification(notification) !== undefined,
          )
        ) {
          loadStates();
        }
      },
    });
  }, [loadStates]);

  const onProtocolSkillEnabledChange = useCallback(
    (skill: Skill, enabled: boolean) => {
      const match = matchProtocolSkillEnabledState(
        skill,
        protocolSkillEnabledStates,
      );
      if (!match || protocolSkillEnabledPendingKey) {
        return;
      }
      setProtocolSkillEnabledPendingKey(skill.key);
      void writeProtocolSkillEnabled({ path: match.path, enabled })
        .then((effectiveEnabled) => {
          // 写回结果优先于尚未返回的 skills/changed 重读。
          loadGeneration.current += 1;
          setProtocolSkillEnabledStates((current) =>
            current.map((item) =>
              item.path === match.path
                ? { ...item, enabled: effectiveEnabled }
                : item,
            ),
          );
          toast.success(
            t(
              effectiveEnabled
                ? "skills.workspace.configEnabled.enabledToast"
                : "skills.workspace.configEnabled.disabledToast",
              { name: skill.name },
            ),
          );
        })
        .catch(() => {
          toast.error(
            t("skills.workspace.configEnabled.failedToast", {
              name: skill.name,
            }),
          );
        })
        .finally(() => {
          setProtocolSkillEnabledPendingKey(null);
        });
    },
    [protocolSkillEnabledPendingKey, protocolSkillEnabledStates, t],
  );

  return {
    protocolSkillEnabledStates,
    protocolSkillEnabledPendingKey,
    onProtocolSkillEnabledChange,
  };
}
