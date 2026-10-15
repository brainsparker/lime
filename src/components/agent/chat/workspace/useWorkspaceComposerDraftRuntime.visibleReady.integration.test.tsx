import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeInvoke, safeListen } from "@/lib/dev-bridge";
import { changeLimeLocale } from "@/i18n/createI18n";
import { ComposerController } from "@/components/input-kit/ComposerController";
import { ComposerEditor } from "@/components/input-kit/ComposerEditor";
import { encodeComposerDraft } from "@/components/input-kit/composerDraftCodec";
import {
  deferred,
  harness,
} from "@/components/input-kit/ComposerDraftCoordinator.testFixtures";
import type { DraftScope } from "@/lib/api/persistedAtomTypes";
import { useWorkspaceComposerDraftRuntime } from "./useWorkspaceComposerDraftRuntime";

vi.mock("@/lib/dev-bridge", () => ({
  safeInvoke: vi.fn(),
  safeListen: vi.fn(),
}));
vi.mock("@/lib/api/appServer", () => ({ AppServerClient: vi.fn() }));
vi.mock("@/lib/agentDebug", () => ({ logAgentDebug: vi.fn() }));

type Fixture = Awaited<ReturnType<typeof harness>>;
type Runtime = ReturnType<typeof useWorkspaceComposerDraftRuntime>;
const scopeA: DraftScope = {
  workspaceId: "workspace-a",
  kind: "local",
  id: "session-a",
};
const scopeB: DraftScope = {
  workspaceId: "workspace-b",
  kind: "local",
  id: "session-b",
};
const signalScope: DraftScope = {
  workspaceId: "metadata-workspace",
  kind: "home",
  id: "new-conversation",
};
const fixtures: Fixture[] = [];
const mounted: Array<{ root: Root; host: HTMLDivElement }> = [];
const rangeDescriptors = new Map(
  ["getClientRects", "getBoundingClientRect"].map(
    (name) =>
      [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
  ),
);

beforeEach(async () => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await changeLimeLocale("en-US");
  // JSDOM supplies no native geometry, trusted input or desktop evidence.
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 1, 1),
  });
});

