import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  assertFirstSendConsumed,
  assertFirstSendNewEdit,
  assertFirstSendReceipt,
  assertFirstSendResourceReceipt,
  assertFirstSendSavedFiles,
  assertFirstSendScopeObservation,
  assertFirstSendSource,
  assertFirstSendRouteCoverage,
  assertFirstSendTrace,
  assertUnboundScope,
  captureFirstSendResources,
  firstSendRoutes,
  newEditText,
  requireFirstSend,
} from "../electron/lib/composer-first-send-evidence.mjs";

const markerByRoute = {
  home: "Home首发甲一号",
  "search-new": "搜索新建首发乙二号",
  "project-new": "项目新建首发丙三号",
};

async function until(context, read, ready, phase) {
  const started = Date.now();
  while (Date.now() - started < context.options.timeoutMs) {
    const value = await read();
    if (ready(value)) return value;
    await new Promise((resolve) =>
      setTimeout(resolve, context.options.intervalMs),
    );
  }
  throw new Error("Composer first-send fixture timed out: " + phase);
}

async function canonicalThreads(context) {
  const response = await context.modules.rpc.invokeAppServerFromPage(
    context.page,
    "thread/list",
    { archived: false, limit: 100 },
  );
  requireFirstSend(
    Array.isArray(response.result?.data) && !response.result.nextCursor,
    "bounded complete canonical inventory through public RPC",
  );
  return response.result.data;
}

async function readThread(context, threadId) {
  const response = await context.modules.rpc.invokeAppServerFromPage(
    context.page,
    "thread/read",
    { threadId, includeTurns: true },
  );
  requireFirstSend(
    response.result?.thread?.id === threadId,
    "canonical read identity",
  );
  return response.result.thread;
}

async function visibleSurface(context) {
  return context.page.evaluate(
    context.modules.dom.withComposerEditorDom(() => {
      const editors = findVisibleComposerEditorsDom();
      const editor = editors.length === 1 ? editors[0] : null;
      return {
        electron: window.__LIME_ELECTRON__ === true,
        preload:
          typeof window.electronAPI?.invoke === "function" &&
          window.electronAPI.devBridgeFallback === false,
        editorCount: editors.length,
        text: editor ? readComposerEditorTextDom(editor) : null,
        sessionId: editor?.dataset.sessionId || null,
        disabled: editor
          ? editor.getAttribute("aria-disabled") === "true" ||
            editor.getAttribute("contenteditable") !== "true"
          : true,
        emptyState: Boolean(
          document.querySelector('[data-testid="empty-state-first-screen"]'),
        ),
      };
    }),
  );
}

async function openRealHome(context, record) {
  await context.modules.rpc.bindGuiWorkspaceAndModelPreferences(
    context.page,
    record.workspaceId,
  );
  // Public Home delegates to startNewConversation with explicit projectless scope.
  await context.page.getByTestId("app-sidebar-home-button").click();
  await until(
    context,
    () => visibleSurface(context),
    (dom) =>
      dom.editorCount === 1 &&
      dom.sessionId === null &&
      dom.disabled === false &&
      dom.emptyState === true,
    "real Home button committed the new-task null-session surface",
  );
}

async function openRealDraft(context, record, projectNew) {
  if (projectNew) {
    const bootstrap = await context.modules.drafts.openRecord(context, record);
    requireFirstSend(
      bootstrap.turns.length === 0,
      "navigation-only bootstrap thread has never been submitted",
    );
    const group = context.page
      .getByTestId("app-sidebar-project-conversation-group")
      .filter({
        has: context.page
          .locator("button[aria-expanded]")
          .and(context.page.getByTitle(record.workspaceName, { exact: true })),
      });
    requireFirstSend(
      (await group.count()) === 1,
      "exactly one genuine project group matches the canonical workspace name",
    );
    await group.locator("button[aria-expanded]").hover();
    await group.getByTestId("app-sidebar-project-new-conversation").click();
  } else {
    await openRealHome(context, record);
    // The search creation entry delegates to the same public fresh action.
    await context.page.getByTestId("app-sidebar-search-button").click();
    await context.page
      .getByTestId("app-sidebar-search-new-conversation")
      .click();
  }
  await until(
    context,
    () => visibleSurface(context),
    (value) =>
      value.editorCount === 1 &&
      value.sessionId === null &&
      value.disabled === false,
    "real public create entry exposes one null-session Composer",
  );
  return {
    ...record,
    sessionId: null,
    threadId: null,
    workspaceId: projectNew ? record.workspaceId : null,
    scope: {
      workspaceId: projectNew ? record.workspaceId : null,
      kind: "home",
      id: "new-conversation",
    },
    navigationOnlyBootstrapSessionId: record.sessionId,
  };
}

