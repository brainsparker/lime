import {
  AppServerRpcError,
  type AppServerDrainEventsRequest,
  type AppServerJsonRpcNotification,
} from "@/lib/api/appServer";
import {
  getDefaultAppServerEventBus,
  type AppServerEventBus,
} from "@/lib/api/appServerEventBus";
import { publishProcessedAgentRuntimeEvent } from "../agentRuntimeEvents";
import {
  projectAgentRuntimeSequenceGateNotifications,
  restoreAgentRuntimeCommandSequenceGate,
  type CommandSequenceSnapshot,
} from "./eventSequenceGate";
import { projectAppServerAgentEventPayload } from "./appServerEventStreamProjection";
import { readAppServerAgentEvent } from "./appServerEventPayloadUtils";
import {
  readAppServerNotificationDriftRoute,
  recordAppServerNotificationDrift,
} from "./appServerNotificationDrift";
import { readAppServerV2NotificationRoute } from "./appServerV2Notification";
import { CommandContinuation } from "./commandContinuation";

export const APP_SERVER_EVENT_DRAIN_LIMIT = 50;
export const APP_SERVER_EVENT_DRAIN_ACTIVE_INTERVAL_MS = 32;
export const APP_SERVER_EVENT_DRAIN_FAST_FIRST_LIMIT = 1;
export const APP_SERVER_EVENT_DRAIN_FAST_FIRST_INTERVAL_MS = 24;
export const APP_SERVER_EVENT_DRAIN_INTERVAL_MS = 96;
const APP_SERVER_EVENT_ROUTE_TTL_MS = 30 * 60 * 1000;

type AppServerEventDrainClient = {
  drainEvents: (
    request?: number | AppServerDrainEventsRequest,
  ) => Promise<unknown[]> | unknown[];
};
type AppServerEventBusLike = Pick<AppServerEventBus, "subscribe">;

export type AppServerAgentSessionEventRouteParams = {
  eventName?: string;
  sessionId?: string;
  turnId?: string;
};

type AppServerAgentSessionEventRoute = {
  turnCompleted: boolean;
  commands: CommandContinuation;
  drainNotificationKeys: Set<string>;
  eventName: string;
  expiresAt: number;
  hasPublishedEvent: boolean;
  registrationKey: string;
  requestedTurnId?: string;
  responseNotificationKeys: Set<string>;
  seenEventIds: Set<string>;
  sessionId: string;
  turnId?: string;
};

type AppServerNotificationSource = "drain" | "response";

type AppServerRoutableNotification = {
  eventId?: string;
  sessionId: string;
  terminal: boolean;
  turnId?: string;
};

export class AppServerAgentSessionEventDrainRouter {
  readonly #closedRouteKeys = new Set<string>();
  readonly #closedSessionTurnKeys = new Set<string>();
  readonly #eventBus: AppServerEventBusLike;
  readonly #routes = new Map<string, AppServerAgentSessionEventRoute>();
  #unsubscribeFromEventBus: (() => void) | null = null;
  #nextRegistrationId = 1;

  constructor(
    appServerClient: AppServerEventDrainClient,
    eventBus: AppServerEventBusLike = getDefaultAppServerEventBus(
      appServerClient,
    ),
  ) {
    this.#eventBus = eventBus;
  }

  register(params: AppServerAgentSessionEventRouteParams): {
    publish: (notifications: AppServerJsonRpcNotification[]) => void;
  } | null {
    const eventName = params.eventName?.trim();
    const sessionId = params.sessionId?.trim();
    if (!eventName || !sessionId) {
      return null;
    }

    const route = {
      drainNotificationKeys: new Set<string>(),
      eventName,
      sessionId,
      requestedTurnId: params.turnId?.trim() || undefined,
      responseNotificationKeys: new Set<string>(),
      turnId: params.turnId?.trim() || undefined,
      seenEventIds: new Set(),
      expiresAt: Date.now() + APP_SERVER_EVENT_ROUTE_TTL_MS,
      hasPublishedEvent: false,
      turnCompleted: false,
      commands: new CommandContinuation(),
    } as Omit<AppServerAgentSessionEventRoute, "registrationKey">;
    const key = routeKey(route);
    const registeredRoute: AppServerAgentSessionEventRoute = {
      ...route,
      registrationKey: `${key}\u0000${this.#nextRegistrationId++}`,
    };
    this.#closedRouteKeys.delete(key);
    for (const [existingKey, existing] of this.#routes) {
      if (routeKey(existing) === key && !existing.turnCompleted)
        this.#routes.delete(existingKey);
    }
    this.#routes.set(registeredRoute.registrationKey, registeredRoute);
    this.#ensureEventBusSubscription();

    return {
      publish: (notifications) => {
        this.routeNotifications(notifications, eventName, "response");
      },
    };
  }

