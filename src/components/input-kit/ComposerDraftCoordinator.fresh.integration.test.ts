import { describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import { decodeComposerDraft } from "./composerDraftCodec";
import {
  home,
  local,
  deferred,
  installCoordinatorHarness,
} from "./ComposerDraftCoordinator.testFixtures";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));
const setup = installCoordinatorHarness({ safeInvoke, safeListen });

describe("committed fresh draft through real Controller, Coordinator, parser and Store", () => {
  it("clears only after the existing identity CAS applies, then allocates a new edited identity", async () => {
    const h = await setup();
    h.seed(home, "retained rich draft");
    await h.coordinator.bindCommitted(home);
    const identity = h.coordinator.getSnapshot().identity;
    const gate = deferred<unknown>();
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op?: string })?.op === "clear"
        ? gate.promise.then(execute)
        : execute(),
    );
    const replace = h.coordinator.replaceCommittedDraft(home, () => true);
    await Promise.resolve();
    expect(h.controller.getDocument().text).toBe("retained rich draft");
    gate.resolve(null);
    expect(await replace).toBe("applied");
    expect(h.controller.getDocument().text).toBe("");
    expect(await h.read(home)).toBeNull();
    h.controller.setText("new logical draft");
    await h.coordinator.idle();
    const entry = await h.read(home);
    expect(entry?.draftId).not.toBe(identity?.draftId);
    expect(entry?.state).toBe("draft");
  });

  it("does not clear on transport failure", async () => {
    const h = await setup();
    h.seed(home, "kept");
    await h.coordinator.bindCommitted(home);
    const before = h.controller.captureDraft();
    h.intercept((command, args, execute) => {
      if (
        command === "persisted_atom_update" &&
        (args.mutation as { op?: string })?.op === "clear"
      )
        throw new Error("unavailable");
      return execute();
    });
    expect(await h.coordinator.replaceCommittedDraft(home, () => true)).toBe(
      "unavailable",
    );
    expect(h.controller.captureDraft()).toEqual(before);
    expect((await h.read(home))?.state).toBe("draft");
  });

  it("a real Store CAS conflict preserves rich local content and the newer remote version", async () => {
    const h = await setup();
    h.seed(home, "local rich kept");
    await h.coordinator.bindCommitted(home);
    h.controller.ingestPaste("折叠保留".repeat(300));
    await h.coordinator.idle();
    const before = h.controller.captureDraft();
    const entry = await h.read(home);
    if (entry?.state !== "draft") throw new Error("missing seeded draft");
    h.intercept((command, args, execute) => {
      if (
        command === "persisted_atom_update" &&
        (args.mutation as { op?: string }).op === "clear"
      )
        h.store.updatePersistedAtomState({
          op: "put",
          scope: home,
          draftId: entry.draftId,
          expectedVersion: entry.scopeVersion,
          nextVersion: "remote-concurrent-edit",
          draft: entry.draft,
        });
      return execute();
    });
    expect(await h.coordinator.replaceCommittedDraft(home, () => true)).toBe(
      "conflict",
    );
    expect(h.controller.captureDraft()).toEqual(before);
    expect((await h.read(home))?.scopeVersion).toBe("remote-concurrent-edit");
  });

  it("a queued fresh clear rechecks route ownership before it reaches the gateway", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(home);
    const gate = deferred<undefined>();
    let current = true;
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op?: string }).op === "put"
        ? gate.promise.then(execute)
        : execute(),
    );
    h.controller.setText("source survives withheld clear");
    const replace = h.coordinator.replaceCommittedDraft(home, () => current);
    await Promise.resolve();
    current = false;
    gate.resolve(undefined);
    expect(await replace).toBe("stale");
    expect(h.controller.getDocument().text).toBe(
      "source survives withheld clear",
    );
    expect(h.mutations.some((mutation) => mutation.op === "clear")).toBe(false);
    expect(await h.read(home)).toMatchObject({
      state: "draft",
      draft: { document: { text: "source survives withheld clear" } },
    });
  });

  it("preserves edits made while the old identity clear is in flight, including durable re-persistence", async () => {
    const h = await setup();
    h.seed(home, "old draft");
    await h.coordinator.bindCommitted(home);
    const gate = deferred<unknown>();
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op?: string })?.op === "clear"
        ? gate.promise.then(execute)
        : execute(),
    );
    const replace = h.coordinator.replaceCommittedDraft(home, () => true);
    await Promise.resolve();
    h.controller.setText("edit wins");
    gate.resolve(null);
    expect(await replace).toBe("stale");
    expect(h.controller.getDocument().text).toBe("edit wins");
    await h.coordinator.idle();
    const entry = await h.read(home);
    if (entry?.state !== "draft")
      throw new Error("latest edited draft must remain durable");
    expect(decodeComposerDraft(entry.draft).document.text).toBe("edit wins");
  });

  it("rejects noncommitted or mismatched scope without mutating the current document", async () => {
    const h = await setup();
    h.seed(local, "local retained");
    await h.coordinator.bindCommitted(local);
    expect(await h.coordinator.replaceCommittedDraft(home, () => true)).toBe(
      "stale",
    );
    expect(await h.coordinator.replaceCommittedDraft(local, () => false)).toBe(
      "stale",
    );
    expect(h.controller.getDocument().text).toBe("local retained");
    expect(h.mutations).toEqual([]);
  });

  it("late fresh completion never clears a newly navigated local target", async () => {
    const h = await setup();
    h.seed(home, "old home");
    h.seed(local, "local target");
    await h.coordinator.bindCommitted(home);
    const gate = deferred<unknown>();
    let current = true;
    h.intercept((command, args, execute) =>
      command === "persisted_atom_update" &&
      (args.mutation as { op?: string })?.op === "clear"
        ? gate.promise.then(execute)
        : execute(),
    );
    const replace = h.coordinator.replaceCommittedDraft(home, () => current);
    await Promise.resolve();
    current = false;
    await h.coordinator.bindCommitted(local);
    gate.resolve(null);
    expect(await replace).toBe("stale");
    expect(h.controller.getDocument().text).toBe("local target");
  });
});
