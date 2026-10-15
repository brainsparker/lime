import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  buildClawAgentParams,
  buildHomeAgentParams,
  type StartNewConversation,
} from "@/lib/workspace/navigation";
import type {
  AgentLocation,
  AgentPageParams,
  Page,
  PageParams,
} from "@/types/page";

const NAVIGATION_RESTORE_STORAGE_KEY = "lime.appNavigation.restore.v1";

interface UseAppNavigationResult {
  startNewConversation: StartNewConversation;
  currentPage: Page;
  pageParams: PageParams;
  requestedPage: Page;
  requestedPageParams: PageParams;
  navigationRequestId: number;
  isNavigating: boolean;
  handleNavigate: (page: Page, params?: PageParams) => void;
  returnFromSettings: () => void;
  agentLocation: AgentLocation | null;
  reportAgentLocation: (location: AgentLocation) => void;
}

interface NavigationTarget {
  page: Page;
  params: PageParams;
}

interface NavigationState {
  currentPage: Page;
  currentPageParams: PageParams;
  currentPageParamsKey: string;
  currentRequestId: number;
  requestedPage: Page;
  requestedPageParams: PageParams;
  requestedPageParamsKey: string;
  navigationRequestId: number;
  agentLocation: { requestId: number; value: AgentLocation } | null;
  settingsReturn: NavigationTarget | null;
}

function normalizePageParams(params?: PageParams): PageParams {
  return params ? { ...params } : {};
}

type SerializableNavigationValue =
  | null
  | boolean
  | number
  | string
  | SerializableNavigationValue[]
  | { [key: string]: SerializableNavigationValue };

function normalizeNavigationParamValue(
  value: unknown,
  insideArray = false,
): SerializableNavigationValue | undefined {
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return insideArray ? null : undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    throw new TypeError("BigInt values are not supported in navigation params");
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) => normalizeNavigationParamValue(item, true) ?? null,
    );
  }

  if (typeof value === "object") {
    const toJson = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJson === "function") {
      return normalizeNavigationParamValue(
        (toJson as () => unknown).call(value),
        insideArray,
      );
    }

    const record = value as Record<string, unknown>;
    const normalized: { [key: string]: SerializableNavigationValue } = {};
    for (const key of Object.keys(record).sort()) {
      const normalizedValue = normalizeNavigationParamValue(record[key]);
      if (normalizedValue !== undefined) {
        normalized[key] = normalizedValue;
      }
    }
    return normalized;
  }

  return insideArray ? null : undefined;
}

function serializePageParams(params: PageParams): string {
  return JSON.stringify(normalizeNavigationParamValue(params) ?? {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickRestorableAgentParams(params: unknown): AgentPageParams | null {
  if (!isRecord(params)) {
    return null;
  }

  const initialSessionId = readString(params.initialSessionId);
  if (!initialSessionId) {
    return null;
  }

  return buildClawAgentParams({
    initialSessionId,
    projectId: readString(params.projectId),
    contentId: readString(params.contentId),
    theme: readString(params.theme),
    lockTheme:
      typeof params.lockTheme === "boolean" ? params.lockTheme : undefined,
  });
}

function clearRestoredNavigationState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(NAVIGATION_RESTORE_STORAGE_KEY);
  } catch {
    // sessionStorage 不可用时退化为普通首页导航。
  }
}

function readRestoredNavigationState(): {
  page: Page;
  params: PageParams;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(NAVIGATION_RESTORE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      clearRestoredNavigationState();
      return null;
    }

    const page = parsed.page;
    if (page !== "agent") {
      clearRestoredNavigationState();
      return null;
    }

    const params = pickRestorableAgentParams(parsed.params);
    if (!params) {
      clearRestoredNavigationState();
      return null;
    }

    return {
      page,
      params,
    };
  } catch {
    clearRestoredNavigationState();
    return null;
  }
}

function persistRestorableNavigation(page: Page, params: PageParams): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const restorableParams =
      page === "agent" ? pickRestorableAgentParams(params) : null;
    if (!restorableParams) {
      clearRestoredNavigationState();
      return;
    }

    window.sessionStorage.setItem(
      NAVIGATION_RESTORE_STORAGE_KEY,
      JSON.stringify({
        page,
        params: restorableParams,
      }),
    );
  } catch {
    // sessionStorage 只是 reload 恢复优化，失败时不应阻断主导航。
  }
}

function settingsReturnTarget(current: NavigationState): NavigationTarget {
  if (current.currentPage !== "agent") {
    return { page: current.currentPage, params: current.currentPageParams };
  }

  const params = current.currentPageParams as AgentPageParams;
  const location =
    current.agentLocation?.requestId === current.currentRequestId
      ? current.agentLocation.value
      : null;
  const restorable = pickRestorableAgentParams({
    ...params,
    ...(location
      ? {
          initialSessionId: location.sessionId,
          projectId: location.workspaceId,
        }
      : {}),
  });
  return {
    page: "agent",
    params:
      restorable ??
      buildHomeAgentParams({
        projectId: location?.workspaceId ?? params.projectId,
      }),
  };
}

