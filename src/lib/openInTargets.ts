import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { openIn } from "./api/openIn";
import type {
  OpenInParams,
  OpenInRequest,
  OpenInTarget,
  OpenInTargets,
} from "./api/openInTypes";

/** Disposable target projection shared by every file surface, including prefetch. */
export const openInQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function queryParams(params: OpenInParams): OpenInParams {
  return {
    cwd: params.cwd ?? null,
    hostId: params.hostId ?? null,
    path: params.path ?? null,
    deferEnrichment: params.deferEnrichment ?? true,
  };
}

export function openInTargetsQueryOptions(input: OpenInParams) {
  const params = queryParams(input);
  const queryKey = ["open-in-targets", JSON.stringify(params)] as const;
  return queryOptions({
    queryKey,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<OpenInTargets> => {
      let snapshot = await openIn.getTargets(params);
      signal.throwIfAborted();
      if (!params.deferEnrichment) return snapshot;
      const publish = (target: OpenInTarget) => {
        signal.throwIfAborted();
        const targets = snapshot.targets.map((entry) =>
          entry.id === target.id ? target : entry,
        );
        snapshot = {
          ...snapshot,
          targets,
          availableTargets: targets
            .filter((entry) => entry.available)
            .map((entry) => entry.id),
        };
        openInQueryClient.setQueryData(queryKey, snapshot);
      };
      await Promise.all(
        snapshot.targets.map(async (target) => {
          const targetParams = {
            ...params,
            target: target.target,
            appPath: target.appPath,
          };
          let detected: OpenInTarget | null;
          try {
            detected = await openIn.detectTarget(targetParams);
          } catch {
            detected = null;
          }
          signal.throwIfAborted();
          if (!detected?.available) {
            publish({ ...target, available: false, icon: null });
            return;
          }
          publish(detected);
          let icon: string | null;
          try {
            icon = await openIn.loadTargetIcon(targetParams);
          } catch {
            icon = null;
          }
          publish({ ...detected, icon });
        }),
      );
      signal.throwIfAborted();
      return snapshot;
    },
  });
}

export function prefetchOpenInTargets(params: OpenInParams): Promise<void> {
  if (!(params.cwd ?? params.path)) return Promise.resolve();
  return openInQueryClient.prefetchQuery(openInTargetsQueryOptions(params));
}

export function selectTargetApps(snapshot: OpenInTargets | undefined) {
  const available =
    snapshot?.targets.filter(
      (target) =>
        target.available && snapshot.availableTargets.includes(target.id),
    ) ?? [];
  const native = available.filter((target) => target.appPath != null);
  const visibleTargets = native.length
    ? native
    : available.filter((target) => target.kind === "builtin");
  const primaryTarget =
    visibleTargets.find((target) => target.id === snapshot?.preferredTarget) ??
    visibleTargets[0] ??
    null;
  return { primaryTarget, visibleTargets };
}

export function useTargetApps(params: OpenInParams, enabled = true) {
  const query = useQuery(
    {
      ...openInTargetsQueryOptions(params),
      enabled: enabled && !!(params.cwd ?? params.path),
    },
    openInQueryClient,
  );
  return { ...query, ...selectTargetApps(query.data) };
}

export async function openTarget(request: OpenInRequest): Promise<void> {
  const options = openInTargetsQueryOptions(request);
  const previous = openInQueryClient.getQueryData(options.queryKey);
  const optimistic = previous
    ? {
        ...previous,
        preferredTarget: request.appPath
          ? `app:${request.appPath}`
          : request.target,
      }
    : undefined;
  let optimisticSnapshot: OpenInTargets | undefined;
  if (request.persistPreferredTargetPath && previous) {
    optimisticSnapshot = openInQueryClient.setQueryData(
      options.queryKey,
      optimistic,
    );
  }
  try {
    await openIn.open(request);
  } catch (error) {
    if (
      request.persistPreferredTargetPath &&
      previous &&
      openInQueryClient.getQueryData(options.queryKey) === optimisticSnapshot
    )
      openInQueryClient.setQueryData(options.queryKey, previous);
    throw error;
  }
  if (request.persistPreferredTargetPath)
    await openInQueryClient.invalidateQueries({
      queryKey: ["open-in-targets"],
    });
}

export async function setGlobalPreferredTarget(
  params: Parameters<typeof openIn.setGlobalPreferredTarget>[0],
): Promise<void> {
  await openIn.setGlobalPreferredTarget(params);
  const targetId = params.appPath ? `app:${params.appPath}` : params.target;
  for (const query of openInQueryClient
    .getQueryCache()
    .findAll({ queryKey: ["open-in-targets"] })) {
    const serialized = query.queryKey[1];
    if (typeof serialized !== "string") continue;
    const identity = JSON.parse(serialized) as OpenInParams;
    if (identity.cwd != null) continue;
    openInQueryClient.setQueryData<OpenInTargets>(query.queryKey, (previous) =>
      previous ? { ...previous, preferredTarget: targetId } : previous,
    );
  }
  await openInQueryClient.invalidateQueries({ queryKey: ["open-in-targets"] });
}
