import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import {
  atomKey,
  assertWorkspaceIndex,
  requireDraftProof,
  summarizeDraft,
} from "./composer-draft-fixture-evidence.mjs";
import {
  assertEmptyHomeCanonicalInventory,
  assertHomeColdHydration,
  assertHomeDraftDiscovery,
  assertHomeDraftSurface,
  assertHomeDraftTrace,
  assertHomeIndexUnchanged,
  assertHomeSavedBytesUnchanged,
  assertHomeSavedEntry,
  assertHomeSavedFiles,
  readHomeDraftSurfaceDom,
} from "./composer-home-draft-fixture-evidence.mjs";

const marker = "首页真实冷恢复草稿一号";

async function readIndex(context, workspaceId) {
  const observed = await context.modules.atom.observePersistedAtomCommand(
    context.page,
    context.protocol,
    "persisted_atom_read",
    { key: atomKey, query: { kind: "workspace-index", workspaceId } },
    { timeoutMs: context.options.timeoutMs },
  );
  return observed.result;
}

async function openHome(context) {
  const home = context.page
    .getByTestId("app-sidebar-home-button")
    .filter({ visible: true });
  requireDraftProof((await home.count()) === 1, "one public Home button");
  await home.click();
  const snapshot = await context.modules.drafts.until(
    context,
    () => context.page.evaluate(readHomeDraftSurfaceDom),
    (value) => {
      try {
        assertHomeDraftSurface(value);
        return true;
      } catch {
        return false;
      }
    },
    "public Home click commits one editable null-session Composer",
  );
  return assertHomeDraftSurface(snapshot);
}

async function readEmptyInventory(context) {
  const observed = await context.modules.rpc.invokeAppServerFromPage(
    context.page,
    "thread/list",
    { limit: 100 },
  );
  return assertEmptyHomeCanonicalInventory(observed.result);
}

async function discoverEditedScope(context, workspaceId, probe) {
  return context.modules.drafts.until(
    context,
    async () => {
      const index = await readIndex(context, workspaceId);
      if (index.data?.items?.length !== 1) return null;
      const scope = index.data.items[0].scope;
      const scopeRead = await context.modules.drafts.readScope(context, scope);
      const surface = await context.page.evaluate(readHomeDraftSurfaceDom);
      try {
        return assertHomeDraftDiscovery({
          index,
          scopeRead,
          workspaceId,
          probe,
          surface,
        });
      } catch {
        return null;
      }
    },
    (value) => value !== null,
    "public GUI probe uniquely identifies native default-workspace home scope",
  );
}