function requestNavigation(
  current: NavigationState,
  page: Page,
  params?: PageParams,
): NavigationState {
  const nextParams = normalizePageParams(params);
  const nextKey = serializePageParams(nextParams);
  if (
    current.requestedPage === page &&
    current.requestedPageParamsKey === nextKey
  ) {
    return current;
  }
  return {
    ...current,
    requestedPage: page,
    requestedPageParams: nextParams,
    requestedPageParamsKey: nextKey,
    navigationRequestId: current.navigationRequestId + 1,
    settingsReturn:
      page !== "settings"
        ? null
        : current.requestedPage === "settings"
          ? current.settingsReturn
          : settingsReturnTarget(current),
  };
}

export function useAppNavigation(): UseAppNavigationResult {
  const lastNewConversationRequest = useRef(0);
  const [navigationState, setNavigationState] = useState<NavigationState>(
    () => {
      const restored = readRestoredNavigationState();
      if (restored) {
        const restoredPageParamsKey = serializePageParams(restored.params);
        return {
          currentPage: restored.page,
          currentPageParams: restored.params,
          currentPageParamsKey: restoredPageParamsKey,
          requestedPage: restored.page,
          requestedPageParams: restored.params,
          requestedPageParamsKey: restoredPageParamsKey,
          navigationRequestId: 0,
          currentRequestId: 0,
          agentLocation: null,
          settingsReturn: null,
        };
      }

      const initialPageParams = buildHomeAgentParams();
      const initialPageParamsKey = serializePageParams(initialPageParams);
      return {
        currentPage: "agent",
        currentPageParams: initialPageParams,
        currentPageParamsKey: initialPageParamsKey,
        requestedPage: "agent",
        requestedPageParams: initialPageParams,
        requestedPageParamsKey: initialPageParamsKey,
        navigationRequestId: 0,
        currentRequestId: 0,
        agentLocation: null,
        settingsReturn: null,
      };
    },
  );

  const handleNavigate = useCallback((page: Page, params?: PageParams) => {
    setNavigationState((current) => requestNavigation(current, page, params));
  }, []);

  const returnFromSettings = useCallback(() => {
    setNavigationState((current) => {
      if (current.requestedPage !== "settings") return current;
      const target = current.settingsReturn;
      return requestNavigation(
        current,
        target?.page ?? "agent",
        target?.params ?? buildHomeAgentParams(),
      );
    });
  }, []);

  const requestId = navigationState.navigationRequestId;
  const reportAgentLocation = useCallback(
    (location: AgentLocation) => {
      setNavigationState((current) => {
        if (
          current.navigationRequestId !== requestId ||
          current.requestedPage !== "agent"
        )
          return current;
        const value = {
          sessionId: readString(location.sessionId) ?? null,
          workspaceId: readString(location.workspaceId) ?? null,
        };
        if (
          current.agentLocation?.requestId === requestId &&
          current.agentLocation.value.sessionId === value.sessionId &&
          current.agentLocation.value.workspaceId === value.workspaceId
        )
          return current;
        return { ...current, agentLocation: { requestId, value } };
      });
    },
    [requestId],
  );

  const startNewConversation = useCallback<StartNewConversation>(
    ({ projectId, freshDraft }) => {
      const id = Math.max(Date.now(), lastNewConversationRequest.current + 1);
      lastNewConversationRequest.current = id;
      const workspaceId = projectId?.trim() || null;
      handleNavigate(
        "agent",
        buildHomeAgentParams({
          projectId: workspaceId ?? undefined,
          newChatAt: id,
          newConversationRequest: { id, workspaceId, freshDraft },
        }),
      );
    },
    [handleNavigate],
  );

  useLayoutEffect(() => {
    setNavigationState((current) => {
      if (
        current.currentPage === current.requestedPage &&
        current.currentPageParamsKey === current.requestedPageParamsKey &&
        current.currentRequestId === current.navigationRequestId
      ) {
        return current;
      }

      return {
        ...current,
        currentPage: current.requestedPage,
        currentPageParams: current.requestedPageParams,
        currentPageParamsKey: current.requestedPageParamsKey,
        currentRequestId: current.navigationRequestId,
      };
    });
  }, [
    navigationState.requestedPage,
    navigationState.requestedPageParamsKey,
    requestId,
  ]);

  useLayoutEffect(() => {
    persistRestorableNavigation(
      navigationState.requestedPage,
      navigationState.requestedPageParams,
    );
  }, [navigationState.requestedPage, navigationState.requestedPageParams]);

  const isNavigating =
    navigationState.currentPage !== navigationState.requestedPage ||
    navigationState.currentPageParamsKey !==
      navigationState.requestedPageParamsKey;

  return {
    currentPage: navigationState.currentPage,
    pageParams: navigationState.currentPageParams,
    requestedPage: navigationState.requestedPage,
    requestedPageParams: navigationState.requestedPageParams,
    navigationRequestId: navigationState.navigationRequestId,
    isNavigating,
    handleNavigate,
    startNewConversation,
    returnFromSettings,
    reportAgentLocation,
    agentLocation:
      navigationState.agentLocation?.requestId === requestId
        ? navigationState.agentLocation.value
        : null,
  };
}
