import { useCallback, useEffect, useRef, useState } from "react";

export interface ProviderSettingDraftState {
  dirty: boolean;
  saving: boolean;
  apiHostDraft: string;
  apiHostDirty: boolean;
  savingApiHost: boolean;
  apiKeyDraft: string;
  apiKeyDirty: boolean;
  savingApiKey: boolean;
}

interface UseProviderSettingDraftOptions {
  providerId: string;
  apiHost: unknown;
}

interface UseProviderSettingDraftResult
  extends Omit<ProviderSettingDraftState, "dirty" | "saving"> {
  setApiHostDraft: (value: string) => void;
  setApiKeyDraft: (value: string) => void;
  saveApiHost: (
    persist: (providerId: string, value: string) => Promise<void>,
  ) => Promise<boolean>;
  saveApiKey: (
    persist: (providerId: string, value: string) => Promise<void>,
  ) => Promise<boolean>;
  resetDrafts: () => void;
}

function normalizeHost(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Provider 表单的唯一草稿生命周期。
 *
 * Provider 列表刷新会重新投影 props，但不会重新挂载详情页。这里按
 * Provider ID 隔离生命周期，并用 revision 防止旧保存结果覆盖在途新编辑。
 */
export function useProviderSettingDraft({
  providerId,
  apiHost,
}: UseProviderSettingDraftOptions): UseProviderSettingDraftResult {
  const normalizedApiHost = normalizeHost(apiHost);
  const [apiHostDraft, setApiHostDraftState] = useState(normalizedApiHost);
  const [apiHostDirty, setApiHostDirty] = useState(false);
  const [savingApiHost, setSavingApiHost] = useState(false);
  const [apiKeyDraft, setApiKeyDraftState] = useState("");
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);

  const providerIdRef = useRef(providerId);
  const lastProviderIdRef = useRef(providerId);
  const mountedRef = useRef(true);
  const apiHostDraftRef = useRef(apiHostDraft);
  const apiKeyDraftRef = useRef(apiKeyDraft);
  const apiHostDirtyRef = useRef(apiHostDirty);
  const apiKeyDirtyRef = useRef(apiKeyDirty);
  const apiHostRevisionRef = useRef(0);
  const apiKeyRevisionRef = useRef(0);
  const apiHostOperationRef = useRef(0);
  const apiKeyOperationRef = useRef(0);

  providerIdRef.current = providerId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const previousProviderId = lastProviderIdRef.current;
    lastProviderIdRef.current = providerId;
    providerIdRef.current = providerId;
    if (previousProviderId === providerId) {
      return;
    }

    apiHostRevisionRef.current += 1;
    apiKeyRevisionRef.current += 1;
    apiHostDraftRef.current = normalizedApiHost;
    apiKeyDraftRef.current = "";
    apiHostDirtyRef.current = false;
    apiKeyDirtyRef.current = false;
    setApiHostDraftState(normalizedApiHost);
    setApiHostDirty(false);
    setSavingApiHost(false);
    setApiKeyDraftState("");
    setApiKeyDirty(false);
    setSavingApiKey(false);
  }, [normalizedApiHost, providerId]);

  useEffect(() => {
    if (apiHostDirtyRef.current) {
      return;
    }

    apiHostDraftRef.current = normalizedApiHost;
    setApiHostDraftState(normalizedApiHost);
  }, [normalizedApiHost]);

  const setApiHostDraft = useCallback((value: string) => {
    apiHostDraftRef.current = value;
    apiHostDirtyRef.current = true;
    apiHostRevisionRef.current += 1;
    setApiHostDraftState(value);
    setApiHostDirty(true);
  }, []);

  const setApiKeyDraft = useCallback((value: string) => {
    apiKeyDraftRef.current = value;
    apiKeyDirtyRef.current = true;
    apiKeyRevisionRef.current += 1;
    setApiKeyDraftState(value);
    setApiKeyDirty(true);
  }, []);

  const saveApiHost = useCallback(
    async (
      persist: (currentProviderId: string, value: string) => Promise<void>,
    ) => {
      if (
        !apiHostDirtyRef.current ||
        !apiHostDraftRef.current.trim() ||
        !mountedRef.current
      ) {
        return false;
      }

      const operation = ++apiHostOperationRef.current;
      const revision = apiHostRevisionRef.current;
      const savingProviderId = providerIdRef.current;
      const value = apiHostDraftRef.current.trim();
      setSavingApiHost(true);

      try {
        await persist(savingProviderId, value);
        const current =
          mountedRef.current &&
          providerIdRef.current === savingProviderId &&
          apiHostRevisionRef.current === revision;
        if (current) {
          apiHostDraftRef.current = value;
          apiHostDirtyRef.current = false;
          setApiHostDraftState(value);
          setApiHostDirty(false);
        }
        return current;
      } finally {
        if (
          mountedRef.current &&
          providerIdRef.current === savingProviderId &&
          apiHostOperationRef.current === operation
        ) {
          setSavingApiHost(false);
        }
      }
    },
    [],
  );

  const saveApiKey = useCallback(
    async (
      persist: (currentProviderId: string, value: string) => Promise<void>,
    ) => {
      if (
        !apiKeyDirtyRef.current ||
        !apiKeyDraftRef.current.trim() ||
        !mountedRef.current
      ) {
        return false;
      }

      const operation = ++apiKeyOperationRef.current;
      const revision = apiKeyRevisionRef.current;
      const savingProviderId = providerIdRef.current;
      const value = apiKeyDraftRef.current.trim();
      setSavingApiKey(true);

      try {
        await persist(savingProviderId, value);
        const current =
          mountedRef.current &&
          providerIdRef.current === savingProviderId &&
          apiKeyRevisionRef.current === revision;
        if (current) {
          apiKeyDraftRef.current = "";
          apiKeyDirtyRef.current = false;
          setApiKeyDraftState("");
          setApiKeyDirty(false);
        }
        return current;
      } finally {
        if (
          mountedRef.current &&
          providerIdRef.current === savingProviderId &&
          apiKeyOperationRef.current === operation
        ) {
          setSavingApiKey(false);
        }
      }
    },
    [],
  );

  const resetDrafts = useCallback(() => {
    apiHostRevisionRef.current += 1;
    apiKeyRevisionRef.current += 1;
    apiHostDraftRef.current = normalizedApiHost;
    apiKeyDraftRef.current = "";
    apiHostDirtyRef.current = false;
    apiKeyDirtyRef.current = false;
    setApiHostDraftState(normalizedApiHost);
    setApiHostDirty(false);
    setSavingApiHost(false);
    setApiKeyDraftState("");
    setApiKeyDirty(false);
    setSavingApiKey(false);
  }, [normalizedApiHost]);

  return {
    apiHostDraft,
    apiHostDirty,
    savingApiHost,
    apiKeyDraft,
    apiKeyDirty,
    savingApiKey,
    setApiHostDraft,
    setApiKeyDraft,
    saveApiHost,
    saveApiKey,
    resetDrafts,
  };
}
