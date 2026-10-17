#!/usr/bin/env node

// Test-only macOS process evidence. The OS reports the child's bound :0 port;
// no probe socket is released and rebound, and no production transport is added.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import WebSocket from "ws";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";
import { terminalGateRuntimeEnvironment } from "./terminal-gate-binaries.mjs";

assert.equal(
  process.platform,
  "darwin",
  "this fixture uses macOS lsof to discover an owned child's bound port",
);
assert.ok(process.env.APP_SERVER_BIN, "supply a fixed App Server artifact");
const binary = path.resolve(process.env.APP_SERVER_BIN);
const binarySha256 = createHash("sha256")
  .update(await readFile(binary))
  .digest("hex");
const temp = await mkdtemp(path.join(tmpdir(), "dynamic-host-"));
const tools = [
  {
    type: "namespace",
    name: "fixture",
    description: "Controlled host",
    tools: [
      {
        type: "function",
        name: "record",
        description: "Record one controlled host action",
        inputSchema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      },
    ],
  },
];
const peers = [];
const turns = [];
const executions = [];
const handlerErrors = [];
let child;
let childExit;
let stderr = "";
let active;
let succeeded = false;
const fixture = await startOpenAiCompatibleFixtureServer({
  scriptedResponses: [
    async ({ body }) => {
      assert.ok(active, "provider request has an active scenario");
      if (active.issued) {
        if (active.holdFollowup) {
          active.enteredFollowup();
          await active.followupGate;
        }
        return { type: "text", content: "DYNAMIC_HOST_TURN_DONE" };
      }
      const names = (body.tools ?? []).map(
        (tool) => tool.function?.name ?? tool.name,
      );
      if (!names.includes("fixture__record")) {
        assert.ok(
          names.includes("tool_search"),
          `host tool is not discoverable: ${names}`,
        );
        return {
          type: "tool_call",
          id: `search-${active.index}`,
          name: "tool_search",
          arguments: { query: "fixture__record" },
        };
      }
      active.issued = true;
      return {
        type: "tool_call",
        id: `record-${active.index}`,
        name: "fixture__record",
        arguments: { value: `turn-${active.index}` },
      };
    },
  ],
});

class Peer extends EventEmitter {
  constructor(socket, label) {
    super();
    this.socket = socket;
    this.label = label;
    this.nextId = 0;
    this.pending = new Map();
    this.messages = [];
    this.calls = [];
    socket.on("error", () => {});
    socket.on("message", (bytes) => {
      const message = JSON.parse(bytes.toString());
      this.messages.push(message);
      this.emit("message", message);
      if (message.method && message.id !== undefined) {
        this.calls.push(message);
        void this.handleTool(message).catch((error) => {
          handlerErrors.push(error.message);
          this.send({
            id: message.id,
            error: { code: -32603, message: error.message },
          });
        });
      } else if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          message.error
            ? pending.reject(
                Object.assign(new Error(message.error.message), {
                  code: message.error.code,
                }),
              )
            : pending.resolve(message.result);
        }
      }
    });
  }
  send(message) {
    this.socket.send(JSON.stringify({ jsonrpc: "2.0", ...message }));
  }
  request(method, params) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.label} ${method} deadline; stderr=${stderr}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  async waitFor(predicate, scenario) {
    const existing = this.messages.find(predicate);
    if (existing) return existing;
    return new Promise((resolve, reject) => {
      const handler = (message) => {
        if (predicate(message)) {
          clearTimeout(timer);
          this.off("message", handler);
          resolve(message);
        }
      };
      const timer = setTimeout(() => {
        this.off("message", handler);
        reject(
          new Error(
            `${scenario} deadline; calls=${JSON.stringify(this.calls)}; stderr=${stderr}`,
          ),
        );
      }, 30_000);
      this.on("message", handler);
    });
  }
  async handleTool(message) {
    assert.equal(message.method, "item/tool/call");
    assert.equal(message.params.namespace, "fixture");
    assert.equal(message.params.tool, "record");
    assert.equal(message.params.phase, "preflight");
    assert.equal(message.params.threadId, active.threadId);
    if (active.disconnect) return;
    executions.push({
      host: this.label,
      threadId: message.params.threadId,
      turnId: message.params.turnId,
      callId: message.params.callId,
      value: message.params.arguments.value,
    });
    await writeFile(
      path.join(temp, "host-proof.json"),
      JSON.stringify(executions),
    );
    this.send({
      id: message.id,
      result: {
        success: true,
        contentItems: [
          { type: "inputText", text: `DYNAMIC_TOOL_EXECUTED ${this.label}` },
        ],
      },
    });
  }
  async close() {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    const closed = once(this.socket, "close");
    this.socket.close();
    await closed;
  }
}

