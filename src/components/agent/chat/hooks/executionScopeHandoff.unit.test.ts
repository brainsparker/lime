import { describe, expect, it, vi } from "vitest";
import {
  assertExecutionSession,
  executionScopeKey,
  normalizeExecutionDirectory,
  type ExecutionScope,
} from "./executionScope";
import { ExecutionScopeHandoff } from "./executionScopeHandoff";
import type { AgentSessionDetail } from "@/lib/api/agentRuntime/sessionTypes";

const scope: ExecutionScope = {
  requestId: "r1",
  sourceWorkspaceId: "a",
  sourceWorkingDir: "/a",
  workspaceId: "b",
  workingDir: "/b",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
type Result = { kind: "rejected" | "unknown" | "runtime-accepted" };
const owner = () => new ExecutionScopeHandoff<string, Result>("a", "/a");

describe("execution scope handoff", () => {
  it("deduplicates the same scope/request and delivers the original frozen payload once", async () => {
    const h = owner();
    const first = h.request(scope, "original");
    expect(h.request({ ...scope }, "replacement")).toBe(first);
    const execute = vi.fn(async (task) => {
      expect(task.payload).toBe("original");
      return { kind: "runtime-accepted" } as const;
    });
    h.commit(scope, execute);
    h.commit(scope, execute);
    await expect(first).resolves.toEqual({ kind: "runtime-accepted" });
    expect(execute).toHaveBeenCalledOnce();
    expect(h.request(scope, "retry after accepted")).toBe(first);
  });
  it("does not collide scopes containing separators", () => {
    expect(
      executionScopeKey({ ...scope, workspaceId: "a:b", workingDir: "/c" }),
    ).not.toBe(
      executionScopeKey({ ...scope, workspaceId: "a", workingDir: "b:/c" }),
    );
  });
  it("keeps unknown acceptance deduplicated rather than blindly resending", async () => {
    const h = owner();
    const p = h.request(scope, "first");
    h.commit(scope, async () => ({ kind: "unknown" }));
    await p;
    expect(h.request(scope, "retry")).toBe(p);
  });
  it("retries an explicitly rejected request with the same created session binding", async () => {
    const h = owner();
    const p = h.request(scope, "first");
    h.commit(scope, async (task) => {
      task.bind({ sessionId: "s1" });
      return { kind: "rejected" };
    });
    await p;
    const retry = h.request(scope, "retry");
    expect(retry).not.toBe(p);
    h.commit(scope, async (task) => {
      expect(task.binding).toEqual({ sessionId: "s1" });
      return { kind: "runtime-accepted" };
    });
    await retry;
  });
  it("rejects a second request while one target is pending", async () => {
    const h = owner();
    const p = h.request(scope, "first");
    expect(() => h.request({ ...scope, requestId: "r2" }, "second")).toThrow(
      "pending",
    );
    h.commit(scope, async () => ({ kind: "rejected" }));
    await p;
  });
  it("rejects queued work on cancellation before a committed executor exists", async () => {
    const h = owner();
    const p = h.request(scope, "first");
    const rejected = expect(p).rejects.toMatchObject({ name: "AbortError" });
    h.cancel();
    await rejected;
    const execute = vi.fn();
    h.commit(scope, execute);
    expect(execute).not.toHaveBeenCalled();
  });
  it("marks in-flight work stale after A→C→A without granting the old owner authority", async () => {
    const h = owner();
    const wait = deferred<Result>();
    const p = h.request(scope, "first");
    let current!: () => boolean;
    h.commit(scope, async (task) => {
      current = task.isCurrent;
      return wait.promise;
    });
    h.observeSurface("c", "/c");
    h.observeSurface("a", "/a");
    expect(current()).toBe(false);
    wait.resolve({ kind: "runtime-accepted" });
    await expect(p).resolves.toEqual({ kind: "runtime-accepted" });
  });
  it("keeps in-flight or unknown work deduplicated across cancellation epochs", async () => {
    const h = owner();
    const wait = deferred<Result>();
    const first = h.request(scope, "first");
    h.commit(scope, async () => wait.promise);
    h.observeSurface("c", "/c");
    h.observeSurface("a", "/a");
    expect(h.request(scope, "replacement")).toBe(first);
    wait.resolve({ kind: "unknown" });
    await first;
    expect(h.request(scope, "retry")).toBe(first);
  });
  it("accepts the intended target commit, then invalidates a later navigation back to source", async () => {
    const h = owner();
    const wait = deferred<Result>();
    const p = h.request(scope, "first");
    let current!: () => boolean;
    h.commit(scope, async (task) => {
      current = task.isCurrent;
      return wait.promise;
    });
    h.observeSurface("b", "/b");
    expect(current()).toBe(true);
    h.observeSurface("a", "/a");
    expect(current()).toBe(false);
    wait.resolve({ kind: "rejected" });
    await p;
  });
  it("rejects an unrelated initial source and refuses session identity replacement", async () => {
    const h = owner();
    expect(() =>
      h.request({ ...scope, sourceWorkspaceId: "z" }, "wrong"),
    ).toThrow();
    const p = h.request(scope, "first");
    h.commit(scope, async (task) => {
      task.bind({ sessionId: "s1" });
      expect(() => task.bind({ sessionId: "s2" })).toThrow("identity changed");
      return { kind: "rejected" };
    });
    await p;
  });
  it("preserves Unix and Windows roots when normalizing cwd", () => {
    expect(normalizeExecutionDirectory("/ h/ ")).toBe("/ h");
    expect(normalizeExecutionDirectory("/")).toBe("/");
    expect(normalizeExecutionDirectory("C:\\")).toBe("C:/");
    expect(normalizeExecutionDirectory("C:\\code\\task\\")).toBe(
      "C:/code/task",
    );
  });
  it("requires canonical cwd, session and thread identity", () => {
    const detail = {
      id: "s1",
      thread_id: "t1",
      working_dir: "/b/",
      workspace_id: "b",
      thread_read: { thread_id: "t1" },
    } as AgentSessionDetail;
    expect(assertExecutionSession(scope, "s1", detail)).toEqual({
      sessionId: "s1",
      threadId: "t1",
    });
    for (const changes of [
      { id: "s2" },
      { thread_id: "wrong" },
      { working_dir: "/a" },
      { workspace_id: "a" },
      { thread_read: { thread_id: "wrong" } },
    ])
      expect(() =>
        assertExecutionSession(scope, "s1", { ...detail, ...changes }),
      ).toThrow("identity mismatch");
  });
});
