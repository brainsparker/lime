#!/usr/bin/env node

// Test-only real stdio/runtime evidence; the provider is an isolated loopback fixture.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  buildToolExecutionTurnStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";
import { terminalGateRuntimeEnvironment } from "./terminal-gate-binaries.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
assert.ok(process.env.APP_SERVER_BIN, "supply a fixed App Server artifact");
const binaryPath = path.resolve(process.env.APP_SERVER_BIN);
const binaryHash = createHash("sha256");
for await (const chunk of createReadStream(binaryPath))
  binaryHash.update(chunk);
const binarySha256 = binaryHash.digest("hex");
const { connectAppServerSidecar, stdioSidecar } = await import(
  pathToFileURL(path.join(repoRoot, "packages/app-server-client/dist/index.js"))
    .href
);
const temp = await mkdtemp(path.join(tmpdir(), "ephemeral-fixture-"));
const workspace = path.join(temp, "workspace");
await mkdir(workspace);
const markers = {
  input: "EPHEMERAL_PRIVATE_INPUT_20261020",
  tool: "EPHEMERAL_TOOL_OUTPUT_20261020",
  first: "EPHEMERAL_FIRST_REPLY_20261020",
  second: "EPHEMERAL_SECOND_REPLY_20261020",
};
const fixture = await startOpenAiCompatibleFixtureServer({
  scriptedResponses: [
    {
      type: "tool_call",
      id: "ephemeral-tool",
      name: "exec_command",
      arguments: {
        cmd:
          process.platform === "win32"
            ? `Write-Output '${markers.tool}'`
            : `printf '${markers.tool}'`,
        workdir: workspace,
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
        login: false,
        yield_time_ms: 1000,
      },
    },
    { type: "text", content: markers.first },
    { type: "text", content: markers.second },
  ],
});
let connected;
let notifications = [];
let normalExits = 0;

async function start() {
  notifications = [];
  connected = await connectAppServerSidecar(
    {
      ...stdioSidecar(binaryPath, undefined, path.join(temp, "data")),
      backendMode: "runtime",
    },
    { clientInfo: { name: "ephemeral-fixture", version: "1" } },
    {
      args: [
        "--listen",
        "stdio://",
        "--backend",
        "runtime",
        "--data-dir",
        path.join(temp, "data"),
        "--app-data-dir",
        path.join(temp, "app"),
      ],
      env: terminalGateRuntimeEnvironment({ appServerBinaryPath: binaryPath }),
      initializeTimeoutMs: 60_000,
    },
  );
  connected.connection.setNotificationObserver((message) =>
    notifications.push(message),
  );
}

async function call(method, params) {
  return (
    await connected.connection.request(
      connected.client.request(method, params),
      method,
      {
        timeoutMs: 60_000,
      },
    )
  ).result;
}

async function closeNormally() {
  connected.sidecar.child.stdin.end();
  await connected.sidecar.waitForExit(30_000);
  assert.equal(
    connected.sidecar.child.exitCode,
    0,
    "stdio EOF must close App Server normally",
  );
  assert.equal(connected.sidecar.child.signalCode, null);
  normalExits += 1;
  await connected.sidecar.close();
  connected = undefined;
}

async function runTurn(threadId, provider, message, expected) {
  const { turn } = await call(
    "turn/start",
    buildToolExecutionTurnStartParams({
      threadId,
      workspaceRoot: workspace,
      model: provider.modelPreference,
      message,
      sandboxPolicy: "workspace-write",
    }),
  );
  const deadline = Date.now() + 120_000;
  let completed;
  while (Date.now() < deadline) {
    completed = notifications.find(
      (entry) =>
        entry.method === "turn/completed" &&
        entry.params.threadId === threadId &&
        entry.params.turn.id === turn.id,
    );
    if (completed) break;
    assert.equal(
      connected.sidecar.child.exitCode,
      null,
      "App Server exited during turn",
    );
    await delay(20);
  }
  assert.equal(
    completed?.params.turn.status,
    "completed",
    "real turn must complete",
  );
  assert.ok(
    notifications.some(
      (entry) =>
        entry.method === "item/completed" &&
        entry.params.threadId === threadId &&
        entry.params.turnId === turn.id &&
        entry.params.item.type === "agentMessage" &&
        entry.params.item.text.includes(expected),
    ),
    "completed AgentMessage must retain the expected response",
  );
  return turn.id;
}

