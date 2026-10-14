import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { toast } from "sonner";
import { getLimeI18n } from "@/i18n/createI18n";
import type { ModelReasoningEffortLevel } from "@/lib/types/modelRegistry";
import type { AgentThreadSettingsUpdate } from "@/lib/api/agentRuntime/threadSettingsNotifications";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { SessionModelPreference } from "./agentChatShared";

interface PendingModelSelection extends SessionModelPreference {
  reasoningEffort: ModelReasoningEffortLevel | "";
}

interface SettingsConfirmation {
  promise: Promise<void>;
  resolve: () => void;
}

export function useAgentModelSettingsSync(options: {
  workspaceId: string;
  runtime: Pick<
    AgentRuntimeAdapter,
    "setSessionProviderSelection" | "listenToThreadSettings"
  >;
  pendingSessionMetadataSyncCancelRef?: MutableRefObject<(() => void) | null>;
  onCanonical: (update: AgentThreadSettingsUpdate) => void;
}) {
  const { listenToThreadSettings, setSessionProviderSelection } =
    options.runtime;
  const pending = useRef(new Map<string, PendingModelSelection>());
  const drafts = useRef(new Map<string, PendingModelSelection>());
  const inFlight = useRef(new Map<string, Promise<void>>());
  const confirmations = useRef(new Map<string, SettingsConfirmation>());
  const generation = useRef(0);
  const onCanonical = useRef(options.onCanonical);
  onCanonical.current = options.onCanonical;

  useEffect(() => {
    const unsubscribe = listenToThreadSettings?.((update) => {
      onCanonical.current(update);
      for (const sessionId of update.sessionIds) {
        confirmations.current.get(sessionId)?.resolve();
      }
    });
    const currentConfirmations = confirmations.current;
    const currentPending = pending.current;
    const currentDrafts = drafts.current;
    const currentInFlight = inFlight.current;
    return () => {
      generation.current += 1;
      unsubscribe?.();
      for (const confirmation of currentConfirmations.values())
        confirmation.resolve();
      currentConfirmations.clear();
      currentPending.clear();
      currentDrafts.clear();
      currentInFlight.clear();
    };
  }, [listenToThreadSettings, options.workspaceId]);

  const scheduleSessionProviderSelectionSync = useCallback(
    (
      targetSessionId: string,
      providerType: string,
      model: string,
      reasoningEffort: ModelReasoningEffortLevel | "",
    ) => {
      const sessionId = targetSessionId.trim();
      if (!sessionId) return;
      const cancelRef = options.pendingSessionMetadataSyncCancelRef;
      cancelRef?.current?.();
      if (cancelRef) cancelRef.current = null;
      const draft = { providerType, model, reasoningEffort };
      pending.current.set(sessionId, draft);
      drafts.current.set(sessionId, draft);
      if (inFlight.current.has(sessionId)) return;
      const requestGeneration = generation.current;
      let finish!: () => void;
      const completion = new Promise<void>((resolve) => {
        finish = resolve;
      });
      inFlight.current.set(sessionId, completion);
      queueMicrotask(() => {
        void (async () => {
          try {
            while (generation.current === requestGeneration) {
              const selection = pending.current.get(sessionId);
              if (!selection) break;
              pending.current.delete(sessionId);
              let confirm!: () => void;
              const confirmation: SettingsConfirmation = {
                promise: new Promise<void>((resolve) => {
                  confirm = resolve;
                }),
                resolve: () => confirm(),
              };
              confirmations.current.set(sessionId, confirmation);
              try {
                await setSessionProviderSelection(
                  sessionId,
                  selection.providerType,
                  selection.model,
                  selection.reasoningEffort,
                );
                // ACK 不提供有效设置；发送下一回合前必须等真实 canonical 通知。
                if (listenToThreadSettings) await confirmation.promise;
              } catch (error) {
                if (
                  generation.current === requestGeneration &&
                  !pending.current.has(sessionId)
                ) {
                  console.warn(
                    "[AgentChat] 更新 thread model settings 失败:",
                    error,
                  );
                  toast.error(
                    String(
                      getLimeI18n().t("agentChat.modelSettings.updateFailed", {
                        ns: "agent",
                        message:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }),
                    ),
                  );
                }
              } finally {
                if (confirmations.current.get(sessionId) === confirmation)
                  confirmations.current.delete(sessionId);
                if (drafts.current.get(sessionId) === selection)
                  drafts.current.delete(sessionId);
              }
            }
          } finally {
            if (inFlight.current.get(sessionId) === completion)
              inFlight.current.delete(sessionId);
            finish();
          }
        })();
      });
    },
    [
      options.pendingSessionMetadataSyncCancelRef,
      setSessionProviderSelection,
      listenToThreadSettings,
    ],
  );

  const waitForSessionProviderSelectionSync = useCallback(
    (sessionId: string) =>
      inFlight.current.get(sessionId.trim()) ?? Promise.resolve(),
    [],
  );

  return {
    pendingSessionProviderSelectionSyncRef: drafts,
    scheduleSessionProviderSelectionSync,
    waitForSessionProviderSelectionSync,
  };
}