async function start() {
  stderr = "";
  child = spawn(
    binary,
    [
      "--listen",
      "ws://127.0.0.1:0",
      "--backend",
      "runtime",
      "--data-dir",
      path.join(temp, "data"),
      "--app-data-dir",
      path.join(temp, "app"),
    ],
    {
      env: terminalGateRuntimeEnvironment({ appServerBinaryPath: binary }),
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  childExit = once(child, "exit");
  child.stderr.on(
    "data",
    (chunk) => (stderr = (stderr + chunk).slice(-32_000)),
  );
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `owned child exited: ${stderr}`);
    try {
      const { stdout } = await promisify(execFile)(
        "/usr/sbin/lsof",
        ["-nP", "-a", "-p", String(child.pid), "-iTCP", "-sTCP:LISTEN", "-Fn"],
        { timeout: 2000 },
      );
      const port = stdout.match(/^n127\.0\.0\.1:(\d+)$/m)?.[1];
      if (port) return `ws://127.0.0.1:${port}`;
    } catch (error) {
      if (error.code !== 1) throw error;
    }
    await delay(50);
  }
  throw new Error(`owned child did not bind a listener: ${stderr}`);
}
async function connect(url, label) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  const peer = new Peer(socket, label);
  peers.push(peer);
  await peer.request("initialize", {
    clientInfo: { name: "same-host-name", version: "1" },
    capabilities: { experimentalApi: true },
  });
  peer.send({ method: "initialized" });
  return peer;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  let timer;
  await Promise.race([
    childExit,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("owned child shutdown deadline"));
      }, 5000);
    }),
  ]).finally(() => clearTimeout(timer));
}
async function beginTurn(peer, threadId, options = {}) {
  active = { index: turns.length + 1, threadId, issued: false, ...options };
  console.error(
    `dynamic host stage=turn-${active.index} host=${peer.label} disconnect=${!!active.disconnect}`,
  );
  if (active.holdFollowup) {
    active.followupGate = new Promise(
      (resolve) => (active.releaseFollowup = resolve),
    );
    active.followupEntered = new Promise(
      (resolve) => (active.enteredFollowup = resolve),
    );
  }
  const { turn } = await peer.request("turn/start", {
    threadId,
    input: [{ type: "text", text: "Record one controlled host action." }],
    approvalPolicy: "never",
    sandboxPolicy: "danger-full-access",
  });
  active.turnId = turn.id;
  return turn.id;
}
async function complete(peer, threadId, turnId, expectedSuccess) {
  await peer.waitFor(
    (message) =>
      message.method === "turn/completed" &&
      message.params.threadId === threadId &&
      message.params.turn.id === turnId,
    `turn ${turnId}`,
  );
  const read = await peer.request("thread/read", {
    threadId,
    includeTurns: true,
  });
  const turn = read.thread.turns.find((turn) => turn.id === turnId);
  assert.equal(turn.status, "completed", JSON.stringify(turn));
  const item = turn.items.find(
    (item) => item.type === "dynamicToolCall" && item.tool === "record",
  );
  assert.ok(item, `canonical dynamic tool Item: ${JSON.stringify(turn)}`);
  assert.equal(item.success, expectedSuccess, JSON.stringify(item));
  turns.push({ threadId, turnId, itemId: item.id, success: item.success });
  return read;
}