  restoreCommands(params: {
    eventName: string;
    thread: CommandSequenceSnapshot;
  }): void {
    const { eventName, thread } = params;
    restoreAgentRuntimeCommandSequenceGate(eventName, thread);
    for (const turn of thread.turns ?? []) {
      if (
        turn.status === "inProgress" ||
        this.#closedSessionTurnKeys.has(sessionTurnKey(thread.id, turn.id))
      )
        continue;
      let route = [...this.#routes.values()].find(
        (existing) =>
          existing.eventName === eventName &&
          existing.sessionId === thread.id &&
          existing.turnId === turn.id,
      );
      if (!route) {
        const commands = new CommandContinuation();
        commands.restore(turn.items ?? []);
        if (!commands.active) continue;
        this.register({ eventName, sessionId: thread.id, turnId: turn.id });
        route = [...this.#routes.values()].find(
          (existing) =>
            existing.eventName === eventName &&
            existing.sessionId === thread.id &&
            existing.turnId === turn.id,
        );
      }
      if (!route) continue;
      route.turnCompleted = true;
      route.hasPublishedEvent = true;
      route.commands.restore(turn.items ?? []);
      if (!route.commands.active) {
        this.#rememberClosedRoute(route, turn.id);
        this.#routes.delete(route.registrationKey);
      }
    }
    this.#stopEventBusSubscriptionIfIdle();
  }

  close(params: AppServerAgentSessionEventRouteParams): void {
    const eventName = params.eventName?.trim();
    const sessionId = params.sessionId?.trim();
    const turnId = params.turnId?.trim() || undefined;
    if (!eventName || !sessionId) {
      return;
    }

    for (const [key, route] of this.#routes) {
      if (route.eventName !== eventName || route.sessionId !== sessionId) {
        continue;
      }
      if (
        turnId &&
        route.turnId &&
        route.turnId !== turnId &&
        route.requestedTurnId !== turnId
      ) {
        continue;
      }
      this.#rememberClosedRoute(route, turnId ?? route.turnId);
      this.#routes.delete(key);
    }

    if (turnId) {
      this.#closedSessionTurnKeys.add(sessionTurnKey(sessionId, turnId));
    }
    this.#stopEventBusSubscriptionIfIdle();
  }

  routeNotifications(
    notifications: AppServerJsonRpcNotification[] | undefined,
    fallbackEventName?: string,
    source: AppServerNotificationSource = "drain",
  ): void {
    if (!notifications?.length) {
      return;
    }

    for (const notification of sortAppServerAgentSessionNotifications(
      notifications,
    )) {
      this.#routeNotification(notification, fallbackEventName, source);
    }
    this.#stopEventBusSubscriptionIfIdle();
  }

  #ensureEventBusSubscription(): void {
    if (this.#unsubscribeFromEventBus) {
      return;
    }

