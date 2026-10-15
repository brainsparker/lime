import {
  PERSISTED_ATOM_LIMITS,
  parsePersistedAtomReadQuery,
  type PersistedAtomLimits,
} from "../src/lib/api/persistedAtomProtocol";
import { Buffer } from "node:buffer";
import type {
  DraftIdentity,
  PersistedAtomEnvelope,
  PersistedAtomMetadata,
  PersistedAtomMutation,
  PersistedAtomPersistence,
  PersistedAtomReadResult,
  PersistedAtomReadQuery,
  PersistedAtomReason,
  PersistedAtomUpdateResult,
  PersistedDraftEntry,
} from "../src/lib/api/persistedAtomTypes";
import {
  PersistedAtomFile,
  PersistedAtomFileError,
  type PersistedAtomFileOptions,
} from "./persistedAtomFile";
import {
  AtomValidationError,
  COMPOSER_ATOM_KEY,
  parseMutation,
  projectWorkspaceDraftIndex,
  scopeKey,
} from "./persistedAtomRecords";

interface PersistedAtomStoreOptions extends PersistedAtomFileOptions {
  readonly limits?: PersistedAtomLimits;
  readonly now?: () => number;
}

type MutationPlan = {
  entry: PersistedDraftEntry;
  detach: readonly string[];
  bind?: string;
};

function identityMatches(
  entry: PersistedDraftEntry | undefined,
  identity: DraftIdentity,
): boolean {
  return (
    entry?.draftId === identity.draftId &&
    entry.scopeVersion === identity.scopeVersion
  );
}

