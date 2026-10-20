import {
  projectAppServerFileCheckpointListResult,
  projectAppServerFileCheckpointDetail,
  projectAppServerFileCheckpointDiffResult,
  projectAppServerFileCheckpointRestoreResult,
} from "./fileCheckpoints";
import {
  AppServerClient,
  type AppServerCapabilityListParams,
  type AppServerReviewStartParams,
  type AppServerThreadReadParams,
  type AppServerThreadReadResponse,
  type AppServerThreadSettingsUpdateParams,
  type AppServerThreadSettingsUpdateResponse,
  type AppServerThreadShellCommandParams,
} from "@/lib/api/appServer";
import type {
  AppServerRequestResult,
  ThreadResumeParams,
  ThreadResumeResponse,
  ThreadSetNameParams,
  TurnInterruptParams,
  TurnStartParams,
  TurnStartResponse,
  TurnSteerParams,
  TurnSteerResponse,
} from "@limecloud/app-server-client";
import {
  requireTurnStartResponse,
  reportRuntimeAcceptancePostProcessingFailure,
} from "./runtimeAcceptance";
import { isAppServerBridgeAvailable } from "@/lib/api/appServerBridgeAvailability";
import type { AgentRuntimeClient as StandardAgentRuntimeClient } from "@limecloud/agent-runtime-client";
import {
  AppServerAgentSessionEventDrainRouter,
  publishAppServerAgentSessionNotifications,
  publishAppServerRpcErrorNotifications,
} from "./appServerEventStream";
import { projectAppServerThreadReadResult } from "./appServerReadModelClient";
import {
  invokeAgentRuntimeCommand,
  type AgentRuntimeCommandInvoke,
} from "./transport";
import { agentRuntimeCapabilityManifestFromAppServerResponse } from "./capabilityContract";
import { AGENT_RUNTIME_RENDERER_EVENT_NAME_CONTEXT_KEY } from "../agentProtocolOps";
import type {
  AgentRuntimeCapabilityManifestRequest,
  AgentRuntimeCompactSessionRequest,
  AgentRuntimeDiffFileCheckpointRequest,
  AgentRuntimeGetFileCheckpointRequest,
  AgentRuntimeInterruptTurnRequest,
  AgentRuntimeListFileCheckpointsRequest,
  AgentRuntimeReplayRequestRequest,
  AgentRuntimeReplayedActionRequiredView,
  AgentRuntimeRespondActionRequest,
  AgentRuntimeRestoreFileCheckpointRequest,
} from "./requestTypes";
import type {
  AgentRuntimeFileCheckpointDetail,
  AgentRuntimeFileCheckpointDiffResult,
  AgentRuntimeFileCheckpointListResult,
  AgentRuntimeFileCheckpointRestoreResult,
  AgentRuntimeThreadReadModel,
} from "./sessionTypes";
import type { AgentRuntimeCapabilityManifest } from "@limecloud/agent-ui-contracts";
import {
  findPendingTypedServerRequestAction,
  respondPendingTypedServerRequest,
  replayedActionViewFromPendingAction,
} from "./serverRequestReplay";

export type AgentRuntimeAppServerClient = Pick<
  AppServerClient,
  | "readThread"
  | "setThreadName"
  | "updateThreadSettings"
  | "runThreadShellCommand"
  | "startTurn"
  | "startReview"
  | "steerTurn"
  | "cancelTurn"
  | "startThreadCompaction"
  | "resumeThread"
  | "drainEvents"
  | "listAgentSessionFileCheckpoints"
  | "getAgentSessionFileCheckpoint"
  | "diffAgentSessionFileCheckpoint"
  | "restoreAgentSessionFileCheckpoint"
  | "listCapabilities"
>;

export type AgentRuntimeLifecycleClient = Pick<
  StandardAgentRuntimeClient,
  "startTurn" | "steerTurn" | "cancelTurn" | "readThread"
