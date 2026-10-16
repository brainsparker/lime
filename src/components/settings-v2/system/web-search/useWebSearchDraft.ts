import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConfig, updateConfig } from "@/lib/api/appConfig";
import {
  hasInvalidCustomEngine,
  mergeWebSearchDraft,
  readWebSearchDraft,
  type WebSearchDraft,
  type WebSearchFormProps,
} from "./webSearchConfig";

export function useWebSearchDraft() {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState(() => readWebSearchDraft());
  const [snapshot, setSnapshot] = useState(() => readWebSearchDraft());
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    key:
      | "settings.webSearch.message.loadFailed"
      | "settings.webSearch.message.saveFailed"
      | "settings.webSearch.message.saved"
      | "settings.webSearch.mse.templateStatus.notReady";
  } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const mounted = useRef(false);
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const fieldRevisions = useRef<Partial<Record<keyof WebSearchDraft, number>>>(
    {},
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot);

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    void getConfig().then(
      (config) => {
        if (disposed) return;
        const next = readWebSearchDraft(config);
        loaded.current = true;
        setReady(true);
        setDraft(next);
        setSnapshot(next);
        setLoading(false);
      },
      () => {
        if (disposed) return;
        // Backend messages can contain config values; only show localized context.
        setMessage({
          type: "error",
          key: "settings.webSearch.message.loadFailed",
        });
        setLoading(false);
      },
    );
    return () => {
      disposed = true;
      mounted.current = false;
    };
  }, [loadAttempt]);

  const change: WebSearchFormProps["change"] = useCallback((key, value) => {
    revision.current += 1;
    fieldRevisions.current[key] = revision.current;
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  async function save() {
    if (!loaded.current || inFlight.current || !dirty) return;
    if (
      (draft.mseCustomEngineName !== snapshot.mseCustomEngineName ||
        draft.mseCustomEngineTemplate !== snapshot.mseCustomEngineTemplate) &&
      hasInvalidCustomEngine(draft)
    ) {
      setMessage({
        type: "error",
        key: "settings.webSearch.mse.templateStatus.notReady",
      });
      return;
    }
    const submittedDraft = draft;
    const submittedSnapshot = snapshot;
    const submittedRevision = revision.current;
    const submittedFields = { ...fieldRevisions.current };
    inFlight.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const config = await updateConfig((current) =>
        mergeWebSearchDraft(current, submittedDraft, submittedSnapshot),
      );
      if (!mounted.current) return;
      const saved = readWebSearchDraft(config);
      setSnapshot(saved);
      setDraft((current) => {
        if (revision.current === submittedRevision) return saved;
        const next = { ...saved };
        for (const key of Object.keys(saved) as (keyof WebSearchDraft)[]) {
          if (fieldRevisions.current[key] !== submittedFields[key]) {
            Object.assign(next, { [key]: current[key] });
          }
        }
        return next;
      });
      setMessage({
        type: "success",
        key: "settings.webSearch.message.saved",
      });
    } catch {
      if (!mounted.current) return;
      setMessage({
        type: "error",
        key: "settings.webSearch.message.saveFailed",
      });
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function reset() {
    if (inFlight.current) return;
    revision.current += 1;
    setDraft(snapshot);
    setMessage(null);
  }

  function reload() {
    if (loaded.current || inFlight.current || loading) return;
    setLoading(true);
    setMessage(null);
    setLoadAttempt((current) => current + 1);
  }

  return {
    draft,
    change,
    dirty,
    loading,
    ready,
    saving,
    message: message ? { type: message.type, text: t(message.key) } : null,
    save,
    reset,
    reload,
  };
}
