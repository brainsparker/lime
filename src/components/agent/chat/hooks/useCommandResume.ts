import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { AgentThreadItem, AgentThreadTurn } from "@/lib/api/agentProtocol";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { ActiveStreamState } from "./agentStreamSubmissionLifecycle";
import { isRunningSessionCommand } from "../projection/commandActivity";
import { bindRecoveredCommands } from "./commandResume";

export function useCommandResume(options: {
  enabled: boolean;
  sessionId?: string | null;
  threadRead?: AgentRuntimeThreadReadModel | null;
  turns: readonly AgentThreadTurn[];
  activeStreamRef: MutableRefObject<ActiveStreamState | null>;
  listenerMapRef: MutableRefObject<Map<string, () => void>>;
  runtime: Pick<AgentRuntimeAdapter, "listenToTurnEvents" | "resumeThread">;
  getItems?: () => readonly AgentThreadItem[];
  setItems: Dispatch<SetStateAction<AgentThreadItem[]>>;
}) {
  const commands = (options.threadRead?.thread_items ?? []).filter(
    (item) =>
      item.thread_id === options.threadRead?.thread_id &&
      isRunningSessionCommand(item) &&
      options.turns.some(
        (turn) =>
          turn.id === item.turn_id &&
          turn.thread_id === item.thread_id &&
          (turn.status === "completed" ||
            turn.status === "failed" ||
            turn.status === "cancelled"),
      ),
  );
  const key =
    options.enabled && options.sessionId && commands.length
      ? `${options.sessionId}\u0000${options.threadRead!.thread_id}`
      : null;
  const latest = useRef(options);
  const commandRef = useRef(commands);
  latest.current = options;
  commandRef.current = commands;
  const { activeStreamRef, listenerMapRef, runtime, setItems } = options;

  useEffect(() => {
    if (!key || activeStreamRef.current || listenerMapRef.current.size) return;
    const selected = commandRef.current;
    const threadId = selected[0].thread_id;
    let disposed = false;
    let cleanup: (() => void) | null = null;
    const controller = new AbortController();
    void bindRecoveredCommands({
      runtime,
      threadId,
      commands: selected,
      setItems,
      signal: controller.signal,
      getItems: () =>
        latest.current.getItems?.() ??
        latest.current.threadRead?.thread_items ??
        [],
    })
      .then((dispose) => {
        if (disposed) dispose?.();
        else cleanup = dispose;
      })
      .catch((error) => {
        if (!disposed)
          console.error("[AgentChat] 恢复后台命令事件监听失败:", error);
      });
    return () => {
      disposed = true;
      controller.abort();
      cleanup?.();
    };
  }, [key, activeStreamRef, listenerMapRef, runtime, setItems]);
}
