#!/usr/bin/env node

// Test-only: a real PowerShell process, shared runtime and canonical cold read.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  connectAppServerSidecar,
  PROTOCOL_VERSION,
  sidecarArgs,
  stdioSidecar,
} from "../../packages/app-server-client/dist/index.js";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  buildToolExecutionTurnStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";

const cli = process.argv.includes("--cli");
const shell = process.env.LIME_POWERSHELL_BIN;
assert.ok(
  shell && path.isAbsolute(shell),
  "select the verified portable PowerShell executable",
);
assert.ok(
  process.env.APP_SERVER_BIN,
  "select the reviewed App Server artifact",
);
if (cli)
  assert.ok(process.env.LIME_CLI_BIN, "select the reviewed CLI artifact");
const execFileAsync = promisify(execFile);
const marker = "POWERSHELL_OS_OUTPUT_OK";
const final = "POWERSHELL_RUNTIME_DONE";
const directory = await mkdtemp(path.join(tmpdir(), "powershell-command-"));
await mkdir(path.join(directory, "work dir"), { recursive: true });
const workspace = await realpath(path.join(directory, "work dir"));
await writeFile(path.join(workspace, "guide one.md"), `${marker}\n`);
const env = {
  ...process.env,
  XDG_CONFIG_HOME: path.join(directory, "config"),
  XDG_DATA_HOME: path.join(directory, "xdg-data"),
  XDG_CACHE_HOME: path.join(directory, "cache"),
};
const command = "Write-Output 'Restart-Computer'; Get-Content 'guide one.md'";
const encoded = Buffer.from("Write-Output 'Clear-Disk'", "utf16le").toString(
  "base64",
);
const fixture = await startOpenAiCompatibleFixtureServer({
  model: "powershell-command-fixture",
  scriptedResponses: [
    {
      type: "tool_call",
      name: "exec_command",
      id: "powershell-literal",
      arguments: { cmd: command, shell, login: false },
    },
    {
      type: "tool_call",
      name: "exec_command",
      id: "powershell-encoded",
      arguments: {
        cmd: `pwsh -EncodedCommand '${encoded}'`,
        shell,
        login: false,
      },
    },
    { type: "text", content: final },
  ],
});
// The inner pwsh invocation resolves only to the same verified portable runtime.
env.PATH = `${path.dirname(shell)}${path.delimiter}${env.PATH || ""}`;
const dataDir = path.join(directory, "data");
const appDataDir = path.join(directory, "app-data");
const config = {
  ...stdioSidecar(process.env.APP_SERVER_BIN, undefined, dataDir),
  backendMode: "runtime",
};
const connect = () =>
  connectAppServerSidecar(
    config,
    {
      clientInfo: { name: "powershell-command-fixture", version: "1" },
      capabilities: { experimentalApi: true },
    },
    {
      env,
      expectedProtocolVersion: PROTOCOL_VERSION,
      args: [...sidecarArgs(config), "--app-data-dir", appDataDir],
    },
  );
