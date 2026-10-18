import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { encodeComposerDraft } from "@/components/input-kit/composerDraftCodec";
import {
  a,
  b,
  home,
  accepted,
  deferred,
  installCoordinatorHarness,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type { DraftScope } from "@/lib/api/persistedAtomTypes";
import { useWorkspaceComposerDraftRuntime } from "./useWorkspaceComposerDraftRuntime";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));
const setup = installCoordinatorHarness({ safeInvoke, safeListen });
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<{ root: Root; element: HTMLDivElement }> = [];
afterEach(() => {
  act(() => {
    for (const { root, element } of mounted.splice(0)) {
      root.unmount();
      element.remove();
    }
  });
});

async function mount(
  controller: ComposerController,
  scope: DraftScope | null,
  strict = false,
) {
  let current!: ReturnType<typeof useWorkspaceComposerDraftRuntime>;
  function Surface({ initialScope }: { initialScope: DraftScope | null }) {
    current = useWorkspaceComposerDraftRuntime({ controller, initialScope });
    return (
      <output>{current.composerDraftRestoring ? "restoring" : "ready"}</output>
    );
  }
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  mounted.push({ root, element });
  async function render(initialScope: DraftScope | null) {
    await act(async () => {
      root.render(
        strict ? (
          <StrictMode>
            <Surface initialScope={initialScope} />
          </StrictMode>
        ) : (
          <Surface initialScope={initialScope} />
        ),
      );
    });
  }
  await render(scope);
  return { current: () => current, render, element };
}

