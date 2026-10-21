import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeAppConfigChanged } from "@/lib/api/appConfig";
import {
  getDesktopPreferences,
  updateDesktopPreference,
} from "@/lib/api/desktopPreferences";
import type { DesktopConfig } from "@/lib/api/appConfigTypes";

export function useDesktopPreferences() {
  const [configured, setConfigured] = useState<DesktopConfig | null>(null);
  const [error, setError] = useState<"load" | "save" | null>(null);
  const [pending, setPending] = useState(false);
  const alive = useRef(false);
  const saving = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const value = await getDesktopPreferences();
      if (alive.current && revision.current === current) {
        setConfigured(value);
        setError(null);
      }
    } catch {
      if (alive.current && revision.current === current) setError("load");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const unsubscribe = subscribeAppConfigChanged(() => {
      if (!saving.current) void refresh();
    });
    return () => {
      alive.current = false;
      revision.current += 1;
      unsubscribe();
    };
  }, [refresh]);

  const save = async <K extends keyof DesktopConfig>(
    key: K,
    value: NonNullable<DesktopConfig[K]>,
  ) => {
    if (!configured || saving.current) return;
    const previous = configured;
    const current = ++revision.current;
    saving.current = true;
    setPending(true);
    setError(null);
    setConfigured({ ...previous, [key]: value });
    try {
      const saved = await updateDesktopPreference(key, value);
      if (alive.current && revision.current === current) setConfigured(saved);
    } catch {
      let restored = previous;
      try {
        restored = await getDesktopPreferences({ forceRefresh: true });
      } catch {
        // 保留上次可用投影；不把未知保存结果当作成功。
      }
      if (alive.current && revision.current === current) {
        setConfigured(restored);
        setError("save");
      }
    } finally {
      saving.current = false;
      if (alive.current) setPending(false);
    }
  };

  return { configured, error, pending, refresh, save };
}