async function createSourceRecord(context, route) {
  const title = "Composer first-send " + context.options.runId + " " + route;
  const marker = markerByRoute[route];
  let record;
  if (route === "home" || route === "search-new") {
    const workspace = await context.modules.rpc.ensureDefaultWorkspace(
      context.page,
    );
    record = {
      title,
      marker,
      rootPath: workspace.rootPath,
      workspaceId: workspace.workspaceId,
      sessionId: null,
      threadId: null,
      scope: {
        workspaceId: workspace.workspaceId,
        kind: "home",
        id: "new-conversation",
      },
    };
    if (route === "home") {
      await openRealHome(context, record);
      record.workspaceId = null;
      record.scope = {
        workspaceId: null,
        kind: "home",
        id: "new-conversation",
      };
    } else {
      record = await openRealDraft(context, record, false);
    }
  } else {
    const rootPath = path.join(
      context.runtimeEnv.tempRoot,
      "first-send-" + route,
    );
    await fs.mkdir(rootPath);
    const bootstrap = await context.modules.drafts.createRecord(context, {
      rootPath,
      title,
      marker,
    });
    record = await openRealDraft(context, bootstrap, route === "project-new");
  }
  record.path = path.join(
    context.runtimeEnv.tempRoot,
    "first-send-" + route + ".md",
  );
  record.pathName = path.basename(record.path);
  await fs.writeFile(
    record.path,
    "# First-send path reference\n" + marker + "\n",
  );
  return record;
}

async function readWorkspaceIndex(context, workspaceId) {
  const observed = await context.modules.atom.observePersistedAtomCommand(
    context.page,
    context.protocol,
    "persisted_atom_read",
    {
      key: "composer-drafts-v1",
      query: { kind: "workspace-index", workspaceId },
    },
    { timeoutMs: context.options.timeoutMs },
  );
  return observed.result;
}

async function observeNativeSource(context, route, record, expectedMarker) {
  return until(
    context,
    async () => {
      const workspaceIndex = await readWorkspaceIndex(
        context,
        record.workspaceId,
      );
      const kind = "home";
      const items = workspaceIndex.data?.items?.filter(
        (item) => item.scope?.kind === kind,
      );
      // Fail closed on absent or ambiguous metadata. No fallback scope/Thread.
      if (items?.length !== 1) return null;
      const scopeRead = await context.modules.drafts.readScope(
        context,
        items[0].scope,
      );
      return {
        workspaceId: record.workspaceId,
        workspaceIndex,
        scopeRead,
        expectedMarker,
        dom: await visibleSurface(context),
      };
    },
    (value) => {
      try {
        assertFirstSendScopeObservation(route, value ?? {});
        return true;
      } catch {
        return false;
      }
    },
    "unique same-atom metadata and saved payload match the sole real Composer",
  );
}

