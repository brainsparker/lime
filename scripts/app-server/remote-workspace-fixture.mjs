#!/usr/bin/env node

// Test-only real remote CLI/TUI -> current runtime -> command -> canonical history.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import { provisionToolExecutionFixtureProvider } from "../agent-runtime/tool-execution-current-contract.mjs";
import { terminalGateRuntimeEnvironment } from "./terminal-gate-binaries.mjs";

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
for (const key of ["APP_SERVER_BIN", "LIME_CLI_BIN", "TUI_TEST_BIN"]) {
  assert.ok(process.env[key], "supply fixed " + key);
}
const binary = path.resolve(process.env.APP_SERVER_BIN);
const cli = path.resolve(process.env.LIME_CLI_BIN);
const ptyTest = path.resolve(process.env.TUI_TEST_BIN);
const temp = await realpath(
  await mkdtemp(path.join(tmpdir(), "remote-workspace-")),
);
const serverCwd = path.join(temp, "server-workspace");
const clientCwd = path.join(temp, "client-workspace");
const explicitCwd = path.join(serverCwd, "explicit-workspace");
await Promise.all(
  [serverCwd, clientCwd, explicitCwd].map((dir) =>
    mkdir(dir, { recursive: true }),
  ),
);
const { connectRemoteAppServer } = await import(
  pathToFileURL(path.join(repo, "packages/app-server-client/dist/index.js"))
    .href
);
const runFile = promisify(execFile);
const turns = [];
const artifacts = [];
let active;
let daemon;
let daemonExit;
let stderr = "";
let remote;
let endpoint;
let provider;
let succeeded = false;
const runtimeEnv = terminalGateRuntimeEnvironment({
  appServerBinaryPath: binary,
});
const fixture = await startOpenAiCompatibleFixtureServer({
  scriptedResponses: [
    ({ body }) => {
      assert.ok(active, "every request must belong to a fixture scenario");
      if (active.issued) return { type: "text", content: active.completedText };
      const names = (body.tools ?? []).map(
        (tool) => tool.function?.name ?? tool.name,
      );
      if (!names.includes("exec_command")) {
        assert.ok(
          names.includes("tool_search"),
          "command tool must be discoverable",
        );
        return {
          type: "tool_call",
          id: "search-" + active.index,
          name: "tool_search",
          arguments: { query: "exec_command" },
        };
      }
      active.issued = true;
      return {
        type: "tool_call",
        id: "pwd-" + active.index,
        name: "exec_command",
        arguments: {
          cmd: "pwd > " + active.proof + " && cat " + active.proof,
          yield_time_ms: 1000,
        },
      };
    },
  ],
});

async function start() {
  stderr = "";
  daemon = spawn(
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
      cwd: serverCwd,
      env: { ...runtimeEnv, RUST_LOG: "app_server_transport=info" },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  daemonExit = once(daemon, "exit");
  daemon.stderr.on(
    "data",
    (chunk) => (stderr = (stderr + chunk).slice(-32000)),
  );
  const deadline = Date.now() + 30000;
  // Read only the listener of this fixture's owned process.
  while (Date.now() < deadline) {
    assert.equal(daemon.exitCode, null, "daemon failed: " + stderr);
    if (process.platform === "darwin") {
      try {
        const result = await runFile(
          "/usr/sbin/lsof",
          [
            "-nP",
            "-a",
            "-p",
            String(daemon.pid),
            "-iTCP",
            "-sTCP:LISTEN",
            "-Fn",
          ],
          { timeout: 2000 },
        );
        const port = result.stdout.match(/^n127\.0\.0\.1:(\d+)$/m)?.[1];
        if (port) {
          endpoint = "ws://127.0.0.1:" + port;
          break;
        }
      } catch (error) {
        if (error.code !== 1) throw error;
      }
    } else {
      const port = stderr.match(/websocket listening.*127\.0\.0\.1:(\d+)/)?.[1];
      if (port) {
        endpoint = "ws://127.0.0.1:" + port;
        break;
      }
    }
    await delay(50);
  }
  assert.ok(endpoint, "daemon listener deadline: " + stderr);
  remote = await connectRemoteAppServer(
    { websocketUrl: endpoint },
    {
      clientInfo: { name: "remote-workspace-observer", version: "1" },
      capabilities: { experimentalApi: true },
    },
  );
}

async function stop() {
  await remote?.transport.close();
  remote = undefined;
  if (!daemon || daemon.exitCode !== null) return;
  daemon.kill("SIGTERM");
  let timer;
  await Promise.race([
    daemonExit,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        daemon.kill("SIGKILL");
        reject(new Error("owned daemon shutdown deadline"));
      }, 5000);
    }),
  ]).finally(() => clearTimeout(timer));
  endpoint = undefined;
}