let connected;
let threadId;
const notifications = [];
let cliEvents;
try {
  connected = await connect();
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: async (_options, method, params) =>
      (
        await connected.connection.request(
          connected.client.request(method, params),
          method,
        )
      ).result,
  });
  threadId = (
    await connected.connection.startSession(
      buildToolExecutionThreadStartParams({
        provider,
        workspaceRoot: workspace,
        title: "PowerShell command fixture",
      }),
    )
  ).result.thread.id;
  if (cli) {
    await connected.sidecar.close();
    connected = undefined;
    const result = await execFileAsync(
      process.env.LIME_CLI_BIN,
      [
        "exec",
        "resume",
        threadId,
        "Run the PowerShell fixture.",
        "--json",
        "--app-server",
        process.env.APP_SERVER_BIN,
        "--app-server-arg=--backend",
        "--app-server-arg=runtime",
        "--app-server-arg=--data-dir",
        `--app-server-arg=${dataDir}`,
        "--app-server-arg=--app-data-dir",
        `--app-server-arg=${appDataDir}`,
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
      { env, cwd: workspace, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
    );
    cliEvents = result.stdout
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    assert.equal(cliEvents.at(-1).type, "turn.completed", result.stderr);
    const commands = cliEvents.filter(
      (event) =>
        event.type === "item.completed" &&
        event.item.type === "command_execution",
    );
    assert.equal(commands.length, 2);
    assert.ok(
      commands.some((event) => event.item.aggregated_output.includes(marker)),
    );
    assert.ok(
      commands.some((event) =>
        event.item.aggregated_output.includes("Clear-Disk"),
      ),
    );
    connected = await connect();
  } else {
    connected.connection.setNotificationObserver((event) =>
      notifications.push(event),
    );
    const turnId = (
      await connected.connection.startTurn(
        buildToolExecutionTurnStartParams({
          threadId,
          workspaceRoot: workspace,
          model: provider.modelPreference,
          message: "Run the PowerShell fixture.",
          clientUserMessageId: "powershell-user",
        }),
      )
    ).result.turn.id;
    const matches = (event) =>
      event.method === "turn/completed" && event.params.turn.id === turnId;
    while (!notifications.some(matches))
      await connected.connection.nextNotification(120_000);
    assert.equal(notifications.find(matches).params.turn.status, "completed");
  }
  const thread = (
    await connected.connection.readThread({ threadId, includeTurns: true })
  ).result.thread;
  const items = thread.turns
    .flatMap((turn) => turn.items)
    .filter((item) => item.type === "commandExecution");
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.status, "completed", JSON.stringify(item));
    assert.equal(item.exitCode, 0);
    assert.equal(item.cwd, workspace);
    assert.ok(item.processId, "actual process identity must be projected");
    if (!cli) {
      for (const method of ["item/started", "item/completed"]) {
        assert.equal(
          notifications.filter(
            (event) =>
              event.method === method && event.params.item.id === item.id,
          ).length,
          1,
        );
      }
    }
  }
  assert.ok(items[0].aggregatedOutput.includes("Restart-Computer"));
  assert.ok(items[0].aggregatedOutput.includes(marker));
  assert.ok(items[1].aggregatedOutput.includes("Clear-Disk"));
  assert.equal(
    fixture.requests.length,
    3,
    "runtime must execute both actual tools",
  );
  const page = (
    await connected.connection.listThreadItems({
      threadId,
      limit: 100,
      sortDirection: "asc",
    })
  ).result;
  assert.deepEqual(
    page.data
      .filter((entry) => entry.item.type === "commandExecution")
      .map((entry) => entry.item),
    items,
  );
  await connected.sidecar.close();
  connected = await connect();
  const cold = (
    await connected.connection.readThread({ threadId, includeTurns: true })
  ).result.thread;
  assert.deepEqual(cold.turns, thread.turns);
  await writeFile(
    path.join(directory, "evidence.json"),
    JSON.stringify(
      {
        host: cli ? "cli" : "stdio",
        backend: "runtime",
        liveProviderUsed: false,
        shell,
        shellSha256: createHash("sha256")
          .update(await readFile(shell))
          .digest("hex"),
        threadId,
        thread,
        cold,
        page,
        notifications,
        cliEvents,
        providerRequests: fixture.requests.map((request) => request.body),
      },
      null,
      2,
    ),
  );
  console.log(
    `POWERSHELL_COMMAND_${cli ? "CLI" : "STDIO"}_OK backend=runtime literal=visible encoded=executed canonical=page=cold evidence=${directory}`,
  );
} catch (error) {
  await writeFile(
    path.join(directory, "failure.json"),
    JSON.stringify(
      {
        error: error.stack,
        threadId,
        notifications,
        cliEvents,
        stderr: connected?.sidecar.stderrLines,
      },
      null,
      2,
    ),
  );
  throw new Error(`PowerShell command fixture failed; evidence=${directory}`, {
    cause: error,
  });
} finally {
  await connected?.sidecar.close();
  await fixture.close();
}
