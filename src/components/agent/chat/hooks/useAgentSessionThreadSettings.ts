import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  isThreadSettingsUpdatedNotification,
  type ThreadSettings,
} from "@limecloud/app-server-client";
import type { AgentRuntimeThreadReadModel } from "@/lib/api/agentRuntime/sessionTypes";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { SessionModelPreference, Topic } from "./agentChatShared";
import type { AgentSessionSnapshot } from "./agentSessionState";

export function canonicalThreadSettingsPreference(
  preference: SessionModelPreference | null,
  threadId?: string | null,
):
  | (SessionModelPreference & {
      threadId: string;
      threadSettings: ThreadSettings;
    })
  | null {
  if (!preference?.threadId || (threadId && preference.threadId !== threadId))
    return null;
  if (
    !isThreadSettingsUpdatedNotification({
      method: "thread/settings/updated",
      params: {
        threadId: preference.threadId,
        threadSettings: preference.threadSettings,
      },
    })
  )
    return null;
  return preference as SessionModelPreference & {
    threadId: string;
    threadSettings: ThreadSettings;
  };
}

export function applyCachedThreadSettingsToSnapshot(
  snapshot: AgentSessionSnapshot,
  loadPreference: (sessionId: string) => SessionModelPreference | null,
): AgentSessionSnapshot {
  if (!snapshot.sessionId) return snapshot;
  const preference = canonicalThreadSettingsPreference(
    loadPreference(snapshot.sessionId),
    snapshot.threadRead?.thread_id,
  );
  if (!preference) return snapshot;
  return {
    ...snapshot,
    workingDir: preference.threadSettings.cwd,
    threadRead: {
      ...(snapshot.threadRead ?? { thread_id: preference.threadId }),
      thread_settings: preference.threadSettings,
    },
  };
}

export function useAgentSessionThreadSettings(options: {
  runtime: Pick<AgentRuntimeAdapter, "listenToThreadSettings">;
  workspaceId: string;
  sessionIdRef: MutableRefObject<string | null>;
  threadReadRef: MutableRefObject<AgentRuntimeThreadReadModel | null>;
  sessionWorkingDirRef: MutableRefObject<string | null>;
  setThreadRead: Dispatch<SetStateAction<AgentRuntimeThreadReadModel | null>>;
  setSessionWorkingDir: Dispatch<SetStateAction<string | null>>;
  setTopics: Dispatch<SetStateAction<Topic[]>>;
}) {
  const listenToThreadSettings = options.runtime.listenToThreadSettings;
  const latest = useRef(options);
  latest.current = options;
  useEffect(
    () =>
      listenToThreadSettings?.((update) => {
        const current = latest.current;
        if (update.workspaceId && update.workspaceId !== current.workspaceId)
          return;
        current.setTopics((topics) =>
          topics.map((topic) =>
            update.sessionIds.includes(topic.id)
              ? {
                  ...topic,
                  model: update.threadSettings.model,
                  workingDir: update.threadSettings.cwd,
                }
              : topic,
          ),
        );
        const sessionId = current.sessionIdRef.current?.trim();
        if (!sessionId || !update.sessionIds.includes(sessionId)) return;
        const read = current.threadReadRef.current;
        if (read && read.thread_id !== update.threadId) return;
        const nextRead = {
          ...(read ?? { thread_id: update.threadId }),
          thread_settings: update.threadSettings,
        };
        current.threadReadRef.current = nextRead;
        current.sessionWorkingDirRef.current = update.threadSettings.cwd;
        current.setThreadRead(nextRead);
        current.setSessionWorkingDir(update.threadSettings.cwd);
      }),
    [listenToThreadSettings, options.workspaceId],
  );
}
