import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { vi } from "vitest";
import type {
  DraftScope,
  PersistedAtomMutation,
} from "../src/lib/api/persistedAtomTypes";
import { PersistedAtomStore } from "./persistedAtomStore";

const roots: string[] = [],
  stores: PersistedAtomStore[] = [];
export const limits = {
  maxDraftBytes: 2_048,
  maxFileBytes: 16_384,
  maxEntries: 20,
  maxBindings: 20,
};
export const home: DraftScope = {
  workspaceId: null,
  kind: "home",
  id: "new-conversation",
};
export const local: DraftScope = {
  workspaceId: "w",
  kind: "local",
  id: "session-1",
};
export const identity = { draftId: "d1", scopeVersion: "v1" };

export function put(
  scope: DraftScope = home,
  draftId = "d1",
  nextVersion = "v1",
  expectedVersion: string | null = null,
  text = "rich 中文😀",
): PersistedAtomMutation {
  return {
    op: "put",
    scope,
    draftId,
    nextVersion,
    expectedVersion,
    draft: {
      text,
      editorDocument: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text,
                marks: [
                  { type: "link", attrs: { href: "https://example.test" } },
                ],
              },
            ],
          },
        ],
      },
      selectionStart: 0,
      selectionEnd: text.length,
      attachments: [
        { data: "aW1hZ2U=", mediaType: "image/png", sourcePath: "fixture.png" },
      ],
      annotations: [{ id: "annotation-1" }],
      pendingPastes: [{ text: "folded", placeholder: "paste-1" }],
      inputCapabilityRoute: { route: "image" },
    },
  };
}
export function promotion(
  source: DraftScope = home,
  target: DraftScope = local,
): PersistedAtomMutation {
  return { op: "promote", source, target, identity, expectedTarget: null };
}
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
export function trackStore(store: PersistedAtomStore): void {
  stores.push(store);
}
export async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "atom-store-"));
  roots.push(root);
  return root;
}
export async function createStore(
  options: ConstructorParameters<typeof PersistedAtomStore>[1] = {},
) {
  const root = await createRoot(),
    store = new PersistedAtomStore(root, {
      limits,
      now: () => 1_000,
      ...options,
    });
  trackStore(store);
  await store.ready;
  return { root, store };
}
export function entry(store: PersistedAtomStore, scope: DraftScope = home) {
  const result = store.sendPersistedAtomState({ kind: "scope", scope });
  if (result.outcome !== "ready" || result.data.queryKind !== "scope")
    return null;
  return result.data.view.entry;
}
export async function cleanup(): Promise<void> {
  vi.useRealTimers();
  for (const store of stores.splice(0)) {
    store.dispose();
    await store.flush();
  }
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
}