afterEach(async () => {
  act(() => {
    for (const { root, host } of mounted.splice(0)) {
      root.unmount();
      host.remove();
    }
  });
  for (const fixture of fixtures.splice(0)) await fixture.close();
  for (const [name, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor);
    else Reflect.deleteProperty(Range.prototype, name);
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function setup() {
  const fixture = await harness({ safeInvoke, safeListen });
  fixtures.push(fixture);
  return fixture;
}

function richDocument(label: string) {
  const source = new ComposerController();
  source.ingestHTML(
    "<p>" +
      label +
      ' 中😀 <a href="https://example.invalid/readiness">link</a></p>' +
      '<pre><code class="language-typescript">const value = "中😀";</code></pre>' +
      "<p>tail</p>",
  );
  source.setSelection(source.getDocument().text.length);
  source.ingestPaste("hidden rich draft payload 中😀 ".repeat(100));
  source.insertMention({
    id: "user:capability-report",
    kind: "skill",
    name: "capability-report",
    path: "/skills/capability-report",
    label: "/user:capability-report",
  });
  source.setAttachments([{ data: "YQ==", mediaType: "image/png" }]);
  source.setPathReferences([
    {
      id: "readiness-file-" + label,
      path: "/workspace/" + label + ".ts",
      name: label + ".ts",
      isDir: false,
    },
  ]);
  source.setInputCapabilityRoute({ skill: "capability-report" });
  return source.captureDraft();
}

function seedRich(fixture: Fixture, scope: DraftScope, label: string) {
  const document = richDocument(label);
  const result = fixture.store.updatePersistedAtomState({
    op: "put",
    scope,
    draftId: "readiness-draft-" + scope.id,
    expectedVersion: null,
    nextVersion: "readiness-version-" + scope.id,
    draft: encodeComposerDraft(document, false),
  });
  expect(result.outcome).toBe("applied");
  expect(document.pendingPastes).toHaveLength(1);
  expect(document.mentionBindings).toHaveLength(1);
  return document;
}

function storedEntry(fixture: Fixture, scope: DraftScope) {
  const read = fixture.store.sendPersistedAtomState({ kind: "scope", scope });
  if (read.outcome !== "ready" || read.data.queryKind !== "scope")
    throw new Error("Real Store did not return a scope");
  return read.data.view.entry;
}

async function mount(fixture: Fixture, initialScope: DraftScope | null) {
  let current!: Runtime;
  function Surface({ visibleTarget }: { visibleTarget: DraftScope | null }) {
    current = useWorkspaceComposerDraftRuntime({
      controller: fixture.controller,
      initialScope: visibleTarget,
    });
    return (
      <ComposerEditor
        controller={fixture.controller}
        sessionId={
          visibleTarget?.kind === "local" ? visibleTarget.id : undefined
        }
        disabled={current.composerDraftRestoring}
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  async function render(visibleTarget: DraftScope | null) {
    await act(async () =>
      root.render(<Surface visibleTarget={visibleTarget} />),
    );
  }
  await render(initialScope);
  const editor = () => {
    const node = host.querySelector<HTMLElement>(
      '[data-testid="composer-editor"]',
    );
    if (!node) throw new Error("Real EditorView was not mounted");
    return node;
  };
  return { current: () => current, editor, render };
}

type Surface = Awaited<ReturnType<typeof mount>>;

function expectEditable(surface: Surface, editable: boolean) {
  expect(surface.editor().getAttribute("contenteditable")).toBe(
    String(editable),
  );
  expect(surface.editor().getAttribute("aria-disabled")).toBe(
    String(!editable),
  );
  expect(surface.current().composerDraftRestoring).toBe(!editable);
}

function pasteHtml(node: HTMLElement, html: string) {
  const plainText = new DOMParser().parseFromString(html, "text/html").body
    .textContent;
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (format: string) =>
        format === "text/html" ? html : (plainText ?? ""),
    },
  });
  node.dispatchEvent(event);
  return event.defaultPrevented;
}

function expectBlockedPaste(surface: Surface, fixture: Fixture) {
  const before = fixture.controller.captureDraft();
  act(() => {
    expect(pasteHtml(surface.editor(), "<p>must not enter old scope</p>")).toBe(
      true,
    );
  });
  expect(fixture.controller.captureDraft()).toEqual(before);
}

describe("visible Composer identity and real binding readiness", () => {
  it("blocks the old scope and superseded initial read until B actually hydrates", async () => {
    const fixture = await setup();
    const documentA = seedRich(fixture, scopeA, "A");
    const documentB = seedRich(fixture, scopeB, "B");
    await fixture.store.flush();
    expect(fixture.store.metadata().persistence.state).toBe("saved");
    const originalA = storedEntry(fixture, scopeA);
    const surface = await mount(fixture, scopeA);
    expectEditable(surface, true);
    expect(fixture.controller.captureDraft()).toEqual(documentA);

    const firstRead = deferred<unknown>();
    const refreshRead = deferred<unknown>();
    let targetReadCount = 0;
    fixture.intercept((command, args, execute) => {
      const query = args.query as { scope?: DraftScope } | undefined;
      if (command === "persisted_atom_read" && query?.scope?.id === scopeB.id) {
        targetReadCount += 1;
        if (targetReadCount === 1) return firstRead.promise.then(execute);
        if (targetReadCount === 2) return refreshRead.promise.then(execute);
      }
      return execute();
    });

    // The public visible target changes before the navigation owner commits it.
    await surface.render(scopeB);
    expect(surface.editor().dataset.sessionId).toBe(scopeB.id);
    expect(surface.current().composerDraftStatus?.scope).toEqual(scopeA);
    expectEditable(surface, false);
    expectBlockedPaste(surface, fixture);
    expect(storedEntry(fixture, scopeA)).toEqual(originalA);

    await act(async () => surface.current().commitComposerDraftScope(scopeB));
    expect(targetReadCount).toBe(1);
    expect(surface.current().composerDraftStatus?.scope).toEqual(scopeB);
    expectEditable(surface, false);
    expectBlockedPaste(surface, fixture);

    // Real Store metadata invalidation starts a newer read of the same binding.
    await act(async () => {
      expect(fixture.seed(signalScope, "metadata signal").outcome).toBe(
        "applied",
      );
    });
    expect(targetReadCount).toBe(2);
    await act(async () => {
      firstRead.resolve(null);
      await firstRead.promise;
    });
    expectEditable(surface, false);
    expectBlockedPaste(surface, fixture);
    expect(fixture.controller.captureDraft()).toEqual(documentA);

    await act(async () => {
      refreshRead.resolve(null);
      await refreshRead.promise;
    });
    expect(surface.current().composerDraftStatus?.scope).toEqual(scopeB);
    expectEditable(surface, true);
    expect(fixture.controller.captureDraft()).toEqual(documentB);
    expect(
      surface.editor().querySelectorAll("[data-composer-code-block]"),
    ).toHaveLength(1);
    expect(
      surface
        .editor()
        .querySelectorAll(
          '[role="link"][text-link-href="https://example.invalid/readiness"]',
        ),
    ).toHaveLength(1);
    expect(storedEntry(fixture, scopeA)).toEqual(originalA);

    act(() => {
      expect(pasteHtml(surface.editor(), "<p>B accepted edit</p>")).toBe(true);
    });
    expect(fixture.controller.getDocument().text).toContain("B accepted edit");
    await act(async () => surface.current().composerDraftCoordinator!.idle());
    expect(storedEntry(fixture, scopeA)).toEqual(originalA);
    const editedB = storedEntry(fixture, scopeB);
    if (editedB?.state !== "draft") throw new Error("B edit was not persisted");
    expect(JSON.stringify(editedB.draft)).toContain("B accepted edit");
  });

  it.each(["mode-mismatch", "transport-unavailable"] as const)(
    "%s cannot become editable through the bind promise finally",
    async (failure) => {
      const fixture = await setup();
      seedRich(fixture, scopeA, "A");
      if (failure === "mode-mismatch") fixture.seed(scopeB, "plain B", true);
      else seedRich(fixture, scopeB, "B");
      await fixture.store.flush();
      const originalA = storedEntry(fixture, scopeA);
      const surface = await mount(fixture, scopeA);
      const before = fixture.controller.captureDraft();
      if (failure === "transport-unavailable") {
        fixture.intercept((command, args, execute) => {
          const query = args.query as { scope?: DraftScope } | undefined;
          if (
            command === "persisted_atom_read" &&
            query?.scope?.id === scopeB.id
          )
            throw new Error("test-only read transport unavailable");
          return execute();
        });
      }
      await surface.render(scopeB);
      await act(async () => surface.current().commitComposerDraftScope(scopeB));
      expect(surface.current().composerDraftStatus?.error).toBe(
        failure === "mode-mismatch" ? "mode_mismatch" : "transport",
      );
      expectEditable(surface, false);
      expectBlockedPaste(surface, fixture);
      expect(fixture.controller.captureDraft()).toEqual(before);
      expect(storedEntry(fixture, scopeA)).toEqual(originalA);
      expect(fixture.mutations).toHaveLength(0);
    },
  );

  it("opens an empty B after real hydration without requiring a saved identity", async () => {
    const fixture = await setup();
    seedRich(fixture, scopeA, "A");
    await fixture.store.flush();
    const originalA = storedEntry(fixture, scopeA);
    const surface = await mount(fixture, scopeA);
    await surface.render(scopeB);
    expectEditable(surface, false);
    await act(async () => surface.current().commitComposerDraftScope(scopeB));
    expect(surface.current().composerDraftStatus?.scope).toEqual(scopeB);
    expect(surface.current().composerDraftStatus?.identity).toBeNull();
    expectEditable(surface, true);
    expect(fixture.controller.getDocument().text).toBe("");
    expect(storedEntry(fixture, scopeB)).toBeNull();
    expect(storedEntry(fixture, scopeA)).toEqual(originalA);
    expect(fixture.mutations).toHaveLength(0);
  });

  it("requires the exact workspace and a non-null visible target even after readiness", async () => {
    const fixture = await setup();
    seedRich(fixture, scopeA, "A");
    await fixture.store.flush();
    const originalA = storedEntry(fixture, scopeA);
    const surface = await mount(fixture, scopeA);
    expectEditable(surface, true);
    await surface.render({ ...scopeA, workspaceId: "other-workspace" });
    expectEditable(surface, false);
    expectBlockedPaste(surface, fixture);
    await surface.render(null);
    expectEditable(surface, false);
    expectBlockedPaste(surface, fixture);
    await surface.render(scopeA);
    expectEditable(surface, true);
    expect(storedEntry(fixture, scopeA)).toEqual(originalA);
  });
});
