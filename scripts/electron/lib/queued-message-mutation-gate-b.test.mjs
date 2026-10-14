import { describe, expect, it } from "vitest";
import {
  assertQueuedMessageMutationEvidence,
  QUEUED_MESSAGE_EDITED_TEXT,
  QUEUED_MESSAGE_RICH_INPUT,
  QUEUED_MESSAGE_CANONICAL_IMAGE_URL,
  summarizeQueuedMessageMutationEvidence,
} from "./queued-message-mutation-gate-b.mjs";

const THREAD = "queue-thread";
const EDITED = "queue-rich";
const DELETED = "queue-delete";
const ORIGINAL = "queue-original";
const CLIENT = "queue-client";
const EDITED_INPUT = [
  { type: "text", text: QUEUED_MESSAGE_EDITED_TEXT },
  { type: "image", url: QUEUED_MESSAGE_CANONICAL_IMAGE_URL },
];

function fixture() {
  const edited = {
    id: EDITED,
    clientUserMessageId: CLIENT,
    input: EDITED_INPUT,
  };
  const original = {
    id: ORIGINAL,
    input: [{ type: "text", text: "original" }],
  };
  const deleted = { id: DELETED, input: [{ type: "text", text: "delete" }] };
  const calls = [
    {
      method: "thread/queue/update",
      params: {
        threadId: THREAD,
        queuedSubmissionId: EDITED,
        input: EDITED_INPUT,
      },
    },
    {
      method: "thread/queue/reorder",
      params: {
        threadId: THREAD,
        queuedSubmissionIds: [EDITED, ORIGINAL, DELETED],
      },
    },
    {
      method: "thread/queue/delete",
      params: { threadId: THREAD, queuedSubmissionId: DELETED },
    },
  ];
  return {
    calls,
    threadId: THREAD,
    editedId: EDITED,
    deletedId: DELETED,
    initialIds: [ORIGINAL, EDITED, DELETED],
    clientUserMessageId: CLIENT,
    initialInput: [
      QUEUED_MESSAGE_RICH_INPUT[0],
      EDITED_INPUT[1],
      QUEUED_MESSAGE_RICH_INPUT[2],
    ],
    updated: [original, edited, deleted],
    reordered: [edited, original, deleted],
    deleted: [edited, original],
    gui: {
      sameThread: true,
      editedTextVisible: true,
      reordered: true,
      deleted: true,
      previewFocused: true,
    },
  };
}

function summarize(value, overrides = {}) {
  const traceRaw = JSON.stringify(
    value.calls.map(({ method, params }) => ({
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      args_preview: {
        request: {
          lines: [
            JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
          ],
        },
      },
      ...overrides,
    })),
  );
  return summarizeQueuedMessageMutationEvidence({ ...value, traceRaw });
}

describe("QueuedMessageList mutation Gate B evidence", () => {
  it("requires real GUI mutations and canonical rich input readback", () => {
    expect(() =>
      assertQueuedMessageMutationEvidence(summarize(fixture())),
    ).not.toThrow();
  });

  it.each(["renderer-mock", "stdio"])("rejects %s transport", (transport) => {
    expect(() =>
      assertQueuedMessageMutationEvidence(summarize(fixture(), { transport })),
    ).toThrow(/真实 IPC/);
  });

  it("rejects an empty or substituted canonical image baseline", () => {
    for (const initialInput of [
      [],
      QUEUED_MESSAGE_RICH_INPUT,
      [QUEUED_MESSAGE_RICH_INPUT[0], { type: "image", url: "sidecar://other" }],
    ]) {
      const value = { ...fixture(), initialInput };
      expect(() =>
        assertQueuedMessageMutationEvidence(summarize(value)),
      ).toThrow(/编辑前基线/);
    }
  });

  it("rejects a replacement image in the update request", () => {
    const value = fixture();
    value.calls[0].params.input = [
      EDITED_INPUT[0],
      { type: "image", url: "sidecar://other" },
    ];
    expect(() => assertQueuedMessageMutationEvidence(summarize(value))).toThrow(
      /完整富输入/,
    );
  });

  it("rejects a mutation from another canonical Thread", () => {
    const value = fixture();
    value.calls[0].params.threadId = "other-thread";
    expect(() => assertQueuedMessageMutationEvidence(summarize(value))).toThrow(
      /真实 IPC/,
    );
  });

  it("rejects duplicate action requests and wrong submission identity", () => {
    const duplicated = fixture();
    duplicated.calls.push(duplicated.calls[0]);
    expect(() =>
      assertQueuedMessageMutationEvidence(summarize(duplicated)),
    ).toThrow(/请求数量/);
    const wrong = fixture();
    wrong.calls[0].params.queuedSubmissionId = "other-submission";
    expect(() => assertQueuedMessageMutationEvidence(summarize(wrong))).toThrow(
      /完整富输入/,
    );
  });

  it("rejects repeated text, dropped image or lost client identity in canonical state", () => {
    for (const replacement of [
      { input: [...EDITED_INPUT, { type: "text", text: "Queue rich B" }] },
      { input: [EDITED_INPUT[0]] },
      { input: [EDITED_INPUT[0], { type: "image", url: "sidecar://other" }] },
      { clientUserMessageId: "wrong-client" },
    ]) {
      const value = fixture();
      value.updated[1] = { ...value.updated[1], ...replacement };
      expect(() =>
        assertQueuedMessageMutationEvidence(summarize(value)),
      ).toThrow(/canonical 读回/);
    }
  });

  it("rejects successful reorder ACK without canonical order", () => {
    const value = fixture();
    value.reordered = value.updated;
    expect(() => assertQueuedMessageMutationEvidence(summarize(value))).toThrow(
      /canonical 顺序/,
    );
  });

  it("rejects successful delete ACK with the submission still present", () => {
    const value = fixture();
    value.deleted = value.reordered;
    expect(() => assertQueuedMessageMutationEvidence(summarize(value))).toThrow(
      /canonical 剩余队列/,
    );
  });

  it("requires visible same-thread result and focusable preview", () => {
    for (const field of Object.keys(fixture().gui)) {
      const value = fixture();
      value.gui[field] = false;
      expect(() =>
        assertQueuedMessageMutationEvidence(summarize(value)),
      ).toThrow(/可见结果与键盘 preview/);
    }
  });
});