async function call(method, params) {
  return (
    await remote.connection.request(remote.client.request(method, params))
  ).result;
}

function begin(label, expectedCwd) {
  active = {
    index: turns.length + 1,
    label,
    expectedCwd,
    issued: false,
    proof: "workspace-proof-" + (turns.length + 1) + ".txt",
    prompt: "Verify remote workspace " + label,
    completedText: "REMOTE_WORKSPACE_DONE_" + (turns.length + 1),
  };
  console.error("remote workspace scenario=" + label);
}

async function verify(threadId) {
  assert.equal(active.issued, true, "real runtime must execute pwd");
  const read = await call("thread/read", { threadId, includeTurns: true });
  assert.equal(read.thread.cwd, active.expectedCwd);
  assert.equal(read.thread.extra.workingDir, active.expectedCwd);
  const turn = read.thread.turns.at(-1);
  assert.equal(turn.status, "completed", JSON.stringify(turn));
  const command = turn.items.find((item) => item.type === "commandExecution");
  assert.equal(command?.status, "completed", JSON.stringify(turn));
  assert.equal(command.exitCode, 0);
  assert.ok(command.aggregatedOutput.includes(active.expectedCwd));
  assert.equal(
    (
      await readFile(path.join(active.expectedCwd, active.proof), "utf8")
    ).trim(),
    active.expectedCwd,
  );
  await assert.rejects(readFile(path.join(clientCwd, active.proof)), {
    code: "ENOENT",
  });
  turns.push({ ...active, threadId, turnId: turn.id, itemId: command.id });
  return read.thread;
}

