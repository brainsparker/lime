import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConfig, updateConfig } from "@/lib/api/appConfig";
import {
  countToolOverrides,
  mergeExecutionPolicyDraft,
  readExecutionPolicyDraft,
  type ExecutionPolicyDraft,
  type ExecutionPolicyField,
} from "./executionPolicyConfig";

const MESSAGE_KEYS = {
  loadFailed: "settings.executionPolicy.message.loadFailed",
  saveFailed: "settings.executionPolicy.message.saveFailed",
  saved: "settings.executionPolicy.message.saved",
} as const;

export function useExecutionPolicyDraft() {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState(readExecutionPolicyDraft);
  const [snapshot, setSnapshot] = useState(readExecutionPolicyDraft);
  const [toolOverrideCount, setToolOverrideCount] = useState(0);
  const [hasBashOverride, setHasBashOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [messageKey, setMessageKey] = useState<
    "loadFailed" | "saveFailed" | "saved" | null
  >(null);
  const mounted = useRef(false);
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const loadingRef = useRef(true);
  const revision = useRef(0);
  const fields = useRef<Partial<Record<ExecutionPolicyField, number>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot);

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    loaded.current = false;
    loadingRef.current = true;
    setLoading(true);
    setReady(false);
    void getConfig({ forceRefresh: true }).then(
      (config) => {
        if (disposed) return;
        const next = readExecutionPolicyDraft(config);
        loaded.current = true;
        setReady(true);
        setDraft(next);
        setSnapshot(next);
        setToolOverrideCount(countToolOverrides(config));
        setHasBashOverride(
          Boolean(
            config.agent?.tool_execution?.tool_overrides?.bash ||
            config.agent?.tool_execution?.tool_overrides?.Bash,
          ),
        );
        loadingRef.current = false;
        setLoading(false);
      },
      () => {
        if (disposed) return;
        setMessageKey("loadFailed");
        loadingRef.current = false;
        setLoading(false);
      },
    );
    return () => {
      disposed = true;
      mounted.current = false;
    };
  }, [attempt]);

  const change = useCallback(
    <K extends ExecutionPolicyField>(
      field: K,
      value:
        | ExecutionPolicyDraft[K]
        | ((current: ExecutionPolicyDraft[K]) => ExecutionPolicyDraft[K]),
    ) => {
      if (!loaded.current) return;
      fields.current[field] = ++revision.current;
      setDraft((current) => ({
        ...current,
        [field]: typeof value === "function" ? value(current[field]) : value,
      }));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!loaded.current || inFlight.current || !dirty) return;
    const submitted = draft;
    const baseline = snapshot;
    const submittedFields = { ...fields.current };
    inFlight.current = true;
    setSaving(true);
    setMessageKey(null);
    try {
      const config = await updateConfig((current) =>
        mergeExecutionPolicyDraft(current, submitted, baseline),
      );
      if (!mounted.current) return;
      const saved = readExecutionPolicyDraft(config);
      setSnapshot(saved);
      setToolOverrideCount(countToolOverrides(config));
      setHasBashOverride(
        Boolean(
          config.agent?.tool_execution?.tool_overrides?.bash ||
          config.agent?.tool_execution?.tool_overrides?.Bash,
        ),
      );
      setDraft((current) => {
        const next = { ...saved };
        for (const field of Object.keys(saved) as ExecutionPolicyField[]) {
          if (fields.current[field] !== submittedFields[field])
            Object.assign(next, { [field]: current[field] });
        }
        return next;
      });
      setMessageKey("saved");
    } catch {
      if (mounted.current) setMessageKey("saveFailed");
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [dirty, draft, snapshot]);

  const reload = useCallback(() => {
    if (dirty || inFlight.current || loadingRef.current) return;
    loadingRef.current = true;
    loaded.current = false;
    setReady(false);
    setMessageKey(null);
    setAttempt((current) => current + 1);
  }, [dirty]);

  return {
    draft,
    change,
    dirty,
    loading,
    ready,
    saving,
    reload,
    save,
    toolOverrideCount:
      toolOverrideCount +
      (!hasBashOverride &&
      draft.bashWarningPolicy !== snapshot.bashWarningPolicy
        ? 1
        : 0),
    message: messageKey
      ? {
          type:
            messageKey === "saved" ? ("success" as const) : ("error" as const),
          text: t(MESSAGE_KEYS[messageKey]),
        }
      : null,
  };
}