async function rejectHistory(method, params) {
  await assert.rejects(call(method, params), /ephemeral/);
}

async function assertNoPrivateRecords(directory, needles) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await assertNoPrivateRecords(target, needles);
    } else if (entry.isFile()) {
      const content = await readFile(target);
      for (const needle of needles) {
        assert.ok(
          !content.includes(Buffer.from(needle)),
          `ephemeral record leaked to ${path.relative(temp, target)}`,
        );
      }
    }
  }
}

try {
  await start();
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_, method, params) => call(method, params),
  });
  const defaults = buildToolExecutionThreadStartParams({
    provider,
    title: "Ephemeral storage fixture",
    workspaceRoot: workspace,
  });
  const { thread } = await call("thread/start", {
    ...defaults,
    ephemeral: true,
  });
  assert.equal(thread.ephemeral, true);
  assert.equal(thread.path ?? null, null);
  assert.ok((await call("thread/loaded/list", {})).data.includes(thread.id));
  const metadata = await call("thread/read", { threadId: thread.id });
  assert.equal(metadata.thread.ephemeral, true);
  const first = await runTurn(
    thread.id,
    provider,
    markers.input,
    markers.first,
  );
  const continuation = fixture.requests.at(-1).body;
  assert.ok(
    JSON.stringify(continuation).includes(markers.tool),
    "tool result reached the next sample",
  );
  assert.ok(
    notifications.some(
      (entry) =>
        entry.method === "item/completed" &&
        entry.params.threadId === thread.id &&
        entry.params.turnId === first &&
        entry.params.item.type === "commandExecution" &&
        entry.params.item.aggregatedOutput?.includes(markers.tool),
    ),
    "real tool lifecycle reached the canonical Item projection",
  );
  const second = await runTurn(
    thread.id,
    provider,
    "Continue using the previous turn.",
    markers.second,
  );
  const history = JSON.stringify(fixture.requests.at(-1).body);
  for (const marker of [markers.input, markers.tool, markers.first]) {
    assert.ok(
      history.includes(marker),
      "second turn must receive in-memory model history",
    );
  }
  for (const [method, params] of [
    ["thread/read", { threadId: thread.id, includeTurns: true }],
    ["thread/turns/list", { threadId: thread.id }],
    ["thread/items/list", { threadId: thread.id }],
  ])
    await rejectHistory(method, params);
  assert.ok(
    !(await call("thread/list", {})).data.some(
      (entry) => entry.id === thread.id,
    ),
  );
  const durable = (
    await call("thread/start", { ...defaults, ephemeral: false })
  ).thread;
  await closeNormally();
  const privateRecords = [thread.id, first, second, ...Object.values(markers)];
  await assertNoPrivateRecords(path.join(temp, "data"), privateRecords);
  await assertNoPrivateRecords(path.join(temp, "app"), privateRecords);
  await start();
  await assert.rejects(call("thread/read", { threadId: thread.id }));
  await assert.rejects(call("thread/resume", { threadId: thread.id }));
  const restored = await call("thread/read", { threadId: durable.id });
  assert.equal(
    restored.thread.id,
    durable.id,
    "ordinary threads remain durable",
  );
  assert.ok(
    (await call("thread/list", {})).data.some(
      (entry) => entry.id === durable.id,
    ),
  );
  await closeNormally();
  await assertNoPrivateRecords(path.join(temp, "data"), privateRecords);
  await assertNoPrivateRecords(path.join(temp, "app"), privateRecords);
  console.log(
    JSON.stringify({
      ok: true,
      transport: "stdio",
      backendMode: "runtime",
      liveProviderUsed: false,
      binaryPath,
      binarySha256,
      ephemeralThreadId: thread.id,
      turnIds: [first, second],
      durableThreadId: durable.id,
      providerRequests: fixture.requests.length,
      realToolContinuation: true,
      inMemoryHistory: true,
      privateRecordsOnDisk: false,
      historyRejected: true,
      coldResumeRejected: true,
      normalExits,
    }),
  );
} finally {
  await connected?.sidecar.close();
  await fixture.close();
  await rm(temp, { recursive: true, force: true });
}
