import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  createDeferred,
  flushEffects,
  mockCreateAgentRuntimeSession,
  mockGetAgentRuntimeSession,
  mockSafeInvoke,
  mockSubmitAgentRuntimeTurn,
  seedSession,
} from "./useAgentChat.testUtils";
import { useAgentChat } from "./useAgentChat";
import type { ExecutionScope } from "./executionScope";
import type { RuntimeSubmissionResult } from "./agentSendResult";
import { getAgentSessionScopedKeys } from "./agentSessionScopedStorage";

const scope: ExecutionScope = {
  requestId: "worktree-r1",
  sourceWorkspaceId: "a",
  sourceWorkingDir: "/a",
  workspaceId: "b",
  workingDir: "/b",
};

function mount() {
  let value!: ReturnType<typeof useAgentChat>;
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  function Surface({
    workspaceId,
    workingDir,
  }: {
    workspaceId: string;
    workingDir: string;
  }) {
    value = useAgentChat({ workspaceId, workingDir });
    return null;
  }
  function render(workspaceId = "a", workingDir = "/a") {
    act(() =>
      root.render(
        <Surface workspaceId={workspaceId} workingDir={workingDir} />,
      ),
    );
  }
  render();
  return {
    get: () => value,
    render,
    unmount() {
      act(() => root.unmount());
      element.remove();
    },
  };
}

function installCanonicalSessions() {
  mockCreateAgentRuntimeSession.mockResolvedValue("scope-session");
  mockGetAgentRuntimeSession.mockImplementation(async (id: string) => ({
    id,
    thread_id: id,
    working_dir: id === "scope-session" ? "/b" : "/a",
    workspace_id: id === "scope-session" ? "b" : "a",
    messages: [],
    thread_read: { thread_id: id, status: "idle" },
  }));
}

function start(h: ReturnType<typeof mount>, request = scope) {
  let pending!: Promise<RuntimeSubmissionResult>;
  act(() => {
    pending = h
      .get()
      .sendMessage(
        "same frozen input",
        [],
        false,
        false,
        false,
        "react",
        undefined,
        undefined,
        {
          executionScope: request,
          composerTarget: "start",
          providerOverride: "openai",
          modelOverride: "gpt-5.4-mini",
        },
      );
  });
  return pending;
}

