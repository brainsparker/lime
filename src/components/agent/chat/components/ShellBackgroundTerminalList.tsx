import React from "react";
import { agentText } from "./harnessPanelText";
import {
  cleanBackgroundTerminals,
  listBackgroundTerminals,
  terminateBackgroundTerminalForItem,
  type BackgroundTerminalsAppServerClient,
} from "@/lib/api/backgroundTerminals";
import type { AppServerThreadBackgroundTerminal } from "@/lib/api/appServer";

interface ShellBackgroundTerminalListProps {
  threadId: string;
  client?: BackgroundTerminalsAppServerClient;
}

export function ShellBackgroundTerminalList({
  threadId,
  client,
}: ShellBackgroundTerminalListProps) {
  const [terminals, setTerminals] = React.useState<
    AppServerThreadBackgroundTerminal[]
  >([]);
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stoppingId, setStoppingId] = React.useState<string | null>(null);
  const [stoppingAll, setStoppingAll] = React.useState(false);
  const requestRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const requestId = ++requestRef.current;
    setStatus("loading");
    try {
      const next = await listBackgroundTerminals(threadId, client);
      if (requestId !== requestRef.current) {
        return;
      }
      setTerminals(next);
      setStatus("ready");
    } catch {
      if (requestId !== requestRef.current) {
        return;
      }
      setStatus("error");
    }
  }, [client, threadId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const stopTerminal = React.useCallback(
    async (itemId: string) => {
      setStoppingId(itemId);
      try {
        await terminateBackgroundTerminalForItem(
          { threadId, itemId },
          client,
        );
        await refresh();
      } catch {
        setStatus("error");
      } finally {
        setStoppingId((current) => (current === itemId ? null : current));
      }
    },
    [client, refresh, threadId],
  );
  const stopAll = React.useCallback(async () => {
    setStoppingAll(true);
    try {
      await cleanBackgroundTerminals(threadId, client);
      await refresh();
    } catch {
      setStatus("error");
    } finally {
      setStoppingAll(false);
    }
  }, [client, refresh, threadId]);

  return (
    <section
      className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2"
      data-testid="shell-background-terminals"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">
          {agentText(
            "agentChat.navbar.shell.backgroundTerminals",
            "后台终端",
          )}
        </span>
        <span className="flex items-center gap-1">
          {terminals.length > 0 ? (
            <button
              type="button"
              className="inline-flex h-6 items-center rounded-md px-2 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
              disabled={stoppingAll || stoppingId !== null}
              onClick={() => {
                void stopAll();
              }}
              data-testid="shell-background-terminals-stop-all"
            >
              {stoppingAll
                ? agentText(
                    "agentChat.navbar.shell.backgroundTerminalsStoppingAll",
                    "正在停止全部",
                  )
                : agentText(
                    "agentChat.navbar.shell.backgroundTerminalsStopAll",
                    "停止全部",
                  )}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-6 items-center rounded-md px-2 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            disabled={stoppingAll}
            onClick={() => {
              void refresh();
            }}
            data-testid="shell-background-terminals-refresh"
          >
            {agentText(
              "agentChat.navbar.shell.backgroundTerminalsRefresh",
              "刷新",
            )}
          </button>
        </span>
      </div>
      {status === "loading" && terminals.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          {agentText(
            "agentChat.navbar.shell.backgroundTerminalsLoading",
            "正在读取后台终端",
          )}
        </p>
      ) : null}
      {status === "error" ? (
        <p
          className="mt-1 text-xs text-rose-600"
          data-testid="shell-background-terminals-error"
        >
          {agentText(
            "agentChat.navbar.shell.backgroundTerminalsError",
            "无法读取后台终端",
          )}
        </p>
      ) : null}
      {status === "ready" && terminals.length === 0 ? (
        <p
          className="mt-1 text-xs text-slate-500"
          data-testid="shell-background-terminals-empty"
        >
          {agentText(
            "agentChat.navbar.shell.backgroundTerminalsEmpty",
            "没有正在运行的后台终端",
          )}
        </p>
      ) : null}
      {terminals.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {terminals.map((terminal) => {
            const label = terminal.command.trim() || terminal.processId;
            const stopping = stoppingId === terminal.itemId;
            return (
              <li
                key={terminal.processId}
                className="flex items-center gap-2"
                data-testid="shell-background-terminal"
                title={terminal.cwd}
              >
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700">
                  {label}
                </span>
                <button
                  type="button"
                  className="inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                  disabled={stopping || stoppingAll || !terminal.itemId.trim()}
                  onClick={() => {
                    void stopTerminal(terminal.itemId);
                  }}
                  data-testid="shell-background-terminal-stop"
                >
                  {stopping
                    ? agentText(
                        "agentChat.navbar.shell.backgroundTerminalsStopping",
                        "正在停止",
                      )
                    : agentText(
                        "agentChat.navbar.shell.backgroundTerminalsStop",
                        "停止",
                      )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
