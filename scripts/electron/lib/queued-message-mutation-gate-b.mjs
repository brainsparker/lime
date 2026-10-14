import { createHash } from "node:crypto";
import {
  isObservedPreloadAppServerResponse,
  parseJsonRpcRequestsFromInvokeTrace,
} from "./mcp-config-fixture-evidence.mjs";
import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";

export const QUEUED_MESSAGE_MUTATION_METHODS = [
  "thread/queue/update",
  "thread/queue/reorder",
  "thread/queue/delete",
];
export const QUEUED_MESSAGE_RICH_INPUT = [
  { type: "text", text: "Queue rich A" },
  {
    type: "image",
    url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==",
  },
  { type: "text", text: "Queue rich B" },
];
export const QUEUED_MESSAGE_EDITED_TEXT =
  "Queue rich A edited\nQueue rich B edited";
const IMAGE_DIGEST = createHash("sha256")
  .update(Buffer.from(QUEUED_MESSAGE_RICH_INPUT[1].url.split(",")[1], "base64"))
  .digest("hex");
export const QUEUED_MESSAGE_CANONICAL_IMAGE_URL = `sidecar://media/input-${IMAGE_DIGEST}.png`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function textOf(input) {
  return input
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function sameOrder(actual, expected) {
  return (
    Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected)
  );
}

export function summarizeQueuedMessageTimelineEvidence({
  traceRaw,
  threadId,
  baselineTurnId,
  before,
  updated,
  reordered,
  deleted,
  turnPage,
  itemPage,
  baselineSearch,
  pendingSearch,
  pendingOccurrences,
  searchObservation,
  gui,
}) {
  const snapshots = [before, updated, reordered, deleted];
  return {
    searchDiagnostics: {
      baselineCount: baselineSearch?.data?.length ?? null,
      baselineSameThread: baselineSearch?.data?.[0]?.thread?.id === threadId,
      baselineStatus: baselineSearch?.data?.[0]?.thread?.status?.type ?? null,
      pendingCount: pendingSearch?.data?.length ?? null,
      pendingEOF: !pendingSearch?.nextCursor,
      occurrenceCount: pendingOccurrences?.data?.length ?? null,
      occurrenceEOF: !pendingOccurrences?.nextCursor,
    },
    sameThread: snapshots.every((thread) => thread?.id === threadId),
    pendingExcluded: snapshots.every(
      (thread) =>
        Array.isArray(thread?.turns) &&
        thread.turns.length === 1 &&
        thread.turns[0].id === baselineTurnId &&
        thread.turns[0].status === "interrupted",
    ),
    idle: snapshots.every((thread) => thread?.status?.type === "idle"),
    pagingExcluded:
      Array.isArray(turnPage?.data) &&
      turnPage.data.length === 1 &&
      turnPage.data[0].id === baselineTurnId &&
      !turnPage.nextCursor &&
      Array.isArray(itemPage?.data) &&
      itemPage.data.length > 0 &&
      itemPage.data.every((entry) => entry.turnId === baselineTurnId) &&
      !itemPage.nextCursor,
    searchExcluded:
      baselineSearch?.data?.length === 1 &&
      baselineSearch.data[0].thread?.id === threadId &&
      baselineSearch.data[0].thread.status?.type === "idle" &&
      Array.isArray(pendingSearch?.data) &&
      pendingSearch.data.length === 0 &&
      !pendingSearch.nextCursor &&
      Array.isArray(pendingOccurrences?.data) &&
      pendingOccurrences.data.length === 0 &&
      !pendingOccurrences.nextCursor,
    searchReadMatches:
      isObservedPreloadAppServerResponse(
        searchObservation,
        "thread/searchOccurrences",
      ) &&
      searchObservation.params?.threadId === threadId &&
      searchObservation.params?.searchTerm === QUEUED_MESSAGE_EDITED_TEXT,
    mediaReadMatches: parseJsonRpcRequestsFromInvokeTrace(traceRaw).some(
      (request) =>
        request.method === "media/read" &&
        request.transport === "electron-ipc" &&
        request.status === "success" &&
        request.params?.threadId === threadId &&
        request.params?.uri === QUEUED_MESSAGE_CANONICAL_IMAGE_URL,
    ),
    gui,
  };
}

