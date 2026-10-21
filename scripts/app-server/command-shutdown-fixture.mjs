#!/usr/bin/env node

// Test-only: session shutdown through real stdio/CLI, runtime and OS processes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  buildToolExecutionTurnStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";
import {
  connectAppServerSidecar,
  sidecarArgs,
  stdioSidecar,
} from "../../packages/app-server-client/dist/index.js";

const cli = process.argv.includes("--cli");
const active = process.argv.includes("--active");
const directory = await mkdtemp(path.join(tmpdir(), "command-shutdown-"));
await mkdir(path.join(directory, "work dir"), { recursive: true });
const workspace = await realpath(path.join(directory, "work dir"));
const config = {
  ...stdioSidecar(
    process.env.APP_SERVER_BIN,
    undefined,
    path.join(directory, "data"),
  ),
  backendMode: "runtime",
};
const args = [
  ...sidecarArgs(config),
  "--app-data-dir",
  path.join(directory, "app-data"),
];
const notifications = [];
const processes = [];
const threads = [];
const fixture = await startOpenAiCompatibleFixtureServer({
  model: "command-shutdown-fixture",
  // Match each user thread's history; background memory requests must not
  // consume another thread's tool call or completion.
  scriptedResponses: [
    ({ body }) => {
      const messages = body.messages ?? [];
      const prompt = messages.find(
        (message) =>
          message.role === "user" &&
          (message.content === "start a background command" ||
            /^start background [01]$/u.test(message.content)),
      )?.content;
      if (!prompt)
        return { type: "text", content: "No background command requested." };
      const index = prompt === "start background 1" ? 1 : 0;
      if (
        messages.some(
          (message) =>
            message.role === "tool" &&
            message.tool_call_id === `shutdown-${index}`,
        )
      ) {
        return { type: "text", content: `BACKGROUND_STARTED_${index}` };
      }
      return {
        type: "tool_call",
        name: "exec_command",
        id: `shutdown-${index}`,
        arguments: {
          cmd: `printf '%s %s\\n' "$$" "$PPID" > 'process-${index}.pid'; printf 'SHUTDOWN_PARTIAL_${index}'; read answer`,
          workdir: workspace,
          shell: "/bin/sh",
          login: false,
          tty: true,
          yield_time_ms: active ? 30_000 : 250,
        },
      };
    },
  ],
});

const connect = () =>
  connectAppServerSidecar(
    config,
    {
      clientInfo: { name: "command-shutdown-fixture", version: "1" },
      capabilities: { experimentalApi: true },
    },
    { args, env: process.env, initializeTimeoutMs: 10_000 },
  );
const request = async (connected, method, params) =>
  (
    await connected.connection.request(
      connected.client.request(method, params),
      method,
      { timeoutMs: 10_000 },
    )
  ).result;
async function closeStdio(connected) {
  connected.sidecar.child.stdin.end();
  await connected.sidecar.waitForExit(10_000);
  assert.equal(
    connected.sidecar.child.exitCode,
    0,
    connected.sidecar.stderrLines.join("\n"),
  );
  assert.equal(
    connected.sidecar.child.signalCode,
    null,
    "App Server exits through stdio EOF",
  );
  await connected.sidecar.close();
}
const command = (thread, index) =>
  thread.turns
    .flatMap((turn) => turn.items)
    .find((item) => item.id === `item_shutdown-${index}`);
