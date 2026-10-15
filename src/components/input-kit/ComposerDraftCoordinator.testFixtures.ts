import { Buffer } from "node:buffer";
import { afterEach, beforeEach, vi } from "vitest";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { encodeComposerDraft } from "@/components/input-kit/composerDraftCodec";
import { createRuntimeAcceptanceReceipt } from "@/lib/api/agentRuntime/runtimeAcceptance";
import {
  fromRuntimeAcceptanceReceipt,
  fromQueueAcceptanceResponse,
} from "@/components/agent/chat/hooks/agentSendResult";
import type {
  DraftScope,
  PersistedAtomMutation,
} from "@/lib/api/persistedAtomTypes";
import { sendPersistedAtomState } from "@/lib/api/persistedAtoms";
import { PersistedAtomStore } from "../../../electron/persistedAtomStore";
import type { PersistedAtomFileIO } from "../../../electron/persistedAtomFile";
import { ComposerDraftCoordinator } from "./ComposerDraftCoordinator";

export const a: DraftScope = { workspaceId: "w", kind: "draft", id: "a" };
export const b: DraftScope = { workspaceId: "w", kind: "draft", id: "b" };
export const home: DraftScope = {
  workspaceId: null,
  kind: "home",
  id: "new-conversation",
};
export const local: DraftScope = { workspaceId: "w", kind: "local", id: "s1" };
export const accepted = () =>
  fromRuntimeAcceptanceReceipt(
    createRuntimeAcceptanceReceipt(
      { sessionId: "s1", threadId: "t1" },
      "start",
      "turn1",
    ),
  );
export const queueAccepted = () =>
  fromQueueAcceptanceResponse(
    { sessionId: "s1", threadId: "t1", clientUserMessageId: "u1" },
    {
      id: "q1",
      clientUserMessageId: "u1",
      input: [{ type: "text", text: "queued", text_elements: [] }],
    },
  );
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Test-only bridge, real gateway/parser/Store; no duplicated persistence oracle. */
export async function harness(
  bridge: {
    safeInvoke: typeof import("@/lib/dev-bridge").safeInvoke;
    safeListen: typeof import("@/lib/dev-bridge").safeListen;
  },
  options: {
    plainTextMode?: boolean;
    limits?: {
      maxEntries: number;
      maxBindings: number;
      maxDraftBytes: number;
      maxFileBytes: number;
    };
  } = {},
) {
  const files = new Map<string, Buffer>();
  let failWrite = false;
  const io: PersistedAtomFileIO = {
    readFile: async (file) => {
      const value = files.get(file);
      if (!value)
        throw Object.assign(new Error("test missing file"), { code: "ENOENT" });
      return value;
    },
    mkdir: async () => undefined,
    writeFile: async (file, data) => {
      if (failWrite)
        throw Object.assign(new Error("test storage failure"), { code: "EIO" });
      files.set(file, Buffer.from(data, "utf8"));
    },
    rename: async (source, target) => {
      files.set(target, files.get(source)!);
      files.delete(source);
    },
    removeTemporary: async (file) => {
      files.delete(file);
    },
  };
  const store = new PersistedAtomStore("/test-only/coordinator", {
    io,
    platform: "darwin",
    limits: options.limits,
  });
  await store.ready;
  const controller = new ComposerController(
    {},
    { plainTextMode: options.plainTextMode ?? false },
  );
  const coordinator = new ComposerDraftCoordinator(controller, {
    plainTextMode: options.plainTextMode ?? false,
  });
  const mutations: PersistedAtomMutation[] = [];
  const reads: DraftScope[] = [];
  let intercept:
    | ((
        command: string,
        args: Record<string, unknown>,
        execute: () => unknown,
      ) => unknown)
    | null = null;
  vi.mocked(bridge.safeInvoke).mockImplementation(async (command, args) => {
    const data = args ?? {};
    const execute = () => {
      if (command === "persisted_atom_read")
        return store.sendPersistedAtomState(data.query);
      if (command === "persisted_atom_update")
        return store.updatePersistedAtomState(data.mutation);
      throw new Error("Unexpected test-only command");
    };
    if (command === "persisted_atom_read")
      reads.push((data.query as { scope: DraftScope }).scope);
    if (command === "persisted_atom_update")
      mutations.push(structuredClone(data.mutation as PersistedAtomMutation));
    return (
      intercept ? await intercept(command, data, execute) : execute()
    ) as never;
  });
  vi.mocked(bridge.safeListen).mockImplementation(async (_event, handler) =>
    store.subscribe((metadata) => {
      handler({
        event: "persisted-atom-update",
        id: 1,
        payload: { ...metadata, event: "persisted-atom-update" },
      } as never);
    }),
  );
  return {
    store,
    controller,
    coordinator,
    mutations,
    reads,
    files,
    intercept(value: typeof intercept) {
      intercept = value;
    },
    failWrite(value: boolean) {
      failWrite = value;
    },
    async read(scope: DraftScope) {
      const result = await sendPersistedAtomState({
        key: "composer-drafts-v1",
        query: { kind: "scope", scope },
      });
      if (result.outcome !== "ready" || result.data.queryKind !== "scope")
        throw new Error("Test scope is not ready");
      return result.data.view.entry;
    },
    seed(
      scope: DraftScope,
      text: string,
      plainTextMode = options.plainTextMode ?? false,
    ) {
      const source = new ComposerController({ text }, { plainTextMode });
      const draftId = `seed-${scope.kind}-${scope.id}`,
        nextVersion = `seed-version-${text}`;
      return store.updatePersistedAtomState({
        op: "put",
        scope,
        draftId,
        nextVersion,
        expectedVersion: null,
        draft: encodeComposerDraft(source.captureDraft(), plainTextMode),
      });
    },
    async close() {
      coordinator.detach();
      await coordinator.idle();
      store.dispose();
      await store.flush();
    },
  };
}

export function installCoordinatorHarness(
  bridge: Parameters<typeof harness>[0],
) {
  let active: Awaited<ReturnType<typeof harness>> | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });
  afterEach(async () => {
    await active?.close();
    active = undefined;
    vi.useRealTimers();
  });
  return async (options: Parameters<typeof harness>[1] = {}) => {
    active = await harness(bridge, options);
    return active;
  };
}