>;

type AgentRuntimeLifecycleStartTurnParams = Parameters<
  AgentRuntimeLifecycleClient["startTurn"]
>[0];
type AgentRuntimeLifecycleCancelTurnParams = Parameters<
  AgentRuntimeLifecycleClient["cancelTurn"]
>[0];
type AgentRuntimeLifecycleSteerTurnParams = Parameters<
  AgentRuntimeLifecycleClient["steerTurn"]
>[0];
type AgentRuntimeLifecycleReadThreadParams = Parameters<
  AgentRuntimeLifecycleClient["readThread"]
>[0];

export interface AgentRuntimeThreadClientDeps {
  invokeCommand?: AgentRuntimeCommandInvoke;
  appServerClient?: AgentRuntimeAppServerClient;
  standardRuntimeClient?: AgentRuntimeLifecycleClient;
  isAppServerTurnLifecycleAvailable?: () => boolean;
  enableAppServerEventDrain?: boolean;
}

export function createThreadClient(deps: AgentRuntimeThreadClientDeps = {}) {
  const {
    invokeCommand = invokeAgentRuntimeCommand,
    appServerClient = new AppServerClient(),
    isAppServerTurnLifecycleAvailable = defaultIsAppServerTurnLifecycleAvailable,
    enableAppServerEventDrain,
  } = deps;
  void invokeCommand;
  const standardRuntimeClient =
    deps.standardRuntimeClient ??
    createAppServerAgentRuntimeLifecycleClient(appServerClient);
  const appServerEventRouter = shouldEnableAppServerEventDrain(
    appServerClient,
    enableAppServerEventDrain,
    // The App Server-backed lifecycle client is created just below. Only an
    // explicitly injected lifecycle client bypasses the App Server drain.
    deps.standardRuntimeClient,
  )
    ? new AppServerAgentSessionEventDrainRouter(appServerClient)
    : null;

  async function submitAgentRuntimeTurn(
    request: TurnStartParams,
    onAccepted?: (response: AppServerRequestResult<TurnStartResponse>) => void,
  ): Promise<AppServerRequestResult<TurnStartResponse>> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const threadId = request.threadId.trim();
    if (!threadId) {
      throw new Error("threadId is required to start App Server turn");
    }
    const { eventName, params } = prepareAppServerTurnStart(request, threadId);
    const route = appServerEventRouter?.register({
      eventName,
      sessionId: threadId,
    });
    let result: AppServerRequestResult<TurnStartResponse>;
    try {
      result = await standardRuntimeClient.startTurn(params);
      requireTurnStartResponse(result?.result);
    } catch (error) {
      try {
        publishAppServerRpcErrorNotifications(error, {
          eventName,
          sessionId: threadId,
        });
      } catch {
        console.error(
          "[AgentRuntime] turn/start rejection notification failed",
        );
      }
      throw error;
    }
    try {
      onAccepted?.(result);
    } catch {
      reportRuntimeAcceptancePostProcessingFailure("start_callback", {
        threadId,
      });
    }
    try {
      if (route) route.publish(result.notifications);
      else
        publishAppServerAgentSessionNotifications(
          eventName,
          result.notifications,
        );
    } catch {
      reportRuntimeAcceptancePostProcessingFailure("start_notifications", {
        threadId,
      });
    }
    return result;
  }

  async function submitAgentRuntimeReview(
    request: AppServerReviewStartParams,
  ): Promise<Awaited<ReturnType<AgentRuntimeAppServerClient["startReview"]>>> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const threadId = request.threadId.trim();
    if (!threadId) {
      throw new Error("threadId is required to start App Server review");
    }
    const eventName = `agentSession/event/${threadId}`;
    const route = appServerEventRouter?.register({
      eventName,
      sessionId: threadId,
    });
    try {
      const result = await appServerClient.startReview({
        ...request,
        threadId,
      });
      if (route) {
        route.publish(result.notifications);
      } else {
        publishAppServerAgentSessionNotifications(
          eventName,
          result.notifications,
        );
      }
      return result;
    } catch (error) {
      publishAppServerRpcErrorNotifications(error, {
        eventName,
        sessionId: threadId,
      });
      throw error;
    }
  }

  async function interruptAgentRuntimeTurn(
    request: AgentRuntimeInterruptTurnRequest,
  ): Promise<boolean> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const cancelParams = appServerTurnCancelParamsFromRequest(request);
    appServerEventRouter?.close({
      eventName: request.event_name,
      sessionId: request.session_id,
      turnId: cancelParams.turnId,
    });
    const result = await standardRuntimeClient.cancelTurn(cancelParams);
    publishAppServerAgentSessionNotifications(
      request.event_name,
      result.notifications,
    );
    return true;
  }

  function steerAgentRuntimeTurn(
    request: TurnSteerParams,
  ): Promise<AppServerRequestResult<TurnSteerResponse>> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    return standardRuntimeClient.steerTurn(request);
  }

  async function compactAgentRuntimeSession(
    request: AgentRuntimeCompactSessionRequest,
  ): Promise<void> {
    const threadId = request.session_id.trim();
    const eventName = request.event_name.trim();
    if (!threadId) {
      throw new Error("threadId is required to start context compaction");
    }
    if (!eventName) {
      throw new Error("eventName is required to route context compaction");
    }

    const route = appServerEventRouter?.register({
      eventName,
      sessionId: threadId,
    });
    try {
      const result = await appServerClient.startThreadCompaction({ threadId });
      if (route) {
        route.publish(result.notifications);
      } else {
        publishAppServerAgentSessionNotifications(
          eventName,
          result.notifications,
        );
      }
    } catch (error) {
      publishAppServerRpcErrorNotifications(error, {
        eventName,
        sessionId: threadId,
      });
      throw error;
    }
  }

  async function resumeThread(
    request: ThreadResumeParams,
    consumeSnapshot?: (snapshot: ThreadResumeResponse) => void,
  ): Promise<AppServerRequestResult<ThreadResumeResponse>> {
    const threadId = request.threadId.trim();
    if (!threadId) {
      throw new Error("thread/resume requires a non-empty threadId");
    }
    const params: ThreadResumeParams = {
      ...request,
      threadId,
      excludeTurns: request.excludeTurns ?? true,
    };
    const response = await appServerClient.resumeThread(params);
    if (!consumeSnapshot) return response;
    if (response.result.thread.id !== threadId)
      throw new Error("thread/resume returned a foreign Thread");
    const read = await appServerClient.readThread({
      threadId,
      includeTurns: true,
    });
    if (read.result.thread.id !== threadId)
      throw new Error("thread/read returned a foreign resume snapshot");
    const snapshot: ThreadResumeResponse = {
      ...response.result,
      thread: { ...response.result.thread, turns: read.result.thread.turns },
    };
    consumeSnapshot(snapshot);
    appServerEventRouter?.restoreThread({
      eventName: `agentSession/event/${threadId}`,
      thread: snapshot.thread,
    });
    appServerEventRouter?.routeNotifications([
      ...response.notifications,
      ...read.notifications,
    ]);
    return response;
  }

  async function getAgentRuntimeCapabilityManifest(
    request: AgentRuntimeCapabilityManifestRequest = {},
  ): Promise<AgentRuntimeCapabilityManifest> {
    const params: AppServerCapabilityListParams = {
      ...(request.app_id ? { appId: request.app_id } : {}),
      ...(request.workspace_id ? { workspaceId: request.workspace_id } : {}),
      ...(request.session_id ? { sessionId: request.session_id } : {}),
      ...(request.cursor ? { cursor: request.cursor } : {}),
      ...(typeof request.limit === "number" ? { limit: request.limit } : {}),
    };
    const result = await appServerClient.listCapabilities(params);
    return agentRuntimeCapabilityManifestFromAppServerResponse(
      result.result.capabilities ?? [],
      result.result.runtimeCapabilityManifest,
      {
        sessionId: request.session_id,
      },
    );
  }

  async function replayAgentRuntimeRequest(
    request: AgentRuntimeReplayRequestRequest,
  ): Promise<AgentRuntimeReplayedActionRequiredView | null> {
    const action = findPendingTypedServerRequestAction(
      request.session_id,
      request.request_id,
    );
    return action ? replayedActionViewFromPendingAction(action) : null;
  }

  async function respondAgentRuntimeAction(
    request: AgentRuntimeRespondActionRequest,
  ): Promise<void> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    if (respondPendingTypedServerRequest(request)) {
      return;
    }
    throw new Error(
      "Typed server request is no longer pending; generic agentSession/action/respond is retired.",
    );
  }

  async function getAgentRuntimeThreadRead(
    threadId: string,
  ): Promise<AgentRuntimeThreadReadModel> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      throw new Error(
        "threadId is required to read canonical App Server thread",
      );
    }
    const response = await appServerClient.readThread({
      threadId: normalizedThreadId,
      includeTurns: true,
    });
    return projectAppServerThreadReadResult(response.result);
  }

  async function runUserShellCommand(
    request: AppServerThreadShellCommandParams,
    eventName: string,
  ): Promise<void> {
    const threadId = request.threadId.trim();
    const command = request.command.trim();
    const normalizedEventName = eventName.trim();
    if (!threadId) {
      throw new Error("threadId is required to run a shell command");
    }
    if (!command) {
      throw new Error("command is required to run a shell command");
    }
    if (!normalizedEventName) {
      throw new Error("eventName is required to route a shell command");
    }

    const route = appServerEventRouter?.register({
      eventName: normalizedEventName,
      sessionId: threadId,
    });
    try {
      const result = await appServerClient.runThreadShellCommand({
        threadId,
        command,
      });
      if (route) {
        route.publish(result.notifications);
      } else {
        publishAppServerAgentSessionNotifications(
          normalizedEventName,
          result.notifications,
        );
      }
    } catch (error) {
      publishAppServerRpcErrorNotifications(error, {
        eventName: normalizedEventName,
        sessionId: threadId,
      });
      throw error;
    }
  }

  async function readAgentRuntimeThread(
    threadId: string,
  ): Promise<AppServerThreadReadResponse> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      throw new Error(
        "threadId is required to read canonical App Server thread",
      );
    }
    const response = await appServerClient.readThread({
      threadId: normalizedThreadId,
      includeTurns: true,
    } satisfies AppServerThreadReadParams);
    return response.result;
  }

  async function readThreadSessionId(threadId: string): Promise<string> {
    assertAppServerTurnLifecycleAvailable(isAppServerTurnLifecycleAvailable);
    const normalizedThreadId = threadId.trim();
    if (!normalizedThreadId) {
      throw new Error("threadId is required to resolve App Server session");
    }
    const response = await appServerClient.readThread({
      threadId: normalizedThreadId,
      includeTurns: false,
    } satisfies AppServerThreadReadParams);
    const resolvedThreadId = response.result.thread.id.trim();
    if (resolvedThreadId !== normalizedThreadId) {
      throw new Error(
        `thread/read returned mismatched threadId: expected ${normalizedThreadId}, received ${resolvedThreadId || "<empty>"}`,
      );
    }
    const sessionId = response.result.thread.sessionId.trim();
    if (!sessionId) {
      throw new Error(
        `thread/read returned an empty sessionId for ${normalizedThreadId}`,
      );
    }
    return sessionId;
  }

  async function updateAgentRuntimeThreadSettings(
    request: AppServerThreadSettingsUpdateParams,
  ): Promise<AppServerRequestResult<AppServerThreadSettingsUpdateResponse>> {
    const threadId = request.threadId.trim();
    if (!threadId) {
      throw new Error(
        "threadId is required to update App Server thread settings",
      );
    }
    return appServerClient.updateThreadSettings({
      ...request,
      threadId,
    });
  }

  async function setAgentRuntimeThreadName(
    request: ThreadSetNameParams,
  ): Promise<void> {
    const threadId = request.threadId.trim();
    const name = request.name.trim();
    if (!threadId) {
      throw new Error("threadId is required to name an App Server thread");
    }
    if (!name) {
      throw new Error("name is required to name an App Server thread");
    }
    await appServerClient.setThreadName({ threadId, name });
  }

  async function listAgentRuntimeFileCheckpoints(
    request: AgentRuntimeListFileCheckpointsRequest,
  ): Promise<AgentRuntimeFileCheckpointListResult> {
    const command = "agentSession/fileCheckpoint/list";
    const result = await appServerClient.listAgentSessionFileCheckpoints({
      sessionId: request.session_id,
    });
    return projectAppServerFileCheckpointListResult(command, result.result);
  }

  async function getAgentRuntimeFileCheckpoint(
    request: AgentRuntimeGetFileCheckpointRequest,
  ): Promise<AgentRuntimeFileCheckpointDetail> {
    const command = "agentSession/fileCheckpoint/get";
    const result = await appServerClient.getAgentSessionFileCheckpoint({
      sessionId: request.session_id,
      checkpointId: request.checkpoint_id,
    });
    return projectAppServerFileCheckpointDetail(command, result.result);
  }

  async function diffAgentRuntimeFileCheckpoint(
    request: AgentRuntimeDiffFileCheckpointRequest,
  ): Promise<AgentRuntimeFileCheckpointDiffResult> {
    const command = "agentSession/fileCheckpoint/diff";
    const result = await appServerClient.diffAgentSessionFileCheckpoint({
      sessionId: request.session_id,
      checkpointId: request.checkpoint_id,
    });
    return projectAppServerFileCheckpointDiffResult(command, result.result);
  }

  async function restoreAgentRuntimeFileCheckpoint(
    request: AgentRuntimeRestoreFileCheckpointRequest,
  ): Promise<AgentRuntimeFileCheckpointRestoreResult> {
    const command = "agentSession/fileCheckpoint/restore";
    const result = await appServerClient.restoreAgentSessionFileCheckpoint({
      sessionId: request.session_id,
      checkpointId: request.checkpoint_id,
      confirmRestore: request.confirm_restore,
      createBackup: request.create_backup,
    });
    return projectAppServerFileCheckpointRestoreResult(command, result.result);
  }

  return {
    compactAgentRuntimeSession,
    diffAgentRuntimeFileCheckpoint,
    getAgentRuntimeFileCheckpoint,
    getAgentRuntimeCapabilityManifest,
    getAgentRuntimeThreadRead,
    readAgentRuntimeThread,
    readThreadSessionId,
    setAgentRuntimeThreadName,
    updateAgentRuntimeThreadSettings,
    interruptAgentRuntimeTurn,
    listAgentRuntimeFileCheckpoints,
    replayAgentRuntimeRequest,
    respondAgentRuntimeAction,
    restoreAgentRuntimeFileCheckpoint,
    resumeThread,
    runUserShellCommand,
    steerAgentRuntimeTurn,
    submitAgentRuntimeReview,
    submitAgentRuntimeTurn,
  };
}

