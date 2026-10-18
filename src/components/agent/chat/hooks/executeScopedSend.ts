import type { SendMessageFn } from "./agentChatShared";
import type { AgentRuntimeAdapter } from "./agentRuntimeAdapter";
import type { RuntimeSubmissionResult } from "./agentSendResult";
import { assertExecutionSession } from "./executionScope";
import type { ExecutionScopeTask } from "./executionScopeHandoff";
import type { ScopedSend } from "./useExecutionScopeHandoff";
import type { useAgentSession } from "./useAgentSession";

type Dependencies = {
  session: Pick<
    ReturnType<typeof useAgentSession>,
    "createFreshSession" | "ensureSession"
  >;
  runtime: Pick<AgentRuntimeAdapter, "getSession">;
  sendCurrentMessage: SendMessageFn;
};

/** Called after the current React session/context/stream owners commit the target scope. */
export async function executeScopedSend(
  task: ExecutionScopeTask<ScopedSend>,
  { session, runtime, sendCurrentMessage }: Dependencies,
): Promise<RuntimeSubmissionResult> {
  let submitted = false;
  let creating = false;
  try {
    const requireCurrent = () => {
      if (!task.isCurrent())
        throw new DOMException("Execution scope was superseded", "AbortError");
    };
    requireCurrent();
    const sendOptions = task.payload.args[8];
    let sessionId = task.binding?.sessionId;
    if (!sessionId) {
      creating = true;
      sessionId =
        (await session.createFreshSession(undefined, {
          skipSessionStartHooks: sendOptions?.skipSessionStartHooks,
          modelPreference: {
            providerType: sendOptions?.providerOverride ?? "",
            model: sendOptions?.modelOverride ?? "",
          },
          onCreated: (id) => task.bind({ sessionId: id }),
          requestId: task.scope.requestId,
          isCurrent: task.isCurrent,
        })) ?? undefined;
    }
    creating = false;
    requireCurrent();
    if (!sessionId) throw new Error("Execution scope did not create a session");
    const detail = await runtime.getSession(sessionId, {
      source: "executionScope",
    });
    requireCurrent();
    const binding = assertExecutionSession(task.scope, sessionId, detail);
    task.bind(binding);
    await session.ensureSession({
      targetSessionId: sessionId,
      skipSessionRestore: true,
    });
    requireCurrent();
    const args = [...task.payload.args] as Parameters<SendMessageFn>;
    args[8] = {
      ...sendOptions,
      executionScope: task.scope,
      executionScopeIsCurrent: task.isCurrent,
      targetSessionId: sessionId,
      skipSessionRestore: true,
      observer: {
        ...sendOptions?.observer,
        onRuntimeAccepted(receipt) {
          if (
            receipt.kind !== "start" ||
            receipt.sessionId !== binding.sessionId ||
            receipt.threadId !== binding.threadId
          )
            throw new Error("Execution scope acceptance identity mismatch");
          sendOptions?.observer?.onRuntimeAccepted?.(
            Object.freeze({ ...receipt, executionScope: task.scope }),
          );
        },
      },
    };
    submitted = true;
    const result = await sendCurrentMessage(...args);
    if (result.kind === "runtime-accepted") {
      if (
        result.receipt.kind !== "start" ||
        result.receipt.sessionId !== binding.sessionId ||
        result.receipt.threadId !== binding.threadId
      )
        return { kind: "unknown" };
      return {
        ...result,
        receipt: Object.freeze({
          ...result.receipt,
          executionScope: task.scope,
        }),
      };
    }
    return result;
  } catch (error) {
    return submitted || (creating && !task.binding)
      ? { kind: "unknown" }
      : { kind: "rejected", error };
  }
}
