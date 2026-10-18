import type { AgentSessionDetail } from "@/lib/api/agentRuntime/sessionTypes";

/** An in-process submit target; never include this object in a wire request. */
export interface ExecutionScope {
  readonly requestId: string;
  readonly sourceWorkspaceId: string;
  readonly sourceWorkingDir: string;
  readonly workspaceId: string;
  readonly workingDir: string;
}

export function normalizeExecutionDirectory(value: string): string {
  const path = value.trim().replace(/\\/gu, "/");
  if (path === "/" || /^[a-z]:\/$/iu.test(path)) return path;
  return path.replace(/\/+$/u, "");
}

export function requireExecutionScope(value: ExecutionScope): ExecutionScope {
  const scope = Object.freeze({
    requestId: value.requestId.trim(),
    sourceWorkspaceId: value.sourceWorkspaceId.trim(),
    sourceWorkingDir: normalizeExecutionDirectory(value.sourceWorkingDir),
    workspaceId: value.workspaceId.trim(),
    workingDir: normalizeExecutionDirectory(value.workingDir),
  });
  if (Object.values(scope).some((part) => !part))
    throw new Error(
      "Execution scope requires request, workspace and cwd identities",
    );
  return scope;
}

export function executionScopeKey(scope: ExecutionScope): string {
  return JSON.stringify(Object.values(requireExecutionScope(scope)));
}

export function executionSurfaceKey(
  workspaceId: string,
  workingDir?: string | null,
) {
  return JSON.stringify([
    workspaceId.trim(),
    normalizeExecutionDirectory(workingDir ?? ""),
  ]);
}

export function assertExecutionSession(
  scope: ExecutionScope,
  sessionId: string,
  detail: AgentSessionDetail,
): { sessionId: string; threadId: string } {
  const threadId =
    detail.thread_read?.thread_id?.trim() || detail.thread_id?.trim();
  if (
    detail.id !== sessionId ||
    !threadId ||
    (detail.thread_id && detail.thread_id !== threadId) ||
    normalizeExecutionDirectory(detail.working_dir ?? "") !==
      scope.workingDir ||
    (detail.workspace_id && detail.workspace_id !== scope.workspaceId)
  )
    throw new Error("Execution scope canonical session identity mismatch");
  return Object.freeze({ sessionId, threadId });
}
