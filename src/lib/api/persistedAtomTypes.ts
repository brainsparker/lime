export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const SUMMARY_PANEL_PIN_ATOM_KEY = "app-shell-summary-panel-pinned";
export const FILE_TREE_OPEN_ATOM_KEY = "app-shell-file-tree-open";
export const PERSISTED_BOOLEAN_DEFAULTS = {
  [SUMMARY_PANEL_PIN_ATOM_KEY]: true,
  [FILE_TREE_OPEN_ATOM_KEY]: false,
} as const;
export type PersistedBooleanAtomKey = keyof typeof PERSISTED_BOOLEAN_DEFAULTS;
export const PERSISTED_BOOLEAN_ATOM_KEYS = Object.keys(
  PERSISTED_BOOLEAN_DEFAULTS,
) as PersistedBooleanAtomKey[];

export function isPersistedBooleanAtomKey(
  value: unknown,
): value is PersistedBooleanAtomKey {
  return (
    typeof value === "string" &&
    Object.hasOwn(PERSISTED_BOOLEAN_DEFAULTS, value)
  );
}

export type PersistedAtomKey = "composer-drafts-v1" | PersistedBooleanAtomKey;

export interface DraftScope {
  readonly workspaceId: string | null;
  readonly kind: "home" | "draft" | "local";
  readonly id: string;
}

export interface DraftIdentity {
  readonly draftId: string;
  readonly scopeVersion: string;
}

interface DraftEntryMetadata extends DraftIdentity {
  readonly originScopeKey: string;
  readonly updatedAt: number;
  readonly sessionId?: string;
  readonly threadId?: string;
}

export type PersistedDraftEntry =
  | (DraftEntryMetadata & {
      readonly state: "draft";
      readonly draft: JsonObject;
    })
  | (DraftEntryMetadata & {
      readonly state: "consumed";
      readonly consumption: "accepted" | "clear";
      readonly consumedAt: number;
    });

export type PersistedAtomMutation =
  | {
      readonly op: "put";
      readonly scope: DraftScope;
      readonly draftId: string;
      readonly expectedVersion: string | null;
      readonly nextVersion: string;
      readonly draft: JsonObject;
    }
  | {
      readonly op: "promote";
      readonly source: DraftScope;
      readonly target: DraftScope;
      readonly identity: DraftIdentity;
      readonly expectedTarget: DraftIdentity | null;
      readonly sessionId?: string;
      readonly threadId?: string;
    }
  | {
      readonly op: "consume" | "clear";
      readonly identity: DraftIdentity;
    };

export type PersistedAtomReadQuery =
  | { readonly kind: "scope"; readonly scope: DraftScope }
  | {
      readonly kind: "workspace-index";
      readonly workspaceId: string | null;
    };

export type PersistedAtomReadRequest =
  | {
      readonly key: "composer-drafts-v1";
      readonly query: PersistedAtomReadQuery;
    }
  | {
      readonly key: PersistedBooleanAtomKey;
      readonly query: { readonly kind: "value" };
    };

export type PersistedAtomUpdateRequest =
  | {
      readonly key: "composer-drafts-v1";
      readonly mutation: PersistedAtomMutation;
    }
  | {
      readonly key: PersistedBooleanAtomKey;
      readonly mutation: { readonly op: "set"; readonly value: boolean };
    };

export interface PersistedAtomDiagnostic {
  readonly phase: "load" | "serialize" | "primary" | "backup";
  readonly code: string;
}

export interface PersistedAtomPersistence {
  readonly state: "loading" | "saved" | "pending" | "error" | "unavailable";
  readonly savedRevision: number | null;
  readonly diagnostic?: PersistedAtomDiagnostic;
}

export interface PersistedAtomMetadata {
  readonly key: PersistedAtomKey;
  readonly storeRevision: number;
  readonly persistence: PersistedAtomPersistence;
}

export interface PersistedDraftView {
  readonly scope: DraftScope;
  readonly entry: PersistedDraftEntry | null;
}

export type PersistedAtomReason =
  | "invalid_request"
  | "invalid_scope"
  | "invalid_payload"
  | "capacity_exceeded"
  | "identity_mismatch"
  | "version_conflict"
  | "target_conflict"
  | "retired_draft"
  | "closed";

export interface PersistedDraftIndexItem {
  readonly scope: DraftScope;
  readonly identity: DraftIdentity;
  readonly updatedAt: number;
  readonly sessionId?: string;
  readonly threadId?: string;
}

export type PersistedAtomReadData =
  | { readonly queryKind: "value"; readonly value: boolean }
  | { readonly queryKind: "scope"; readonly view: PersistedDraftView }
  | {
      readonly queryKind: "workspace-index";
      readonly workspaceId: string | null;
      readonly items: readonly PersistedDraftIndexItem[];
    };

export type PersistedAtomReadResult = PersistedAtomMetadata &
  (
    | { readonly outcome: "ready"; readonly data: PersistedAtomReadData }
    | {
        readonly outcome: "invalid" | "unavailable";
        readonly reason?: PersistedAtomReason;
        readonly data: null;
      }
  );

export interface PersistedAtomUpdateResult extends PersistedAtomMetadata {
  readonly outcome: "applied" | "conflict" | "invalid" | "unavailable";
  readonly changed: boolean;
  readonly reason?: PersistedAtomReason;
  readonly entry: PersistedDraftEntry | null;
  readonly value?: boolean;
}

/** Notifications contain metadata only; drafts never enter diagnostics. */
export interface PersistedAtomUpdateEvent extends PersistedAtomMetadata {
  readonly event: "persisted-atom-update";
}

export interface PersistedAtomEnvelope {
  readonly format: "electron-persisted-atom-state";
  readonly version: 1;
  readonly storeRevision: number;
  readonly atoms: Partial<
    Readonly<Record<PersistedBooleanAtomKey, boolean>>
  > & {
    readonly "composer-drafts-v1": {
      readonly bindings: Readonly<Record<string, string>>;
      readonly entries: Readonly<Record<string, PersistedDraftEntry>>;
    };
  };
}
