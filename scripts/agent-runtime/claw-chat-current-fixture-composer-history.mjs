import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  canonicalSkillProjection,
  isExpectedSkillIdentity,
} from "./claw-chat-current-fixture-skill-identity.mjs";
import { composerEditorSelector } from "../lib/composer-editor-dom.mjs";
import { appServerCallFromPage } from "../electron/mcp-config-fixture-smoke.mjs";
import {
  isObservedPreloadAppServerResponse,
  parseJsonRpcRequestsFromInvokeTrace,
} from "../electron/lib/mcp-config-fixture-evidence.mjs";
import { assert, sleep } from "./claw-chat-current-fixture-utils.mjs";
import {
  composerMarksMatch,
  withComposerMarksDom,
} from "./claw-chat-current-fixture-composer-marks.mjs";

const INPUT_METHODS = new Set([
  "turn/start",
  "turn/steer",
  "thread/queue/add",
  "thread/queue/update",
  "thread/queue/start",
]);

// Reconstruct only the rendered document. Paste source text remains private;
// its initial wire expansion and Controller recovery tests are separate proof.
function readHistorySnapshotDom({ sessionId }) {
  const editors = findVisibleComposerEditorsDom(sessionId);
  const editor = editors.length === 1 ? editors[0] : null;
  const container = editor?.closest('[data-testid="inputbar-core-container"]');
  const readNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE)
      return { type: "text", text: node.nodeValue };
    if (!(node instanceof HTMLElement)) return null;
    if (node.matches("br.ProseMirror-trailingBreak")) return null;
    if (node.tagName === "BR") return { type: "hard_break" };
    const kind = node.getAttribute("data-composer-token");
    if (kind) {
      return {
        type: kind,
        id: node.getAttribute("data-composer-id"),
        name: node.getAttribute("data-composer-name"),
        path: node.getAttribute("data-composer-path"),
        label: node.textContent,
        editable: node.getAttribute("contenteditable"),
      };
    }
    return {
      type: node.tagName.toLowerCase(),
      content: Array.from(node.childNodes).map(readNode).filter(Boolean),
    };
  };
  const documentProjection = editor
    ? Array.from(editor.childNodes).map(readNode).filter(Boolean)
    : null;
  const tokens = editor
    ? Array.from(editor.querySelectorAll("[data-composer-token]")).map(readNode)
    : [];
  const images = Array.from(container?.querySelectorAll("img") ?? [])
    .filter((node) => node.getAttribute("src")?.startsWith("data:image/"))
    .map((node) => ({
      src: node.getAttribute("src"),
      decoded: node.complete && node.naturalWidth > 0 && node.naturalHeight > 0,
    }));
  const paths = Array.from(
    container?.querySelectorAll(
      '[data-testid="inputbar-path-reference-chip"]',
    ) ?? [],
  ).map((node) => ({
    id: node.getAttribute("data-reference-id"),
    path: node.getAttribute("data-reference-path"),
    isDir: node.getAttribute("data-reference-is-dir"),
    name: node.getAttribute("title"),
  }));
  return {
    electron: window.__LIME_ELECTRON__ === true,
    preload: typeof window.electronAPI?.invoke === "function",
    editorCount: editors.length,
    sessionId: editor?.dataset.sessionId ?? null,
    disabled:
      !editor ||
      editor.getAttribute("aria-disabled") === "true" ||
      editor.getAttribute("contenteditable") !== "true",
    text: editor ? readComposerEditorTextDom(editor) : null,
    documentProjection,
    marks: editor ? readComposerMarksDom(editor) : null,
    tokens,
    images,
    paths,
    traceRaw: localStorage.getItem("lime_invoke_trace_buffer_v1"),
  };
}

export async function readComposerHistorySnapshot(page, sessionId) {
  return page.evaluate(withComposerMarksDom(readHistorySnapshotDom), {
    sessionId,
  });
}

export function installComposerHistoryKeyboardObserverDom(node) {
  const events = [];
  const handler = (event) => {
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    events.push({
      key: event.key,
      trusted: event.isTrusted,
      sessionId: node.dataset.sessionId,
      focused: document.activeElement === node,
      defaultPrevented: event.defaultPrevented,
    });
  };
  // Register after EditorView on the same node so its bubble handler has
  // already consumed the key. Capture-phase microtasks can run too early.
  node.addEventListener("keydown", handler);
  window.__composerHistoryObserver = { node, handler, events };
}