async function sourceBeforeSend(context, route, record) {
  // Typing must not create a canonical session before the public Send action.
  const beforeThreads = await canonicalThreads(context);
  const probe = "Scope probe " + context.options.runId + " " + route;
  await context.modules.dom.fillComposerEditor(context.page, probe, null);
  const discovered = await observeNativeSource(context, route, record, probe);
  requireFirstSend(
    discovered.dom.text === probe &&
      discovered.scopeRead.data.view.entry.draft.document.text === probe &&
      (record.scope === null ||
        isDeepStrictEqual(record.scope, discovered.scopeRead.data.view.scope)),
    "real probe matches exact visible and saved text before scope binding",
  );
  record.scope = discovered.scopeRead.data.view.scope;
  const original = await context.modules.drafts.prepareVisibleDraft(
    context,
    record,
  );
  await context.modules.drafts.verifyVisibleDraft(context, record, original);
  const observed = await observeNativeSource(
    context,
    route,
    record,
    record.marker,
  );
  const expected = context.expected(record);
  const skillPath = await fs.realpath(
    path.join(
      context.runtimeEnv.env.HOME,
      ".agents",
      "skills",
      "capability-report",
      "SKILL.md",
    ),
  );
  requireFirstSend(
    (await fs.stat(skillPath)).isFile(),
    "installed Skill identity points to the real fixture SKILL.md",
  );
  const skillIdentity = {
    name: "capability-report",
    key: "user:capability-report",
    path: skillPath,
  };
  const literal = context.modules.marks.composerMarksFixture({
    prompt: expected.prompt,
    skillIdentity,
    pasteText: expected.pasteText,
  });
  const expectedSubmission = {
    ...literal,
    text: literal.text + " " + record.marker,
    displayText: literal.displayText + " " + record.marker,
  };
  requireFirstSend(
    original.dom.text === expectedSubmission.displayText,
    "independent fixed Markdown fixture matches the current rendered rich draft",
  );
  const resources = captureFirstSendResources(original.entry, {
    ...expected,
    skillIdentity,
    expectedSubmission,
    skillFileSha256: createHash("sha256")
      .update(await fs.readFile(skillPath))
      .digest("hex"),
  });
  const preparedThreads = await canonicalThreads(context);
  return {
    proof: {
      ...assertFirstSendSource(route, {
        ...observed,
        scope: record.scope,
        entry: original.entry,
        beforeThreads,
        preparedThreads,
      }),
      scopeDiscovery: assertFirstSendScopeObservation(route, discovered),
      resources,
    },
    // Raw body/media stay local to this run; only resource metadata is logged.
    receiptExpected: {
      expectedSubmission,
      prompt: expected.prompt,
      editorText: original.dom.text,
      skillIdentity,
      skillToken: original.dom.tokens.find((token) => token.type === "skill"),
      pasteToken: original.dom.tokens.find((token) => token.type === "paste"),
      pasteText: expected.pasteText,
      imageBase64: expected.imageBase64,
      pathReference: { name: record.pathName, path: record.path },
    },
  };
}

async function clickSendAndReadReceipt(
  context,
  record,
  source,
  receiptExpected,
) {
  await context.page
    .locator(context.modules.dom.composerEditorSelector() + ":visible")
    .locator('xpath=ancestor::*[@data-testid="inputbar-core-container"][1]')
    .getByTestId("send-btn")
    .click();
  const dom = await until(
    context,
    () => visibleSurface(context),
    (value) => value.editorCount === 1 && value.sessionId && !value.disabled,
    "accepted ready callback exposes the genuine local Composer",
  );
  const threads = await canonicalThreads(context);
  const thread = threads.find((item) => item.sessionId === dom.sessionId);
  requireFirstSend(thread, "visible accepted session has a canonical thread");
  const expected = context.expected(record);
  const fragments = [
    expected.prompt,
    record.marker,
    expected.pasteText,
    "const value = '中😀';",
  ];
  const accepted = await until(
    context,
    () => readThread(context, thread.id),
    (value) => {
      try {
        assertFirstSendReceipt(value, source, fragments);
        return true;
      } catch {
        return false;
      }
    },
    "accepted first-send canonical Turn and independently expected body fragments",
  );
  const receipt = assertFirstSendReceipt(accepted, source, fragments);
  const mediaRead = await context.modules.launcher.appServerCallFromPage(
    context.page,
    "media/read",
    { threadId: receipt.threadId, uri: source.resources.image.canonicalUrl },
  );
  const { summarizeRichInputSubmission } = await import(
    pathToFileURL(
      path.join(
        context.options.repoRoot,
        "scripts/agent-runtime/claw-chat-current-fixture-rich-input-evidence.mjs",
      ),
    ).href
  );
  const richInput = summarizeRichInputSubmission({
    ...receiptExpected,
    canonical: { thread: accepted },
    threadId: receipt.threadId,
    turnId: receipt.turnId,
    traceRaw: (
      await context.modules.history.readComposerHistorySnapshot(
        context.page,
        receipt.sessionId,
      )
    ).traceRaw,
    mediaRead,
  });
  return {
    ...receipt,
    richInput: assertFirstSendResourceReceipt(source, receipt, {
      richInput,
      mediaRead,
      expectedSubmission: receiptExpected.expectedSubmission,
    }),
  };
}

async function waitUnbound(context, scope) {
  return until(
    context,
    () => context.modules.drafts.readScope(context, scope),
    (result) => {
      try {
        assertUnboundScope(result, scope);
        return true;
      } catch {
        return false;
      }
    },
    "native exact scope unbound after accepted consumption",
  );
}

