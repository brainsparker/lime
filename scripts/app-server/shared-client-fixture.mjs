#!/usr/bin/env node

// Test-only process evidence for connection isolation and CLI target selection.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import {
  buildTerminalGateBinaries,
  snapshotTerminalGateBinaries,
  terminalGateRuntimeEnvironment,
} from "./terminal-gate-binaries.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const suffix = process.platform === "win32" ? ".exe" : "";
const env = { ...process.env, CARGO_BUILD_JOBS: "1" };
await buildTerminalGateBinaries({ env, repoRoot });
const temp = await mkdtemp(path.join(tmpdir(), "shared-client-fixture-"));
const children = [];
const sockets = [];
let runtimeEnv = env;

async function stop(child) {
  if (!child.pid) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  child.kill("SIGTERM");
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

async function startServer(binary, name) {
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const url = `ws://127.0.0.1:${port}`;
  const child = spawn(
    binary,
    [
      "--listen",
      url,
      "--backend",
      "unavailable",
      "--data-dir",
      path.join(temp, name, "data"),
      "--app-data-dir",
      path.join(temp, name, "app"),
    ],
    { stdio: ["ignore", "ignore", "pipe"], env: runtimeEnv },
  );
  children.push(child);
  await once(child, "spawn");
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4_000);
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `App Server ${name} exited: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return url;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`App Server ${name} readiness timeout: ${stderr}`);
}

async function connect(url, name) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await once(socket, "open");
  const pending = new Map();
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    pending.get(JSON.stringify(message.id))?.(message);
  });
  function request(id, method, params = {}) {
    return new Promise((resolve, reject) => {
      const key = JSON.stringify(id);
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(new Error(`${name}: ${method} ${key} response timeout`));
      }, 10_000);
      pending.set(key, (message) => {
        clearTimeout(timer);
        pending.delete(key);
        resolve(message);
      });
      socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }
  function notify(method, params) {
    socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }
  const initialized = await request(1, "initialize", {
    clientInfo: { name, version: "1.0" },
  });
  assert.ok(initialized.result, `${name}: ${JSON.stringify(initialized)}`);
  notify("initialized", {});
  return { request, notify };
}

async function checkConnectionIsolation(url) {
  const a = await connect(url, "shared-client-a");
  const b = await connect(url, "shared-client-b");
  for (const id of [7, "7"]) {
    a.notify("$/cancelRequest", { id });
    // A response is the processing barrier for A's preceding notification.
    assert.ok((await a.request("barrier", "thread/list")).result);
    const other = await b.request(id, "thread/list");
    const own = await a.request(id, "thread/list");
    const reused = await a.request(id, "thread/list");
    assert.ok(
      other.result,
      `other client ${JSON.stringify(id)}: ${JSON.stringify(other)}`,
    );
    assert.equal(own.error?.code, -32800, `own cancel: ${JSON.stringify(own)}`);
    assert.ok(reused.result, `reused id: ${JSON.stringify(reused)}`);
  }
}

async function runCli(binary, args) {
  const child = spawn(binary, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: runtimeEnv,
  });
  children.push(child);
  await once(child, "spawn");
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
  let code, signal;
  try {
    [code, signal] = await once(child, "close");
  } finally {
    clearTimeout(timer);
  }
  assert.equal(
    code,
    0,
    `${JSON.stringify(args)} exit=${code} signal=${signal}: ${stderr}`,
  );
  return stdout;
}

async function checkCliTargets(binary, a, b) {
  const list = async (url) => {
    const output = await runCli(binary, [
      "--remote",
      url,
      "mcp",
      "list",
      "--json",
    ]);
    return JSON.parse(output)
      .servers.map((server) => server.name)
      .sort();
  };
  await runCli(binary, [
    "--remote",
    a,
    "mcp",
    "add",
    "probe-a",
    "--url",
    "http://127.0.0.1:9/mcp",
  ]);
  assert.deepEqual(await list(a), ["probe-a"], "root writes only Host A");
  assert.deepEqual(await list(b), [], "Host B remains unchanged");
  await runCli(binary, [
    "--remote",
    a,
    "mcp",
    "add",
    "probe-b",
    "--remote",
    b,
    "--url",
    "http://127.0.0.1:9/mcp",
  ]);
  assert.deepEqual(
    await list(a),
    ["probe-a"],
    "child override leaves A unchanged",
  );
  assert.deepEqual(await list(b), ["probe-b"], "child writes only Host B");
  await runCli(binary, ["--remote", a, "mcp", "remove", "probe-a"]);
  assert.deepEqual(await list(a), [], "root removes only from Host A");
  assert.deepEqual(
    await list(b),
    ["probe-b"],
    "root removal leaves B unchanged",
  );
}

try {
  const { cliBinaryPath, appServerBinaryPath } =
    await snapshotTerminalGateBinaries({
      env,
      cliBinaryPath: path.resolve(
        env.LIME_CLI_BIN ||
          path.join(repoRoot, "lime-rs/target/debug", `lime${suffix}`),
      ),
      appServerBinaryPath: path.resolve(
        env.APP_SERVER_BIN ||
          path.join(repoRoot, "lime-rs/target/debug", `app-server${suffix}`),
      ),
      directory: path.join(temp, "binaries"),
    });
  runtimeEnv = terminalGateRuntimeEnvironment({ env, appServerBinaryPath });
  const a = await startServer(appServerBinaryPath, "a");
  await checkConnectionIsolation(a);
  const b = await startServer(appServerBinaryPath, "b");
  await checkCliTargets(cliBinaryPath, a, b);
  const sha256 = async (file) =>
    createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  console.log(
    JSON.stringify(
      {
        transport: "real-cli-and-two-app-server-websockets",
        backend: "unavailable",
        appServerSha256: await sha256(appServerBinaryPath),
        cliSha256: await sha256(cliBinaryPath),
        integerAndStringCancelIsolated: true,
        canceledIdReusable: true,
        rootWritesOnlySelectedHost: true,
        childOverridesHost: true,
        rootRemovesOnlySelectedHost: true,
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.terminate();
  await Promise.all(children.map(stop));
  await rm(temp, { recursive: true, force: true });
}