function defaultIsAppServerTurnLifecycleAvailable(): boolean {
  return isAppServerBridgeAvailable();
}

function prepareAppServerTurnStart(
  request: TurnStartParams,
  threadId: string,
): { eventName: string; params: TurnStartParams } {
  const fallbackEventName = `agentSession/event/${threadId}`;
  const context = request.additionalContext;
  if (!isRecord(context)) {
    return { eventName: fallbackEventName, params: request };
  }

  const rendererEventName =
    context[AGENT_RUNTIME_RENDERER_EVENT_NAME_CONTEXT_KEY];
  if (
    !isRecord(rendererEventName) ||
    rendererEventName.kind !== "application" ||
    typeof rendererEventName.value !== "string"
  ) {
    return { eventName: fallbackEventName, params: request };
  }

  const {
    [AGENT_RUNTIME_RENDERER_EVENT_NAME_CONTEXT_KEY]: _rendererEventName,
    ...additionalContext
  } = context;
  const { additionalContext: _context, ...baseParams } = request;
  return {
    eventName: rendererEventName.value.trim() || fallbackEventName,
    params:
      Object.keys(additionalContext).length > 0
        ? { ...baseParams, additionalContext }
        : baseParams,
  };
}

function assertAppServerTurnLifecycleAvailable(
  isAvailable: () => boolean,
): void {
  if (!isAvailable()) {
    throw new Error(
      "App Server turn lifecycle is unavailable; Agent Runtime requires the App Server current lifecycle channel.",
    );
  }
}

