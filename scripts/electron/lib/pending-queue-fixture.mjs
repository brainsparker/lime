import fs from "node:fs";
import path from "node:path";
import { appServerCallFromPage } from "../mcp-config-fixture-smoke.mjs";

export function preparePendingQueueBackend(runtimeEnv) {
  const backend = path.join(runtimeEnv.tempRoot, "queue-backend.mjs");
  const started = path.join(runtimeEnv.tempRoot, "queue-backend-started");
  fs.writeFileSync(
    backend,
    `import { readFileSync, writeFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));
if (input.kind === "turnStart") {
  writeFileSync(process.argv[2], "started");
  await new Promise(() => { setInterval(() => {}, 1000); });
} else {
  console.log(JSON.stringify({ events: [] }));
}
`,
  );
  runtimeEnv.env.APP_SERVER_BACKEND_COMMAND = process.execPath;
  runtimeEnv.env.APP_SERVER_BACKEND_ARGS = JSON.stringify([backend, started]);
  runtimeEnv.env.APP_SERVER_BACKEND_TIMEOUT_MS = "120000";
  return started;
}

/** Admission is real; the external fixture holds execution until typed interrupt. */
export async function pauseQueueAfterInterruptedTurn(
  page,
  threadId,
  startedPath,
) {
  const admitted = await appServerCallFromPage(page, "turn/start", {
    threadId,
    input: [
      { type: "text", text: "Queue fixture interrupted execution baseline" },
    ],
    clientUserMessageId: "queue-fixture-baseline-client",
  });
  const turnId = admitted.result?.turn?.id;
  if (!turnId)
    throw new Error("Queue baseline turn/start 未返回 Turn identity");
  const deadline = Date.now() + 15_000;
  while (!fs.existsSync(startedPath)) {
    if (Date.now() >= deadline)
      throw new Error("Queue baseline backend 未实际启动");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await appServerCallFromPage(page, "turn/interrupt", { threadId, turnId });
  const terminalDeadline = Date.now() + 15_000;
  do {
    const response = await appServerCallFromPage(page, "thread/read", {
      threadId,
      includeTurns: true,
    });
    const thread = response.result?.thread;
    if (
      thread?.status?.type === "idle" &&
      thread.turns?.length === 1 &&
      thread.turns[0].id === turnId &&
      thread.turns[0].status === "interrupted"
    )
      return turnId;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < terminalDeadline);
  throw new Error("Queue baseline interrupt 未形成 canonical idle terminal");
}
