import { describe, expect, it } from "vitest";
import type { Topic } from "../hooks/agentChatShared";
import { resolveBackgroundSessionRuntimeSnapshot } from "./useWorkspaceBackgroundSessionRuntime";

const topic = (status: Topic["status"], sourceSessionId = "session-1") =>
  ({ id: "topic-1", sourceSessionId, status, title: "" }) as Topic;

describe("background session projection", () => {
  it.each(["running", "queued", "waiting"] as const)(
    "keeps canonical identity and %s without depending on a home card title",
    (status) => {
      expect(resolveBackgroundSessionRuntimeSnapshot(topic(status))).toEqual({
        sessionId: "session-1",
        status,
      });
    },
  );
  it("clears completed or absent sessions and uses the topic identity when needed", () => {
    expect(resolveBackgroundSessionRuntimeSnapshot(topic("done"))).toBeNull();
    expect(resolveBackgroundSessionRuntimeSnapshot(null)).toBeNull();
    expect(
      resolveBackgroundSessionRuntimeSnapshot(topic("running", "")),
    ).toEqual({
      sessionId: "topic-1",
      status: "running",
    });
  });
});