export function takeComposerHistoryKeyboardEventsDom() {
  const observer = window.__composerHistoryObserver;
  observer.node.removeEventListener("keydown", observer.handler);
  delete window.__composerHistoryObserver;
  return observer.events;
}

export async function prepareHistoryPaste(page, sessionId, text) {
  const editor = page.locator(`${composerEditorSelector(sessionId)}:visible`);
  await editor.focus();
  await editor.press("ControlOrMeta+End");
  await page.keyboard.insertText(" ");
  await editor.evaluate((node, text) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      }),
    );
  }, text);
  const snapshot = await readComposerHistorySnapshot(page, sessionId);
  const pastes = snapshot.tokens.filter((token) => token.type === "paste");
  assert(
    isLiveSnapshot(snapshot, sessionId) &&
      pastes.length === 1 &&
      pastes[0].id &&
      pastes[0].editable === "false",
    "large paste 未通过真实 EditorView paste 入口形成唯一 atom",
  );
  return pastes[0];
}

export async function observeHistorySkillCapability(
  page,
  sessionId,
  skillName,
  active,
  timeoutMs,
) {
  const trigger = page
    .locator(`${composerEditorSelector(sessionId)}:visible`)
    .locator(
      'xpath=ancestor::*[@data-testid="inputbar-core-container"][1]//*[@data-testid="inputbar-plus-trigger"]',
    );
  await trigger.click();
  await page.locator('[data-testid="inputbar-plus-skills"]:visible').click();
  const panel = page.locator(
    '[data-testid="inputbar-plus-panel-skills"]:visible',
  );
  await panel.waitFor({
    state: "visible",
    timeout: Math.min(timeoutMs, 10_000),
  });
  await page.waitForFunction(
    ({ active, skillName }) => {
      const panels = Array.from(
        document.querySelectorAll('[data-testid="inputbar-plus-panel-skills"]'),
      ).filter(
        (node) =>
          node instanceof HTMLElement && node.getClientRects().length > 0,
      );
      if (panels.length !== 1) return false;
      const clear = panels[0].querySelector(
        '[data-testid="skill-selector-clear"]',
      );
      return active
        ? !!clear &&
            (clear.parentElement?.textContent ?? "").includes(skillName)
        : !clear;
    },
    { active, skillName },
    { timeout: Math.min(timeoutMs, 10_000) },
  );
  const observation = await panel.evaluate((node) => {
    const clear = node.querySelector('[data-testid="skill-selector-clear"]');
    return {
      panelObserved: true,
      active: !!clear,
      selectionLabel: clear?.parentElement?.textContent ?? null,
    };
  });
  await trigger.click();
  await panel.waitFor({
    state: "hidden",
    timeout: Math.min(timeoutMs, 10_000),
  });
  return observation;
}

function isLiveSnapshot(snapshot, sessionId) {
  return (
    snapshot?.electron === true &&
    snapshot.preload === true &&
    snapshot.editorCount === 1 &&
    snapshot.sessionId === sessionId &&
    snapshot.disabled === false
  );
}

function isEmptySnapshot(snapshot) {
  return (
    snapshot?.text === "" &&
    snapshot.tokens?.length === 0 &&
    snapshot.images?.length === 0 &&
    snapshot.paths?.length === 0
  );
}

function userItems(read) {
  return (Array.isArray(read?.thread?.turns) ? read.thread.turns : []).flatMap(
    (turn) =>
      (Array.isArray(turn.items) ? turn.items : [])
        .filter((item) => item?.type === "userMessage")
        .map((item) => ({ turnId: turn.id, item })),
  );
}

function inputRequests(raw, threadId) {
  if (!Array.isArray(JSON.parse(raw)))
    throw new Error("history invoke trace 必须为数组");
  return parseJsonRpcRequestsFromInvokeTrace(raw).filter(
    (request) =>
      request.params.threadId === threadId && INPUT_METHODS.has(request.method),
  );
}

function summarizeTextIdentity(text) {
  return typeof text === "string"
    ? {
        length: text.length,
        sha256: createHash("sha256").update(text).digest("hex"),
      }
    : null;
}

