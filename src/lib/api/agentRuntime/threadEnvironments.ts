import type { AgentRuntimeThreadEnvironment } from "./sessionTypes";
import {
  isRecord,
  readOptionalBooleanField,
  readOptionalStringField,
  readStringArrayField,
  readStringField,
} from "./canonicalReadFields";

/**
 * Project the persisted Thread environment selection once at the canonical
 * read-model boundary. Components should not inspect business-object metadata
 * directly because that bypasses Thread identity and lifecycle ownership.
 */
export function readCanonicalThreadEnvironmentSelections(
  metadata?: Record<string, unknown>,
): AgentRuntimeThreadEnvironment[] {
  if (!metadata) {
    return [];
  }

  const persistedSelections = Array.isArray(metadata.environments)
    ? metadata.environments
    : [];
  const worldStateSelections = environmentWorldStateSelections(
    metadata.environmentWorldState,
  );
  const worldStateById = new Map<string, Record<string, unknown>>();
  for (const selection of worldStateSelections) {
    if (!isRecord(selection)) {
      continue;
    }
    const environmentId = readStringField(
      selection,
      "environmentId",
      "environment_id",
    ).trim();
    if (environmentId) {
      worldStateById.set(environmentId, selection);
    }
  }
  const rawSelections =
    persistedSelections.length > 0
      ? persistedSelections.map((selection) => {
          if (!isRecord(selection)) {
            return selection;
          }
          const environmentId = readStringField(
            selection,
            "environmentId",
            "environment_id",
          ).trim();
          const worldState = worldStateById.get(environmentId);
          return worldState ? { ...selection, ...worldState } : selection;
        })
      : worldStateSelections;
  const selections: AgentRuntimeThreadEnvironment[] = [];
  const seen = new Set<string>();
  for (const value of rawSelections) {
    if (!isRecord(value)) {
      continue;
    }
    const environmentId = readStringField(
      value,
      "environmentId",
      "environment_id",
    ).trim();
    if (!environmentId || seen.has(environmentId)) {
      continue;
    }
    const status = canonicalEnvironmentStatus(
      readOptionalStringField(value, "status"),
    );
    const cwd = readOptionalStringField(value, "cwd")?.trim();
    const roots = readStringArrayField(
      value,
      "runtimeWorkspaceRoots",
      "runtime_workspace_roots",
    );
    const shell = readOptionalStringField(value, "shell")?.trim();
    const error = readOptionalStringField(value, "error")?.trim();
    const primary = readOptionalBooleanField(value, "primary");
    selections.push({
      environment_id: environmentId,
      ...(cwd ? { cwd } : {}),
      ...(roots.length > 0 ? { runtime_workspace_roots: roots } : {}),
      ...(primary === undefined ? {} : { primary }),
      ...(status ? { status } : {}),
      ...(shell ? { shell } : {}),
      ...(error ? { error } : {}),
    });
    seen.add(environmentId);
  }
  return selections.sort((left, right) =>
    left.environment_id.localeCompare(right.environment_id),
  );
}

function environmentWorldStateSelections(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return [];
  }
  const environments = value.environments;
  if (Array.isArray(environments)) {
    return environments;
  }
  if (!isRecord(environments)) {
    return [];
  }
  return Object.entries(environments).map(([environmentId, selection]) =>
    isRecord(selection) ? { environmentId, ...selection } : { environmentId },
  );
}

function canonicalEnvironmentStatus(
  value: string | undefined,
): AgentRuntimeThreadEnvironment["status"] {
  switch (value?.trim().toLowerCase()) {
    case "ready":
    case "connected":
      return "connected";
    case "pending":
      return "pending";
    case "disconnected":
    case "unknown":
      return "disconnected";
    default:
      return undefined;
  }
}
