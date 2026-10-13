import type { AgentEvent } from "@/lib/api/agentProtocol";
import type { AgentUiPerformanceTraceMetadata } from "./agentStreamPerformanceMetrics";

function parseEventTimestampMs(timestamp: string | undefined): number | null {
  if (!timestamp) {
    return null;
  }
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildAgentEventPerformanceTrace(params: {
  activeSessionId: string;
  event: AgentEvent;
  eventReceivedAt: number;
  previousTrace?: AgentUiPerformanceTraceMetadata | null;
  resolvedWorkspaceId: string;
}): AgentUiPerformanceTraceMetadata | null {
  const previousTrace = params.previousTrace ?? null;
  if (!previousTrace && !params.event.trace_id && !params.event.run_id) {
    return null;
  }

  return {
    ...previousTrace,
    requestId: params.event.request_id ?? previousTrace?.requestId ?? null,
    runId: params.event.run_id ?? previousTrace?.runId ?? null,
    sessionId:
      params.event.session_id ??
      previousTrace?.sessionId ??
      params.activeSessionId,
    traceId: params.event.trace_id ?? previousTrace?.traceId ?? null,
    turnId: params.event.turn_id ?? previousTrace?.turnId ?? null,
    workspaceId: previousTrace?.workspaceId ?? params.resolvedWorkspaceId,
    serverEventEmittedAt:
      normalizeOptionalMetricTime(params.event.server_event_emitted_at) ??
      parseEventTimestampMs(params.event.timestamp) ??
      previousTrace?.serverEventEmittedAt ??
      null,
    serverEventId:
      params.event.event_id ?? previousTrace?.serverEventId ?? null,
    serverEventSequence:
      normalizeOptionalMetricTime(params.event.sequence) ??
      previousTrace?.serverEventSequence ??
      null,
    serverEventType:
      params.event.type ?? previousTrace?.serverEventType ?? null,
    rendererEventReceivedAt:
      normalizeOptionalMetricTime(params.event.renderer_event_received_at) ??
      params.eventReceivedAt,
    providerWaitMs:
      params.event.type === "provider_trace" &&
      params.event.stage === "first_text_delta_received"
        ? (normalizeOptionalMetricTime(params.event.elapsed_ms) ??
          previousTrace?.providerWaitMs ??
          null)
        : (previousTrace?.providerWaitMs ?? null),
  };
}

export interface AgentStreamFirstRuntimeStatusMetricContextParams {
  activeSessionId: string;
  eventName: string;
  firstEventReceivedAt?: number | null;
  firstRuntimeStatusAt: number;
  requestStartedAt: number;
  statusPhase: string;
  statusTitle: string;
}

export interface AgentStreamFirstTextDeltaMetricContextParams {
  activeSessionId: string;
  deltaText: string;
  eventName: string;
  firstEventReceivedAt?: number | null;
  firstRuntimeStatusAt?: number | null;
  firstTextDeltaAt: number;
  requestStartedAt: number;
  rendererEventReceivedAt?: number | null;
  serverEventEmittedAt?: number | null;
}

export interface AgentStreamProviderTraceMetricContextParams {
  activeSessionId: string;
  attempt?: number | null;
  cancelReason?: string | null;
  elapsedMs?: number | null;
  eventName: string;
  failureCategory?: string | null;
  model?: string | null;
  provider?: string | null;
  retryable?: boolean | null;
  runtimeProviderActiveModel?: string | null;
  runtimeProviderBackend?: string | null;
  runtimeProviderProtocol?: string | null;
  runtimeProviderSelector?: string | null;
  runtimeEventType?: string | null;
  stage: string;
  status?: string | null;
  textChars?: number | null;
}

function normalizeOptionalMetricTime(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function shouldRecordAgentStreamFirstRuntimeStatus(params: {
  firstRuntimeStatusAt?: number | null;
}): boolean {
  return !params.firstRuntimeStatusAt;
}

export function shouldRecordAgentStreamFirstTextDelta(params: {
  firstTextDeltaAt?: number | null;
}): boolean {
  return !params.firstTextDeltaAt;
}

export function buildAgentStreamFirstRuntimeStatusMetricContext(
  params: AgentStreamFirstRuntimeStatusMetricContextParams,
): Record<string, unknown> {
  return {
    elapsedMs: params.firstRuntimeStatusAt - params.requestStartedAt,
    eventName: params.eventName,
    firstEventDeltaMs: params.firstEventReceivedAt
      ? params.firstRuntimeStatusAt - params.firstEventReceivedAt
      : null,
    phase: params.statusPhase,
    sessionId: params.activeSessionId,
    title: params.statusTitle,
  };
}

export function buildAgentStreamFirstTextDeltaMetricContext(
  params: AgentStreamFirstTextDeltaMetricContextParams,
): Record<string, unknown> {
  const rendererEventReceivedAt = normalizeOptionalMetricTime(
    params.rendererEventReceivedAt,
  );
  const serverEventEmittedAt = normalizeOptionalMetricTime(
    params.serverEventEmittedAt,
  );
  return {
    deltaChars: params.deltaText.length,
    elapsedMs: params.firstTextDeltaAt - params.requestStartedAt,
    eventName: params.eventName,
    firstEventDeltaMs: params.firstEventReceivedAt
      ? params.firstTextDeltaAt - params.firstEventReceivedAt
      : null,
    firstRuntimeStatusDeltaMs: params.firstRuntimeStatusAt
      ? params.firstTextDeltaAt - params.firstRuntimeStatusAt
      : null,
    rendererEventReceivedDeltaMs:
      rendererEventReceivedAt !== null
        ? params.firstTextDeltaAt - rendererEventReceivedAt
        : null,
    serverEventDeltaMs:
      serverEventEmittedAt !== null
        ? params.firstTextDeltaAt - serverEventEmittedAt
        : null,
    serverToRendererDeltaMs:
      serverEventEmittedAt !== null && rendererEventReceivedAt !== null
        ? rendererEventReceivedAt - serverEventEmittedAt
        : null,
    sessionId: params.activeSessionId,
  };
}

export function buildAgentStreamProviderTraceMetricContext(
  params: AgentStreamProviderTraceMetricContextParams,
): Record<string, unknown> {
  const elapsedMs = normalizeOptionalMetricTime(params.elapsedMs);
  return {
    attempt: normalizeOptionalMetricTime(params.attempt),
    cancelReason: params.cancelReason ?? null,
    elapsedMs,
    eventName: params.eventName,
    failureCategory: params.failureCategory ?? null,
    model: params.model ?? null,
    provider: params.provider ?? null,
    providerWaitMs:
      params.stage === "first_text_delta_received" ? elapsedMs : null,
    retryable: params.retryable ?? null,
    runtimeProviderActiveModel: params.runtimeProviderActiveModel ?? null,
    runtimeProviderBackend: params.runtimeProviderBackend ?? null,
    runtimeProviderProtocol: params.runtimeProviderProtocol ?? null,
    runtimeProviderSelector: params.runtimeProviderSelector ?? null,
    runtimeEventType: params.runtimeEventType ?? null,
    sessionId: params.activeSessionId,
    stage: params.stage,
    status: params.status ?? null,
    textChars: normalizeOptionalMetricTime(params.textChars),
  };
}