    this.#unsubscribeFromEventBus = this.#eventBus.subscribe({
      getDrainOptions: () => {
        this.#pruneExpiredRoutes();
        if (this.#hasRouteWaitingForFirstEvent()) {
          return {
            intervalMs: APP_SERVER_EVENT_DRAIN_FAST_FIRST_INTERVAL_MS,
            limit: APP_SERVER_EVENT_DRAIN_FAST_FIRST_LIMIT,
          };
        }
        return {
          activeIntervalMs: APP_SERVER_EVENT_DRAIN_ACTIVE_INTERVAL_MS,
          intervalMs: APP_SERVER_EVENT_DRAIN_INTERVAL_MS,
          limit: APP_SERVER_EVENT_DRAIN_LIMIT,
        };
      },
      onNotifications: (notifications) => {
        this.routeNotifications(notifications);
      },
    });
  }

  #routeNotification(
    notification: AppServerJsonRpcNotification,
    fallbackEventName?: string,
    source: AppServerNotificationSource = "drain",
  ): void {
    const routable = readRoutableNotification(notification);
    if (!routable) {
      recordAppServerNotificationDrift(notification);
      if (fallbackEventName) {
        publishAppServerAgentSessionNotifications(fallbackEventName, [
          notification,
        ]);
      }
      return;
    }

    const matchedRoutes = this.#matchingRoutes(routable, notification);
    if (
      matchedRoutes.length === 0 &&
      fallbackEventName &&
      !this.#isClosedFallbackRoute(routable, fallbackEventName) &&
      !this.#isClosedSessionTurn(routable)
    ) {
      publishAppServerAgentSessionNotifications(fallbackEventName, [
        notification,
      ]);
      return;
    }

    for (const route of matchedRoutes) {
      if (routable.eventId && route.seenEventIds.has(routable.eventId)) {
        continue;
      }
      if (routable.eventId) {
        route.seenEventIds.add(routable.eventId);
      } else {
        const notificationKey = directNotificationMirrorKey(notification);
        if (
          notificationKey &&
          hasNotificationFromOtherSource(route, source, notificationKey)
        ) {
          continue;
        }
        if (notificationKey) {
          recordNotificationSource(route, source, notificationKey);
        }
      }
      route.hasPublishedEvent = true;
      const accepted = publishAppServerAgentSessionNotificationsFromPipeline(
        route.eventName,
        [notification],
      );
      if (!accepted) continue;
      route.commands.observe(notification);
      if (routable.terminal) {
        route.turnCompleted = true;
      }
      if (route.turnCompleted && !route.commands.active) {
        this.#rememberClosedRoute(route, routable.turnId);
        this.#routes.delete(route.registrationKey);
      }
    }
  }

  #hasRouteWaitingForFirstEvent(): boolean {
    for (const route of this.#routes.values()) {
      if (!route.hasPublishedEvent) {
        return true;
      }
    }
    return false;
  }

  #isClosedFallbackRoute(
    event: AppServerRoutableNotification,
    fallbackEventName: string,
  ): boolean {
    return (
      this.#closedRouteKeys.has(
        routeKey({
          eventName: fallbackEventName,
          sessionId: event.sessionId,
          turnId: event.turnId,
        }),
      ) ||
      this.#closedRouteKeys.has(
        routeKey({
          eventName: fallbackEventName,
          sessionId: event.sessionId,
        }),
      )
    );
  }

  #isClosedSessionTurn(event: AppServerRoutableNotification): boolean {
    return Boolean(
      event.turnId &&
      this.#closedSessionTurnKeys.has(
        sessionTurnKey(event.sessionId, event.turnId),
      ),
    );
  }

  #matchingRoutes(
    event: AppServerRoutableNotification,
    notification: AppServerJsonRpcNotification,
  ): AppServerAgentSessionEventRoute[] {
    const routes: AppServerAgentSessionEventRoute[] = [];
    if (this.#isClosedSessionTurn(event)) {
      return routes;
    }
    for (const route of this.#routes.values()) {
      if (route.sessionId !== event.sessionId) {
        continue;
      }
      if (
        !route.turnId &&
        [...this.#routes.values()].some(
          (existing) =>
            existing.turnCompleted &&
            existing.sessionId === event.sessionId &&
            existing.turnId === event.turnId,
        )
      )
        continue;
      if (route.turnCompleted && !route.commands.allows(notification)) continue;
      if (!route.turnId && event.turnId) {
        route.turnId = event.turnId;
      }
      if (route.turnId && event.turnId && route.turnId !== event.turnId) {
        if (
          route.hasPublishedEvent ||
          this.#isClosedRouteForEvent(route, event)
        ) {
          continue;
        }
        route.turnId = event.turnId;
      }
      routes.push(route);
    }
    return routes;
  }

  #rememberClosedRoute(
    route: AppServerAgentSessionEventRoute,
    turnId?: string,
  ): void {
    this.#closedRouteKeys.add(routeKey(route));
    if (route.requestedTurnId) {
      this.#closedRouteKeys.add(
        routeKey({
          eventName: route.eventName,
          sessionId: route.sessionId,
          turnId: route.requestedTurnId,
        }),
      );
    }
    if (turnId) {
      this.#closedSessionTurnKeys.add(sessionTurnKey(route.sessionId, turnId));
    }
  }

  #isClosedRouteForEvent(
    route: AppServerAgentSessionEventRoute,
    event: AppServerRoutableNotification,
  ): boolean {
    return (
      this.#closedRouteKeys.has(
        routeKey({
          eventName: route.eventName,
          sessionId: route.sessionId,
          turnId: event.turnId,
        }),
      ) ||
      this.#closedRouteKeys.has(
        routeKey({
          eventName: route.eventName,
          sessionId: route.sessionId,
          turnId: route.requestedTurnId,
        }),
      )
    );
  }

  #pruneExpiredRoutes(): void {
    const now = Date.now();
    for (const [key, route] of this.#routes) {
      if (route.expiresAt <= now) {
        this.#routes.delete(key);
      }
    }
    this.#stopEventBusSubscriptionIfIdle();
  }

  #stopEventBusSubscriptionIfIdle(): void {
    if (this.#routes.size > 0 || !this.#unsubscribeFromEventBus) {
      return;
    }
    this.#unsubscribeFromEventBus();
    this.#unsubscribeFromEventBus = null;
  }
}

