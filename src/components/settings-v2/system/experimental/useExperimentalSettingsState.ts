import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  getConfig,
  updateConfig,
  type CrashReportingConfig,
  type ToolCallingConfig,
} from "@/lib/api/appConfig";
import {
  getExperimentalConfig,
  saveExperimentalConfig,
  type ExperimentalFeatures,
} from "@/lib/api/experimentalFeatures";
import { applyCrashReportingSettings } from "@/lib/crashReporting";
import {
  DEFAULT_CRASH_REPORTING_CONFIG,
  normalizeCrashReportingConfig,
} from "@/lib/crashDiagnostic";
import { useSettingsDraft } from "../../_layout/useSettingsDraft";
import {
  DEFAULT_TOOL_CALLING_CONFIG,
  normalizeToolCallingConfig,
} from "./tool-calling-config";

interface CrashDraft {
  enabled: boolean;
  dsn: string;
  environment: string;
  sample_rate: string;
  send_pii: boolean;
}
interface CrashState {
  draft: CrashDraft;
  baseline: CrashDraft;
}
type Message = { type: "success" | "error"; text: string } | null;
const crashFields = [
  "enabled",
  "dsn",
  "environment",
  "sample_rate",
  "send_pii",
] as const;

function fromCrashConfig(config?: CrashReportingConfig): CrashDraft {
  const normalized = normalizeCrashReportingConfig(config);
  return {
    enabled: Boolean(normalized.enabled),
    dsn: normalized.dsn ?? "",
    environment: normalized.environment ?? "production",
    sample_rate: String(normalized.sample_rate ?? 1),
    send_pii: Boolean(normalized.send_pii),
  };
}
function toCrashConfig(draft: CrashDraft) {
  return normalizeCrashReportingConfig({
    ...draft,
    dsn: draft.dsn || null,
    sample_rate:
      draft.sample_rate.trim() === ""
        ? DEFAULT_CRASH_REPORTING_CONFIG.sample_rate
        : Number(draft.sample_rate),
  });
}
function mergeCrashDraft(
  latest: CrashDraft,
  owner: CrashState,
  fields: readonly (keyof CrashDraft)[],
) {
  const merged = { ...latest };
  for (const field of fields) {
    if (owner.draft[field] !== owner.baseline[field])
      Object.assign(merged, { [field]: owner.draft[field] });
  }
  return merged;
}

