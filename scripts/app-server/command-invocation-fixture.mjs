#!/usr/bin/env node

// Test-only runtime fixture: execute OS shells through the public stdio boundary.
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  buildToolExecutionTurnStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const { PROTOCOL_VERSION, connectAppServerSidecar, sidecarArgs, stdioSidecar } =
  await import(
    pathToFileURL(
      path.join(rootDir, "packages/app-server-client/dist/index.js"),
    ).href
  );
const marker = "COMMAND_INVOCATION_OS_OK";
const complete = "COMMAND_INVOCATION_RUNTIME_DONE";
const readCommand = "cat 'guide one.md'";
const waitCommand = `${readCommand}; read answer`;
const call = (name, id, args) => ({
  type: "tool_call",
  name,
  id,
  arguments: args,
});

function sessionId(context) {
  const text = JSON.stringify(context.body.messages);
  const matches = [...text.matchAll(/session_id\\?"\s*:\s*(-?\d+)/gu)];
  const id = Number(matches.at(-1)?.[1]);
  ok(Number.isInteger(id), "provider must receive the actual exec session id");
  return id;
}

async function run() {
  ok(
    process.env.APP_SERVER_BIN,
    "APP_SERVER_BIN must select the reviewed artifact",
  );
  ok(
    process.platform !== "win32",
    "this OS shell fixture requires a Unix host",
  );
  const directory = await mkdtemp(path.join(tmpdir(), "command-invocation-"));
  const workspace = path.join(directory, "workspace");
  const workdir = path.join(workspace, "work dir");
  await mkdir(workdir, { recursive: true });
  await writeFile(path.join(workdir, "guide one.md"), `${marker}\n`);
  const cwd = await realpath(workdir);
  const fixture = await startOpenAiCompatibleFixtureServer({
    model: "command-invocation-fixture",
    scriptedResponses: [
      call("exec_command", "invocation-read", {
        cmd: readCommand,
        workdir: "work dir",
        shell: "/bin/sh",
        login: false,
      }),
      call("exec_command", "invocation-silent", {
        cmd: "true",
        workdir: "work dir",
        shell: "/bin/sh",
        login: false,
      }),
      call("exec_command", "invocation-wait", {
        cmd: waitCommand,
        workdir: "work dir",
        shell: "/bin/sh",
        login: false,
        tty: true,
        yield_time_ms: 250,
      }),
      (context) =>
        call("write_stdin", "invocation-poll", {
          session_id: sessionId(context),
          chars: "",
          yield_time_ms: 25,
        }),
      (context) =>
        call("write_stdin", "invocation-write", {
          session_id: sessionId(context),
          chars: "continue\n",
          yield_time_ms: 30_000,
        }),
      call("exec_command", "invocation-failed", {
        cmd: readCommand,
        workdir: "missing directory",
        shell: "/bin/sh",
        login: false,
      }),
      { type: "text", content: complete },
    ],
  });
  const config = {
    ...stdioSidecar(
      process.env.APP_SERVER_BIN,
      undefined,
      path.join(directory, "data"),
    ),
    backendMode: "runtime",
  };
  const notifications = [];
  let connected;
  let cold;
  let threadId;
  try {
    connected = await connectAppServerSidecar(
      config,
      {
        clientInfo: { name: "command-invocation-fixture", version: "1" },
        capabilities: { experimentalApi: true },
      },
      {
        initializeTimeoutMs: 10_000,
        expectedProtocolVersion: PROTOCOL_VERSION,
        args: [
          ...sidecarArgs(config),
          "--app-data-dir",
          path.join(directory, "app-data"),
        ],
      },
    );
    const connection = connected.connection;
    connection.setNotificationObserver((notification) =>
      notifications.push(notification),
    );
    const provider = await provisionToolExecutionFixtureProvider({
      fixture,
      invoke: async (_options, method, params) =>
        (
          await connection.request(
            connected.client.request(method, params),
            method,
            { timeoutMs: 10_000 },
          )
        ).result,
    });
    const started = await connection.startSession(
      buildToolExecutionThreadStartParams({
        provider,
        workspaceRoot: workspace,
        title: "Command invocation runtime fixture",
      }),
    );
    threadId = started.result.thread.id;
    const turn = await connection.startTurn(
      buildToolExecutionTurnStartParams({
        threadId,
        workspaceRoot: workspace,
        model: provider.modelPreference,
        message: "Run the local command invocation fixture.",
        clientUserMessageId: "invocation-user",
      }),
    );
    const turnId = turn.result.turn.id;
    let terminal = notifications.find(
      (entry) =>
        entry.method === "turn/completed" && entry.params.turn.id === turnId,
    );
    while (!terminal) {
      const notification = await connection.nextNotification(30_000);
      if (
        notification.method === "turn/completed" &&
        notification.params.turn.id === turnId
      ) {
        terminal = notification;
      }
    }
    equal(
      terminal.params.turn.status,
      "completed",
      JSON.stringify(terminal.params.turn.error),
    );
    equal(fixture.requests.length, 7, "all scripted native tools must execute");
    const read = (await connection.readThread({ threadId, includeTurns: true }))
      .result;
    const items = commandItems(read);
    equal(items.length, 4, "poll and stdin must reuse the command item");
    const executed = items.find((item) => item.id === "item_invocation-read");
    const waited = items.find((item) => item.id === "item_invocation-wait");
    const silent = items.find((item) => item.id === "item_invocation-silent");
    const failed = items.find((item) => item.id === "item_invocation-failed");
    ok(executed && silent && waited && failed, JSON.stringify(items));
    equal(executed.cwd, cwd);
    equal(executed.source, "unifiedExecStartup");
    equal(executed.exitCode, 0);
    ok(executed.aggregatedOutput.includes(marker));
    equal(executed.commandActions[0].type, "read");
    equal(executed.commandActions[0].path, path.join(cwd, "guide one.md"));
    equal(waited.cwd, cwd);
    equal(waited.exitCode, 0);
    equal(silent.exitCode, 0);
    ok(
      !silent.aggregatedOutput,
      "silent execution must not create fake output",
    );
    ok(waited.aggregatedOutput.includes("continue"));
    deepStrictEqual(waited.terminalInteractions, [
      { processId: waited.processId, stdin: "(poll)" },
      { processId: waited.processId, stdin: "sent 9 chars" },
    ]);
    deepStrictEqual(failed.commandActions, [
      { type: "unknown", command: readCommand },
    ]);
    equal(failed.status, "failed");
    ok(!failed.processId, "preparation failure must not claim a process");
    for (const item of [executed, silent, waited]) {
      const starts = notifications.filter(
        (entry) =>
          entry.method === "item/started" && entry.params.item.id === item.id,
      );
      equal(starts.length, 1, `one actual start for ${item.id}`);
      equal(starts[0].params.item.cwd, cwd);
      equal(starts[0].params.item.processId, item.processId);
      deepStrictEqual(
        starts[0].params.item.commandActions,
        item.commandActions,
      );
      const ends = notifications.filter(
        (entry) =>
          entry.method === "item/completed" && entry.params.item.id === item.id,
      );
      equal(ends.length, 1, `one actual completion for ${item.id}`);
      deepStrictEqual(ends[0].params.item, item);
    }
    const failedStarts = notifications.filter(
      (entry) =>
        entry.method === "item/started" && entry.params.item.id === failed.id,
    );
    equal(failedStarts.length, 1, "one lifecycle for the rejected invocation");
    ok(
      !failedStarts[0].params.item.processId,
      "preparation failure has no process",
    );
    deepStrictEqual(
      failedStarts[0].params.item.commandActions,
      failed.commandActions,
    );
    const page = (
      await connection.listThreadItems({
        threadId,
        limit: 100,
        sortDirection: "asc",
      })
    ).result;
    deepStrictEqual(
      page.data
        .filter((entry) => entry.item.type === "commandExecution")
        .map((entry) => entry.item),
      items,
    );
    await connected.sidecar.close();
    connected = undefined;
    cold = await connectAppServerSidecar(
      config,
      {
        clientInfo: { name: "command-invocation-cold-read", version: "1" },
        capabilities: { experimentalApi: true },
      },
      {
        args: [
          ...sidecarArgs(config),
          "--app-data-dir",
          path.join(directory, "app-data"),
        ],
        initializeTimeoutMs: 10_000,
      },
    );
    const restored = (
      await cold.connection.readThread({ threadId, includeTurns: true })
    ).result;
    deepStrictEqual(commandItems(restored), items);
    const evidence = {
      threadId,
      turnId,
      notifications,
      thread: read.thread,
      page,
      cold: restored.thread,
      providerRequests: fixture.requests.map((request) => request.body),
    };
    await writeFile(
      path.join(directory, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
    console.log(
      `COMMAND_INVOCATION_STDIO_OK thread=${threadId} turn=${turnId} backend=runtime shell=actual starts=once poll=original stdin=original preparation=unknown live=read=page=cold fixture=${directory}`,
    );
  } catch (error) {
    await writeFile(
      path.join(directory, "failure.json"),
      JSON.stringify(
        {
          error: error.stack,
          threadId,
          notifications,
          providerRequests: fixture.requests.map((request) => request.body),
          stderr: connected?.sidecar.stderrLines,
        },
        null,
        2,
      ),
    );
    throw new Error(
      `command invocation fixture failed; evidence=${directory}`,
      { cause: error },
    );
  } finally {
    await cold?.sidecar.close();
    await connected?.sidecar.close();
    await fixture.close();
  }
}

function commandItems(read) {
  return read.thread.turns
    .flatMap((turn) => turn.items)
    .filter((item) => item.type === "commandExecution");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
