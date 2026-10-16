import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConfig, updateConfig } from "@/lib/api/appConfig";
import { normalizeMemoryConfig } from "./memoryConfig";

export function useMemorySettingsDraft(showMessage: (message: string) => void) {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState(() => normalizeMemoryConfig());
  const [snapshot, setSnapshot] = useState(() => normalizeMemoryConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    async function load() {
      try {
        const nextConfig = await getConfig();
        if (disposed) return;
        const memory = normalizeMemoryConfig(nextConfig.memory);
        loaded.current = true;
        setDraft(memory);
        setSnapshot(memory);
      } catch (error) {
        if (!disposed) console.error("加载记忆设置失败:", error);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
      mounted.current = false;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(snapshot),
    [draft, snapshot],
  );

  async function save() {
    if (!loaded.current || inFlight.current) return;
    const submittedDraft = draft;
    const memory = normalizeMemoryConfig(submittedDraft);
    inFlight.current = true;
    setSaving(true);
    try {
      const updatedConfig = await updateConfig((current) => ({
        ...current,
        memory,
      }));
      if (!mounted.current) return;
      const savedMemory = normalizeMemoryConfig(updatedConfig.memory);
      setSnapshot(savedMemory);
      setDraft((current) =>
        current === submittedDraft ? savedMemory : current,
      );
      showMessage(t("settings.memory.message.saved"));
    } catch (error) {
      if (!mounted.current) return;
      console.error("保存记忆设置失败:", error);
      showMessage(t("settings.memory.message.saveFailed"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function reset() {
    if (inFlight.current) return;
    setDraft(snapshot);
    showMessage(t("settings.memory.message.restored"));
  }

  return { draft, setDraft, dirty, loading, saving, save, reset };
}
