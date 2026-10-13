#!/usr/bin/env node

// Test-only runtime fixture: execute OS shells through the public stdio boundary.
import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
const autonomousFailure = process.argv.includes("--autonomous-failure");
const autonomous = process.argv.includes("--autonomous") || autonomousFailure;
const tui = process.argv.includes("--tui");
const execFileAsync = promisify(execFile);
const background = process.argv.includes("--background") || autonomous;
const backgroundCommand = autonomous
  ? `${readCommand}; while [ ! -f .background-release ]; do sleep 0.025; done; cat 'tail marker.txt'; exit ${autonomousFailure ? 7 : 0}`
  : `${readCommand}; read answer; printf 'BACKGROUND_DONE:%s\\n' "$answer"`;
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
  ok(!autonomousFailure || !tui, "autonomous failure currently covers stdio");
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
  if (autonomous)
    await writeFile(
      path.join(workdir, "tail marker.txt"),
      "BACKGROUND_AUTONOMOUS_DONE\n",
    );
  const cwd = await realpath(workdir);
  let backgroundSessionId;
  const fixture = await startOpenAiCompatibleFixtureServer({
    model: "command-invocation-fixture",
    scriptedResponses: background
      ? [
          call("exec_command", "invocation-background", {
            cmd: backgroundCommand,
            workdir: "work dir",
            shell: "/bin/sh",
            login: false,
            tty: true,
            yield_time_ms: 250,
          }),
          (context) => {
            backgroundSessionId = sessionId(context);
            return { type: "text", content: "BACKGROUND_STARTED" };
          },
          ...(autonomous
            ? []
            : [
                () =>
                  call("write_stdin", "invocation-background-write", {
                    session_id: backgroundSessionId,
                    chars: "continue\n",
                    yield_time_ms: 30_000,
                  }),
                { type: "text", content: complete },
              ]),
        ]
      : [
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
  let backgroundFirstRead;
  let backgroundSecondTurnId;
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
    if (tui) {
      ok(autonomous, "TUI command fixture requires --autonomous");
      ok(
        process.env.LIME_CLI_BIN,
        "LIME_CLI_BIN must select the reviewed artifact",
      );
      await connected.sidecar.close();
      connected = undefined;
      // The PTY host resumes the same prepared Thread, runs its actual tool, and releases the
      // process only after observing model completion and a usable composer.
      const result = await execFileAsync(
        process.env.CARGO || "cargo",
        [
          "test",
          "--manifest-path",
          path.join(rootDir, "lime-rs/Cargo.toml"),
          "-p",
          "tui",
          "--lib",
          "--jobs",
          "1",
          "runtime::pty_tests::command_continuation::real_pty_projects_session_command_exit_after_model_turn",
          "--",
          "--exact",
          "--nocapture",
        ],
        {
          cwd: rootDir,
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            LIME_TEST_COMMAND_TUI_GATE_B: "1",
            LIME_TEST_CLI_BIN: process.env.LIME_CLI_BIN,
            LIME_TEST_APP_SERVER_BIN: process.env.APP_SERVER_BIN,
            LIME_TEST_COMMAND_THREAD_ID: threadId,
            LIME_TEST_TERMINAL_CWD: workspace,
            LIME_TEST_COMMAND_DATA_DIR: path.join(directory, "data"),
            LIME_TEST_COMMAND_APP_DATA_DIR: path.join(directory, "app-data"),
          },
        },
      );
      console.log(result.stdout, result.stderr);
      // Shared provider/history paths must remain the same for the resumed CLI host.
      cold = await connectAppServerSidecar(
        config,
        {
          clientInfo: { name: "command-tui-cold", version: "1" },
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
      const read = (
        await cold.connection.readThread({ threadId, includeTurns: true })
      ).result;
      equal(read.thread.turns.length, 1);
      equal(read.thread.turns[0].status, "completed");
      const items = commandItems(read);
      equal(items.length, 1);
      equal(items[0].status, "completed");
      equal(items[0].exitCode, 0);
      ok(items[0].aggregatedOutput.includes("BACKGROUND_AUTONOMOUS_DONE"));
      equal(
        fixture.requests.length,
        2,
        "PTY must execute real runtime tools without another provider request",
      );
      await writeFile(
        path.join(directory, "evidence.json"),
        JSON.stringify(
          {
            threadId,
            thread: read.thread,
            providerRequests: fixture.requests.map((request) => request.body),
          },
          null,
          2,
        ),
      );
      console.log(
        `COMMAND_AUTONOMOUS_TUI_CANONICAL_OK thread=${threadId} backend=runtime fixture=${directory}`,
      );
      return;
    }
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
    const terminal = await awaitTurnCompleted(
      connection,
      notifications,
      turnId,
    );
    equal(
      terminal.params.turn.status,
      "completed",
      JSON.stringify(terminal.params.turn.error),
    );
    if (background) {
      equal(
        fixture.requests.length,
        2,
        "first Turn must yield an actual process",
      );
      backgroundFirstRead = (
        await connection.readThread({ threadId, includeTurns: true })
      ).result;
      const initial = commandItems(backgroundFirstRead);
      equal(initial.length, 1, "first Turn owns one command");
      equal(
        initial[0].status,
        "inProgress",
        "Turn completion cannot complete the process",
      );
      ok(initial[0].processId, "background command must have a real process");
      if (autonomous) {
        await writeFile(path.join(workdir, ".background-release"), "release\n");
        await awaitCommandCompleted(connection, notifications, initial[0].id);
        equal(
          fixture.requests.length,
          2,
          "autonomous exit must not invoke the provider or another tool",
        );
      } else {
        const second = await connection.startTurn(
          buildToolExecutionTurnStartParams({
            threadId,
            workspaceRoot: workspace,
            model: provider.modelPreference,
            message: "Continue the existing background command.",
            clientUserMessageId: "invocation-background-second-user",
          }),
        );
        backgroundSecondTurnId = second.result.turn.id;
        const secondTerminal = await awaitTurnCompleted(
          connection,
          notifications,
          backgroundSecondTurnId,
        );
        equal(
          secondTerminal.params.turn.status,
          "completed",
          JSON.stringify(secondTerminal.params.turn.error),
        );
        equal(
          fixture.requests.length,
          4,
          "both Turns must execute the scripted runtime tools",
        );
      }
    } else {
      equal(
        fixture.requests.length,
        7,
        "all scripted native tools must execute",
      );
    }
    const read = (await connection.readThread({ threadId, includeTurns: true }))
      .result;
    const items = commandItems(read);
    equal(
      items.length,
      background ? 1 : 4,
      "poll and stdin must reuse the command item",
    );
    let actualItems;
    if (background) {
      const item = items[0];
      const originalTurn = read.thread.turns.find(
        (entry) => entry.id === turnId,
      );
      equal(
        originalTurn.status,
        "completed",
        "command exit must preserve the model Turn terminal status",
      );
      equal(item.id, "item_invocation-background");
      equal(item.status, autonomousFailure ? "failed" : "completed");
      equal(item.cwd, cwd);
      equal(item.source, "unifiedExecStartup");
      equal(item.command, commandItems(backgroundFirstRead)[0].command);
      equal(item.processId, commandItems(backgroundFirstRead)[0].processId);
      equal(item.exitCode, autonomousFailure ? 7 : 0);
      ok(
        item.aggregatedOutput.includes(marker),
        "original output must survive the next Turn",
      );
      ok(
        item.aggregatedOutput.includes(
          autonomous
            ? "BACKGROUND_AUTONOMOUS_DONE"
            : "BACKGROUND_DONE:continue",
        ),
      );
      deepStrictEqual(
        item.terminalInteractions,
        autonomous
          ? undefined
          : [{ processId: item.processId, stdin: "sent 9 chars" }],
      );
      equal(
        originalTurn.items.filter((entry) => entry.type === "commandExecution")
          .length,
        1,
      );
      if (!autonomous)
        equal(
          read.thread.turns
            .find((entry) => entry.id === backgroundSecondTurnId)
            .items.filter((entry) => entry.type === "commandExecution").length,
          0,
        );
      const lifecycle = notifications.filter(
        (entry) =>
          ["item/started", "item/completed"].includes(entry.method) &&
          entry.params.item.id === item.id,
      );
      ok(
        lifecycle.every((entry) => entry.params.turnId === turnId),
        "all command lifecycle events belong to the original Turn",
      );
      const outputDeltas = notifications.filter(
        (entry) =>
          entry.method === "item/commandExecution/outputDelta" &&
          entry.params.itemId === item.id,
      );
      ok(
        outputDeltas.length > 0,
        "background command must stream actual OS output",
      );
      ok(
        outputDeltas.every((entry) => entry.params.turnId === turnId),
        "background output belongs to the original Turn",
      );
      if (autonomous) {
        equal(
          notifications.filter(
            (entry) =>
              entry.method === "item/commandExecution/terminalInteraction",
          ).length,
          0,
          "autonomous exit must not synthesize terminal interaction",
        );
        const turnEndIndex = notifications.findIndex(
          (entry) =>
            entry.method === "turn/completed" &&
            entry.params.turn.id === turnId,
        );
        const commandEndIndex = notifications.findIndex(
          (entry) =>
            entry.method === "item/completed" &&
            entry.params.item.id === item.id,
        );
        ok(
          commandEndIndex > turnEndIndex,
          "the real process must exit after the model Turn, without polling",
        );
        ok(
          notifications
            .slice(turnEndIndex + 1, commandEndIndex)
            .some(
              (entry) =>
                entry.method === "item/commandExecution/outputDelta" &&
                entry.params.delta.includes("BACKGROUND_AUTONOMOUS_DONE"),
            ),
          "trailing process output must precede completion",
        );
      }
      actualItems = [item];
    } else {
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
      const failedStarts = notifications.filter(
        (entry) =>
          entry.method === "item/started" && entry.params.item.id === failed.id,
      );
      equal(
        failedStarts.length,
        1,
        "one lifecycle for the rejected invocation",
      );
      ok(
        !failedStarts[0].params.item.processId,
        "preparation failure has no process",
      );
      deepStrictEqual(
        failedStarts[0].params.item.commandActions,
        failed.commandActions,
      );
      actualItems = [executed, silent, waited];
    }
    for (const item of actualItems) {
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
    if (background) {
      deepStrictEqual(restored.thread.turns, read.thread.turns);
    }
    const evidence = {
      threadId,
      turnId,
      backgroundFirstRead,
      backgroundSecondTurnId,
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
      `${autonomousFailure ? "COMMAND_AUTONOMOUS_FAILURE_STDIO_OK" : autonomous ? "COMMAND_AUTONOMOUS_STDIO_OK" : background ? "COMMAND_BACKGROUND_STDIO_OK" : "COMMAND_INVOCATION_STDIO_OK"} thread=${threadId} turn=${turnId} backend=runtime shell=actual starts=once poll=original stdin=original live=read=page=cold fixture=${directory}`,
    );
  } catch (error) {
    await writeFile(
      path.join(directory, "failure.json"),
      JSON.stringify(
        {
          error: error.stack,
          threadId,
          backgroundFirstRead,
          backgroundSecondTurnId,
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

async function awaitTurnCompleted(connection, notifications, turnId) {
  const matches = (entry) =>
    entry.method === "turn/completed" && entry.params.turn.id === turnId;
  const observed = notifications.find(matches);
  if (observed) return observed;
  while (true) {
    const notification = await connection.nextNotification(30_000);
    if (matches(notification)) return notification;
  }
}

async function awaitCommandCompleted(connection, notifications, itemId) {
  const matches = (entry) =>
    entry.method === "item/completed" && entry.params.item.id === itemId;
  const observed = notifications.find(matches);
  if (observed) return observed;
  while (true) {
    const notification = await connection.nextNotification(30_000);
    if (matches(notification)) return notification;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
