import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  cloneDraft,
  parseEnvelope,
  parseMutation,
  parseScope,
  scopeKey,
} from "./persistedAtomRecords";
import type { PersistedAtomEnvelope } from "../src/lib/api/persistedAtomTypes";

const limits = {
  maxDraftBytes: 2_048,
  maxFileBytes: 8_192,
  maxEntries: 10,
  maxBindings: 10,
};
const home = {
  workspaceId: null,
  kind: "home",
  id: "new-conversation",
} as const;
function envelope(): PersistedAtomEnvelope {
  return {
    format: "electron-persisted-atom-state",
    version: 1,
    storeRevision: 1,
    atoms: {
      "composer-drafts-v1": {
        bindings: { [scopeKey(home)]: "draft-1" },
        entries: {
          "draft-1": {
            state: "draft",
            draftId: "draft-1",
            scopeVersion: "v1",
            originScopeKey: scopeKey(home),
            updatedAt: 1,
            draft: {
              text: "中文😀",
              editorDocument: { type: "doc", content: [] },
            },
          },
        },
      },
    },
  };
}

describe("persisted atom JSON/identity boundary", () => {
  it("keeps structured namespaces distinct and preserves the local session id", () => {
    expect(
      parseScope({ workspaceId: "w", kind: "local", id: "session-1" }),
    ).toEqual({ workspaceId: "w", kind: "local", id: "session-1" });
    expect(
      scopeKey({ workspaceId: "a|b", kind: "draft", id: "c" }),
    ).not.toEqual(scopeKey({ workspaceId: "a", kind: "draft", id: "b|c" }));
    expect(scopeKey(home)).not.toEqual(
      scopeKey({ ...home, workspaceId: "null" }),
    );
  });

  it.each([
    { ...home, id: "other-home" },
    { ...home, kind: "remote" },
    { ...home, workspaceId: undefined },
    { ...home, extra: "ignored" },
    { ...home, id: "" },
    { ...home, id: "x\u0000y" },
  ])("rejects invalid scope rather than changing identity", (scope) => {
    expect(() => parseScope(scope)).toThrow("invalid_scope");
  });

  it("measures complete UTF8 JSON including escaped text and clones the input", () => {
    const value = { text: '中文😀\n"', nested: { selection: [0, 2] } };
    const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
    expect(cloneDraft(value, bytes)).toEqual(value);
    expect(() => cloneDraft(value, bytes - 1)).toThrow("capacity_exceeded");
    const copy = cloneDraft(value, bytes);
    value.nested.selection[0] = 4;
    expect(copy).not.toEqual(value);
  });

  it.each([
    undefined,
    BigInt(1),
    NaN,
    Infinity,
    () => "x",
    new Date(0),
    new Map(),
    Symbol("x"),
  ])("rejects values JSON would lose", (item) => {
    expect(() => cloneDraft({ item }, limits.maxDraftBytes)).toThrow(
      "invalid_payload",
    );
  });

  it("does not execute accessors or toJSON, or accept cyclic/sparse data", () => {
    let called = false;
    const accessor = Object.defineProperty({}, "text", {
      enumerable: true,
      get() {
        called = true;
        return "secret";
      },
    });
    expect(() => cloneDraft(accessor, limits.maxDraftBytes)).toThrow(
      "invalid_payload",
    );
    expect(called).toBe(false);
    expect(() =>
      cloneDraft({ toJSON: () => ({ lost: true }) }, limits.maxDraftBytes),
    ).toThrow("invalid_payload");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => cloneDraft(circular, limits.maxDraftBytes)).toThrow(
      "invalid_payload",
    );
    expect(() => cloneDraft({ list: Array(2) }, limits.maxDraftBytes)).toThrow(
      "invalid_payload",
    );
  });

  it("preserves ordinary special property names without prototype mutation", () => {
    const value = JSON.parse(
      '{"__proto__":{"text":"x"},"constructor":"field"}',
    );
    expect(cloneDraft(value, limits.maxDraftBytes)).toEqual(value);
    expect(Object.getPrototypeOf(cloneDraft(value, limits.maxDraftBytes))).toBe(
      Object.prototype,
    );
  });

  it("rejects unknown operation fields and unchanged version tokens", () => {
    const put = {
      op: "put",
      scope: home,
      draftId: "d",
      expectedVersion: null,
      nextVersion: "v1",
      draft: {},
    };
    expect(parseMutation(put, limits)).toEqual(put);
    expect(() =>
      parseMutation({ ...put, arbitraryPath: "/tmp/x" }, limits),
    ).toThrow("invalid_request");
    expect(() =>
      parseMutation({ ...put, expectedVersion: "v1" }, limits),
    ).toThrow("version_conflict");
    expect(() => parseMutation({ op: "replace", atom: {} }, limits)).toThrow(
      "invalid_request",
    );
  });

  it("loads a valid rich document and a payload-free tombstone", () => {
    expect(parseEnvelope(envelope(), limits)).toEqual(envelope());
    const data = envelope(),
      atom = data.atoms["composer-drafts-v1"];
    const consumed = {
      draftId: "old",
      scopeVersion: "v-old",
      originScopeKey: scopeKey(home),
      state: "consumed",
      consumption: "accepted",
      updatedAt: 2,
      consumedAt: 2,
    };
    expect(
      parseEnvelope(
        {
          ...data,
          atoms: {
            "composer-drafts-v1": {
              ...atom,
              entries: { ...atom.entries, old: consumed },
            },
          },
        },
        limits,
      ).atoms["composer-drafts-v1"].entries.old,
    ).toEqual(consumed);
    expect(() =>
      parseEnvelope(
        {
          ...data,
          atoms: {
            "composer-drafts-v1": {
              ...atom,
              entries: {
                ...atom.entries,
                old: { ...consumed, draft: { text: "sent" } },
              },
            },
          },
        },
        limits,
      ),
    ).toThrow();
  });

  it.each([
    (data: PersistedAtomEnvelope) => ({ ...data, version: 2 }),
    (data: PersistedAtomEnvelope) => ({
      ...data,
      atoms: { ...data.atoms, other: {} },
    }),
    (data: PersistedAtomEnvelope) => ({ ...data, storeRevision: -1 }),
    (data: PersistedAtomEnvelope) => ({
      ...data,
      atoms: {
        "composer-drafts-v1": {
          ...data.atoms["composer-drafts-v1"],
          bindings: { [scopeKey(home)]: "absent" },
        },
      },
    }),
    (data: PersistedAtomEnvelope) => ({
      ...data,
      atoms: {
        "composer-drafts-v1": {
          ...data.atoms["composer-drafts-v1"],
          bindings: {},
        },
      },
    }),
    (data: PersistedAtomEnvelope) => ({
      ...data,
      atoms: {
        "composer-drafts-v1": {
          ...data.atoms["composer-drafts-v1"],
          bindings: {
            [scopeKey(home)]: "draft-1",
            [scopeKey({ workspaceId: "w", kind: "draft", id: "tab" })]:
              "draft-1",
          },
        },
      },
    }),
  ])("fails closed for inconsistent/future durable envelopes", (change) => {
    expect(() => parseEnvelope(change(envelope()), limits)).toThrow();
  });

  it("rejects a local binding whose session metadata is a canonical thread id", () => {
    const data = envelope();
    expect(() =>
      parseEnvelope(
        {
          ...data,
          atoms: {
            "composer-drafts-v1": {
              ...data.atoms["composer-drafts-v1"],
              bindings: {
                [scopeKey({
                  workspaceId: "w",
                  kind: "local",
                  id: "session-1",
                })]: "draft-1",
              },
            },
          },
        },
        limits,
      ),
    ).toThrow();
  });
});