export function assertQueuedMessageTimelineEvidence(evidence) {
  assert(evidence.sameThread, "Queue public history 未绑定同一 Thread");
  assert(
    evidence.pendingExcluded && evidence.pagingExcluded,
    "尚未消费的 Queue 泄漏到 public Turn/Item history 或分页",
  );
  assert(evidence.idle, "尚未启动的 Queue 被误报为 active");
  assert(
    evidence.mediaReadMatches,
    "Queue 图片缺少同线程 media/read 的真实 IPC 证据",
  );
  assert(
    evidence.searchExcluded && evidence.searchReadMatches,
    `pending 搜索未隔离，或缺少同线程真实搜索 IPC: ${JSON.stringify({
      ...evidence.searchDiagnostics,
      searchReadMatches: evidence.searchReadMatches,
    })}`,
  );
  assert(
    evidence.gui?.pendingAbsent &&
      evidence.gui?.idle &&
      evidence.gui?.imageDecoded,
    "Queue 未保持 idle/独立 preview 或未解码真实缩略图",
  );
}

export function summarizeQueuedMessageMutationEvidence({
  traceRaw,
  threadId,
  editedId,
  deletedId,
  initialIds,
  clientUserMessageId,
  initialInput,
  updated,
  reordered,
  deleted,
  gui,
}) {
  const requests = parseJsonRpcRequestsFromInvokeTrace(traceRaw).filter(
    (request) => QUEUED_MESSAGE_MUTATION_METHODS.includes(request.method),
  );
  const successful = requests.filter(
    (request) =>
      request.command === "app_server_handle_json_lines" &&
      request.transport === "electron-ipc" &&
      request.status === "success" &&
      request.params?.threadId === threadId,
  );
  const update = successful.find(
    (request) => request.method === "thread/queue/update",
  );
  const reorder = successful.find(
    (request) => request.method === "thread/queue/reorder",
  );
  const remove = successful.find(
    (request) => request.method === "thread/queue/delete",
  );
  const canonicalEdited = updated.find((item) => item.id === editedId);
  const expectedOrder = [
    editedId,
    ...initialIds.filter((id) => id !== editedId),
  ];
  const expectedFinalOrder = expectedOrder.filter((id) => id !== deletedId);
  const attachmentsOf = (input) =>
    Array.isArray(input) ? input.filter((item) => item.type !== "text") : [];
  const originalAttachments = attachmentsOf(initialInput);
  const baselineImageMatchesSeed =
    Array.isArray(initialInput) &&
    textOf(initialInput) === textOf(QUEUED_MESSAGE_RICH_INPUT) &&
    originalAttachments.length === 1 &&
    originalAttachments[0].type === "image" &&
    originalAttachments[0].url === QUEUED_MESSAGE_CANONICAL_IMAGE_URL;
  const imagePreserved = (input) =>
    baselineImageMatchesSeed &&
    sameOrder(attachmentsOf(input), originalAttachments);
  return {
    baselineImageMatchesSeed,
    missingMethods: QUEUED_MESSAGE_MUTATION_METHODS.filter(
      (method) => !successful.some((request) => request.method === method),
    ),
    requestsMatchThread:
      requests.length === successful.length && successful.length === 3,
    updateMatchesSubmission: update?.params?.queuedSubmissionId === editedId,
    updateTextMatches:
      Array.isArray(update?.params?.input) &&
      textOf(update.params.input) === QUEUED_MESSAGE_EDITED_TEXT,
    updateImagePreserved: imagePreserved(update?.params?.input),
    canonicalTextMatches:
      Array.isArray(canonicalEdited?.input) &&
      textOf(canonicalEdited.input) === QUEUED_MESSAGE_EDITED_TEXT &&
      canonicalEdited.input.filter((item) => item.type === "text").length === 1,
    canonicalImagePreserved: imagePreserved(canonicalEdited?.input),
    clientIdentityPreserved:
      canonicalEdited?.clientUserMessageId === clientUserMessageId,
    reorderRequestMatches: sameOrder(
      reorder?.params?.queuedSubmissionIds,
      expectedOrder,
    ),
    canonicalOrderMatches: sameOrder(
      reordered.map((item) => item.id),
      expectedOrder,
    ),
    deleteRequestMatches: remove?.params?.queuedSubmissionId === deletedId,
    canonicalDeleteMatches: sameOrder(
      deleted.map((item) => item.id),
      expectedFinalOrder,
    ),
    gui,
  };
}

