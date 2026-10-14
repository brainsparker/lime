import { useEffect, useRef } from "react";
import {
  subscribeAppServerNotifications,
  type AppServerEventBusSubscription,
} from "@/lib/api/appServerEventBus";
import type { AgentSessionReadModelRefreshRequest } from "./agentSessionRefresh";
import { isScopedThreadQueueChangedNotification } from "./useAgentSessionThreadQueue";

interface ThreadQueueSyncOptions {
  workspaceId?: string;
  sessionId: string | null;
  threadId: string | null;
  refreshSessionReadModel: (
    sessionId: string,
    request: AgentSessionReadModelRefreshRequest,
  ) => Promise<unknown>;
  subscribeNotifications?: (
    subscription: AppServerEventBusSubscription,
  ) => () => void;
  onWarn?: (error: unknown) => void;
}

export function useAgentThreadQueueSync(options: ThreadQueueSyncOptions) {
  const sessionId = options.sessionId?.trim() || null;
  const threadId = options.threadId?.trim() || null;
  const workspaceId = options.workspaceId?.trim() || "";
  const identity = useRef({ sessionId, threadId, workspaceId });
  if (
    identity.current.sessionId !== sessionId ||
    identity.current.threadId !== threadId ||
    identity.current.workspaceId !== workspaceId
  ) {
    identity.current = { sessionId, threadId, workspaceId };
  }
  const latest = useRef(options);
  latest.current = options;
  const subscribe =
    options.subscribeNotifications ?? subscribeAppServerNotifications;

  useEffect(() => {
    if (!sessionId || !threadId) return;
    const origin = identity.current;
    let active = true;
    let reading = false;
    let pending = false;
    const isCurrent = () => active && identity.current === origin;
    const warn = (error: unknown) => {
      if (isCurrent()) latest.current.onWarn?.(error);
    };
    const readPending = async () => {
      if (reading || !isCurrent()) return;
      reading = true;
      try {
        while (pending && isCurrent()) {
          pending = false;
          try {
            await latest.current.refreshSessionReadModel(sessionId, {
              timelineMode: "replace",
              expectedThreadId: threadId,
              isCurrent,
            });
          } catch (error) {
            warn(error);
          }
        }
      } finally {
        reading = false;
      }
    };
    const unsubscribe = subscribe({
      onError: warn,
      onNotifications: (notifications) => {
        if (
          isCurrent() &&
          notifications.some((notification) =>
            isScopedThreadQueueChangedNotification(notification, threadId),
          )
        ) {
          pending = true;
          void readPending();
        }
      },
    });
    return () => {
      active = false;
      pending = false;
      unsubscribe();
    };
  }, [sessionId, threadId, workspaceId, subscribe]);
}
