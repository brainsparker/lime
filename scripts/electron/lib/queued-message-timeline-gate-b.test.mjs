import { describe, expect, it } from "vitest";
import {
  assertQueuedMessageTimelineEvidence,
  summarizeQueuedMessageTimelineEvidence,
  QUEUED_MESSAGE_CANONICAL_IMAGE_URL,
  QUEUED_MESSAGE_EDITED_TEXT,
} from "./queued-message-mutation-gate-b.mjs";

function rpcTrace(method, params) {
  return {
    command: "app_server_handle_json_lines",
    transport: "electron-ipc",
    status: "success",
    args_preview: {
      request: {
        lines: [JSON.stringify({ jsonrpc: "2.0", id: method, method, params })],
      },
    },
  };
}

function fixture() {
  const thread = () => ({
    id: "thread-a",
    status: { type: "idle" },
    turns: [
      {
        id: "baseline",
        status: "interrupted",
        items: [{ id: "baseline-user", type: "userMessage" }],
      },
    ],
  });
  return {
    traceRaw: JSON.stringify([
      rpcTrace("media/read", {
        threadId: "thread-a",
        uri: QUEUED_MESSAGE_CANONICAL_IMAGE_URL,
      }),
    ]),
    threadId: "thread-a",
    baselineTurnId: "baseline",
    before: thread(),
    updated: thread(),
    reordered: thread(),
    deleted: thread(),
    turnPage: { data: [{ id: "baseline" }], nextCursor: null },
    itemPage: {
      data: [{ turnId: "baseline", item: { id: "baseline-user" } }],
      nextCursor: null,
    },
    gui: { pendingAbsent: true, idle: true, imageDecoded: true },
    baselineSearch: {
      data: [{ thread: { id: "thread-a", status: { type: "idle" } } }],
      nextCursor: null,
    },
    pendingSearch: { data: [], nextCursor: null },
    pendingOccurrences: { data: [], nextCursor: null },
    searchObservation: {
      electron: true,
      fallback: false,
      command: "app_server_handle_json_lines",
      transport: "electron-ipc",
      status: "success",
      method: "thread/searchOccurrences",
      params: {
        threadId: "thread-a",
        searchTerm: QUEUED_MESSAGE_EDITED_TEXT,
      },
      requestId: "observed-search",
      responseId: "observed-search",
    },
  };
}
function assertFixture(value) {
  assertQueuedMessageTimelineEvidence(
    summarizeQueuedMessageTimelineEvidence(value),
  );
}

describe("Pending Queue public history Gate B oracle", () => {
  it("requires only interrupted execution history, EOF and a decoded Queue thumbnail via IPC", () => {
    expect(() => assertFixture(fixture())).not.toThrow();
  });
  it.each(["before", "updated", "reordered", "deleted"])(
    "rejects another Thread, leaked Turn or active status in %s",
    (stage) => {
      for (const defect of ["thread", "turn", "status"]) {
        const value = fixture();
        if (defect === "thread") value[stage].id = "other-thread";
        if (defect === "turn")
          value[stage].turns.push({ id: "pending", items: [] });
        if (defect === "status") value[stage].status = { type: "active" };
        expect(() => assertFixture(value)).toThrow();
      }
    },
  );
  it.each(["turnPage", "itemPage"])(
    "rejects leaked pending or unexplored cursor in %s",
    (page) => {
      const leaked = fixture();
      leaked[page].data.push({ id: "pending" });
      expect(() => assertFixture(leaked)).toThrow(/分页/);
      const partial = fixture();
      partial[page].nextCursor = "unexplored";
      expect(() => assertFixture(partial)).toThrow(/分页/);
    },
  );
  it.each(["pendingAbsent", "idle", "imageDecoded"])(
    "rejects missing user-visible result %s",
    (field) => {
      const value = fixture();
      value.gui[field] = false;
      expect(() => assertFixture(value)).toThrow(/缩略图/);
    },
  );
  it.each(["pendingSearch", "pendingOccurrences"])(
    "rejects leaked pending search or cursor in %s",
    (field) => {
      const leaked = fixture();
      leaked[field].data.push({ id: "pending" });
      expect(() => assertFixture(leaked)).toThrow(/搜索/);
      const partial = fixture();
      partial[field].nextCursor = "unexplored";
      expect(() => assertFixture(partial)).toThrow(/搜索/);
    },
  );
  it("rejects a negative search without a positive execution-history baseline", () => {
    const value = fixture();
    value.baselineSearch.data = [];
    expect(() => assertFixture(value)).toThrow(/搜索/);
  });
  it("rejects a missing, foreign or unmatched direct preload search observation", () => {
    for (const defect of [
      "missing",
      "electron",
      "fallback",
      "transport",
      "method",
      "thread",
      "term",
      "response",
    ]) {
      const value = fixture();
      const observation = value.searchObservation;
      if (defect === "missing") value.searchObservation = null;
      if (defect === "electron") observation.electron = false;
      if (defect === "fallback") observation.fallback = true;
      if (defect === "transport") observation.transport = "renderer-mock";
      if (defect === "method") observation.method = "thread/search";
      if (defect === "thread") observation.params.threadId = "other-thread";
      if (defect === "term") observation.params.searchTerm = "different";
      if (defect === "response") observation.responseId = "another-request";
      expect(() => assertFixture(value), defect).toThrow(/真实搜索 IPC/);
    }
  });
  it("rejects image decode without same-Thread media/read IPC", () => {
    for (const defect of ["missing", "thread", "uri", "transport", "status"]) {
      const value = fixture();
      const trace = JSON.parse(value.traceRaw);
      const line = JSON.parse(trace[0].args_preview.request.lines[0]);
      if (defect === "missing") trace.length = 0;
      if (defect === "thread") line.params.threadId = "other-thread";
      if (defect === "uri") line.params.uri = "sidecar://other";
      if (defect === "transport") trace[0].transport = "renderer-mock";
      if (defect === "status") trace[0].status = "error";
      if (trace.length)
        trace[0].args_preview.request.lines = [JSON.stringify(line)];
      value.traceRaw = JSON.stringify(trace);
      expect(() => assertFixture(value)).toThrow(/真实 IPC/);
    }
  });
});
