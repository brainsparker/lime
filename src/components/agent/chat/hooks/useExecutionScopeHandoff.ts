import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentAccessMode } from "./agentChatStorage";
import type { SendMessageFn } from "./agentChatShared";
import type { RuntimeSubmissionResult } from "./agentSendResult";
import { executionSurfaceKey, type ExecutionScope } from "./executionScope";
import {
  ExecutionScopeHandoff,
  type ExecutionScopeTask,
} from "./executionScopeHandoff";

export interface ScopedSend {
  args: Parameters<SendMessageFn>;
  accessMode: AgentAccessMode;
}

export function useExecutionScopeHandoff(
  workspaceId: string,
  workingDir?: string | null,
) {
  const owner = useRef<ExecutionScopeHandoff<
    ScopedSend,
    RuntimeSubmissionResult
  > | null>(null);
  if (!owner.current)
    owner.current = new ExecutionScopeHandoff(workspaceId, workingDir);
  const [request, setRequest] = useState<{
    scope: ExecutionScope;
    accessMode: AgentAccessMode;
    attempt: number;
  } | null>(null);
  const attempt = useRef(0);
  const surface = executionSurfaceKey(workspaceId, workingDir);
  useLayoutEffect(() => {
    const cancelled = owner.current!.observeSurface(workspaceId, workingDir);
    setRequest((current) =>
      cancelled
        ? null
        : current &&
            surface !==
              executionSurfaceKey(
                current.scope.sourceWorkspaceId,
                current.scope.sourceWorkingDir,
              ) &&
            surface !==
              executionSurfaceKey(
                current.scope.workspaceId,
                current.scope.workingDir,
              )
          ? null
          : current,
    );
  }, [workspaceId, workingDir, surface]);
  useEffect(() => () => owner.current!.cancel(), []);
  const submit = useCallback((scope: ExecutionScope, payload: ScopedSend) => {
    const result = owner.current!.request(scope, payload);
    if (owner.current!.isActive(scope))
      setRequest((current) => ({
        scope,
        accessMode:
          current?.scope.requestId === scope.requestId
            ? current.accessMode
            : payload.accessMode,
        attempt: ++attempt.current,
      }));
    return result;
  }, []);
  const commit = useCallback(
    (
      execute: (
        task: ExecutionScopeTask<ScopedSend>,
      ) => Promise<RuntimeSubmissionResult>,
    ) => {
      if (request) owner.current!.commit(request.scope, execute);
    },
    [request],
  );
  const cancel = useCallback(() => {
    owner.current!.cancel();
    setRequest(null);
  }, []);
  const active =
    request &&
    [
      executionSurfaceKey(
        request.scope.sourceWorkspaceId,
        request.scope.sourceWorkingDir,
      ),
      executionSurfaceKey(request.scope.workspaceId, request.scope.workingDir),
    ].includes(surface)
      ? request
      : null;
  return useMemo(
    () => ({
      scope: active?.scope,
      accessMode: active?.accessMode,
      request: submit,
      commit,
      cancel,
      attempt: active?.attempt,
    }),
    [active, submit, commit, cancel],
  );
}