describe("useAgentChat execution scope through the current context/session/stream owners", () => {
  it("commits target cwd/workspace before Thread creation, permission lookup and accepted attribution", async () => {
    installCanonicalSessions();
    seedSession("a", "source-session");
    const h = mount();
    try {
      await flushEffects();
      const sourceKeys = getAgentSessionScopedKeys("a");
      const targetKeys = getAgentSessionScopedKeys("b");
      const sourceCandidate = sessionStorage.getItem(
        sourceKeys.currentSessionKey,
      );
      const sourceMessages = sessionStorage.getItem(sourceKeys.messagesKey);
      const pending = start(h);
      let result!: RuntimeSubmissionResult;
      await act(async () => {
        result = await pending;
      });
      expect(result).toMatchObject({
        kind: "runtime-accepted",
        receipt: {
          sessionId: "scope-session",
          threadId: "scope-session",
          executionScope: scope,
        },
      });
      expect(mockCreateAgentRuntimeSession).toHaveBeenCalledExactlyOnceWith(
        "b",
        undefined,
        "react",
        expect.objectContaining({
          workingDir: "/b",
          metadata: expect.objectContaining({
            providerSelector: "openai",
            modelName: "gpt-5.4-mini",
          }),
        }),
      );
      expect(h.get().sessionWorkingDir).toBe("/b");
      expect(h.get().sessionId).toBe("scope-session");
      expect(sessionStorage.getItem(sourceKeys.currentSessionKey)).toBe(
        sourceCandidate,
      );
      expect(sessionStorage.getItem(sourceKeys.messagesKey)).toBe(
        sourceMessages,
      );
      expect(sessionStorage.getItem(targetKeys.currentSessionKey)).toBe(
        JSON.stringify("scope-session"),
      );
      expect(mockSubmitAgentRuntimeTurn).toHaveBeenCalledOnce();
      const lines = mockSafeInvoke.mock.calls
        .flatMap(
          (call) =>
            (call[1] as { request?: { lines?: string[] } })?.request?.lines ??
            [],
        )
        .map((line) => JSON.parse(line));
      expect(
        lines.some(
          (line) =>
            line.method === "permissionProfile/list" &&
            line.params?.cwd === "/b",
        ),
      ).toBe(true);
      const metadata =
        mockSubmitAgentRuntimeTurn.mock.calls[0]?.[0]?.additionalContext
          ?.metadata;
      expect(JSON.parse(metadata.value)).toMatchObject({
        agentUiPerformanceTrace: { workspaceId: "b" },
      });
    } finally {
      h.unmount();
    }
  });
  it("deduplicates a repeated same request after accepted without a second Thread or Turn", async () => {
    installCanonicalSessions();
    const h = mount();
    try {
      await flushEffects();
      const pending = start(h);
      await act(async () => {
        await pending;
      });
      const retry = start(h);
      await act(async () => {
        await retry;
      });
      expect(mockCreateAgentRuntimeSession).toHaveBeenCalledOnce();
      expect(mockSubmitAgentRuntimeTurn).toHaveBeenCalledOnce();
    } finally {
      h.unmount();
    }
  });
  it("keeps created session identity for a retry after canonical hydration fails", async () => {
    installCanonicalSessions();
    const original = mockGetAgentRuntimeSession.getMockImplementation()!;
    let fail = true;
    mockGetAgentRuntimeSession.mockImplementation(async (id: string) => {
      if (id === "scope-session" && fail) {
        fail = false;
        throw new Error("read failed");
      }
      return original(id);
    });
    const h = mount();
    try {
      await flushEffects();
      const pending = start(h);
      await act(async () => {
        expect((await pending).kind).toBe("rejected");
      });
      const retry = start(h);
      await act(async () => {
        expect((await retry).kind).toBe("runtime-accepted");
      });
      expect(mockCreateAgentRuntimeSession).toHaveBeenCalledOnce();
      expect(mockSubmitAgentRuntimeTurn).toHaveBeenCalledOnce();
    } finally {
      h.unmount();
    }
  });
  it("does not send or let a late created session overwrite C after A→C→A", async () => {
    installCanonicalSessions();
    const create = createDeferred<string>();
    mockCreateAgentRuntimeSession.mockReturnValue(create.promise);
    const h = mount();
    try {
      await flushEffects();
      const pending = start(h);
      await flushEffects();
      expect(mockCreateAgentRuntimeSession).toHaveBeenCalledOnce();
      h.render("c", "/c");
      h.render("a", "/a");
      await act(async () => {
        create.resolve("scope-session");
        expect((await pending).kind).toBe("rejected");
      });
      expect(mockSubmitAgentRuntimeTurn).not.toHaveBeenCalled();
      expect(h.get().sessionId).not.toBe("scope-session");
    } finally {
      h.unmount();
    }
  });
  it("does not blindly repeat an unknown Turn acceptance", async () => {
    installCanonicalSessions();
    mockSubmitAgentRuntimeTurn.mockRejectedValue(new Error("response lost"));
    const h = mount();
    try {
      await flushEffects();
      const pending = start(h);
      await act(async () => {
        expect((await pending).kind).toBe("unknown");
      });
      const retry = start(h);
      await act(async () => {
        expect((await retry).kind).toBe("unknown");
      });
      expect(mockCreateAgentRuntimeSession).toHaveBeenCalledOnce();
      expect(mockSubmitAgentRuntimeTurn).toHaveBeenCalledOnce();
    } finally {
      h.unmount();
    }
  });
  it("rejects a canonical cwd mismatch before Turn submission", async () => {
    installCanonicalSessions();
    mockGetAgentRuntimeSession.mockImplementation(async (id: string) => ({
      id,
      thread_id: id,
      working_dir: "/wrong",
      messages: [],
    }));
    const h = mount();
    try {
      await flushEffects();
      const pending = start(h);
      await act(async () => {
        expect((await pending).kind).toBe("rejected");
      });
      expect(mockSubmitAgentRuntimeTurn).not.toHaveBeenCalled();
    } finally {
      h.unmount();
    }
  });
});
