import { describe, expect, it } from "vitest";
import { decodeUserInputWire } from "./request-user-input-fixture-smoke.mjs";

function entry(message, overrides = {}) {
  return {
    command: "app_server_handle_json_lines",
    transport: "electron-ipc",
    status: "success",
    args_preview: { request: { lines: [JSON.stringify(message)] } },
    ...overrides,
  };
}

describe("request user input Gate B wire evidence", () => {
  it("keeps reverse responses without a method and preserves original token and punctuation", () => {
    const response = {
      jsonrpc: "2.0",
      id: "host-request:7",
      result: {
        answers: {
          choice_id: { answers: ["保留 A, B"] },
          freeform_id: { answers: ["第一行\n第二行"] },
        },
      },
    };
    const interrupt = {
      jsonrpc: "2.0",
      id: 8,
      method: "turn/interrupt",
      params: { threadId: "thread-1", turnId: "turn-2" },
    };
    expect(decodeUserInputWire([entry(response), entry(interrupt)])).toEqual([
      response,
      interrupt,
    ]);
  });

  it("excludes failed, fallback and unrelated commands from IPC proof", () => {
    const response = { id: 1, result: { answers: {} } };
    expect(
      decodeUserInputWire([
        entry(response, { status: "error" }),
        entry(response, { transport: "mock" }),
        entry(response, { command: "other_command" }),
        entry(response, { args_preview: {} }),
      ]),
    ).toEqual([]);
  });

  it("fails on malformed successful IPC evidence instead of silently discarding it", () => {
    expect(() =>
      decodeUserInputWire([
        entry(null, { args_preview: { request: { lines: ["{"] } } }),
      ]),
    ).toThrow();
  });
});