async function acceptedNewEdit(fixture, context, record, source, receipt) {
  const local = {
    ...record,
    sessionId: receipt.sessionId,
    threadId: receipt.threadId,
    scope: {
      workspaceId: record.workspaceId,
      kind: "local",
      id: receipt.sessionId,
    },
  };
  const oldScope = await waitUnbound(context, record.scope);
  const localScope = await waitUnbound(context, local.scope);
  requireFirstSend(
    oldScope.storeRevision === localScope.storeRevision,
    "old and accepted local scopes acknowledge the same saved consumption",
  );
  const consumed = await fixture.inspectSavedFiles(
    localScope.storeRevision,
    (envelope) => assertFirstSendConsumed(envelope, source, receipt),
  );
  assertFirstSendSavedFiles(consumed, {
    ...source.identity,
    sameCapturedIdentity: true,
    sessionId: receipt.sessionId,
    threadId: receipt.threadId,
  });
  // Real contenteditable input; no Controller, PM-state or native-atom injection.
  await context.modules.dom.fillComposerEditor(
    context.page,
    newEditText,
    receipt.sessionId,
  );
  const saved = await context.modules.drafts.waitSaved(context, local);
  const entry = saved.data.view.entry;
  const newEdit = assertFirstSendNewEdit(entry, source, receipt);
  const original = {
    entry,
    dom: await context.modules.history.readComposerHistorySnapshot(
      context.page,
      receipt.sessionId,
    ),
  };
  await context.modules.rpc.invokeAppServerFromPage(
    context.page,
    "turn/interrupt",
    {
      threadId: receipt.threadId,
      turnId: receipt.turnId,
    },
  );
  const terminal = await until(
    context,
    () => readThread(context, receipt.threadId),
    (thread) =>
      thread.turns?.length === 1 &&
      thread.turns[0].id === receipt.turnId &&
      ["interrupted", "canceled", "cancelled"].includes(thread.turns[0].status),
    "public canonical interrupt settles the accepted old Turn",
  );
  await context.modules.drafts.verifyVisibleDraft(context, local, original);
  const final = await context.modules.drafts.waitSaved(context, local);
  requireFirstSend(
    isDeepStrictEqual(final.data.view.entry, entry),
    "old accepted Turn completion preserves exact new document and identity",
  );
  await waitUnbound(context, record.scope);
  const newFiles = await fixture.inspectSavedFiles(
    final.storeRevision,
    (envelope) => {
      const disk = envelope.atoms["composer-drafts-v1"].entries[entry.draftId];
      requireFirstSend(
        isDeepStrictEqual(disk, entry),
        "new local draft equals actual saved bytes",
      );
      return assertFirstSendNewEdit(disk, source, receipt);
    },
  );
  assertFirstSendSavedFiles(newFiles, {
    draftId: entry.draftId,
    scopeVersion: entry.scopeVersion,
    newEditPreserved: true,
    documentSha256: newEdit.documentSha256,
  });
  return {
    oldScope: assertUnboundScope(oldScope, record.scope),
    acceptedLocalScope: assertUnboundScope(localScope, local.scope),
    consumedFiles: consumed,
    newEdit,
    savedNewEditFiles: newFiles,
    terminalStatus: terminal.turns[0].status,
    exactPendingAcceptanceRace: false,
    interruptSurface: "preload -> App Server turn/interrupt",
  };
}

