import { describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { decodeComposerDraft } from "@/components/input-kit/composerDraftCodec";
import { ComposerDraftCoordinator } from "./ComposerDraftCoordinator";
import {
  a,
  b,
  home,
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

describe("Composer binding through explicit test-only bridge and real owners", () => {
  it("keeps a queued discard retired while its preceding put notification reads the old entry", async () => {
    const h = await setup();
    h.seed(home, "old home draft");
    await h.coordinator.bindCommitted(home);
    await h.coordinator.connect();
    h.controller.setText("scope probe before rich replacement");
    const old = h.coordinator.captureBinding()!;
    const gate = deferred<unknown>();
    const entered = deferred<undefined>();
    h.intercept((command, args, execute) => {
      if (
        command === "persisted_atom_update" &&
        (args.mutation as { op?: string }).op === "clear"
      ) {
        entered.resolve(undefined);
        return gate.promise.then(execute);
      }
      return execute();
    });
    const clearing = h.coordinator.clear();
    await entered.promise;
    await vi.advanceTimersByTimeAsync(0);
    const afterDiscard = h.controller.captureDraft();
    h.controller.ingestHTML(
      '<p>new rich 中😀</p><pre><code class="language-typescript">const next = 1;</code></pre>',
    );
    const replacement = h.controller.captureDraft();
    gate.resolve(null);
    expect(await clearing).toBe(true);
    await h.coordinator.idle();
    expect(afterDiscard.text).toBe("");
    const saved = await h.read(home);
    expect(saved?.state).toBe("draft");
    expect(saved?.draftId).not.toBe(old.identity.draftId);
    if (saved?.state !== "draft")
      throw new Error("new rich draft was not saved");
    expect(decodeComposerDraft(saved.draft).document).toEqual(replacement);
    expect(h.coordinator.getSnapshot().mutation).toBe("applied");
  });

  it("coalesces user edits for 250ms and preserves selection/resources in the codec", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(a);
    h.controller.setText("first");
    h.controller.setText("中文😀 final", { start: 2, end: 4 });
    h.controller.setAttachments([
      { data: "YQ==", mediaType: "image/png", previewUrl: "blob:old" },
    ]);
    await vi.advanceTimersByTimeAsync(249);
    expect(h.mutations).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await h.coordinator.idle();
    expect(h.mutations).toHaveLength(1);
    const entry = await h.read(a);
    expect(entry?.state).toBe("draft");
    if (entry?.state !== "draft") throw new Error("missing test draft");
    const decoded = decodeComposerDraft(entry.draft);
    expect(decoded.document.text).toBe("中文😀 final");
    expect(decoded.document.selectionStart).toBe(2);
    expect(decoded.document.selectionEnd).toBe(4);
    expect(decoded.document.attachments[0]).toEqual({
      data: "YQ==",
      mediaType: "image/png",
    });
  });

  it("changes opaque version only when durable payload changes, not submit intent or preview", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(a);
    h.controller.setText("same");
    const first = h.coordinator.captureBinding()!;
    h.controller.submit("queue");
    h.controller.setAttachments([
      { data: "YQ==", mediaType: "image/png", previewUrl: "blob:one" },
    ]);
    const second = h.coordinator.captureBinding()!;
    h.controller.setAttachments([
      { data: "YQ==", mediaType: "image/png", previewUrl: "blob:two" },
    ]);
    expect(h.coordinator.captureBinding()?.identity).toEqual(second.identity);
    expect(second.identity.scopeVersion).not.toBe(first.identity.scopeVersion);
    h.controller.setSelection(1, 1);
    expect(h.coordinator.captureBinding()?.identity.scopeVersion).not.toBe(
      second.identity.scopeVersion,
    );
  });

  it("prepareNavigation preserves the source until actual navigation commits", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(a);
    h.controller.setText("source");
    h.coordinator.prepareNavigation();
    await h.coordinator.idle();
    expect(h.coordinator.getSnapshot().scope).toEqual(a);
    expect(h.controller.captureDraft().text).toBe("source");
    await h.coordinator.bindCommitted(b);
    expect(h.controller.captureDraft().text).toBe("");
    h.controller.setText("target");
    await h.coordinator.bindCommitted(home);
    h.controller.setText("home");
    await h.coordinator.bindCommitted(a);
    expect(h.controller.captureDraft().text).toBe("source");
    await h.coordinator.bindCommitted(b);
    expect(h.controller.captureDraft().text).toBe("target");
    await h.coordinator.bindCommitted(home);
    expect(h.controller.captureDraft().text).toBe("home");
  });

  it("rejects a late hydrate after another committed scope", async () => {
    const h = await setup();
    h.seed(a, "remote a");
    h.seed(b, "remote b");
    const gate = deferred<unknown>();
    let once = true;
    h.intercept((command, _args, execute) => {
      if (command === "persisted_atom_read" && once) {
        once = false;
        const result = execute();
        return gate.promise.then(() => result);
      }
      return execute();
    });
    const pending = h.coordinator.bindCommitted(a);
    await h.coordinator.bindCommitted(b);
    gate.resolve(null);
    expect(await pending).toBe(false);
    expect(h.controller.captureDraft().text).toBe("remote b");
  });

  it("preserves user edits made while hydrate is delayed and does not rebase onto remote", async () => {
    const h = await setup();
    h.seed(a, "remote");
    const gate = deferred<unknown>();
    h.intercept((command, _args, execute) =>
      command === "persisted_atom_read"
        ? gate.promise.then(execute)
        : execute(),
    );
    const pending = h.coordinator.bindCommitted(a);
    h.controller.setText("new local");
    gate.resolve(null);
    expect(await pending).toBe(false);
    expect(h.controller.captureDraft().text).toBe("new local");
    expect(h.coordinator.getSnapshot().mutation).toBe("conflict");
    expect(h.mutations).toHaveLength(0);
  });

  it("allows local edits during a delayed absent scope read", async () => {
    const h = await setup();
    const gate = deferred<unknown>();
    h.intercept((command, _args, execute) =>
      command === "persisted_atom_read"
        ? gate.promise.then(execute)
        : execute(),
    );
    const pending = h.coordinator.bindCommitted(a);
    h.controller.setText("local");
    gate.resolve(null);
    expect(await pending).toBe(true);
    h.intercept(null);
    await h.coordinator.idle();
    expect(h.controller.captureDraft().text).toBe("local");
    expect((await h.read(a))?.state).toBe("draft");
  });

  it("rejects wrong codec mode without altering the immutable Controller mode or storing empty", async () => {
    const h = await setup();
    h.seed(a, "plain", true);
    expect(await h.coordinator.bindCommitted(a)).toBe(false);
    expect(h.coordinator.getSnapshot().error).toBe("mode_mismatch");
    expect(h.mutations).toHaveLength(0);
    expect(h.controller.getSnapshot().document.text).toBe("");
  });

  it("requires explicit mode and restores with an explicitly matching plain Controller", async () => {
    expect(
      () => new ComposerDraftCoordinator(new ComposerController(), {} as never),
    ).toThrow("explicitly");
    const h = await setup({ plainTextMode: true });
    h.seed(a, "plain");
    expect(await h.coordinator.bindCommitted(a)).toBe(true);
    expect(h.controller.captureDraft().text).toBe("plain");
    expect(h.mutations).toHaveLength(0);
  });

  it("metadata notifications only reread and fail closed when listen is unavailable", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(a);
    await h.coordinator.connect();
    const count = h.reads.length;
    h.seed(b, "other");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.reads.length).toBeGreaterThan(count);
    expect(h.reads.every((scope) => scope.id === a.id)).toBe(true);
    expect(h.controller.captureDraft().text).toBe("");
    expect(h.mutations).toHaveLength(0);
    h.coordinator.detach();
    const failed = new ComposerDraftCoordinator(h.controller, {
      plainTextMode: false,
    });
    vi.mocked(safeListen).mockRejectedValue(new Error("unavailable"));
    await failed.connect();
    expect(failed.getSnapshot().mutation).toBe("unavailable");
    failed.detach();
  });

  it("handles unavailable reads without clearing or treating the scope as absent", async () => {
    const h = await setup();
    h.controller.setText("unsaved local");
    vi.mocked(safeInvoke).mockRejectedValue(new Error("transport"));
    expect(await h.coordinator.bindCommitted(a)).toBe(false);
    expect(h.controller.captureDraft().text).toBe("unsaved local");
    expect(h.mutations).toHaveLength(0);
    expect(h.coordinator.getSnapshot().mutation).toBe("unavailable");
  });

  it("preserves initial whitespace/route as a draft without using send's empty predicate", async () => {
    const h = await setup();
    h.controller.setText("   ");
    h.controller.setInputCapabilityRoute({ capability: "image" });
    await h.coordinator.bindCommitted(a);
    await h.coordinator.idle();
    const entry = await h.read(a);
    if (entry?.state !== "draft") throw new Error("initial draft missing");
    expect(decodeComposerDraft(entry.draft).document.text).toBe("   ");
    expect(
      decodeComposerDraft(entry.draft).document.inputCapabilityRoute,
    ).toEqual({ capability: "image" });
  });

  it("does not hydrate over user clear while the old read is delayed", async () => {
    const h = await setup();
    h.seed(a, "remote");
    const gate = deferred<unknown>();
    h.intercept((command, _args, execute) =>
      command === "persisted_atom_read"
        ? gate.promise.then(execute)
        : execute(),
    );
    const pending = h.coordinator.bindCommitted(a);
    await h.coordinator.clear();
    gate.resolve(null);
    expect(await pending).toBe(false);
    expect(h.controller.captureDraft().text).toBe("");
    h.intercept(null);
    expect((await h.read(a))?.state).toBe("draft");
  });

  it("ignores old metadata revisions and never treats a notification's saved field as a receipt", async () => {
    const h = await setup();
    await h.coordinator.bindCommitted(a);
    await h.coordinator.connect();
    h.controller.setText("pending");
    await h.coordinator.idle();
    const handler = vi.mocked(safeListen).mock.calls[0][1];
    const count = h.reads.length;
    handler({
      event: "persisted-atom-update",
      id: 1,
      payload: {
        key: "composer-drafts-v1",
        storeRevision: 0,
        persistence: { state: "saved", savedRevision: 0 },
        event: "persisted-atom-update",
      },
    } as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.reads).toHaveLength(count);
    handler({
      event: "persisted-atom-update",
      id: 2,
      payload: {
        key: "composer-drafts-v1",
        storeRevision: h.store.metadata().storeRevision,
        persistence: {
          state: "saved",
          savedRevision: h.store.metadata().storeRevision,
        },
        event: "persisted-atom-update",
      },
    } as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.coordinator.getSnapshot().persistence?.state).toBe("pending");
  });

  it("does not restore an older notification read after navigation commits another scope", async () => {
    const h = await setup();
    h.seed(a, "a");
    h.seed(b, "b");
    await h.coordinator.bindCommitted(a);
    await h.coordinator.connect();
    const remoteDraft = h.coordinator.captureBinding()!.payload;
    const gate = deferred<unknown>();
    let once = true;
    h.intercept((command, _args, execute) => {
      if (command === "persisted_atom_read" && once) {
        once = false;
        const result = execute();
        return gate.promise.then(() => result);
      }
      return execute();
    });
    h.store.updatePersistedAtomState({
      op: "put",
      scope: a,
      draftId: "seed-draft-a",
      expectedVersion: "seed-version-a",
      nextVersion: "new-remote",
      draft: remoteDraft,
    });
    await h.coordinator.bindCommitted(b);
    gate.resolve(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.controller.captureDraft().text).toBe("b");
    expect(h.coordinator.getSnapshot().scope).toEqual(b);
  });
});
