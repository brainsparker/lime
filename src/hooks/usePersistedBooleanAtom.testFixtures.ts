import type { Mock } from "vitest";
import {
  PERSISTED_BOOLEAN_DEFAULTS,
  type PersistedBooleanAtomKey,
  type PersistedAtomUpdateEvent,
} from "@/lib/api/persistedAtomTypes";

export function configureBooleanGateway(
  gateway: { read: Mock; update: Mock; listen: Mock },
  initial: Partial<Record<PersistedBooleanAtomKey, boolean>> = {},
) {
  const values: Record<PersistedBooleanAtomKey, boolean> = {
    ...PERSISTED_BOOLEAN_DEFAULTS,
    ...initial,
  };
  const listeners = new Set<(event: PersistedAtomUpdateEvent) => void>();
  let revision = 0;
  const metadata = (key: PersistedBooleanAtomKey) => ({
    key,
    storeRevision: revision,
    persistence: { state: "saved" as const, savedRevision: revision },
  });
  const read = (key: PersistedBooleanAtomKey) => ({
    ...metadata(key),
    outcome: "ready" as const,
    data: { queryKind: "value" as const, value: values[key] },
  });
  const notify = (key: PersistedBooleanAtomKey) => {
    for (const listener of listeners)
      listener({ ...metadata(key), event: "persisted-atom-update" });
  };
  gateway.read.mockImplementation(async ({ key }) => read(key));
  gateway.update.mockImplementation(async ({ key, mutation }) => {
    values[key as PersistedBooleanAtomKey] = mutation.value;
    revision += 1;
    notify(key);
    return {
      ...metadata(key),
      outcome: "applied",
      changed: true,
      entry: null,
      value: mutation.value,
    };
  });
  gateway.listen.mockImplementation(async (handler) => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  });
  return {
    read,
    notify,
    set: (
      key: PersistedBooleanAtomKey,
      value: boolean,
      nextRevision: number,
    ) => {
      values[key] = value;
      revision = nextRevision;
      notify(key);
    },
  };
}
