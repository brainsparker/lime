import { useEffect, useMemo } from "react";
import type {
  AgentBackgroundSessionRuntimeSnapshot,
  AgentChatWorkspaceProps,
} from "../agentChatWorkspaceContract";
import type { Topic } from "../hooks/agentChatShared";

export function resolveBackgroundSessionRuntimeSnapshot(
  topic: Topic | null,
): AgentBackgroundSessionRuntimeSnapshot | null {
  if (
    !topic ||
    (topic.status !== "running" &&
      topic.status !== "queued" &&
      topic.status !== "waiting")
  ) {
    return null;
  }
  return {
    sessionId: topic.sourceSessionId || topic.id,
    status: topic.status,
  };
}

export function useWorkspaceBackgroundSessionRuntime({
  onBackgroundSessionRuntimeChange,
  recentSessionTopic,
}: {
  onBackgroundSessionRuntimeChange?: AgentChatWorkspaceProps["onBackgroundSessionRuntimeChange"];
  recentSessionTopic: Topic | null;
}) {
  const snapshot = useMemo(
    () => resolveBackgroundSessionRuntimeSnapshot(recentSessionTopic),
    [recentSessionTopic],
  );
  useEffect(() => {
    onBackgroundSessionRuntimeChange?.(snapshot);
  }, [onBackgroundSessionRuntimeChange, snapshot]);
}
