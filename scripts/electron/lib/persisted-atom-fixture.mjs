import { createHash } from "node:crypto";
import path from "node:path";

export const PERSISTED_ATOM_FIXTURE_KEY = "composer-drafts-v1";
export const PERSISTED_ATOM_FIXTURE_COMMANDS = Object.freeze([
  "persisted_atom_read",
  "persisted_atom_update",
]);
const EVENT = "persisted-atom-update";
const SHA256 = /^[a-f0-9]{64}$/;

class FixtureProofError extends Error {}

function requireProof(condition, name) {
  if (!condition)
    throw new FixtureProofError(`persisted atom fixture failed: ${name}`);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseProtocol(parser, value, name, request) {
  try {
    const result = parser(value, request);
    requireProof(result !== null && result !== undefined, name);
    return result;
  } catch {
    throw new FixtureProofError(`persisted atom fixture failed: ${name}`);
  }
}

function scopeView(result, name) {
  requireProof(
    result?.outcome === "ready" && result.data?.queryKind === "scope",
    name,
  );
  return result.data.view;
}

function expectDraft(result, identity, draft, name) {
  const entry =
    result.outcome === "ready" ? scopeView(result, name).entry : result.entry;
  requireProof(
    entry?.state === "draft" &&
      entry.draftId === identity.draftId &&
      entry.scopeVersion === identity.scopeVersion &&
      digest(entry.draft) === digest(draft),
    name,
  );
}

function expectEmpty(result, name) {
  requireProof(scopeView(result, name).entry === null, name);
}

function expectIndex(result, workspaceId, expected, name) {
  requireProof(
    result?.outcome === "ready" &&
      result.data?.queryKind === "workspace-index" &&
      result.data.workspaceId === workspaceId,
    name,
  );
  const items = result.data.items;
  requireProof(
    items.length === expected.length &&
      expected.every(([scope, identity]) =>
        items.some(
          (item) =>
            digest(item.scope) === digest(scope) &&
            digest(item.identity) === digest(identity),
        ),
      ),
    name,
  );
  return {
    workspaceId,
    storeRevision: result.storeRevision,
    itemCount: items.length,
    itemsSha256: digest(items),
  };
}

function expectOutcome(result, outcome, changed, reason, name) {
  requireProof(
    result.outcome === outcome &&
      result.changed === changed &&
      (reason === undefined || result.reason === reason),
    name,
  );
}

function verifyIdentity(handle, appDataRoot) {
  const identity = handle.identity;
  requireProof(
    Number.isSafeInteger(identity?.pid) &&
      identity.pid > 0 &&
      identity.appDataRoot === appDataRoot &&
      SHA256.test(identity.hostSha256 ?? "") &&
      SHA256.test(identity.preloadSha256 ?? "") &&
      identity.eventEmissionGuard?.validated === true &&
      SHA256.test(identity.eventEmissionGuard.sourceSha256 ?? ""),
    "current Host/preload and renderer-emission source guard",
  );
  return identity;
}

/** Only the public preload IPC surface is evaluated; no store or Controller access. */
export async function observePersistedAtomCommand(
  page,
  protocol,
  command,
  args,
  { timeoutMs = 10_000 } = {},
) {
  requireProof(
    PERSISTED_ATOM_FIXTURE_COMMANDS.includes(command),
    "known command",
  );
  const request =
    command === "persisted_atom_read"
      ? parseProtocol(
          protocol.parseReadRequest,
          args,
          "strict read request protocol",
        )
      : args;
  let observation;
  try {
    observation = await page.evaluate(
      async ({ command: name, args: request, eventName, timeout }) => {
        const api = window.electronAPI;
        if (
          window.__LIME_ELECTRON__ !== true ||
          api?.devBridgeFallback !== false ||
          typeof api.invoke !== "function" ||
          typeof api.listen !== "function" ||
          typeof api.supportsCommand !== "function" ||
          !api.supportsCommand(name)
        ) {
          throw new Error("native persisted atom preload unavailable");
        }
        const events = [];
        let resolveEvent;
        let expectedRevision;
        const eventSeen = new Promise((resolve) => {
          resolveEvent = resolve;
        });
        const unlisten = api.listen(eventName, (envelope) => {
          events.push(envelope);
          if (envelope?.payload?.storeRevision === expectedRevision)
            resolveEvent();
        });
        if (typeof unlisten !== "function") {
          throw new Error("native persisted atom listener unavailable");
        }
        let timer;
        try {
          const result = await api.invoke(name, request);
          if (name === "persisted_atom_update" && result?.changed === true) {
            expectedRevision = result.storeRevision;
            if (
              events.some(
                (event) => event?.payload?.storeRevision === expectedRevision,
              )
            )
              resolveEvent();
            await Promise.race([
              eventSeen,
              new Promise((resolve) => {
                timer = setTimeout(resolve, timeout);
              }),
            ]);
          }
          return { result, events, transport: "electron-ipc" };
        } finally {
          clearTimeout(timer);
          unlisten();
        }
      },
      { command, args: request, eventName: EVENT, timeout: timeoutMs },
    );
  } catch {
    // Transport errors may include request data. Do not echo them into evidence.
    throw new Error(`persisted atom fixture transport failed: ${command}`);
  }
  requireProof(
    observation?.transport === "electron-ipc",
    "native IPC transport",
  );
  const result = parseProtocol(
    command === "persisted_atom_read"
      ? protocol.parseReadResult
      : protocol.parseUpdateResult,
    observation.result,
    "strict response protocol",
    request,
  );
  const events = observation.events.map((envelope) => {
    requireProof(envelope?.event === EVENT, "native event envelope");
    return parseProtocol(
      protocol.parseUpdateEvent,
      envelope.payload,
      "strict metadata-only event protocol",
    );
  });
  if (command === "persisted_atom_update" && result.changed) {
    requireProof(
      events.some((event) => event.storeRevision === result.storeRevision),
      "Main mutation broadcast revision",
    );
  }
  return { result, events };
}

function verifyFiles(files, appDataRoot, revision) {
  for (const [kind, filename] of [
    ["primary", "host-state.json"],
    ["backup", "host-state.json.bak"],
  ]) {
    const file = files?.[kind];
    requireProof(
      file?.path === path.join(appDataRoot, filename) &&
        file.validatedBy === "persistedAtomRecords.parseEnvelope" &&
        file.storeRevision === revision &&
        SHA256.test(file.sha256 ?? ""),
      `saved ${kind} envelope`,
    );
  }
  requireProof(
    files.primary.sha256 === files.backup.sha256,
    "same saved snapshot",
  );
  return Object.fromEntries(
    ["primary", "backup"].map((kind) => {
      const {
        path: filePath,
        storeRevision,
        sha256,
        validatedBy,
      } = files[kind];
      return [kind, { path: filePath, storeRevision, sha256, validatedBy }];
    }),
  );
}

function verifyExit(receipt, pid) {
  requireProof(
    receipt?.pid === pid &&
      receipt.exited === true &&
      receipt.exitCode === 0 &&
      receipt.signal === null &&
      receipt.mode === "normal",
    "complete normal Main process exit",
  );
}

/**
 * Driver owns launch/close and isolated-profile file IO. Shared wire parsers and
 * the existing file envelope owner are mandatory; fake drivers are unit evidence.
 */
export async function runPersistedAtomFixture({
  driver,
  protocol,
  appDataRoot,
  runId,
  timeoutMs = 10_000,
  intervalMs = 50,
}) {
  requireProof(path.isAbsolute(appDataRoot), "isolated absolute AppDataRoot");
  requireProof(/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(runId), "run identity");
  requireProof(timeoutMs > 0 && timeoutMs <= 60_000, "bounded timeout");
  requireProof(intervalMs > 0 && intervalMs <= timeoutMs, "bounded polling");
  const scope = (kind, id) => ({ workspaceId: `fixture-${runId}`, kind, id });
  const home = scope("home", "new-conversation");
  const local = scope("local", `session-${runId}`);
  const draftScope = scope("draft", `draft-tab-${runId}`);
  const otherScope = { ...draftScope, workspaceId: `other-${runId}` };
  const nullScope = { ...home, workspaceId: null };
  const identity = (suffix, version) => ({
    draftId: `draft-${runId}-${suffix}`,
    scopeVersion: `version-${suffix}-${version}`,
  });
  const a1 = identity("a", 1);
  const a2 = identity("a", 2);
  const b1 = identity("b", 1);
  const c1 = identity("c", 1);
  const d1 = identity("d", 1);
  const e1 = identity("e", 1);
  const f1 = identity("f", 1);
  const firstDraft = {
    document: { type: "doc", content: [] },
    text: "fixture 中😀",
  };
  const finalDraft = {
    document: {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "const n = 1;" }],
        },
      ],
    },
    text: "const n = 1;",
    selection: { from: 2, to: 4 },
    annotations: [{ kind: "fixture", label: "中😀" }],
    images: [{ source: "fixture-only.png", unavailable: true }],
  };
  let active;
  const commands = [];
  let mutationEvents = 0;
  const invoke = async (command, request) => {
    const observation = await observePersistedAtomCommand(
      active.page,
      protocol,
      command,
      request,
      { timeoutMs },
    );
    commands.push(command);
    mutationEvents += observation.events.length;
    return observation.result;
  };
  const read = (target) =>
    invoke("persisted_atom_read", {
      key: PERSISTED_ATOM_FIXTURE_KEY,
      query: { kind: "scope", scope: target },
    });
  const index = (workspaceId) =>
    invoke("persisted_atom_read", {
      key: PERSISTED_ATOM_FIXTURE_KEY,
      query: { kind: "workspace-index", workspaceId },
    });
  const update = (mutation) =>
    invoke("persisted_atom_update", {
      key: PERSISTED_ATOM_FIXTURE_KEY,
      mutation,
    });
  const put = (target, token, expectedVersion, draft) =>
    update({
      op: "put",
      scope: target,
      draftId: token.draftId,
      expectedVersion,
      nextVersion: token.scopeVersion,
      draft,
    });
  const readReady = async (target) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const result = await read(target);
      if (result.persistence.state !== "loading") return result;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new FixtureProofError(
      "persisted atom fixture failed: initial load timeout",
    );
  };
  try {
    active = await driver.launch({ appDataRoot, generation: 1 });
    const before = verifyIdentity(active, appDataRoot);
    expectEmpty(await readReady(home), "fresh Home scope after initial load");
    expectIndex(
      await index(home.workspaceId),
      home.workspaceId,
      [],
      "fresh workspace index",
    );
    expectOutcome(
      await put(home, a1, null, firstDraft),
      "applied",
      true,
      undefined,
      "create",
    );
    expectDraft(await read(home), a1, firstDraft, "create readback");
    expectIndex(
      await index(home.workspaceId),
      home.workspaceId,
      [[home, a1]],
      "Home current binding discoverable",
    );
    expectOutcome(
      await put(home, a2, a1.scopeVersion, finalDraft),
      "applied",
      true,
      undefined,
      "version update",
    );
    const stale = await put(
      home,
      identity("a", 3),
      a1.scopeVersion,
      firstDraft,
    );
    expectOutcome(
      stale,
      "conflict",
      false,
      "version_conflict",
      "stale writer CAS",
    );
    expectDraft(stale, a2, finalDraft, "CAS preserves latest draft");
    expectOutcome(
      await put(local, b1, null, firstDraft),
      "applied",
      true,
      undefined,
      "occupied target",
    );
    expectIndex(
      await index(home.workspaceId),
      home.workspaceId,
      [
        [home, a2],
        [local, b1],
      ],
      "Home and local bindings isolated to workspace",
    );
    const promotion = {
      op: "promote",
      source: home,
      target: local,
      identity: a2,
      expectedTarget: null,
      sessionId: local.id,
      threadId: `thread-${runId}`,
    };
    expectOutcome(
      await update(promotion),
      "conflict",
      false,
      "target_conflict",
      "promotion target CAS",
    );
    expectDraft(await read(home), a2, finalDraft, "conflicted source retained");
    expectDraft(
      await read(local),
      b1,
      firstDraft,
      "conflicted target retained",
    );
    expectOutcome(
      await update({ op: "clear", identity: b1 }),
      "applied",
      true,
      undefined,
      "explicit clear",
    );
    expectOutcome(
      await update(promotion),
      "applied",
      true,
      undefined,
      "scope promotion",
    );
    expectEmpty(await read(home), "promoted source unbound");
    const promoted = await read(local);
    expectDraft(
      promoted,
      a2,
      finalDraft,
      "promotion keeps identity and payload",
    );
    requireProof(
      scopeView(promoted, "promoted scope").entry.sessionId === local.id &&
        scopeView(promoted, "promoted scope").entry.threadId ===
          promotion.threadId,
      "session/thread metadata remain distinct",
    );
    expectOutcome(
      await update({ op: "consume", identity: a1 }),
      "conflict",
      false,
      "version_conflict",
      "old acceptance preserves newer version",
    );
    expectDraft(await read(local), a2, finalDraft, "old acceptance unchanged");
    const consumed = await update({ op: "consume", identity: a2 });
    expectOutcome(consumed, "applied", true, undefined, "exact acceptance");
    requireProof(
      consumed.entry?.state === "consumed" &&
        !Object.hasOwn(consumed.entry, "draft"),
      "tombstone contains no body",
    );
    expectEmpty(await read(local), "consumed scope unbound");
    expectIndex(
      await index(home.workspaceId),
      home.workspaceId,
      [],
      "cleared and consumed drafts absent from index",
    );
    expectOutcome(
      await put(local, identity("a", 3), null, firstDraft),
      "conflict",
      false,
      "retired_draft",
      "late put cannot resurrect",
    );
    expectOutcome(
      await put(local, c1, null, finalDraft),
      "applied",
      true,
      undefined,
      "new logical draft",
    );
    expectOutcome(
      await update({ op: "consume", identity: a2 }),
      "applied",
      false,
      undefined,
      "idempotent old acceptance",
    );
    expectDraft(
      await read(local),
      c1,
      finalDraft,
      "new logical draft survives old acceptance",
    );
    for (const [target, token] of [
      [draftScope, d1],
      [otherScope, e1],
      [nullScope, f1],
    ]) {
      expectOutcome(
        await put(target, token, null, firstDraft),
        "applied",
        true,
        undefined,
        "isolated workspace draft creation",
      );
    }
    const startedAt = Date.now();
    let saved;
    while (Date.now() - startedAt < timeoutMs) {
      const candidate = await read(local);
      expectDraft(
        candidate,
        c1,
        finalDraft,
        "saved polling keeps current draft",
      );
      if (
        candidate.persistence.state === "error" ||
        candidate.persistence.state === "unavailable"
      ) {
        throw new FixtureProofError(
          "persisted atom fixture failed: disk save unavailable",
        );
      }
      if (
        candidate.persistence.state === "saved" &&
        candidate.persistence.savedRevision === candidate.storeRevision
      ) {
        saved = candidate;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    requireProof(saved !== undefined, "real saved revision receipt");
    const indexSnapshots = [];
    for (const [workspaceId, expected] of [
      [
        home.workspaceId,
        [
          [local, c1],
          [draftScope, d1],
        ],
      ],
      [otherScope.workspaceId, [[otherScope, e1]]],
      [null, [[nullScope, f1]]],
    ]) {
      const result = await index(workspaceId);
      indexSnapshots.push(
        expectIndex(
          result,
          workspaceId,
          expected,
          "saved workspace index isolation",
        ),
      );
      requireProof(
        result.storeRevision === saved.storeRevision &&
          result.persistence.state === "saved" &&
          result.persistence.savedRevision === saved.storeRevision,
        "index and saved file metadata revision",
      );
    }
    const files = verifyFiles(
      await driver.inspectFiles({ appDataRoot }),
      appDataRoot,
      saved.storeRevision,
    );
    const firstExit = await driver.close(active);
    verifyExit(firstExit, before.pid);
    active = null;
    active = await driver.launch({ appDataRoot, generation: 2 });
    const after = verifyIdentity(active, appDataRoot);
    requireProof(after.pid !== before.pid, "new Main PID after full exit");
    requireProof(
      after.hostSha256 === before.hostSha256 &&
        after.preloadSha256 === before.preloadSha256 &&
        after.eventEmissionGuard.sourceSha256 ===
          before.eventEmissionGuard.sourceSha256,
      "same Host/preload artifacts across restart",
    );
    const restored = await readReady(local);
    expectDraft(
      restored,
      c1,
      finalDraft,
      "same scope/version after real restart",
    );
    requireProof(
      restored.storeRevision === saved.storeRevision &&
        restored.persistence.state === "saved" &&
        restored.persistence.savedRevision === saved.storeRevision,
      "restart saved revision unchanged",
    );
    const restoredIndexSnapshots = [];
    for (const [workspaceId, expected] of [
      [
        home.workspaceId,
        [
          [local, c1],
          [draftScope, d1],
        ],
      ],
      [otherScope.workspaceId, [[otherScope, e1]]],
      [null, [[nullScope, f1]]],
    ]) {
      const result = await index(workspaceId);
      restoredIndexSnapshots.push(
        expectIndex(
          result,
          workspaceId,
          expected,
          "workspace index discovered after normal restart",
        ),
      );
      requireProof(
        result.storeRevision === saved.storeRevision &&
          result.persistence.state === "saved" &&
          result.persistence.savedRevision === saved.storeRevision,
        "restart index saved revision unchanged",
      );
    }
    requireProof(
      digest(indexSnapshots) === digest(restoredIndexSnapshots),
      "same detached index metadata across restart",
    );
    expectEmpty(
      await read(home),
      "promoted/consumed Home remains absent after restart",
    );
    expectOutcome(
      await put(local, identity("a", 4), null, firstDraft),
      "conflict",
      false,
      "retired_draft",
      "tombstone survives restart",
    );
    expectDraft(
      await read(local),
      c1,
      finalDraft,
      "restored new draft protected",
    );
    const secondExit = await driver.close(active);
    verifyExit(secondExit, after.pid);
    active = null;
    return {
      schemaVersion: 1,
      scenario: "persisted-atom-host-ipc-restart",
      proofLevel: "Desktop persistence",
      runtimeGate: false,
      guiDraftRestoration: false,
      realRuntimeAcceptance: false,
      result: "pass",
      runId,
      appDataRoot,
      pids: [before.pid, after.pid],
      hostSha256: before.hostSha256,
      preloadSha256: before.preloadSha256,
      rendererEventEmissionGuardSha256: before.eventEmissionGuard.sourceSha256,
      scope: local,
      identity: c1,
      draftSha256: digest(finalDraft),
      savedRevision: saved.storeRevision,
      workspaceIndexSnapshots: indexSnapshots,
      restoredWorkspaceIndexSnapshots: restoredIndexSnapshots,
      files,
      commands: [...new Set(commands)],
      ipcInvocationCount: commands.length,
      nativeMetadataEventCount: mutationEvents,
      normalExitCount: 2,
      cases: [
        "create",
        "update",
        "CAS-conflict",
        "promotion-target-conflict",
        "clear",
        "promote",
        "old-version-consume-conflict",
        "consume",
        "late-put",
        "new-draft-protection",
        "saved-receipt",
        "primary-backup",
        "new-PID-restart",
        "same-scope-version-read",
        "restart-tombstone",
        "same-atom-workspace-index",
        "Home-draft-local-current-binding",
        "workspace-and-null-isolation",
        "consumed-index-removal",
        "index-file-revision",
        "restart-index-discovery",
      ],
      unknown: [
        "GUI rich-draft hydration",
        "App Server acceptance",
        "Windows process",
        "force kill/power loss durability",
      ],
    };
  } catch (error) {
    // Never serialize Host errors, rejected payloads, or user draft data.
    if (error instanceof FixtureProofError) throw error;
    throw new Error("persisted atom Host IPC/restart fixture did not complete");
  } finally {
    if (active) await driver.close(active).catch(() => undefined);
  }
}