function shouldEnableAppServerEventDrain(
  appServerClient: AgentRuntimeAppServerClient,
  override: boolean | undefined,
  standardRuntimeClient: AgentRuntimeLifecycleClient | undefined,
): boolean {
  if (override !== undefined) {
    return override;
  }
  return (
    standardRuntimeClient === undefined &&
    typeof appServerClient.drainEvents === "function"
  );
}

function createAppServerAgentRuntimeLifecycleClient(
  appServerClient: AgentRuntimeAppServerClient,
): AgentRuntimeLifecycleClient {
  return {
    startTurn: (params: AgentRuntimeLifecycleStartTurnParams) =>
      appServerClient.startTurn(params) as ReturnType<
        AgentRuntimeLifecycleClient["startTurn"]
      >,
    steerTurn: (params: AgentRuntimeLifecycleSteerTurnParams) =>
      appServerClient.steerTurn(params) as ReturnType<
        AgentRuntimeLifecycleClient["steerTurn"]
      >,
    cancelTurn: (params: AgentRuntimeLifecycleCancelTurnParams) =>
      appServerClient.cancelTurn(params) as ReturnType<
        AgentRuntimeLifecycleClient["cancelTurn"]
      >,
    readThread: (params: AgentRuntimeLifecycleReadThreadParams) =>
      appServerClient.readThread(
        params as unknown as AppServerThreadReadParams,
      ) as ReturnType<AgentRuntimeLifecycleClient["readThread"]>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export {
  projectAppServerAgentEventPayload,
  publishAppServerAgentSessionNotifications,
} from "./appServerEventStream";

function appServerTurnCancelParamsFromRequest(
  request: AgentRuntimeInterruptTurnRequest,
): TurnInterruptParams {
  if (!request.turn_id) {
    throw new Error("turn_id is required to cancel App Server turn");
  }
  return {
    threadId: request.session_id,
    turnId: request.turn_id,
  };
}

export const {
  compactAgentRuntimeSession,
  diffAgentRuntimeFileCheckpoint,
  getAgentRuntimeCapabilityManifest,
  getAgentRuntimeFileCheckpoint,
  getAgentRuntimeThreadRead,
  readAgentRuntimeThread,
  readThreadSessionId,
  setAgentRuntimeThreadName,
  updateAgentRuntimeThreadSettings,
  interruptAgentRuntimeTurn,
  listAgentRuntimeFileCheckpoints,
  replayAgentRuntimeRequest,
  respondAgentRuntimeAction,
  restoreAgentRuntimeFileCheckpoint,
  resumeThread,
  runUserShellCommand,
  steerAgentRuntimeTurn,
  submitAgentRuntimeReview,
  submitAgentRuntimeTurn,
} = createThreadClient();