function detached<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class PersistedAtomStore {
  readonly ready: Promise<void>;
  readonly #file: PersistedAtomFile;
  readonly #limits: PersistedAtomLimits;
  readonly #now: () => number;
  readonly #entries = new Map<string, PersistedDraftEntry>();
  readonly #bindings = new Map<string, string>();
  readonly #listeners = new Set<(metadata: PersistedAtomMetadata) => void>();
  #storeRevision = 0;
  #persistence: PersistedAtomPersistence = {
    state: "loading",
    savedRevision: null,
  };
  #available = false;
  #closed = false;
  #repairPending = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #diskQueue: Promise<void> = Promise.resolve();

  constructor(appDataRoot: string, options: PersistedAtomStoreOptions = {}) {
    this.#limits = Object.freeze({
      ...(options.limits ?? PERSISTED_ATOM_LIMITS),
    });
    if (
      Object.values(this.#limits).some(
        (limit) => !Number.isSafeInteger(limit) || limit <= 0,
      )
    )
      throw new Error("invalid persisted atom budget");
    this.#now = options.now ?? Date.now;
    this.#file = new PersistedAtomFile(appDataRoot, this.#limits, options);
    this.ready = this.#load();
  }

  metadata(): PersistedAtomMetadata {
    return {
      key: COMPOSER_ATOM_KEY,
      storeRevision: this.#storeRevision,
      persistence: detached(this.#persistence),
    };
  }

  subscribe(listener: (metadata: PersistedAtomMetadata) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  sendPersistedAtomState(query: unknown): PersistedAtomReadResult {
    let parsed: PersistedAtomReadQuery;
    try {
      parsed = parsePersistedAtomReadQuery(query);
    } catch {
      return {
        ...this.metadata(),
        outcome: "invalid",
        reason: "invalid_request",
        data: null,
      };
    }
    if (!this.#available || this.#closed)
      return {
        ...this.metadata(),
        outcome: "unavailable",
        ...(this.#closed ? { reason: "closed" as const } : {}),
        data: null,
      };
    if (parsed.kind === "workspace-index")
      return {
        ...this.metadata(),
        outcome: "ready",
        data: {
          queryKind: parsed.kind,
          workspaceId: parsed.workspaceId,
          items: projectWorkspaceDraftIndex(
            this.#bindings,
            this.#entries,
            parsed.workspaceId,
          ),
        },
      };
    const id = this.#bindings.get(scopeKey(parsed.scope));
    return {
      ...this.metadata(),
      outcome: "ready",
      data: {
        queryKind: parsed.kind,
        view: {
          scope: parsed.scope,
          entry: id ? detached(this.#entries.get(id) ?? null) : null,
        },
      },
    };
  }

  /** All CAS checks and Map commits are synchronous; disk IO is separate. */
  updatePersistedAtomState(value: unknown): PersistedAtomUpdateResult {
    if (!this.#available || this.#closed)
      return this.#result(
        "unavailable",
        null,
        this.#closed ? "closed" : undefined,
      );
    let mutation: PersistedAtomMutation;
    try {
      mutation = parseMutation(value, this.#limits);
    } catch (error) {
      return this.#result(
        "invalid",
        null,
        error instanceof AtomValidationError ? error.reason : "invalid_request",
      );
    }
    const id =
      mutation.op === "put" ? mutation.draftId : mutation.identity.draftId;
    const current = this.#entries.get(id);
    const plan =
      mutation.op === "put"
        ? this.#put(mutation, current)
        : mutation.op === "promote"
          ? this.#promote(mutation, current)
          : this.#consume(mutation, current);
    if ("outcome" in plan) return plan;
    if (!this.#fits(plan))
      return this.#result("invalid", current ?? null, "capacity_exceeded");
    if (this.#storeRevision === Number.MAX_SAFE_INTEGER)
      return this.#result("invalid", current ?? null, "capacity_exceeded");
    for (const key of plan.detach) this.#bindings.delete(key);
    if (plan.bind) this.#bindings.set(plan.bind, plan.entry.draftId);
    this.#entries.set(plan.entry.draftId, plan.entry);
    this.#storeRevision += 1;
    this.#persistence = {
      state: "pending",
      savedRevision: this.#persistence.savedRevision,
    };
    this.#broadcastPersistedAtomUpdate();
    this.#schedule();
    return this.#result("applied", plan.entry, undefined, true);
  }

  flush(): Promise<void> {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    if (!this.#available) return this.#diskQueue;
    const snapshot = this.#snapshot();
    this.#diskQueue = this.#diskQueue.then(async () => {
      if (
        !this.#repairPending &&
        this.#persistence.savedRevision !== null &&
        this.#persistence.savedRevision >= snapshot.storeRevision
      )
        return;
      try {
        await this.#file.save(snapshot);
        this.#repairPending = false;
        this.#persistence = {
          state:
            snapshot.storeRevision === this.#storeRevision
              ? "saved"
              : "pending",
          savedRevision: snapshot.storeRevision,
        };
      } catch (error) {
        this.#persistence = {
          state: "error",
          savedRevision: this.#persistence.savedRevision,
          diagnostic:
            error instanceof PersistedAtomFileError
              ? error.diagnostic
              : { phase: "serialize", code: "INVALID_JSON" },
        };
      }
      this.#broadcastPersistedAtomUpdate();
    });
    return this.#diskQueue;
  }

  /** Best effort only. No Quit handshake or sender waits on this operation. */
  dispose(): void {
    this.#closed = true;
    this.#listeners.clear();
    void this.flush();
  }

  #put(
    mutation: Extract<PersistedAtomMutation, { op: "put" }>,
    current: PersistedDraftEntry | undefined,
  ): MutationPlan | PersistedAtomUpdateResult {
    const key = scopeKey(mutation.scope);
    const bound = this.#bindings.get(key);
    if (current?.state === "consumed")
      return this.#result("conflict", current, "retired_draft");
    if (mutation.expectedVersion === null) {
      if (current || bound)
        return this.#result("conflict", current ?? null, "identity_mismatch");
    } else {
      if (!current || bound !== mutation.draftId)
        return this.#result("conflict", current ?? null, "identity_mismatch");
      if (current.scopeVersion !== mutation.expectedVersion)
        return this.#result("conflict", current, "version_conflict");
    }
    return {
      entry: {
        draftId: mutation.draftId,
        scopeVersion: mutation.nextVersion,
        originScopeKey: current?.originScopeKey ?? key,
        updatedAt: this.#now(),
        ...(current?.sessionId
          ? { sessionId: current.sessionId }
          : mutation.scope.kind === "local"
            ? { sessionId: mutation.scope.id }
            : {}),
        ...(current?.threadId ? { threadId: current.threadId } : {}),
        state: "draft",
        draft: mutation.draft,
      },
      detach: [],
      bind: key,
    };
  }

  #promote(
    mutation: Extract<PersistedAtomMutation, { op: "promote" }>,
    current: PersistedDraftEntry | undefined,
  ): MutationPlan | PersistedAtomUpdateResult {
    if (
      !identityMatches(current, mutation.identity) ||
      current?.state !== "draft"
    )
      return this.#result("conflict", current ?? null, "version_conflict");
    const source = scopeKey(mutation.source),
      target = scopeKey(mutation.target);
    const sourceId = this.#bindings.get(source),
      targetId = this.#bindings.get(target);
    const targetEntry = targetId ? this.#entries.get(targetId) : undefined;
    if (targetId && targetId !== current.draftId)
      return this.#result("conflict", current, "target_conflict");
    if (
      mutation.expectedTarget &&
      !identityMatches(targetEntry, mutation.expectedTarget)
    )
      return this.#result("conflict", current, "target_conflict");
    if (sourceId !== current.draftId && targetId !== current.draftId) {
      return this.#result("conflict", current, "identity_mismatch");
    }
    const sessionId =
      mutation.sessionId ??
      (mutation.target.kind === "local"
        ? mutation.target.id
        : current.sessionId);
    if (
      (mutation.target.kind === "local" && sessionId !== mutation.target.id) ||
      (current.sessionId && sessionId !== current.sessionId) ||
      (current.threadId &&
        mutation.threadId &&
        current.threadId !== mutation.threadId)
    )
      return this.#result("conflict", current, "identity_mismatch");
    const threadId = mutation.threadId ?? current.threadId;
    if (
      targetId === current.draftId &&
      current.sessionId === sessionId &&
      current.threadId === threadId
    )
      return this.#result("applied", current);
    return {
      entry: {
        ...current,
        ...(sessionId ? { sessionId } : {}),
        ...(threadId ? { threadId } : {}),
        updatedAt: this.#now(),
      },
      detach: source === target || sourceId !== current.draftId ? [] : [source],
      bind: target,
    };
  }

  #consume(
    mutation: Extract<PersistedAtomMutation, { op: "consume" | "clear" }>,
    current: PersistedDraftEntry | undefined,
  ): MutationPlan | PersistedAtomUpdateResult {
    if (!identityMatches(current, mutation.identity))
      return this.#result("conflict", current ?? null, "version_conflict");
    if (current?.state === "consumed") return this.#result("applied", current);
    if (!current) return this.#result("conflict", null, "identity_mismatch");
    const { draft: _draft, ...metadata } = current;
    return {
      entry: {
        ...metadata,
        state: "consumed",
        consumption: mutation.op === "consume" ? "accepted" : "clear",
        consumedAt: this.#now(),
        updatedAt: this.#now(),
      },
      detach: [...this.#bindings]
        .filter(([, id]) => id === current.draftId)
        .map(([key]) => key),
    };
  }

  #fits(plan: MutationPlan): boolean {
    const snapshot = this.#snapshot();
    const atom = snapshot.atoms[COMPOSER_ATOM_KEY];
    const bindings = { ...atom.bindings },
      entries = { ...atom.entries, [plan.entry.draftId]: plan.entry };
    for (const key of plan.detach) delete bindings[key];
    if (plan.bind) bindings[plan.bind] = plan.entry.draftId;
    if (
      Object.keys(entries).length > this.#limits.maxEntries ||
      Object.keys(bindings).length > this.#limits.maxBindings
    )
      return false;
    try {
      const reservedEntries = Object.fromEntries(
        Object.entries(entries).map(([id, entry]) => {
          if (entry.state === "consumed") return [id, entry];
          const { draft: _draft, ...metadata } = entry;
          const tombstone: PersistedDraftEntry = {
            ...metadata,
            state: "consumed",
            consumption: "accepted",
            updatedAt: Number.MAX_SAFE_INTEGER,
            consumedAt: Number.MAX_SAFE_INTEGER,
          };
          return [
            id,
            Buffer.byteLength(JSON.stringify(tombstone), "utf8") >
            Buffer.byteLength(JSON.stringify(entry), "utf8")
              ? tombstone
              : entry,
          ];
        }),
      );
      return (
        Buffer.byteLength(
          JSON.stringify({
            ...snapshot,
            storeRevision: Number.MAX_SAFE_INTEGER,
            atoms: {
              [COMPOSER_ATOM_KEY]: { bindings, entries: reservedEntries },
            },
          }),
          "utf8",
        ) <= this.#limits.maxFileBytes
      );
    } catch {
      return false;
    }
  }

  #result(
    outcome: PersistedAtomUpdateResult["outcome"],
    entry: PersistedDraftEntry | null,
    reason?: PersistedAtomReason,
    changed = false,
  ): PersistedAtomUpdateResult {
    return {
      ...this.metadata(),
      outcome,
      changed,
      ...(reason ? { reason } : {}),
      entry: entry ? detached(entry) : null,
    };
  }

  #snapshot(): PersistedAtomEnvelope {
    return {
      format: "electron-persisted-atom-state",
      version: 1,
      storeRevision: this.#storeRevision,
      atoms: {
        [COMPOSER_ATOM_KEY]: {
          bindings: Object.fromEntries(this.#bindings),
          entries: Object.fromEntries(this.#entries),
        },
      },
    };
  }

  async #load(): Promise<void> {
    try {
      const { envelope, recovered } = await this.#file.load();
      if (envelope) {
        const atom = envelope.atoms[COMPOSER_ATOM_KEY];
        for (const [id, entry] of Object.entries(atom.entries))
          this.#entries.set(id, entry);
        for (const [key, id] of Object.entries(atom.bindings))
          this.#bindings.set(key, id);
        this.#storeRevision = envelope.storeRevision;
      }
      this.#available = true;
      this.#repairPending = recovered;
      this.#persistence = {
        state: recovered ? "pending" : "saved",
        savedRevision: this.#storeRevision,
      };
      if (recovered && !this.#closed) this.#schedule();
    } catch (error) {
      this.#persistence = {
        state: "unavailable",
        savedRevision: null,
        diagnostic:
          error instanceof PersistedAtomFileError
            ? error.diagnostic
            : { phase: "load", code: "INVALID_STATE" },
      };
    }
    this.#broadcastPersistedAtomUpdate();
  }

  #schedule(): void {
    if (this.#closed) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.flush();
    }, 500);
    this.#timer.unref?.();
  }

  #broadcastPersistedAtomUpdate(): void {
    for (const listener of this.#listeners) {
      try {
        listener(this.metadata());
      } catch {
        /* Notification failure cannot roll back a committed atom. */
      }
    }
  }
}