export function summarizeComposerHistoryRecall({
  prepared,
  cleared,
  recalled,
  returned,
  beforeRead,
  afterRead,
  threadId,
  sessionId,
  skillIdentity,
  expectedSubmission,
  expectedMarks = expectedSubmission?.marks,
  backendText,
  keyboardActions,
  keyboardEvents,
  imageDataUrl,
  pathReference,
}) {
  const liveEditorObserved = [prepared, cleared, recalled, returned].every(
    (snapshot) => isLiveSnapshot(snapshot, sessionId),
  );
  const emptyDraftReturned =
    isEmptySnapshot(cleared) &&
    isEmptySnapshot(returned) &&
    isDeepStrictEqual(cleared.documentProjection, returned.documentProjection);
  let preparedProjection;
  let recalledProjection;
  let preparedTokens;
  let recalledTokens;
  try {
    preparedProjection = canonicalSkillProjection(
      prepared?.documentProjection,
      skillIdentity,
    );
    recalledProjection = canonicalSkillProjection(
      recalled?.documentProjection,
      skillIdentity,
    );
    preparedTokens = canonicalSkillProjection(prepared?.tokens, skillIdentity);
    recalledTokens = canonicalSkillProjection(recalled?.tokens, skillIdentity);
  } catch {
    // An alias is valid only when it resolves to the actual fixture Skill.
  }
  const renderedDocumentPreserved =
    Array.isArray(prepared?.documentProjection) &&
    prepared.documentProjection.length > 0 &&
    !!preparedProjection &&
    !!recalledProjection &&
    isDeepStrictEqual(preparedProjection, recalledProjection);
  const marksSemanticsPreserved =
    !!expectedMarks &&
    [prepared, recalled].every((snapshot) =>
      composerMarksMatch(snapshot, expectedMarks, sessionId),
    ) &&
    typeof expectedSubmission?.displayText === "string" &&
    prepared.text === expectedSubmission.displayText &&
    recalled.text === expectedSubmission.displayText;
  const tokenIdentityPreserved =
    prepared?.tokens?.length === 2 &&
    prepared.tokens.some(
      (token) =>
        token.type === "skill" &&
        isExpectedSkillIdentity(token, skillIdentity) &&
        token.id === skillIdentity.key &&
        token.label === `/${skillIdentity.key}` &&
        token.editable === "false",
    ) &&
    prepared.tokens.some(
      (token) =>
        token.type === "paste" &&
        token.id &&
        token.label &&
        token.editable === "false",
    ) &&
    !!preparedTokens &&
    !!recalledTokens &&
    isDeepStrictEqual(preparedTokens, recalledTokens);
  const imagesPreserved =
    prepared?.images?.length === 1 &&
    prepared.images[0].src === imageDataUrl &&
    prepared.images.every((image) => image.decoded === true) &&
    isDeepStrictEqual(prepared.images, recalled?.images);
  const pathIdentityPreserved =
    prepared?.paths?.length === 1 &&
    isDeepStrictEqual(prepared.paths[0], pathReference) &&
    prepared.paths.every(
      (path) => path.id && path.path && path.name && path.isDir === "false",
    ) &&
    isDeepStrictEqual(prepared.paths, recalled?.paths);
  const capabilityPreserved =
    prepared?.capability?.panelObserved === true &&
    prepared.capability.active === true &&
    prepared.capability.selectionLabel?.includes(skillIdentity?.name) ===
      true &&
    isDeepStrictEqual(prepared.capability, recalled?.capability) &&
    [cleared, returned].every(
      (snapshot) =>
        snapshot?.capability?.panelObserved === true &&
        snapshot.capability.active === false,
    );
  const keyboardObserved =
    isDeepStrictEqual(keyboardActions, [
      "ControlOrMeta+Home",
      "ArrowUp",
      "ControlOrMeta+End",
      "ArrowDown",
    ]) &&
    Array.isArray(keyboardEvents) &&
    keyboardEvents.length === 2 &&
    ["ArrowUp", "ArrowDown"].every(
      (key, index) =>
        keyboardEvents[index].key === key &&
        keyboardEvents[index].trusted === true &&
        keyboardEvents[index].defaultPrevented === true &&
        keyboardEvents[index].sessionId === sessionId &&
        keyboardEvents[index].focused === true,
    );
  const readsObserved = [beforeRead, afterRead].every(
    (read) =>
      isObservedPreloadAppServerResponse(read?.ipcObservation, "thread/read") &&
      read.ipcObservation.params?.threadId === threadId &&
      read.result?.thread?.id === threadId,
  );
  const beforeUsers = userItems(beforeRead?.result);
  const afterUsers = userItems(afterRead?.result);
  const canonicalSkills = beforeUsers[0]?.item.content?.filter(
    (part) => part.type === "skill",
  );
  const canonicalInputUnchanged =
    readsObserved &&
    beforeUsers.length === 1 &&
    canonicalSkills?.length === 1 &&
    isExpectedSkillIdentity(canonicalSkills[0], skillIdentity) &&
    typeof beforeUsers[0].item.id === "string" &&
    beforeUsers[0].item.id.length > 0 &&
    isDeepStrictEqual(beforeUsers, afterUsers) &&
    isDeepStrictEqual(
      beforeRead.result.thread.turns.map((turn) => turn.id),
      afterRead.result.thread.turns.map((turn) => turn.id),
    );
  let acceptedSubmissionObserved = false;
  let noAdditionalInput = false;
  let submissionDiagnostics = { traceParsed: false };
  const expectedWireText = expectedSubmission?.text;
  try {
    const before = inputRequests(cleared.traceRaw, threadId);
    const after = inputRequests(returned.traceRaw, threadId);
    const start = before.length === 1 ? before[0] : null;
    const submittedSkills = start?.params.input?.filter(
      (part) => part.type === "skill",
    );
    const checks = {
      singleInputRequest: before.length === 1,
      startMethod: start?.method === "turn/start",
      electronTransport: start?.transport === "electron-ipc",
      successfulTransport: start?.status === "success",
      requestIdPresent: start?.id != null,
      clientIdPresent:
        typeof start?.params.clientUserMessageId === "string" &&
        start.params.clientUserMessageId.length > 0,
      canonicalClientMatched:
        typeof start?.params.clientUserMessageId === "string" &&
        beforeUsers[0]?.item.clientId === start.params.clientUserMessageId,
      singleText:
        start?.params.input?.filter((part) => part.type === "text").length ===
        1,
      wireTextMatched:
        start?.params.input?.some(
          (part) => part.type === "text" && part.text === expectedWireText,
        ) === true,
      wireTextElementsMatched:
        start?.params.input?.some(
          (part) =>
            part.type === "text" &&
            isDeepStrictEqual(
              part.text_elements ?? [],
              expectedSubmission?.textElements,
            ),
        ) === true,
      singleSkill: submittedSkills?.length === 1,
      skillIdentityMatched: isExpectedSkillIdentity(
        submittedSkills?.[0],
        skillIdentity,
      ),
      expectedWireTextPresent:
        typeof expectedWireText === "string" &&
        expectedWireText.startsWith(`/${skillIdentity?.name} `) &&
        expectedWireText.length > skillIdentity.name.length + 2,
      backendTextMatched: backendText === expectedWireText,
    };
    acceptedSubmissionObserved = Object.values(checks).every(Boolean);
    noAdditionalInput =
      acceptedSubmissionObserved && isDeepStrictEqual(before, after);
    submissionDiagnostics = {
      traceParsed: true,
      checks,
      beforeInputRequestCount: before.length,
      afterInputRequestCount: after.length,
      requestBoundaryUnchanged: isDeepStrictEqual(before, after),
      requests: before.map((request) => ({
        method: request.method,
        transport: request.transport,
        status: request.status,
        id: request.id,
        clientUserMessageId: request.params.clientUserMessageId ?? null,
        inputTypes: request.params.input?.map((part) => part.type) ?? [],
        textIdentities:
          request.params.input
            ?.filter((part) => part.type === "text")
            .map((part) => summarizeTextIdentity(part.text)) ?? [],
      })),
      canonicalClientId: beforeUsers[0]?.item.clientId ?? null,
      expectedDisplayTextIdentity: summarizeTextIdentity(
        expectedSubmission?.displayText,
      ),
      expectedWireTextIdentity: summarizeTextIdentity(expectedWireText),
      backendTextIdentity: summarizeTextIdentity(backendText),
    };
  } catch {
    // Missing trace evidence cannot establish a negative submission claim.
  }
  const checks = {
    liveEditorObserved,
    acceptedSubmissionObserved,
    keyboardObserved,
    emptyDraftReturned,
    renderedDocumentPreserved,
    marksSemanticsPreserved,
    tokenIdentityPreserved,
    imagesPreserved,
    pathIdentityPreserved,
    capabilityPreserved,
    canonicalInputUnchanged,
    noAdditionalInput,
  };
  return {
    ok: Object.values(checks).every(Boolean),
    ...checks,
    threadId,
    sessionId,
    itemId: beforeUsers[0]?.item.id ?? null,
    submissionDiagnostics,
    claimBoundary:
      "Real Electron keyboard recall preserves the rendered document, Skill and paste atom identities, image bytes, path identities and visible installed Skill selection; ArrowDown returns the cleared draft without new input. Hidden paste source recovery is a separate Controller test claim.",
    pasteSourceAfterRecallObserved: false,
    documentSource: "read-only rendered DOM",
  };
}