describe("Workspace committed draft lifecycle through the real Coordinator and Store", () => {
  it("restores full rich JSON/resources and waits for a committed target", async () => {
    const h = await setup();
    const original = new ComposerController();
    original.setText("A😀 link ");
    original.ingestPaste("collapsed content".repeat(120));
    original.setAttachments([
      {
        data: "durable-image",
        mediaType: "image/png",
        previewUrl: "blob:ephemeral",
      },
    ]);
    original.setPathReferences([
      { id: "p", path: "/tmp/code.ts", name: "code.ts", isDir: false },
    ]);
    h.store.updatePersistedAtomState({
      op: "put",
      scope: a,
      draftId: "rich",
      expectedVersion: null,
      nextVersion: "v1",
      draft: encodeComposerDraft(original.captureDraft(), false),
    });
    const view = await mount(h.controller, null);
    expect(view.current().composerDraftRestoring).toBe(true);
    expect(h.controller.getDocument().text).toBe("");
    await view.render(a);
    expect(view.current().composerDraftRestoring).toBe(false);
    expect(h.controller.captureDraft()).toEqual({
      ...original.captureDraft(),
      attachments: [{ data: "durable-image", mediaType: "image/png" }],
    });
    const identity = view.current().composerDraftStatus?.identity;
    act(() => view.current().prepareComposerDraftNavigation());
    expect(view.current().composerDraftStatus?.identity).toEqual(identity);
    expect(h.controller.getDocument().text).toBe(original.getDocument().text);
  });

  it("a late read cannot restore a superseded scope or overwrite an edit", async () => {
    const h = await setup();
    h.seed(a, "old remote");
    h.seed(b, "target remote");
    const gate = deferred<unknown>();
    h.intercept((command, args, execute) => {
      const query = args.query as
        | { kind?: string; scope?: DraftScope }
        | undefined;
      return command === "persisted_atom_read" && query?.scope?.id === a.id
        ? gate.promise.then(execute)
        : execute();
    });
    const view = await mount(h.controller, a);
    await act(async () => view.current().commitComposerDraftScope(b));
    expect(h.controller.getDocument().text).toBe("target remote");
    act(() => h.controller.setText("new edit"));
    await act(async () => {
      gate.resolve(null);
      await gate.promise;
    });
    expect(h.controller.getDocument().text).toBe("new edit");
    expect(view.current().composerDraftStatus?.scope).toEqual(b);
  });

  it("promotes the same captured home identity before accepted consumption", async () => {
    const h = await setup();
    const view = await mount(h.controller, home);
    act(() => h.controller.setText("home submission"));
    const owner = view.current().composerDraftCoordinator!;
    const capture = owner.captureSubmission("start");
    const revision = h.controller.getSnapshot().revision;
    const result = accepted();
    if (result.kind !== "runtime-accepted")
      throw new Error("test acceptance missing");
    await act(async () =>
      view.current().handleComposerDraftAccepted(capture, result),
    );
    expect(h.controller.getSnapshot().revision).toBe(revision);
    expect(view.current().composerDraftStatus?.generation).toBe(
      capture.binding!.generation,
    );
    expect(view.current().composerDraftStatus?.scope).toEqual({
      ...home,
      kind: "local",
      id: "s1",
    });
    await act(async () => {
      await owner.settleSubmission(capture, result);
    });
    expect(h.controller.getDocument().text).toBe("");
    expect(h.mutations.map((item) => item.op)).toEqual([
      "put",
      "promote",
      "consume",
    ]);
    expect(await h.read(home)).toBeNull();
  });

  it.each([false, true])(
    "worktree acceptance promotes into the target workspace and preserves newer input: %s",
    async (edit) => {
      const h = await setup();
      const source = { ...home, workspaceId: "a" };
      const target = { workspaceId: "b", kind: "local" as const, id: "s1" };
      const view = await mount(h.controller, source);
      act(() => h.controller.setText("worktree captured input"));
      const owner = view.current().composerDraftCoordinator!;
      const capture = owner.captureSubmission("start");
      await owner.idle();
      if (edit) act(() => h.controller.setText("new revision while creating"));
      const canonical = accepted();
      if (canonical.kind !== "runtime-accepted")
        throw new Error("test acceptance missing");
      const result = {
        ...canonical,
        receipt: {
          ...canonical.receipt,
          executionScope: {
            requestId: "r1",
            sourceWorkspaceId: "a",
            sourceWorkingDir: "/a",
            workspaceId: "b",
            workingDir: "/b",
          },
        },
      };
      await act(async () => {
        await view.current().handleComposerDraftAccepted(capture, result);
        expect(await owner.settleSubmission(capture, result)).toBe(!edit);
        await owner.idle();
      });
      expect(view.current().getComposerDraftTarget()).toEqual(target);
      expect(owner.getSnapshot().scope).toEqual(target);
      expect(h.controller.getDocument().text).toBe(
        edit ? "new revision while creating" : "",
      );
      expect(await h.read(source)).toBeNull();
      if (edit)
        expect(await h.read(target)).toMatchObject({
          draft: { document: { text: "new revision while creating" } },
        });
    },
  );

  it("does not promote a capture when accepted execution scope names a different source workspace", async () => {
    const h = await setup();
    const source = { ...home, workspaceId: "a" };
    const view = await mount(h.controller, source);
    act(() => h.controller.setText("source input"));
    const owner = view.current().composerDraftCoordinator!;
    const capture = owner.captureSubmission("start");
    const canonical = accepted();
    if (canonical.kind !== "runtime-accepted")
      throw new Error("test acceptance missing");
    await act(async () =>
      view.current().handleComposerDraftAccepted(capture, {
        ...canonical,
        receipt: {
          ...canonical.receipt,
          executionScope: {
            requestId: "r1",
            sourceWorkspaceId: "wrong",
            sourceWorkingDir: "/wrong",
            workspaceId: "b",
            workingDir: "/b",
          },
        },
      }),
    );
    expect(view.current().getComposerDraftTarget()).toEqual(source);
    expect(h.controller.getDocument().text).toBe("source input");
    expect(h.mutations.filter((mutation) => mutation.op === "promote")).toEqual(
      [],
    );
  });

  it("cross-navigation acceptance consumes the old identity and leaves the new document", async () => {
    const h = await setup();
    h.seed(b, "B unsent");
    const view = await mount(h.controller, a);
    act(() => h.controller.setText("A submitted"));
    const owner = view.current().composerDraftCoordinator!;
    const capture = owner.captureSubmission("start");
    await act(async () => view.current().commitComposerDraftScope(b));
    const result = accepted();
    if (result.kind !== "runtime-accepted")
      throw new Error("test acceptance missing");
    await act(async () => {
      await view.current().handleComposerDraftAccepted(capture, result);
      await owner.settleSubmission(capture, result);
    });
    expect(view.current().composerDraftStatus?.scope).toEqual(b);
    expect(h.controller.getDocument().text).toBe("B unsent");
    expect(await h.read(a)).toBeNull();
    expect((await h.read(b))?.state).toBe("draft");
  });

  it("keeps a pending edit and its committed target when the captured home lane is promoted", async () => {
    const h = await setup();
    const view = await mount(h.controller, home);
    act(() => h.controller.setText("home submitted"));
    const owner = view.current().composerDraftCoordinator!;
    const capture = owner.captureSubmission("start");
    await owner.idle();
    const epoch = view.current().getComposerDraftNavigationEpoch();
    act(() => h.controller.setText("new edit while submission is pending"));
    const revision = h.controller.getSnapshot().revision;
    const newerIdentity = owner.getSnapshot().identity;
    expect(newerIdentity?.draftId).toBe(capture.binding!.identity.draftId);
    expect(newerIdentity?.scopeVersion).not.toBe(
      capture.binding!.identity.scopeVersion,
    );
    expect((await h.read(home))?.scopeVersion).toBe(
      capture.binding!.identity.scopeVersion,
    );
    const result = accepted();
    if (result.kind !== "runtime-accepted")
      throw new Error("test acceptance missing");
    const target: DraftScope = { ...home, kind: "local", id: "s1" };
    await act(async () => {
      await view.current().handleComposerDraftAccepted(capture, result);
      expect(await owner.settleSubmission(capture, result)).toBe(false);
      await owner.idle();
    });
    expect(h.controller.getDocument().text).toBe(
      "new edit while submission is pending",
    );
    expect(h.controller.getSnapshot().revision).toBe(revision);
    expect(view.current().getComposerDraftTarget()).toEqual(target);
    expect(owner.getSnapshot().scope).toEqual(target);
    expect(owner.getSnapshot().identity).toEqual(newerIdentity);
    expect(owner.getSnapshot().generation).toBe(capture.binding!.generation);
    expect(view.current().getComposerDraftNavigationEpoch()).toBe(epoch + 1);
    expect(await h.read(home)).toBeNull();
    expect(await h.read(target)).toMatchObject({
      state: "draft",
      draftId: newerIdentity!.draftId,
      scopeVersion: newerIdentity!.scopeVersion,
      draft: {
        document: { text: "new edit while submission is pending" },
      },
    });
    expect(h.mutations.map((item) => item.op)).toEqual([
      "put",
      "promote",
      "put",
      "consume",
    ]);
    await act(async () => view.current().commitComposerDraftScope(target));
    expect(view.current().getComposerDraftNavigationEpoch()).toBe(epoch + 1);
  });

  it("saved plain mode remains intact and reports an explicit mismatch in rich Workspace", async () => {
    const h = await setup();
    h.seed(a, "plain saved", true);
    h.controller.setText("current rich");
    const view = await mount(h.controller, a);
    // An initial local edit conflicts before a remote mode can replace it.
    expect(h.controller.getDocument().text).toBe("current rich");
    expect(view.current().composerDraftStatus?.mutation).toBe("conflict");
    await act(async () => view.current().commitComposerDraftScope(b));
    await act(async () => view.current().commitComposerDraftScope(a));
    expect(view.current().composerDraftStatus?.error).toBe("mode_mismatch");
    expect((await h.read(a))?.state).toBe("draft");
  });

  it("StrictMode cleans up abandoned owners and does not duplicate an edit put", async () => {
    const h = await setup();
    const view = await mount(h.controller, a, true);
    act(() => h.controller.setText("strict edit"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await view.current().composerDraftCoordinator!.idle();
    });
    expect(h.mutations.filter((item) => item.op === "put")).toHaveLength(1);
    expect(view.current().composerDraftRestoring).toBe(false);
  });

  it("a repeated committed target does not cancel navigation from the same scope", async () => {
    const h = await setup();
    const view = await mount(h.controller, a);
    const epoch = view.current().getComposerDraftNavigationEpoch();
    await act(async () => view.current().commitComposerDraftScope(a));
    expect(view.current().getComposerDraftNavigationEpoch()).toBe(epoch);
    await act(async () => view.current().commitComposerDraftScope(b));
    expect(view.current().getComposerDraftNavigationEpoch()).toBe(epoch + 1);
  });

  it("promotion cannot reclaim a newer intended target before its layout binding", async () => {
    const h = await setup();
    h.seed(b, "B unsent");
    const view = await mount(h.controller, home);
    act(() => h.controller.setText("home submitted"));
    const capture = view
      .current()
      .composerDraftCoordinator!.captureSubmission("start");
    const gate = deferred<unknown>();
    let entered!: () => void;
    const promotionEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    h.intercept((command, args, execute) => {
      if (
        command === "persisted_atom_update" &&
        (args.mutation as { op?: string }).op === "promote"
      ) {
        entered();
        return gate.promise.then(execute);
      }
      return execute();
    });
    const result = accepted();
    if (result.kind !== "runtime-accepted")
      throw new Error("missing acceptance");
    const promotion = view
      .current()
      .handleComposerDraftAccepted(capture, result);
    await promotionEntered;
    await act(async () => {
      view.current().commitComposerDraftScope(b);
      gate.resolve(null);
      await promotion;
    });
    expect(view.current().composerDraftStatus?.scope).toEqual(b);
    expect(h.controller.getDocument().text).toBe("B unsent");
  });
});
