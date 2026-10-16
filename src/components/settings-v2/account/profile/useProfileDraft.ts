import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getConfig,
  updateConfig,
  type ConfigUpdater,
} from "@/lib/api/appConfig";
import {
  mergeProfileField,
  readProfile,
  type ProfileField,
  normalizeProfileValue,
  isProfileValueValid,
} from "./profileConfig";

const MESSAGE_KEYS = {
  loadFailed: "settings.profile.message.loadFailed",
  saveFailed: "settings.profile.message.saveFailed",
  saved: "settings.profile.message.saved",
} as const;

export function useProfileDraft() {
  const { t } = useTranslation("settings");
  const [profile, setProfile] = useState(readProfile);
  const [editingField, setEditingField] = useState<ProfileField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [messageKey, setMessageKey] = useState<
    keyof typeof MESSAGE_KEYS | null
  >(null);
  const mounted = useRef(false);
  const loaded = useRef(false);
  const loadingRef = useRef(true);
  const inFlight = useRef(false);
  const editRevision = useRef(0);
  const fieldDirty =
    editingField !== null && editValue !== profile[editingField];
  const dirty = fieldDirty;
  const valid =
    editingField !== null && isProfileValueValid(editingField, editValue);

  useEffect(() => {
    let disposed = false;
    mounted.current = true;
    loaded.current = false;
    loadingRef.current = true;
    setLoading(true);
    void getConfig({ forceRefresh: true }).then(
      (config) => {
        if (disposed) return;
        setProfile(readProfile(config));
        loaded.current = true;
        setReady(true);
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

  const changeEditValue = (value: string) => {
    if (!editingField) return;
    editRevision.current += 1;
    setEditValue(normalizeProfileValue(editingField, value));
    setMessageKey(null);
  };

  const startEdit = (field: ProfileField) => {
    if (!loaded.current || inFlight.current || fieldDirty) return;
    editRevision.current += 1;
    setEditingField(field);
    setEditValue(profile[field]);
    setMessageKey(null);
  };
  const cancelEdit = () => {
    if (inFlight.current) return;
    editRevision.current += 1;
    setEditingField(null);
    setEditValue("");
    setMessageKey(null);
  };

  const persist = async (update: ConfigUpdater, accepted?: () => void) => {
    if (!loaded.current || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setMessageKey(null);
    try {
      const config = await updateConfig(update);
      if (!mounted.current) return;
      setProfile(readProfile(config));
      accepted?.();
      setMessageKey("saved");
    } catch {
      if (mounted.current) setMessageKey("saveFailed");
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const saveEdit = () => {
    if (!editingField || !fieldDirty || !valid) return;
    const revision = editRevision.current;
    void persist(
      (current) => mergeProfileField(current, editingField, editValue),
      () => {
        if (editRevision.current !== revision) return;
        setEditingField(null);
        setEditValue("");
      },
    );
  };
  const retryLoad = () => {
    if (loaded.current || loadingRef.current || inFlight.current) return;
    loadingRef.current = true;
    setMessageKey(null);
    setAttempt((current) => current + 1);
  };

  return {
    profile,
    editingField,
    editValue,
    loading,
    ready,
    saving,
    dirty,
    fieldDirty,
    valid,
    startEdit,
    cancelEdit,
    saveEdit,
    retryLoad,
    changeEditValue,
    message: messageKey
      ? {
          type:
            messageKey === "saved" ? ("success" as const) : ("error" as const),
          text: t(MESSAGE_KEYS[messageKey]),
        }
      : null,
  };
}