export function assertQueuedMessageMutationEvidence(evidence) {
  assert(
    evidence.baselineImageMatchesSeed,
    "Queue canonical 编辑前基线未保留 seed 图片的内容哈希与完整文本",
  );
  assert(
    evidence.missingMethods.length === 0,
    `Queue mutation 缺少真实 IPC method: ${evidence.missingMethods.join(", ")}`,
  );
  assert(
    evidence.requestsMatchThread,
    "Queue mutation 的 Thread identity、transport 或请求数量不正确",
  );
  assert(
    evidence.updateMatchesSubmission &&
      evidence.updateTextMatches &&
      evidence.updateImagePreserved,
    `Queue edit 未经 current update 提交完整富输入: ${JSON.stringify(evidence)}`,
  );
  assert(
    evidence.canonicalTextMatches &&
      evidence.canonicalImagePreserved &&
      evidence.clientIdentityPreserved,
    "Queue edit 的 canonical 读回出现重复文本、附件或 client identity 丢失",
  );
  assert(
    evidence.reorderRequestMatches && evidence.canonicalOrderMatches,
    "Queue reorder 请求与 canonical 顺序不一致",
  );
  assert(
    evidence.deleteRequestMatches && evidence.canonicalDeleteMatches,
    "Queue delete 请求与 canonical 剩余队列不一致",
  );
  assert(
    evidence.gui?.sameThread &&
      evidence.gui?.editedTextVisible &&
      evidence.gui?.reordered &&
      evidence.gui?.deleted &&
      evidence.gui?.previewFocused,
    "Queue mutation 未形成同一线程的可见结果与键盘 preview",
  );
}