export function useExperimentalSettingsState() {
  const { t } = useTranslation("settings");
  const translation = useRef(t);
  translation.current = t;
  const lifetime = useRef<object | null>(null);
  const operation = useRef<symbol | null>(null);
  const loadingRef = useRef<object | null>(null);
  const configRef = useRef<ExperimentalFeatures | null>(null);
  const [config, setConfig] = useState<ExperimentalFeatures | null>(null);
  const toolRef = useRef(DEFAULT_TOOL_CALLING_CONFIG);
  const [toolCallingConfig, setToolCallingConfig] = useState(
    DEFAULT_TOOL_CALLING_CONFIG,
  );
  const [crash, setCrash] = useState<CrashState>(() => {
    const draft = fromCrashConfig(DEFAULT_CRASH_REPORTING_CONFIG);
    return { draft, baseline: draft };
  });
  const crashRef = useRef(crash);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessageState] = useState<Message>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMessage = useCallback((next: Message) => {
    if (!lifetime.current) return;
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = null;
    setMessageState(next);
    if (next?.type === "success")
      messageTimer.current = setTimeout(() => {
        messageTimer.current = null;
        if (lifetime.current) setMessageState(null);
      }, 2000);
  }, []);
  useLayoutEffect(() => {
    lifetime.current = {};
    return () => {
      lifetime.current = null;
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);
  const replaceCrash = useCallback((next: CrashState) => {
    crashRef.current = next;
    setCrash(next);
  }, []);
  const dirty = JSON.stringify(crash.draft) !== JSON.stringify(crash.baseline);
  useSettingsDraft({ dirty, saving });

  const loadConfig = useCallback(async () => {
    if (
      (loadingRef.current !== null &&
        loadingRef.current === lifetime.current) ||
      operation.current ||
      JSON.stringify(crashRef.current.draft) !==
        JSON.stringify(crashRef.current.baseline)
    )
      return;
    const scope = lifetime.current;
    const isCurrent = () => scope !== null && lifetime.current === scope;
    loadingRef.current = scope;
    setLoading(true);
    setError(null);
    try {
      const [experimental, full] = await Promise.all([
        getExperimentalConfig(),
        getConfig(),
      ]);
      if (!isCurrent()) return;
      configRef.current = experimental;
      setConfig(experimental);
      const tool = normalizeToolCallingConfig(full.tool_calling);
      toolRef.current = tool;
      setToolCallingConfig(tool);
      const draft = fromCrashConfig(full.crash_reporting);
      replaceCrash({ draft, baseline: draft });
    } catch {
      if (isCurrent())
        setError(
          translation.current("settings.experimental.message.loadFailed"),
        );
    } finally {
      if (loadingRef.current === scope) loadingRef.current = null;
      if (isCurrent()) setLoading(false);
    }
  }, [replaceCrash]);
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const runMutation = useCallback(
    async (
      mutate: (isCurrent: () => boolean) => Promise<void>,
      errorKey: string,
    ) => {
      if (operation.current || !configRef.current || loadingRef.current) return;
      const request = Symbol();
      const scope = lifetime.current;
      const isCurrent = () =>
        scope !== null &&
        lifetime.current === scope &&
        operation.current === request;
      operation.current = request;
      setSaving(true);
      setMessage(null);
      try {
        await mutate(isCurrent);
      } catch {
        if (isCurrent())
          setMessage({ type: "error", text: translation.current(errorKey) });
      } finally {
        if (operation.current === request) {
          operation.current = null;
          if (scope !== null && lifetime.current === scope) setSaving(false);
        }
      }
    },
    [setMessage],
  );

  const handleToggleWebMcp = useCallback(
    () =>
      runMutation(async (isCurrent) => {
        const enabled = !(configRef.current?.webmcp?.enabled ?? false);
        const latest = await getExperimentalConfig();
        if (!isCurrent()) return;
        const next = { ...latest, webmcp: { ...latest.webmcp, enabled } };
        await saveExperimentalConfig(next);
        if (!isCurrent()) return;
        configRef.current = next;
        setConfig(next);
        setMessage({
          type: "success",
          text: translation.current(
            enabled
              ? "settings.experimental.message.webMcpEnabled"
              : "settings.experimental.message.webMcpDisabled",
          ),
        });
      }, "settings.experimental.message.saveFailed"),
    [runMutation, setMessage],
  );

  const toggleToolField = useCallback(
    (
      field: keyof ToolCallingConfig,
      enabledMessage: string,
      disabledMessage: string,
    ) =>
      runMutation(async (isCurrent) => {
        const value = !toolRef.current[field];
        const result = await updateConfig((latest) => {
          if (!isCurrent()) throw new Error("Settings owner unmounted");
          return {
            ...latest,
            tool_calling: {
              ...normalizeToolCallingConfig(latest.tool_calling),
              [field]: value,
            },
          };
        });
        if (!isCurrent()) return;
        const next = normalizeToolCallingConfig(result.tool_calling);
        toolRef.current = next;
        setToolCallingConfig(next);
        setMessage({
          type: "success",
          text: translation.current(value ? enabledMessage : disabledMessage),
        });
      }, "settings.experimental.message.toolCallingSaveFailed"),
    [runMutation, setMessage],
  );

  const persistCrashConfig = useCallback(
    (enabledOnly = false) =>
      runMutation(async (isCurrent) => {
        const owner = crashRef.current;
        const result = await updateConfig((latest) => {
          if (!isCurrent()) throw new Error("Settings owner unmounted");
          const merged = enabledOnly
            ? {
                ...fromCrashConfig(latest.crash_reporting),
                enabled: !owner.draft.enabled,
              }
            : mergeCrashDraft(
                fromCrashConfig(latest.crash_reporting),
                owner,
                crashFields,
              );
          return { ...latest, crash_reporting: toCrashConfig(merged) };
        });
        if (!isCurrent()) return;
        const baseline = fromCrashConfig(result.crash_reporting);
        const remainingFields = enabledOnly
          ? crashFields.filter((field) => field !== "enabled")
          : [];
        replaceCrash({
          baseline,
          draft: mergeCrashDraft(baseline, owner, remainingFields),
        });
        await applyCrashReportingSettings(
          normalizeCrashReportingConfig(result.crash_reporting),
        );
        if (isCurrent())
          setMessage({
            type: "success",
            text: translation.current(
              "settings.experimental.message.crashReportingSaved",
            ),
          });
      }, "settings.experimental.message.crashReportingSaveFailed"),
    [replaceCrash, runMutation, setMessage],
  );

  const handleCrashFieldChange = useCallback(
    (
      field: keyof CrashReportingConfig,
      value: string | boolean | number | null,
    ) => {
      if (operation.current || loadingRef.current || !configRef.current) return;
      const owner = crashRef.current;
      const nextValue =
        field === "enabled" || field === "send_pii"
          ? Boolean(value)
          : String(value ?? "");
      replaceCrash({ ...owner, draft: { ...owner.draft, [field]: nextValue } });
    },
    [replaceCrash],
  );

  return {
    config,
    toolCallingConfig,
    crashConfig: toCrashConfig(crash.draft),
    crashDraft: crash.draft,
    loading,
    saving,
    error,
    message,
    setMessage,
    loadConfig,
    handleToggleWebMcp,
    handleToggleToolCallingEnabled: () =>
      toggleToolField(
        "enabled",
        "settings.experimental.message.toolCallingEnabled",
        "settings.experimental.message.toolCallingDisabled",
      ),
    handleToggleDynamicFiltering: () =>
      toggleToolField(
        "dynamic_filtering",
        "settings.experimental.message.dynamicFilteringEnabled",
        "settings.experimental.message.dynamicFilteringDisabled",
      ),
    handleToggleNativeInputExamples: () =>
      toggleToolField(
        "native_input_examples",
        "settings.experimental.message.nativeInputExamplesEnabled",
        "settings.experimental.message.nativeInputExamplesDisabled",
      ),
    handleCrashEnabledToggle: () => persistCrashConfig(true),
    handleCrashFieldChange,
    handleSaveCrashConfig: () => persistCrashConfig(),
  };
}