export const homeDraftColdScenario = {
  id: "home-draft-cold",
  scope:
    "stable null-workspace home/new-conversation draft, restored through public Home after normal process restart",
  generationCount: 2,
  sourcePaths: [
    "scripts/electron/lib/composer-home-draft-fixture-scenario.mjs",
    "scripts/electron/lib/composer-home-draft-fixture-evidence.mjs",
    "scripts/electron/lib/composer-home-draft-fixture-evidence.test.mjs",
  ],
  limitations: [
    "Only the public Home null-workspace scope is covered; project New and first submission are separate slices.",
    "No all-draft sidebar picker or TaskCenterTabStrip is introduced or exercised.",
    "First submission, materialization, queue and GUI Stop are separate slices; this draft stays unmaterialized.",
    "Synthetic clipboard/drop events use production GUI ingress; OS clipboard and OS drag are not covered.",
    "Saved is awaited before public normal quit; abrupt exit with pending save is not covered.",
    "Invoke observation begins after each launcher returns; unchanged full bytes/revision and empty canonical inventory additionally cover committed startup mutation.",
    "External backend proves current App Server/read-model transport, not production model execution or live provider.",
  ],
  async run(fixture) {
    const { options, runtimeEnv, recordStage, setPhase } = fixture;
    let context = await fixture.launch(1);
    setPhase("public-home-with-explicit-null-workspace");
    const workspace = await context.modules.rpc.ensureDefaultWorkspace(
      context.page,
    );
    recordStage("generation-1-public-home", await openHome(context));
    recordStage(
      "generation-1-no-canonical-thread",
      await readEmptyInventory(context),
    );
    recordStage("generation-1-default-workspace-fact", workspace);
    const empty = await readIndex(context, null);
    requireDraftProof(
      empty.outcome === "ready" &&
        empty.key === atomKey &&
        empty.data?.queryKind === "workspace-index" &&
        empty.data.workspaceId === null &&
        empty.data.items.length === 0,
      "fresh isolated public Home null workspace has no persisted draft index item",
    );
    const probe = `首页草稿范围探针 ${options.runId}`;
    await context.modules.dom.fillComposerEditor(context.page, probe);
    const discovered = await discoverEditedScope(context, null, probe);
    recordStage("public-edit-native-scope-identity-discovery", discovered);
    const rootPath = path.join(runtimeEnv.tempRoot, "home-draft-resources");
    await fs.mkdir(rootPath);
    const filePath = path.join(rootPath, "composer-home-draft.md");
    const bytes = Buffer.alloc(128, " ");
    bytes.write(`# Current Home draft\n${marker}\n`, "utf8");
    await fs.writeFile(filePath, bytes);
    const record = {
      workspaceId: discovered.scope.workspaceId,
      scope: discovered.scope,
      sessionId: null,
      marker,
      rootPath,
      path: filePath,
      pathName: path.basename(filePath),
    };
    setPhase("public-rich-home-draft-edit-and-save");
    const original = await context.modules.drafts.prepareVisibleDraft(
      context,
      record,
    );
    recordStage(
      "generation-1-rich-home-surface",
      assertHomeDraftSurface(
        await context.page.evaluate(readHomeDraftSurfaceDom),
      ),
    );
    const originalIndex = await readIndex(context, record.workspaceId);
    recordStage(
      "generation-1-same-atom-index",
      assertWorkspaceIndex(
        originalIndex,
        record.workspaceId,
        record.scope,
        original.entry,
      ),
    );
    const rereadIndex = await readIndex(context, record.workspaceId);
    recordStage(
      "generation-1-index-read-is-idempotent",
      assertHomeIndexUnchanged(
        originalIndex,
        rereadIndex,
        record.scope,
        original.entry,
      ),
    );
    requireDraftProof(
      originalIndex.storeRevision === original.revision,
      "rich scope and native index agree on original revision",
    );
    recordStage(
      "generation-1-unmaterialized-inventory",
      await readEmptyInventory(context),
    );
    const inspect = async () =>
      assertHomeSavedFiles(
        await fixture.inspectSavedFiles(original.revision, (envelope) =>
          assertHomeSavedEntry(envelope, record.scope, original.entry),
        ),
        record.scope,
        original.entry,
        original.revision,
      );
    const savedFiles = await inspect();
    recordStage("generation-1-real-saved-files", savedFiles);
    recordStage(
      "generation-1-native-edit-trace",
      assertHomeDraftTrace(await fixture.stopTrace(), true),
    );
    await fixture.quit();
    recordStage(
      "generation-1-normal-quit-files-unchanged",
      assertHomeSavedBytesUnchanged(savedFiles, await inspect()),
    );
    context = await fixture.launch(2);
    setPhase("same-profile-new-pid-current-home-cold-restore");
    const secondWorkspace = await context.modules.rpc.ensureDefaultWorkspace(
      context.page,
    );
    requireDraftProof(
      secondWorkspace.workspaceId === workspace.workspaceId,
      "same real default workspace identity after cold restart",
    );
    const coldIndexBeforeHome = await readIndex(context, record.workspaceId);
    recordStage(
      "generation-2-pre-home-index-unchanged",
      assertHomeIndexUnchanged(
        originalIndex,
        coldIndexBeforeHome,
        record.scope,
        original.entry,
      ),
    );
    recordStage("generation-2-true-public-home-click", await openHome(context));
    const restored = await context.modules.drafts.verifyVisibleDraft(
      context,
      record,
      original,
    );
    recordStage(
      "generation-2-full-json-dom-resources-selection-restored",
      restored,
    );
    const coldIndexAfterHome = await readIndex(context, record.workspaceId);
    recordStage(
      "generation-2-post-home-index-unchanged",
      assertHomeIndexUnchanged(
        coldIndexBeforeHome,
        coldIndexAfterHome,
        record.scope,
        original.entry,
      ),
    );
    const secondScopeRead = await context.modules.drafts.readScope(
      context,
      record.scope,
    );
    requireDraftProof(
      secondScopeRead.storeRevision === original.revision,
      "scope observation keeps original global revision",
    );
    recordStage(
      "generation-2-no-canonical-thread-or-turn",
      await readEmptyInventory(context),
    );
    recordStage(
      "generation-2-real-saved-files-unchanged",
      assertHomeSavedBytesUnchanged(savedFiles, await inspect()),
    );
    recordStage(
      "generation-2-cold-hydration-no-update",
      assertHomeColdHydration({
        beforeRevision: original.revision,
        indexBeforeRevision: coldIndexBeforeHome.storeRevision,
        indexAfterRevision: coldIndexAfterHome.storeRevision,
        restoredRevision: restored.revision,
        trace: await fixture.stopTrace(),
      }),
    );
    await fixture.quit();
    recordStage(
      "generation-2-normal-quit-files-unchanged",
      assertHomeSavedBytesUnchanged(savedFiles, await inspect()),
    );
    return {
      guiDraftRestoration: true,
      firstSubmissionRoutesVerified: false,
      records: [{ ...record, draft: summarizeDraft(original.entry) }],
    };
  },
};