function requestBelongsToThread({ body }, id) {
  return body.messages?.some(
    (message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes(`<thread_id>${id}</thread_id>`),
  );
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}
async function exited(pid) {
  for (let count = 0; count < 200; count++) {
    if (!alive(pid)) return;
    await delay(25);
  }
  assert.fail(`owned process ${pid} survived shutdown`);
}
async function coldThread(connected, id) {
  return (
    await connected.connection.readThread({ threadId: id, includeTurns: true })
  ).result.thread;
}
function terminal(thread, index) {
  const item = command(thread, index);
  assert.equal(thread.turns.length, 1);
  assert.equal(
    thread.turns[0].status,
    active ? "interrupted" : "completed",
    "shutdown preserves canonical Turn state",
  );
  assert.equal(
    item.status,
    "failed",
    "terminated process is an execution failure, not an approval rejection",
  );
  assert.equal(item.processId, threads[index].command.processId);
  assert.equal(item.command, threads[index].command.command);
  assert.ok(
    item.aggregatedOutput.includes(`SHUTDOWN_PARTIAL_${index}`),
    "partial OS output survives shutdown",
  );
}
async function runCli(provider) {
  assert.ok(
    process.env.LIME_CLI_BIN,
    "LIME_CLI_BIN selects the reviewed artifact",
  );
  const child = spawn(
    process.env.LIME_CLI_BIN,
    [
      "exec",
      "start a background command",
      "--json",
      "--locale=en-US",
      "--color=never",
      "--app-server",
      process.env.APP_SERVER_BIN,
      ...args.map((value) => `--app-server-arg=${value}`),
      "--model",
      provider.modelPreference,
      "--provider",
      provider.providerPreference,
      "--cd",
      workspace,
      "--sandbox",
      "danger-full-access",
      "--ask-for-approval",
      "never",
    ],
    { cwd: workspace, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (data) => {
    stdout += data;
  });
  child.stderr.on("data", (data) => {
    stderr += data;
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("CLI shutdown timed out"));
    }, 30_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
  await writeFile(
    path.join(directory, "cli.json"),
    JSON.stringify(result, null, 2),
  );
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.signal, null);
  const events = stdout
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  assert.equal(
    events.filter((event) => event.type === "turn.completed").length,
    1,
  );
  const item = events.find(
    (event) =>
      event.type === "item.started" && event.item?.type === "command_execution",
  )?.item;
  assert.ok(item, "CLI rendered the original Command");
  assert.ok(
    events
      .filter((event) => event.item?.type === "command_execution")
      .every((event) => event.item.id === item.id),
    "CLI keeps its original item alias",
  );
  return { events, item };
}

let connected;
try {
  assert.ok(
    process.env.APP_SERVER_BIN,
    "APP_SERVER_BIN selects the reviewed artifact",
  );
  assert.ok(
    !active || !cli,
    "active EOF uses the App Server transport directly",
  );
  assert.notEqual(
    process.platform,
    "win32",
    "this fixture requires Unix shell",
  );
  connected = await connect();
  connected.connection.setNotificationObserver((event) =>
    notifications.push(event),
  );
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: async (_options, method, params) =>
      request(connected, method, params),
  });
  if (cli) {
    await closeStdio(connected);
    connected = undefined;
    const result = await runCli(provider);
    connected = await connect();
    const list = await request(connected, "thread/list", { limit: 10 });
    assert.equal(list.data.length, 1);
    const thread = await coldThread(connected, list.data[0].id);
    assert.equal(
      thread.id,
      result.events.find((event) => event.type === "thread.started").thread_id,
    );
    assert.equal(command(thread, 0).command, result.item.command);
    threads.push({
      id: thread.id,
      command: { ...command(thread, 0), command: result.item.command },
    });
  } else {
    for (let index = 0; index < (active ? 1 : 2); index++) {
      const started = await connected.connection.startSession(
        buildToolExecutionThreadStartParams({
          provider,
          workspaceRoot: workspace,
          title: `shutdown ${index}`,
        }),
      );
      const id = started.result.thread.id;
      const turn = await connected.connection.startTurn(
        buildToolExecutionTurnStartParams({
          threadId: id,
          workspaceRoot: workspace,
          model: provider.modelPreference,
          message: `start background ${index}`,
          clientUserMessageId: `shutdown-user-${index}`,
        }),
      );
      const matches = (event) =>
        event.method === "turn/completed" &&
        event.params.turn.id === turn.result.turn.id;
      if (active) {
        for (let count = 0; count < 200; count++) {
          try {
            await readFile(path.join(workspace, `process-${index}.pid`));
            break;
          } catch (error) {
            if (error.code !== "ENOENT" || count === 199) throw error;
            await delay(25);
          }
        }
      } else if (!notifications.some(matches)) {
        while (!matches(await connected.connection.nextNotification(15_000))) {}
      }
      let thread = await coldThread(connected, id);
      if (active) {
        for (
          let count = 0;
          count < 200 && !command(thread, index)?.processId;
          count++
        ) {
          await delay(25);
          thread = await coldThread(connected, id);
        }
      }
      assert.equal(thread.turns[0].status, active ? "inProgress" : "completed");
      const item = command(thread, index);
      assert.ok(item, `thread ${id} must own shutdown-${index}`);
      assert.equal(item.status, "inProgress");
      threads.push({ id, command: item });
    }
  }
  for (let index = 0; index < threads.length; index++) {
    const [pid, serverPid] = (
      await readFile(path.join(workspace, `process-${index}.pid`), "utf8")
    )
      .trim()
      .split(/\s+/u)
      .map(Number);
    assert.ok(pid > 1 && serverPid > 1);
    processes.push({ pid, serverPid });
  }
  if (!cli && !active) {
    processes.forEach(({ pid }) =>
      assert.ok(alive(pid), "both commands start as actual processes"),
    );
    await request(connected, "thread/archive", { threadId: threads[0].id });
    await exited(processes[0].pid);
    assert.ok(
      alive(processes[1].pid),
      "closing one Thread preserves the other's Command",
    );
    terminal(await coldThread(connected, threads[0].id), 0);
    assert.equal(
      notifications.filter(
        (event) =>
          event.method === "item/completed" &&
          event.params.item.id === "item_shutdown-0",
      ).length,
      1,
    );
    assert.equal(
      command(await coldThread(connected, threads[1].id), 1).status,
      "inProgress",
    );
  }
  await closeStdio(connected);
  connected = undefined;
  for (const { pid, serverPid } of processes) {
    await exited(pid);
    await exited(serverPid);
  }
  connected = await connect();
  const cold = [];
  for (let index = 0; index < threads.length; index++) {
    const thread = await coldThread(connected, threads[index].id);
    terminal(thread, index);
    cold.push(thread);
  }
  const userRequests = fixture.requests.filter((request) =>
    threads.some(({ id }) => requestBelongsToThread(request, id)),
  );
  assert.equal(
    userRequests.length,
    active ? 1 : cli ? 2 : 4,
    "shutdown never calls the provider again",
  );
  for (const { id } of threads) {
    assert.equal(
      userRequests.filter((request) => requestBelongsToThread(request, id))
        .length,
      active ? 1 : 2,
      `thread ${id}: no provider sampling after shutdown`,
    );
  }
  await writeFile(
    path.join(directory, "evidence.json"),
    JSON.stringify(
      {
        threads,
        processes,
        cold,
        notifications,
        providerRequests: fixture.requests.length,
        userProviderRequests: userRequests.length,
        backend: "runtime",
        transport: "stdio",
        host: cli ? "CLI" : "App Server",
        active,
      },
      null,
      2,
    ),
  );
  console.log(
    `COMMAND_SHUTDOWN_${cli ? "CLI" : "STDIO"}_OK processes=exited cold=terminal identity=original evidence=${directory}`,
  );
} catch (error) {
  await writeFile(
    path.join(directory, "failure.json"),
    JSON.stringify(
      {
        error: error.stack,
        threads,
        processes,
        notifications,
        stderr: connected?.sidecar.stderrLines,
        providerRequests: fixture.requests.map((entry) => entry.body.messages),
      },
      null,
      2,
    ),
  );
  console.error(
    `command shutdown fixture failed; evidence=${directory}`,
    error,
  );
  process.exitCode = 1;
} finally {
  await connected?.sidecar.close();
  for (let index = 0; index < (cli || active ? 1 : 2); index++) {
    try {
      const pid = Number(
        (await readFile(path.join(workspace, `process-${index}.pid`), "utf8"))
          .trim()
          .split(/\s+/u)[0],
      );
      if (pid > 1 && !processes.some((entry) => entry.pid === pid))
        processes.push({ pid });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  // Clean up only PIDs published by this isolated fixture, including red-test leftovers.
  for (const { pid } of processes) if (alive(pid)) process.kill(pid, "SIGKILL");
  await fixture.close();
}