async function runCli({
  label,
  expectedCwd,
  command = [],
  cwd,
  forkOnly = false,
}) {
  if (!forkOnly) begin(label, expectedCwd);
  const args = [
    "exec",
    ...command,
    "--json",
    "--remote",
    endpoint,
    "--model",
    provider.modelPreference,
    "--provider",
    provider.providerPreference,
    "--dangerously-bypass-approvals-and-sandbox",
  ];
  if (cwd !== undefined) args.push("--cd", cwd);
  if (!forkOnly) args.push(active.prompt);
  const result = await new Promise((resolve, reject) => {
    const child = execFile(
      cli,
      args,
      {
        cwd: clientCwd,
        env: runtimeEnv,
        timeout: 60000,
        killSignal: "SIGKILL",
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
    child.stdin.end();
  });
  const events = result.stdout.trim().split(/\r?\n/u).map(JSON.parse);
  assert.equal(events[0]?.type, "thread.started", result.stdout);
  const threadId = events[0].thread_id;
  if (!forkOnly) {
    assert.equal(events.at(-1)?.type, "turn.completed", result.stdout);
    await verify(threadId);
  }
  return threadId;
}

async function runTui({ label, expectedCwd, cwd, resumeThread }) {
  begin(label, expectedCwd);
  const before = (await call("thread/list", { limit: 100 })).data.map(
    (thread) => thread.id,
  );
  const transcript = path.join(temp, label + "-pty.txt");
  const configPath = path.join(temp, label + "-config.json");
  await writeFile(
    configPath,
    JSON.stringify({
      cli,
      remote: endpoint,
      model: provider.modelPreference,
      provider: provider.providerPreference,
      clientCwd,
      explicitCwd: cwd,
      prompt: active.prompt,
      completedText: active.completedText,
      agentRoot: path.join(temp, "client-agent"),
      transcript,
      resume: Boolean(resumeThread),
      resumeName: "REMOTE_RESUME_TARGET",
    }),
  );
  const result = await runFile(
    ptyTest,
    [
      "--exact",
      "runtime::pty_tests::remote_workspace::real_pty_remote_workspace_uses_server_directory_and_restores_terminal",
      "--nocapture",
    ],
    {
      cwd: repo,
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...runtimeEnv, LIME_TEST_REMOTE_WORKSPACE_CONFIG: configPath },
    },
  );
  assert.match(result.stdout, /1 passed; 0 failed/);
  const after = (await call("thread/list", { limit: 100 })).data;
  const threadId =
    resumeThread ?? after.find((thread) => !before.includes(thread.id))?.id;
  assert.ok(threadId, "TUI must create or resume a canonical thread");
  await verify(threadId);
  artifacts.push(transcript);
}

try {
  await start();
  provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_options, method, params) => call(method, params),
  });
  const initial = await runCli({
    label: "cli-default",
    expectedCwd: serverCwd,
  });
  const explicit = await runCli({
    label: "cli-relative",
    cwd: "explicit-workspace",
    expectedCwd: explicitCwd,
  });
  const resumed = await runCli({
    label: "cli-resume-last",
    command: ["resume", "--last"],
    expectedCwd: explicitCwd,
  });
  assert.equal(
    resumed,
    explicit,
    "remote latest must not filter by the client's cwd",
  );
  const fork = await runCli({ command: ["fork", explicit], forkOnly: true });
  assert.notEqual(fork, explicit);
  assert.equal(
    (await call("thread/read", { threadId: fork })).thread.cwd,
    explicitCwd,
  );
  await runCli({
    label: "cli-fork-resume",
    command: ["resume", fork],
    expectedCwd: explicitCwd,
  });
  await stop();
  await start();
  await runCli({
    label: "cli-cold-resume",
    command: ["resume", initial],
    expectedCwd: serverCwd,
  });
  await runTui({ label: "tui-default", expectedCwd: serverCwd });
  await runTui({
    label: "tui-relative",
    cwd: "explicit-workspace",
    expectedCwd: explicitCwd,
  });
  const target = turns.at(-1).threadId;
  await call("thread/name/set", {
    threadId: target,
    name: "REMOTE_RESUME_TARGET",
  });
  await runTui({
    label: "tui-resume-picker",
    expectedCwd: explicitCwd,
    resumeThread: target,
  });
  const summary = {
    schema: "remote-workspace-runtime-v1",
    liveProviderUsed: false,
    appServer: {
      path: binary,
      sha256: createHash("sha256")
        .update(await readFile(binary))
        .digest("hex"),
    },
    cli: {
      path: cli,
      sha256: createHash("sha256")
        .update(await readFile(cli))
        .digest("hex"),
    },
    serverCwd,
    clientCwd,
    turns,
    coldRestarts: 1,
    ptyScenarios: 3,
    terminalModeRestored: true,
    artifacts,
  };
  const output = path.resolve(
    process.env.REMOTE_WORKSPACE_EVIDENCE ??
      ".lime/qc/shared-backend/s03a/remote-workspace-runtime.json",
  );
  await mkdir(path.dirname(output), { recursive: true });
  for (const artifact of artifacts) {
    const destination = path.join(
      path.dirname(output),
      path.basename(artifact),
    );
    await writeFile(destination, await readFile(artifact));
    summary.artifacts[summary.artifacts.indexOf(artifact)] = destination;
  }
  await writeFile(output, JSON.stringify(summary, null, 2) + "\n");
  console.log(
    JSON.stringify({ ok: true, output, turns: turns.length, ptyScenarios: 3 }),
  );
  succeeded = true;
} catch (error) {
  console.error(
    "remote workspace evidence retained: " + temp + "; daemon: " + stderr,
  );
  throw error;
} finally {
  await stop();
  await fixture.close();
  if (succeeded) await rm(temp, { recursive: true, force: true });
}