function directNotificationMirrorKey(
  notification: AppServerJsonRpcNotification,
): string | null {
  const route = readAppServerV2NotificationRoute(notification);
  if (!route) {
    return null;
  }

  // Response notifications and drained notifications can have different
  // top-level envelopes or object insertion order. Mirror identity must use
  // only the stable v2 wire payload, while source-local repeats remain valid.
  return stableJsonStringify({
    method: notification.method,
    route,
    params: notification.params,
  });
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${stableJsonStringify(entry)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasNotificationFromOtherSource(
  route: AppServerAgentSessionEventRoute,
  source: AppServerNotificationSource,
  notificationKey: string,
): boolean {
  return source === "drain"
    ? route.responseNotificationKeys.has(notificationKey)
    : route.drainNotificationKeys.has(notificationKey);
}

function recordNotificationSource(
  route: AppServerAgentSessionEventRoute,
  source: AppServerNotificationSource,
  notificationKey: string,
): void {
  const keys =
    source === "drain"
      ? route.drainNotificationKeys
      : route.responseNotificationKeys;
  keys.add(notificationKey);
}

export function publishAppServerRpcErrorNotifications(
  error: unknown,
  routeParams: AppServerAgentSessionEventRouteParams,
): void {
  if (
    !(error instanceof AppServerRpcError) ||
    !error.notifications.length ||
    !routeParams.eventName
  ) {
    return;
  }

  for (const notification of error.notifications) {
    if (doesNotificationMatchRoute(notification, routeParams)) {
      publishAppServerAgentSessionNotifications(routeParams.eventName, [
        notification,
      ]);
    }
  }
}

function doesNotificationMatchRoute(
  notification: AppServerJsonRpcNotification,
  routeParams: AppServerAgentSessionEventRouteParams,
): boolean {
  const event = readRoutableNotification(notification);
  if (!event) {
    return true;
  }
  if (routeParams.sessionId && event.sessionId !== routeParams.sessionId) {
    return false;
  }
  if (
    routeParams.turnId &&
    event.turnId &&
    routeParams.turnId !== event.turnId
  ) {
    return false;
  }
  return true;
}

function readRoutableNotification(
  notification: AppServerJsonRpcNotification,
): AppServerRoutableNotification | null {
  const event = readAppServerAgentEvent(notification.params);
  if (event) {
    return {
      eventId: event.eventId,
      sessionId: event.threadId ?? event.sessionId,
      terminal: false,
      turnId: event.turnId,
    };
  }

  const direct = readAppServerV2NotificationRoute(notification);
  if (direct) {
    return {
      sessionId: direct.threadId,
      terminal: direct.terminal,
      turnId: direct.turnId,
    };
  }
  const drift = readAppServerNotificationDriftRoute(notification);
  return drift
    ? {
        sessionId: drift.threadId,
        terminal: false,
        turnId: drift.turnId,
      }
    : null;
}

function routeKey(route: AppServerAgentSessionEventRouteParams): string {
  return `${route.sessionId}\u0000${route.turnId ?? ""}\u0000${route.eventName}`;
}

function sessionTurnKey(sessionId: string, turnId: string): string {
  return `${sessionId}\u0000${turnId}`;
}

export function sortAppServerAgentSessionNotifications(
  notifications: AppServerJsonRpcNotification[],
): AppServerJsonRpcNotification[] {
  if (notifications.length <= 1) {
    return notifications;
  }

  return notifications
    .map((notification, index) => ({
      notification,
      event: readAppServerAgentEvent(notification.params),
      index,
    }))
    .sort((left, right) => {
      const leftEvent = left.event;
      const rightEvent = right.event;
      if (!leftEvent || !rightEvent) {
        return left.index - right.index;
      }
      if (leftEvent.sessionId !== rightEvent.sessionId) {
        return left.index - right.index;
      }
      if ((leftEvent.turnId ?? "") !== (rightEvent.turnId ?? "")) {
        return left.index - right.index;
      }
      if (leftEvent.sequence !== rightEvent.sequence) {
        return leftEvent.sequence - rightEvent.sequence;
      }
      return left.index - right.index;
    })
    .map(({ notification }) => notification);
}

export function publishAppServerAgentSessionNotifications(
  eventName: string | undefined,
  notifications: AppServerJsonRpcNotification[] | undefined,
): void {
  if (!eventName || !notifications?.length) {
    return;
  }

  for (const notification of sortAppServerAgentSessionNotifications(
    notifications,
  )) {
    publishAppServerAgentSessionNotificationsFromPipeline(eventName, [
      notification,
    ]);
  }
}

export function publishAppServerAgentSessionNotificationsFromPipeline(
  eventName: string | undefined,
  notifications: AppServerJsonRpcNotification[] | undefined,
): boolean {
  if (!eventName || !notifications?.length) {
    return false;
  }
  let accepted = false;
  for (const notification of notifications) {
    const processedNotifications = projectAgentRuntimeSequenceGateNotifications(
      eventName,
      notification,
    );
    for (const processedNotification of processedNotifications) {
      const payload = projectAppServerAgentEventPayload(processedNotification);
      if (payload) {
        publishProcessedAgentRuntimeEvent(eventName, payload);
        accepted = true;
      }
    }
  }
  return accepted;
}