try {
  const url = await start();
  const owner = await connect(url, "A");
  const observer = await connect(url, "B");
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_, method, params) => owner.request(method, params),
  });
  const started = await owner.request("thread/start", {
    ...buildToolExecutionThreadStartParams({
      provider,
      title: "Dynamic Host fixture",
      workspaceRoot: temp,
    }),
    dynamicTools: tools,
  });
  const threadId = started.thread.id;
  const resume = { threadId, excludeTurns: true };
  await observer.request("thread/resume", resume);
  let turnId = await beginTurn(owner, threadId);
  await complete(observer, threadId, turnId, true);
  assert.equal(
    owner.calls.length,
    1,
    "the registered host receives exactly one call",
  );
  assert.equal(
    observer.calls.length,
    0,
    "a subscribed observer receives no execution call",
  );
  assert.equal(executions.length, 1);
  await assert.rejects(
    observer.request("thread/resume", { ...resume, dynamicTools: tools }),
    /already bound/,
  );
  const drifted = structuredClone(tools);
  drifted[0].tools[0].inputSchema.additionalProperties = true;
  await assert.rejects(
    owner.request("thread/resume", { ...resume, dynamicTools: drifted }),
    /frozen tools/,
  );
  turnId = await beginTurn(owner, threadId, {
    disconnect: true,
    holdFollowup: true,
  });
  await owner.waitFor(
    (message) =>
      message.method === "item/tool/call" && message.params.turnId === turnId,
    "pending host call",
  );
  const pendingCallCount = owner.calls.length;
  await owner.request("thread/resume", { ...resume, dynamicTools: tools });
  await owner.request("thread/read", { threadId, includeTurns: false });
  assert.equal(
    owner.calls.length,
    pendingCallCount,
    "resuming the same host must not replay a pending execution request",
  );
  await owner.close();
  let disconnectTimer;
  await Promise.race([
    active.followupEntered,
    new Promise((_, reject) => {
      disconnectTimer = setTimeout(
        () => reject(new Error("disconnect did not settle the runtime waiter")),
        30_000,
      );
    }),
  ]).finally(() => clearTimeout(disconnectTimer));
  await assert.rejects(
    observer.request("thread/resume", { ...resume, dynamicTools: tools }),
    /active turn/,
  );
  active.releaseFollowup();
  const afterDisconnect = await complete(observer, threadId, turnId, false);
  assert.equal(observer.calls.length, 0);
  assert.equal(
    executions.length,
    1,
    "disconnect must not execute or replay the pending tool on the observer",
  );
  const superset = structuredClone(tools);
  superset[0].tools[0].description = "Updated host description";
  superset[0].tools.push({ ...tools[0].tools[0], name: "newTool" });
  const rebound = await observer.request("thread/resume", {
    ...resume,
    dynamicTools: superset,
  });
  assert.deepEqual(
    rebound.thread.extra.dynamicTools,
    afterDisconnect.thread.extra.dynamicTools,
    "frozen metadata remains unchanged",
  );
  turnId = await beginTurn(observer, threadId);
  await complete(observer, threadId, turnId, true);
  assert.equal(executions.length, 2);
  await observer.close();
  await stop();
  const reopened = await connect(await start(), "C");
  await reopened.request("thread/resume", { ...resume, dynamicTools: tools });
  turnId = await beginTurn(reopened, threadId);
  await complete(reopened, threadId, turnId, true);
  assert.equal(executions.length, 3);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(temp, "host-proof.json"), "utf8")),
    executions,
  );
  assert.deepEqual(handlerErrors, []);
  assert.equal(new Set(executions.map((entry) => entry.callId)).size, 3);
  console.log(
    JSON.stringify({
      ok: true,
      backendMode: "runtime",
      transport: "real-process-two-websocket-hosts",
      platform: process.platform,
      liveProviderUsed: false,
      binarySha256,
      turns,
      executions,
      coldReopens: 1,
      observerExecutionCalls: 0,
    }),
  );
  succeeded = true;
} finally {
  active?.releaseFollowup?.();
  for (const peer of peers) await peer.close().catch(() => {});
  await stop();
  await fixture.close();
  if (succeeded) await rm(temp, { recursive: true, force: true });
  else
    console.error(`dynamic host fixture retained at ${temp}; stderr=${stderr}`);
}
