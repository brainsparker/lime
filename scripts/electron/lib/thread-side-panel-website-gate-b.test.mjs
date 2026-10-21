import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { renderRecentsWebsiteBackendScript } from "./thread-side-panel-website-gate-b.mjs";

describe("Recents website external fixture", () => {
  it("实际子进程只为明确fixture请求产生带独立Turn身份的网站消息", () => {
    const target = "http://127.0.0.1:4317/second";
    const result = spawnSync(process.execPath, ["--input-type=module"], {
      encoding: "utf8",
      input: `const input={kind:"turnStart"},inputText=${JSON.stringify(`RECENTS_WEBSITE_FIXTURE ${target}`)},ledgerPath=null,sessionId="session",threadId="thread",turnId="turn-second";\n${renderRecentsWebsiteBackendScript()}`,
    });
    expect(result.status).toBe(0);
    const { events } = JSON.parse(result.stdout);
    expect(events.map((event) => event.type)).toEqual([
      "message.delta",
      "message.completed",
      "turn.completed",
    ]);
    expect(events[1].payload).toMatchObject({
      itemId: "recents-website:turn-second",
      text: `Website ready: ${target}`,
      status: "completed",
    });
  });
  it("普通请求不进入website分支，继续由原external backend处理", () => {
    const result = spawnSync(process.execPath, ["--input-type=module"], {
      encoding: "utf8",
      input: `const input={kind:"turnStart"},inputText="ordinary fixture prompt";\n${renderRecentsWebsiteBackendScript()}\nconsole.log("normal-handler");`,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("normal-handler");
  });

  it("本地HTML经同一Turn的completed文件变更输出，不伪造普通文件产物", () => {
    const result = spawnSync(process.execPath, ["--input-type=module"], {
      encoding: "utf8",
      input: `const input={kind:"turnStart"},inputText="RECENTS_WEBSITE_FIXTURE recent-website.html",ledgerPath=null,sessionId="session",threadId="thread",turnId="turn-html";\n${renderRecentsWebsiteBackendScript()}`,
    });
    expect(result.status).toBe(0);
    const { events } = JSON.parse(result.stdout);
    const file = events.find((event) => event.type === "item.completed");
    expect(file?.payload.item).toMatchObject({
      sessionId: "session",
      threadId: "thread",
      turnId: "turn-html",
      kind: "file",
      status: "completed",
      payload: {
        type: "file",
        status: "applied",
        changes: [
          {
            path: "recent-website.html",
            kind: { type: "add" },
          },
        ],
      },
    });
    expect(file.payload.item.payload.changes[0].diff).toContain(
      "RECENTS_CANONICAL_HTML",
    );
    expect(events.at(-1).type).toBe("turn.completed");
    expect(events.some((event) => event.type === "artifact.snapshot")).toBe(
      false,
    );
  });
});