export async function runQueuedMessageMutationGate(
  page,
  {
    threadId,
    baselineTurnId,
    editedId,
    deletedId,
    initialIds,
    clientUserMessageId,
    timeoutMs,
    onStage = () => {},
  },
) {
  const list = page.locator('[data-testid="queued-message-list"]');
  const row = (id) =>
    list.locator(
      `[data-testid="queued-message-item"][data-submission-id="${id}"]`,
    );
  const readCanonical = async () => {
    const response = await appServerCallFromPage(page, "thread/queue/list", {
      threadId,
    });
    assert(
      Array.isArray(response.result?.data),
      "Queue canonical list 未返回 data",
    );
    return response.result.data;
  };
  const initial = await readCanonical();
  const initialInput = initial.find((item) => item.id === editedId)?.input;
  const readThread = async () => {
    const response = await appServerCallFromPage(page, "thread/read", {
      threadId,
      includeTurns: true,
    });
    assert(
      response.result?.thread?.id === threadId &&
        Array.isArray(response.result.thread.turns),
      "Queue thread/read 没有返回完整的同线程快照",
    );
    return response.result.thread;
  };
  const beforeThread = await readThread();
  onStage("timeline-baseline-read");
  await list.locator('[data-queue-action="expand"]').click();
  await row(editedId).locator('[data-queue-action="edit"]').click();
  const editor = row(editedId).locator("textarea");
  assert(
    (await editor.inputValue()) === textOf(QUEUED_MESSAGE_RICH_INPUT),
    "Queue 编辑器没有读取全部 text block",
  );
  await editor.fill(QUEUED_MESSAGE_EDITED_TEXT);
  await row(editedId).locator('[data-queue-action="save"]').click();
  await editor.waitFor({ state: "detached", timeout: timeoutMs });
  await page.waitForFunction(
    ({ id, text }) => {
      const row = document.querySelector(`[data-submission-id="${id}"]`);
      return row?.textContent?.includes(text);
    },
    { id: editedId, text: QUEUED_MESSAGE_EDITED_TEXT },
    { timeout: timeoutMs },
  );
  const updated = await readCanonical();
  const updatedThread = await readThread();
  onStage("timeline-updated-read");
  const image = row(editedId).locator("img");
  await image.waitFor({ state: "visible", timeout: timeoutMs });
  const imageDecoded = await image.evaluate(async (image) => {
    await image.decode();
    return image.naturalWidth === 1 && image.naturalHeight === 1;
  });
  onStage("timeline-image-decoded");
  await row(editedId).locator('[data-queue-action="move-up"]').click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector('[data-testid="queued-message-item"]')
        ?.getAttribute("data-submission-id") === id,
    editedId,
    { timeout: timeoutMs },
  );
  const reordered = await readCanonical();
  const reorderedThread = await readThread();
  onStage("timeline-reordered-read");
  await row(deletedId).locator('[data-queue-action="delete"]').click();
  await row(deletedId).waitFor({ state: "detached", timeout: timeoutMs });
  const deleted = await readCanonical();
  const deletedThread = await readThread();
  onStage("timeline-deleted-read");
  const turnPage = (
    await appServerCallFromPage(page, "thread/turns/list", {
      threadId,
      limit: 100,
    })
  ).result;
  const itemPage = (
    await appServerCallFromPage(page, "thread/items/list", {
      threadId,
      limit: 100,
    })
  ).result;
  const baselineSearch = (
    await appServerCallFromPage(page, "thread/search", {
      searchTerm: "Queue fixture interrupted execution baseline",
      sourceKinds: ["appServer"],
    })
  ).result;
  const pendingSearch = (
    await appServerCallFromPage(page, "thread/search", {
      searchTerm: QUEUED_MESSAGE_EDITED_TEXT,
      sourceKinds: ["appServer"],
    })
  ).result;
  const occurrencesResponse = await appServerCallFromPage(
    page,
    "thread/searchOccurrences",
    { threadId, searchTerm: QUEUED_MESSAGE_EDITED_TEXT },
  );
  const pendingOccurrences = occurrencesResponse.result;
  await page.waitForFunction(
    () => {
      const column = document.querySelector(
        '[data-testid="message-list-column"]',
      );
      const send = document.querySelector('[data-testid="send-btn"]');
      const header = document.querySelector(
        '[data-testid="thread-workspace-header"]',
      );
      return (
        Boolean(header && send) &&
        header.getAttribute("data-status") !== "running" &&
        !column?.textContent?.includes("Queue Gate B pending submission") &&
        !column?.textContent?.includes("Queue rich A") &&
        !column?.textContent?.includes("Queue delete sentinel") &&
        !column?.textContent?.includes("正在生成回复")
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
  await row(editedId).locator("[data-queue-preview]").focus();
  const gui = await page.evaluate(
    ({ threadId, editedId, deletedId, text }) => {
      const list = document.querySelector(
        '[data-testid="queued-message-list"]',
      );
      const rows = Array.from(
        list.querySelectorAll('[data-testid="queued-message-item"]'),
      );
      const editedRow = rows.find(
        (row) => row.getAttribute("data-submission-id") === editedId,
      );
      return {
        sameThread: list.getAttribute("data-thread-id") === threadId,
        editedTextVisible: editedRow?.textContent?.includes(text) === true,
        reordered: rows[0] === editedRow,
        deleted: rows.every(
          (row) => row.getAttribute("data-submission-id") !== deletedId,
        ),
        previewFocused:
          editedRow?.contains(document.activeElement) === true &&
          document.activeElement?.hasAttribute("data-queue-preview"),
      };
    },
    { threadId, editedId, deletedId, text: QUEUED_MESSAGE_EDITED_TEXT },
  );
  const traceRaw = await page.evaluate(() =>
    window.localStorage.getItem("lime_invoke_trace_buffer_v1"),
  );
  const evidence = summarizeQueuedMessageMutationEvidence({
    traceRaw,
    threadId,
    editedId,
    deletedId,
    initialIds,
    clientUserMessageId,
    initialInput,
    updated,
    reordered,
    deleted,
    gui,
  });
  assertQueuedMessageMutationEvidence(evidence);
  evidence.timeline = summarizeQueuedMessageTimelineEvidence({
    traceRaw,
    threadId,
    baselineTurnId,
    before: beforeThread,
    updated: updatedThread,
    reordered: reorderedThread,
    deleted: deletedThread,
    turnPage,
    itemPage,
    baselineSearch,
    pendingSearch,
    pendingOccurrences,
    searchObservation: occurrencesResponse.ipcObservation,
    gui: { pendingAbsent: true, idle: true, imageDecoded },
  });
  assertQueuedMessageTimelineEvidence(evidence.timeline);
  await list.locator('[data-queue-action="collapse"]').click();
  return evidence;
}
