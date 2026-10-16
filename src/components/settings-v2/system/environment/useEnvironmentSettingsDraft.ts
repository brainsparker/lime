import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getConfig,
  getEnvironmentPreview,
  updateConfig,
  type EnvironmentPreview,
} from "@/lib/api/appConfig";
import {
  mergeEnvironmentDraft,
  readEnvironmentDraft,
  type EnvironmentDraft,
  type EnvironmentDraftField,
} from "./environmentConfig";

export function useEnvironmentSettingsDraft() {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState(() => readEnvironmentDraft());
  const [snapshot, setSnapshot] = useState(() => readEnvironmentDraft());
  const [preview, setPreview] = useState<EnvironmentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    key:
      | "settings.environment.message.loadFailed"
      | "settings.environment.message.refreshFailed"
      | "settings.environment.message.saveFailed"
      | "settings.environment.message.saved";
  } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const mounted = useRef(false);
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const revision = useRef(0);
  const previewRequest = useRef(0);
  const fieldRevisions = useRef<Partial<Record<EnvironmentDraftField, number>>>(
    {},
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot);

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    setLoading(true);
    void Promise.all([getConfig(), getEnvironmentPreview()]).then(
      ([config, nextPreview]) => {
        if (disposed) return;
        const nextDraft = readEnvironmentDraft(config);
        loaded.current = true;
        setReady(true);
        setDraft(nextDraft);
        setSnapshot(nextDraft);
        setPreview(nextPreview);
        setLoading(false);
      },
      () => {
        if (disposed) return;
        loaded.current = false;
        setReady(false);
        setMessage({
          type: "error",
          key: "settings.environment.message.loadFailed",
        });
        setLoading(false);
      },
    );
    return () => {
      disposed = true;
      mounted.current = false;
      previewRequest.current += 1;
    };
  }, [loadAttempt]);

  const change = useCallback(
    <K extends EnvironmentDraftField>(field: K, value: EnvironmentDraft[K]) => {
      revision.current += 1;
      fieldRevisions.current[field] = revision.current;
      setDraft((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const refreshPreview = useCallback(async () => {
    const request = ++previewRequest.current;
    setRefreshingPreview(true);
    try {
      const nextPreview = await getEnvironmentPreview();
      if (mounted.current && request === previewRequest.current) {
        setPreview(nextPreview);
        setMessage(null);
      }
    } catch {
      if (mounted.current && request === previewRequest.current) {
        setMessage({
          type: "error",
          key: "settings.environment.message.refreshFailed",
        });
      }
    } finally {
      if (mounted.current && request === previewRequest.current)
        setRefreshingPreview(false);
    }
  }, []);

  const save = useCallback(async () => {
    if (!loaded.current || inFlight.current || !dirty) return;

    const submittedDraft = draft;
    const submittedSnapshot = snapshot;
    const submittedRevision = revision.current;
    const submittedFields = { ...fieldRevisions.current };
    const request = ++previewRequest.current;
    setRefreshingPreview(false);
    inFlight.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const config = await updateConfig((current) =>
        mergeEnvironmentDraft(current, submittedDraft, submittedSnapshot),
      );
      if (!mounted.current) return;

      const saved = readEnvironmentDraft(config);
      setSnapshot(saved);
      setDraft((current) => {
        if (revision.current === submittedRevision) return saved;
        const next = { ...saved };
        for (const field of Object.keys(saved) as EnvironmentDraftField[]) {
          if (fieldRevisions.current[field] !== submittedFields[field]) {
            Object.assign(next, { [field]: current[field] });
          }
        }
        return next;
      });

      try {
        const nextPreview = await getEnvironmentPreview();
        if (!mounted.current || request !== previewRequest.current) return;
        setPreview(nextPreview);
        setMessage({
          type: "success",
          key: "settings.environment.message.saved",
        });
      } catch {
        if (!mounted.current || request !== previewRequest.current) return;
        setMessage({
          type: "error",
          key: "settings.environment.message.refreshFailed",
        });
      }
    } catch {
      if (mounted.current) {
        setMessage({
          type: "error",
          key: "settings.environment.message.saveFailed",
        });
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [dirty, draft, snapshot]);

  const reload = useCallback(() => {
    if (loaded.current || inFlight.current || loading) return;
    setLoading(true);
    setMessage(null);
    setReady(false);
    setLoadAttempt((current) => current + 1);
  }, [loading]);

  return {
    draft,
    change,
    dirty,
    loading,
    ready,
    preview,
    refreshingPreview,
    saving,
    message: message ? { type: message.type, text: t(message.key) } : null,
    refreshPreview,
    reload,
    save,
  };
}
