import { useRef, useState } from "react";
import { Loader2, Square, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cleanBackgroundTerminals } from "@/lib/api/backgroundTerminals";
import type { BackgroundTerminal } from "./localConversationBackgroundTerminalSignals";

export function BackgroundTerminalList({
  threadId,
  terminals,
  onOpenTerminal,
  onRefresh,
}: {
  threadId: string;
  terminals: readonly BackgroundTerminal[];
  onOpenTerminal?: (terminal: BackgroundTerminal) => void;
  onRefresh?: () => void | Promise<unknown>;
}) {
  const { t } = useTranslation("agent");
  const [stoppingItemId, setStoppingItemId] = useState<string | null>(null);
  const [stopFailed, setStopFailed] = useState(false);
  const pending = useRef(false);
  const stopAll = async (itemId: string) => {
    if (pending.current) return;
    pending.current = true;
    setStoppingItemId(itemId);
    setStopFailed(false);
    try {
      await cleanBackgroundTerminals(threadId);
      await onRefresh?.();
    } catch {
      setStopFailed(true);
    } finally {
      pending.current = false;
      setStoppingItemId(null);
    }
  };
  return (
    <>
      {terminals.map((terminal) => {
        const label = terminal.command.trim() || t("agentChat.summary.backgroundTerminal");
        return (
          <div
            key={`${terminal.turn_id}:${terminal.id}`}
            className="group flex min-h-7 min-w-0 items-center gap-1 rounded-lg hover:bg-[color:var(--lime-surface-hover)]"
          >
            <button
              type="button"
              title={label}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => onOpenTerminal?.(terminal)}
              disabled={!onOpenTerminal}
            >
              <Terminal className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
            <button
              type="button"
              aria-label={t("agentChat.summary.stopBackgroundTerminals")}
              title={t("agentChat.summary.stopBackgroundTerminals")}
              disabled={stoppingItemId !== null}
              onClick={() => void stopAll(terminal.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 hover:bg-[color:var(--lime-chrome-tab-hover)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-50"
            >
              {stoppingItemId === terminal.id ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Square className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          </div>
        );
      })}
      {stopFailed ? (
        <p role="alert" className="py-1 text-xs text-[color:var(--lime-text-muted)]">
          {t("agentChat.summary.stopBackgroundTerminalsError")}
        </p>
      ) : null}
    </>
  );
}
