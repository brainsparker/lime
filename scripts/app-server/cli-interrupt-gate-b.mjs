// Test-only SIGINT through real CLI, runtime, OS shell and canonical cold read.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import { provisionToolExecutionFixtureProvider } from "../agent-runtime/tool-execution-current-contract.mjs";

export async function runExecInterruptGateB({
  cliBinaryPath,
  appServerBinaryPath,
  tempDir,
  runCliResult,
  terminalEnvironment,
}) {
  if (process.platform === "win32") {
    console.log(
      "CLI_EXEC_INTERRUPT_NOT_RUN platform=win32 reason=requires-Unix-shell-and-SIGINT",
    );
    return;
  }
  const {
    connectAppServerSidecar,
    stdioSidecar,
    sidecarArgs,
    PROTOCOL_VERSION,
  } = await import(
    new URL("../../packages/app-server-client/dist/index.js", import.meta.url)
  );
  for (const json of [true, false]) {
    const scenario = json ? "json" : "human";
    const directory = path.join(tempDir, "interrupt", scenario);
    const workspace = path.join(directory, "work dir");
    await mkdir(workspace, { recursive: true });
    const command =
      "printf '%s %s\\n' \"$$\" \"$PPID\" > 'process.pid'; printf 'CLI_INTERRUPT_READY\\n'; read answer";
    const callId = `cli-interrupt-${scenario}`;
    const fixture = await startOpenAiCompatibleFixtureServer({
      model: "cli-interrupt-fixture",
      scriptedResponses: [
        {
          type: "tool_call",
          name: "exec_command",
          id: callId,
          arguments: {
            cmd: command,
            workdir: workspace,
            shell: "/bin/sh",
            login: false,
            tty: true,
            yield_time_ms: 30_000,
          },
        },
      ],
    });
    const requestStages = [];
    const observeRequests = (stage) => {
      requestStages.push({
        stage,
        timestamp: new Date().toISOString(),
        count: fixture.requests.length,
      });
    };
    const dataDir = path.join(directory, "data");
    const appDataDir = path.join(directory, "app-data");
    const config = {
      ...stdioSidecar(appServerBinaryPath, undefined, dataDir),
      backendMode: "runtime",
    };
    const connect = () =>
      connectAppServerSidecar(
        config,
        {
          clientInfo: { name: "cli-interrupt-fixture", version: "1" },
          capabilities: { experimentalApi: true },
        },
        {
          env: terminalEnvironment,
          args: [...sidecarArgs(config), "--app-data-dir", appDataDir],
          expectedProtocolVersion: PROTOCOL_VERSION,
        },
      );
    const request = async (connected, method, params) =>
      (
        await connected.connection.request(
          connected.client.request(method, params),
          method,
          { timeoutMs: 10_000 },
        )
      ).result;
    let connected;
    let ownedProcesses;
    try {
      connected = await connect();
      const provider = await provisionToolExecutionFixtureProvider({
        fixture,
        invoke: async (_options, method, params) =>
          request(connected, method, params),
      });
      observeRequests("provider-provisioned");
      await connected.sidecar.close();
      connected = undefined;
      const connection = [
        "--app-server",
        appServerBinaryPath,
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
      ];
      const outputPath = path.join(directory, "last-message.txt");
      const preserved = "PREVIOUS_COMPLETED_ANSWER";
      await writeFile(outputPath, preserved);
      observeRequests("before-cli");
      const result = await runInterruptedCli({
        cliBinaryPath,
        args: [
          "exec",
          `interrupt ${scenario}`,
          ...connection,
          ...(json ? ["--json"] : []),
          "--locale=en-US",
          "--color=never",
          "-o",
          outputPath,
        ],
        env: terminalEnvironment,
        cwd: workspace,
        json,
        command,
        onReady: async () => {
          const deadline = Date.now() + 5_000;
          while (Date.now() < deadline) {
            try {
              const [pid, appServerPid] = (
                await readFile(path.join(workspace, "process.pid"), "utf8")
              )
                .trim()
                .split(/\s+/u)
                .map(Number);
              if (
                Number.isInteger(pid) &&
                pid > 1 &&
                Number.isInteger(appServerPid) &&
                appServerPid > 1
              ) {
                ownedProcesses = { pid, appServerPid };
                assert.ok(
                  isAlive(pid),
                  `${scenario}: actual shell must be live before SIGINT`,
                );
                return;
              }
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
            await delay(25);
          }
          assert.fail(`${scenario}: actual shell did not publish its PID`);
        },
      });
      observeRequests("after-cli");
      await writeFile(
        path.join(directory, "result.json"),
        JSON.stringify({ ...result, processes: ownedProcesses }, null, 2),
      );
      assert.equal(
        result.interrupted,
        true,
        `${scenario}: actual SIGINT delivered; ${result.stderr}`,
      );
      assert.equal(
        result.signal,
        null,
        `${scenario}: CLI must exit after canonical cancellation`,
      );
      assert.equal(
        result.code,
        130,
        `${scenario}: interrupted exit code; ${result.stdout} ${result.stderr}`,
      );
      assert.equal(
        await readFile(outputPath, "utf8"),
        preserved,
        `${scenario}: final answer file`,
      );
      const events = json
        ? result.stdout
            .trim()
            .split(/\r?\n/u)
            .map((line) => JSON.parse(line))
        : [];
      if (json) {
        assert.equal(
          events.filter((event) => event.type === "turn.started").length,
          1,
        );
        assert.equal(
          events.some((event) =>
            ["turn.completed", "turn.failed"].includes(event.type),
          ),
          false,
        );
        assert.equal(result.stderr, "", "JSON has no human diagnostics");
      } else {
        assert.equal(
          result.stdout,
          "",
          "interrupted human output has no final answer",
        );
      }
      await waitForExit(ownedProcesses.pid, `${scenario}: actual shell`);
      await waitForExit(ownedProcesses.appServerPid, `${scenario}: App Server`);
      connected = await connect();
      observeRequests("after-cold-connect");
      const listed = await request(connected, "thread/list", { limit: 10 });
      assert.equal(
        listed.data.length,
        1,
        `${scenario}: isolated canonical Thread`,
      );
      const threadId = listed.data[0].id;
      const cold = await runCliResult(
        cliBinaryPath,
        ["thread", "show", threadId, "--include-turns", ...connection],
        tempDir,
      );
      observeRequests("after-cold-show");
      assert.equal(cold.code, 0, cold.stderr);
      const thread = JSON.parse(cold.stdout).thread;
      // Startup memory work has its own thread, as in Codex phase 2. Scope the
      // interruption invariant to this canonical user thread, retaining all traffic.
      const providerRequests = fixture.requests.map(({ path, body }) => {
        const context = body.messages
          ?.filter((message) => message.role === "user")
          .map((message) => message.content)
          .find(
            (content) =>
              typeof content === "string" &&
              content.startsWith("<environment_context>"),
          );
        const requestThreadId = context?.match(
          /<thread_id>([^<]+)<\/thread_id>/u,
        )?.[1];
        assert.ok(
          requestThreadId,
          `${scenario}: provider request thread identity`,
        );
        if (requestThreadId !== threadId) {
          assert.equal(
            body.messages.some(
              (message) =>
                message.role === "user" &&
                message.content === `interrupt ${scenario}`,
            ),
            false,
            `${scenario}: user input must not escape to another thread`,
          );
        }
        return { path, threadId: requestThreadId };
      });
      const userRequests = providerRequests.filter(
        (request) => request.threadId === threadId,
      );
      await writeFile(
        path.join(directory, "canonical.json"),
        JSON.stringify(
          {
            thread,
            processExited: true,
            providerRequests: fixture.requests.length,
            userProviderRequests: userRequests.length,
            providerRequestThreads: providerRequests,
          },
          null,
          2,
        ),
      );
      assert.equal(thread.id, threadId);
      assert.equal(
        thread.turns.length,
        1,
        `${scenario}: interrupt must not start another Turn`,
      );
      const turn = thread.turns[0];
      assert.equal(
        turn.status,
        "interrupted",
        `${scenario}: cold canonical Turn`,
      );
      const item = turn.items.find((item) => item.id === `item_${callId}`);
      assert.equal(
        item?.type,
        "commandExecution",
        `${scenario}: canonical Command identity`,
      );
      assert.equal(item.command, command);
      assert.equal(
        item.status,
        "failed",
        `${scenario}: running Command interruption is an execution failure`,
      );
      assert.ok(
        item.processId,
        `${scenario}: original process identity persists`,
      );
      if (json) {
        assert.equal(events[0].thread_id, threadId);
        const started = events.filter((event) => event.type === "item.started");
        const completed = events.filter(
          (event) => event.type === "item.completed",
        );
        assert.equal(started.length, 1, "one actual Command start");
        assert.equal(completed.length, 1, "one actual Command terminal");
        assert.equal(completed[0].item.id, started[0].item.id);
        assert.equal(completed[0].item.status, item.status);
        assert.equal(
          completed[0].item.aggregated_output,
          item.aggregatedOutput,
        );
        assert.equal(completed[0].item.exit_code, item.exitCode ?? null);
      }
      assert.equal(
        userRequests.length,
        1,
        `${scenario}: no extra provider turn after interrupt`,
      );
      console.log(
        `CLI_EXEC_INTERRUPT_OK mode=${scenario} thread=${threadId} turn=${turn.id} status=${turn.status} command=${item.status} exit=130 cold=ok children=closed backend=runtime`,
      );
    } finally {
      observeRequests("finally");
      await writeFile(
        path.join(directory, "provider-requests.json"),
        JSON.stringify(
          {
            stages: requestStages,
            requests: fixture.requests.map(({ path, body }) => ({
              path,
              body,
            })),
          },
          null,
          2,
        ),
      );
      await connected?.sidecar.close();
      if (!ownedProcesses) {
        try {
          const [pid, appServerPid] = (
            await readFile(path.join(workspace, "process.pid"), "utf8")
          )
            .trim()
            .split(/\s+/u)
            .map(Number);
          if (
            Number.isInteger(pid) &&
            pid > 1 &&
            Number.isInteger(appServerPid) &&
            appServerPid > 1
          ) {
            ownedProcesses = { pid, appServerPid };
          }
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      // Reap only the actual fixture shell and its original parent on assertion failure.
      for (const pid of [ownedProcesses?.pid, ownedProcesses?.appServerPid]) {
        if (pid && isAlive(pid)) process.kill(pid, "SIGTERM");
      }
      await fixture.close();
    }
  }
}

async function runInterruptedCli({
  cliBinaryPath,
  args,
  env,
  cwd,
  json,
  onReady,
  command,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cliBinaryPath, args, {
      env,
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      signal: AbortSignal.timeout(60_000),
    });
    child.stdin.end();
    let stdout = "";
    let stderr = "";
    let interrupted = false;
    let ready;
    const maybeInterrupt = () => {
      const visible = json
        ? stdout
            .split(/\r?\n/u)
            .slice(0, -1)
            .some((line) => {
              const event = JSON.parse(line);
              return (
                event.type === "item.started" && event.item?.command === command
              );
            })
        : stderr.includes("CLI_INTERRUPT_READY");
      if (!visible || interrupted) return;
      interrupted = true;
      ready = onReady().then(() => {
        assert.equal(
          child.kill("SIGINT"),
          true,
          "CLI receives the real signal",
        );
      });
      ready.catch(reject);
    };
    for (const [stream, append] of [
      [
        child.stdout,
        (chunk) => {
          stdout += chunk;
        },
      ],
      [
        child.stderr,
        (chunk) => {
          stderr += chunk;
        },
      ],
    ]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        try {
          append(chunk);
          maybeInterrupt();
        } catch (error) {
          reject(error);
        }
      });
    }
    child.once("error", (error) =>
      reject(
        new Error(
          `${error.message}; interrupted=${interrupted}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          { cause: error },
        ),
      ),
    );
    child.once("close", async (code, signal) => {
      try {
        await ready;
        resolve({ code, signal, stdout, stderr, interrupted });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForExit(pid, label) {
  const deadline = Date.now() + 5_000;
  while (isAlive(pid) && Date.now() < deadline) await delay(25);
  assert.equal(isAlive(pid), false, `${label}: pid=${pid} remains alive`);
}