async function waitForSnapshot(page, sessionId, options, predicate, label) {
  const startedAt = Date.now();
  let snapshot;
  while (Date.now() - startedAt < Math.min(options.timeoutMs, 15_000)) {
    snapshot = await readComposerHistorySnapshot(page, sessionId);
    if (isLiveSnapshot(snapshot, sessionId) && predicate(snapshot))
      return snapshot;
    await sleep(options.intervalMs);
  }
  throw new Error(`${label}: ${JSON.stringify(snapshot)}`);
}

export async function captureComposerHistoryDraft(
  page,
  sessionId,
  skillIdentity,
  options,
) {
  const snapshot = await waitForSnapshot(
    page,
    sessionId,
    options,
    (draft) =>
      draft.images.length === 1 &&
      draft.images[0].decoded &&
      draft.tokens.length === 2 &&
      draft.paths.length === 1,
    "history rich draft DOM/图片解码未准备完整",
  );
  snapshot.capability = await observeHistorySkillCapability(
    page,
    sessionId,
    skillIdentity.name,
    true,
    options.timeoutMs,
  );
  return snapshot;
}

export async function verifyComposerHistoryRecall({
  page,
  options,
  prepared,
  threadId,
  sessionId,
  skillIdentity,
  expectedSubmission,
  backendText,
  imageDataUrl,
  pathReference,
}) {
  const cleared = await waitForSnapshot(
    page,
    sessionId,
    options,
    isEmptySnapshot,
    "accepted submission 未清空完整 Composer draft",
  );
  cleared.capability = await observeHistorySkillCapability(
    page,
    sessionId,
    skillIdentity.name,
    false,
    options.timeoutMs,
  );
  const beforeRead = await appServerCallFromPage(page, "thread/read", {
    threadId,
    includeTurns: true,
  });
  const editor = page.locator(`${composerEditorSelector(sessionId)}:visible`);
  await editor.evaluate(installComposerHistoryKeyboardObserverDom);
  const keyboardActions = [];
  await editor.press("ControlOrMeta+Home");
  keyboardActions.push("ControlOrMeta+Home");
  await editor.press("ArrowUp");
  keyboardActions.push("ArrowUp");
  const recalled = await waitForSnapshot(
    page,
    sessionId,
    options,
    (snapshot) =>
      isDeepStrictEqual(
        canonicalSkillProjection(snapshot.documentProjection, skillIdentity),
        canonicalSkillProjection(prepared.documentProjection, skillIdentity),
      ) &&
      isDeepStrictEqual(snapshot.images, prepared.images) &&
      isDeepStrictEqual(snapshot.paths, prepared.paths),
    "ArrowUp 未恢复完整可见 rich draft",
  );
  recalled.capability = await observeHistorySkillCapability(
    page,
    sessionId,
    skillIdentity.name,
    true,
    options.timeoutMs,
  );
  await editor.press("ControlOrMeta+End");
  keyboardActions.push("ControlOrMeta+End");
  await editor.press("ArrowDown");
  keyboardActions.push("ArrowDown");
  const returned = await waitForSnapshot(
    page,
    sessionId,
    options,
    isEmptySnapshot,
    "ArrowDown 未返回发送后空草稿",
  );
  returned.capability = await observeHistorySkillCapability(
    page,
    sessionId,
    skillIdentity.name,
    false,
    options.timeoutMs,
  );
  const afterRead = await appServerCallFromPage(page, "thread/read", {
    threadId,
    includeTurns: true,
  });
  // Include all menu actions and the second read in the final transport boundary.
  returned.traceRaw = await page.evaluate(() =>
    localStorage.getItem("lime_invoke_trace_buffer_v1"),
  );
  const keyboardEvents = await page.evaluate(
    takeComposerHistoryKeyboardEventsDom,
  );
  const evidence = summarizeComposerHistoryRecall({
    prepared,
    cleared,
    recalled,
    returned,
    beforeRead,
    afterRead,
    threadId,
    sessionId,
    skillIdentity,
    expectedSubmission,
    backendText,
    keyboardActions,
    keyboardEvents,
    imageDataUrl,
    pathReference,
  });
  assert(
    evidence.ok,
    `Composer keyboard history Gate B 失败: ${JSON.stringify(evidence)}`,
  );
  return {
    ...evidence,
    cleared,
    recalled,
    returned,
    keyboardActions,
    keyboardEvents,
  };
}
