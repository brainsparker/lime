import { describe, expect, it } from "vitest";
import { summarizeComposerImeBoundary } from "./claw-chat-current-fixture-composer-ime.mjs";

function fixture() {
  return {
    threadId: "thread-ime",
    sessionId: "session-ime",
    before: { thread: { id: "thread-ime", turns: [] } },
    after: { thread: { id: "thread-ime", turns: [] } },
    observation: {
      electron: true,
      preload: true,
      sessionId: "session-ime",
      editorCount: 1,
      beforeTrace: "[]",
      afterTrace: "[]",
      signals: ["isComposing", "Process", "keyCode229", "compositionstart"].map(
        (signal) => ({
          signal,
          defaultPrevented: false,
          draftUnchanged: true,
        }),
      ),
    },
  };
}

describe("Composer IME Electron evidence", () => {
  it("完整编辑边界与两次同线程 canonical 空历史才通过", () => {
    expect(summarizeComposerImeBoundary(fixture()).ok).toBe(true);
  });

  it.each([
    "electron",
    "preload",
    "sessionId",
    "editorCount",
    "signals",
    "beforeTrace",
    "afterTrace",
  ])("缺失 %s 不可通过", (field) => {
    const input = fixture();
    delete input.observation[field];
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
  });

  it("rejects multiple visible session editors and inherited composition coverage", () => {
    const input = fixture();
    input.observation.editorCount = 2;
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
    input.observation.editorCount = 1;
    input.observation.signals.reverse();
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
  });

  it.each([
    "turn/start",
    "turn/steer",
    "thread/queue/add",
    "thread/queue/start",
  ])("出现真实 %s 请求即失败", (method) => {
    const input = fixture();
    input.observation.afterTrace = JSON.stringify([
      {
        command: "app_server_handle_json_lines",
        transport: "electron-ipc",
        status: "success",
        args_preview: {
          request: {
            lines: [
              JSON.stringify({
                jsonrpc: "2.0",
                id: "ime-submit",
                method,
                params: { threadId: input.threadId },
              }),
            ],
          },
        },
      },
    ]);
    expect(summarizeComposerImeBoundary(input).noSubmitRequest).toBe(false);
  });

  it.each(["before", "after"])("%s 读错线程或缺失 turns 不通过", (field) => {
    const input = fixture();
    input[field].thread.id = "foreign-thread";
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
    input[field].thread.id = input.threadId;
    delete input[field].thread.turns;
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
  });

  it("无 trace 的成功结论或 malformed trace 均拒绝", () => {
    const input = fixture();
    input.observation.afterTrace = "{}";
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
    input.observation.afterTrace = "not-json";
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
  });

  it("候选键被拦截、草稿变化或 canonical Turn 新增时失败", () => {
    const input = fixture();
    input.observation.signals[0].defaultPrevented = true;
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
    input.observation.signals[0].defaultPrevented = false;
    input.observation.signals[1].draftUnchanged = false;
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
    input.observation.signals[1].draftUnchanged = true;
    input.after.thread.turns.push({ id: "unexpected-turn" });
    expect(summarizeComposerImeBoundary(input).ok).toBe(false);
  });
});