/** Inject into the sole shared launcher/lifecycle driver after root adoption. */
export const firstSendScenario = Object.freeze({
  id: "composer-first-submissions",
  scope:
    "Home restore, projectless search New and project New first submissions through startNewConversation",
  generationCount: 3,
  sourcePaths: [
    "scripts/agent-runtime/claw-chat-current-fixture-first-send.mjs",
    "scripts/electron/lib/composer-first-send-evidence.mjs",
    "scripts/agent-runtime/claw-chat-current-fixture-draft-persistence.mjs",
    "scripts/electron/lib/composer-draft-fixture-evidence.mjs",
    "src/components/agent/chat/workspace/useTaskCenterDraftSendRuntime.ts",
    "src/components/agent/chat/workspace/useTaskCenterDraftSendDispatchRuntime.ts",
    "src/components/agent/chat/workspace/useAgentChatWorkspaceCommandWiring.ts",
    "src/components/agent/chat/workspace/agentChatWorkspaceHelpers.ts",
    "src/components/agent/chat/workspace/useWorkspaceTaskCenterSendRuntime.ts",
    "src/components/input-kit/ComposerDraftCoordinator.ts",
    "src/lib/workspace/navigation.ts",
    "src/hooks/useAppNavigation.ts",
    "src/components/agent/chat/workspace/useWorkspaceComposerDraftNavigation.ts",
    "src/components/agent/chat/workspace/useWorkspaceComposerDraftRuntime.ts",
    "src/components/AppSidebar.tsx",
    "src/components/agent/chat/workspace/useTaskCenterTabChrome.tsx",
    "src/components/agent/chat/workspace/taskCenterTabProjection.ts",
    "src/components/app-sidebar/AppSidebarSearchDialog.tsx",
    "src/components/app-sidebar/AppSidebarProjectConversationGroups.tsx",
    "src/components/app-sidebar/useAppSidebarConversationActions.ts",
    "src/lib/api/persistedAtomTypes.ts",
    "src/lib/api/persistedAtomProtocol.ts",
    "scripts/lib/composer-editor-dom.mjs",
    "scripts/electron/mcp-config-fixture-smoke.mjs",
    "scripts/agent-runtime/claw-chat-current-fixture-rich-input-evidence.mjs",
    "scripts/agent-runtime/claw-chat-current-fixture-skill-identity.mjs",
    "scripts/electron/lib/mcp-config-fixture-evidence.mjs",
    "src/components/input-kit/composerSerialization.ts",
    "src/components/input-kit/composerLinks.ts",
    "src/components/agent/chat/utils/buildUserInputSubmitOp.ts",
    "src/components/agent/chat/workspace/inputCapabilityRouting.ts",
    "lime-rs/crates/app-server/src/runtime/input_media.rs",
    "lime-rs/crates/app-server/src/processor/thread/projection/item.rs",
    "lime-rs/crates/app-server-protocol/src/protocol/v2/media.rs",
  ],
  limitations: [
    "Requires root-adopted scenario driver and shared visible-editor helpers; no product build or Electron launch was performed while preparing this candidate.",
    "Navigation-only bootstrap threads are never submitted or counted as first-send coverage.",
    "Public Home/search/project-new-conversation clicks and exact same-atom stable home metadata identify the editing source; no top strip or draft picker is involved.",
    "All three entries use the same typed first-send path; canonical inventory must show no session created by editor input before Send.",
    "New edit follows disk-acknowledged consume; exact pending old-token acceptance timing is not claimed.",
    "Public RPC interrupt is used; GUI Stop, queue acceptance and rejection routes are not covered.",
    "Normal process lifecycle is checked by the shared driver; this scenario does not claim cold rich-draft restoration.",
    "Shared rich-input ingress uses synthetic ClipboardEvent/DataTransfer/DragEvent; OS clipboard and OS drag are not covered.",
  ],
  async run(fixture) {
    requireFirstSend(
      [
        "launch",
        "quit",
        "stopTrace",
        "inspectSavedFiles",
        "recordStage",
        "setPhase",
      ].every((name) => typeof fixture?.[name] === "function"),
      "root-adopted shared scenario driver contract",
    );
    const proofs = [];
    for (const [index, route] of firstSendRoutes.entries()) {
      const context = await fixture.launch(index + 1);
      fixture.setPhase("first-send-" + route + "-source");
      requireFirstSend(
        [
          "createRecord",
          "openRecord",
          "readScope",
          "waitSaved",
          "prepareVisibleDraft",
          "verifyVisibleDraft",
        ].every((name) => typeof context.modules.drafts?.[name] === "function"),
        "root-adopted shared visible-editor action contract",
      );
      const record = await createSourceRecord(context, route);
      const source = await sourceBeforeSend(context, route, record);
      fixture.recordStage(route + "-actual-first-send-source", source.proof);
      fixture.setPhase("first-send-" + route + "-accepted");
      const receipt = await clickSendAndReadReceipt(
        context,
        record,
        source.proof,
        source.receiptExpected,
      );
      const settled = await acceptedNewEdit(
        fixture,
        context,
        record,
        source.proof,
        receipt,
      );
      const trace = assertFirstSendTrace(await fixture.stopTrace());
      const proof = {
        route,
        workspaceId: record.workspaceId,
        source: source.proof,
        receipt,
        ...settled,
        trace,
      };
      fixture.recordStage(
        route + "-accepted-promotion-consumption-new-edit",
        proof,
      );
      proofs.push(proof);
      await fixture.quit();
    }
    assertFirstSendRouteCoverage(proofs);
    return {
      guiDraftRestoration: false,
      firstSubmissionRoutesVerified: true,
      logicalDraftScopeOnly: true,
      visibleTabIdentityVerified: false,
      firstSubmissionRoutes: proofs,
      records: proofs.map((proof) => ({
        route: proof.route,
        workspaceId: proof.workspaceId,
        ...proof.receipt,
        sourceIdentity: proof.source.identity,
        newEditIdentity: {
          draftId: proof.newEdit.draftId,
          scopeVersion: proof.newEdit.scopeVersion,
        },
      })),
    };
  },
});
