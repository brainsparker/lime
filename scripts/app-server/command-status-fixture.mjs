// Test-only: typed approval responses through real stdio, RuntimeCore and cold history.
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  connectAppServerSidecar,
  sidecarArgs,
  stdioSidecar,
} from "../../packages/app-server-client/dist/index.js";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  buildToolExecutionTurnStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";

const directory = await mkdtemp(path.join(tmpdir(), "command-status-"));
const evidencePath =
  process.env.LIME_COMMAND_STATUS_EVIDENCE ||
  path.join(directory, "evidence.json");
const evidence = {
  directory,
  backend: "runtime",
  liveProviderUsed: false,
  scenarios: [],
  status: "running",
};
try {
  for (const decision of ["decline", "cancel"]) {
    const scope = path.join(directory, decision);
    const workspace = path.join(scope, "work dir");
    await mkdir(workspace, { recursive: true });
    const callId = `approval-${decision}`;
    const command = "printf EXECUTED > must-not-exist";
    const fixture = await startOpenAiCompatibleFixtureServer({
      model: "command-status-fixture",
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
          },
        },
        { type: "text", content: "APPROVAL_FINISHED" },
      ],
    });
    const config = {
      ...stdioSidecar(
        process.env.APP_SERVER_BIN,
        undefined,
        path.join(scope, "data"),
      ),
      backendMode: "runtime",
    };
    const connect = () =>
      connectAppServerSidecar(
        config,
        {
          clientInfo: { name: "command-status-fixture", version: "1" },
          capabilities: { experimentalApi: true },
        },
        {
          args: [
            ...sidecarArgs(config),
            "--app-data-dir",
            path.join(scope, "app-data"),
          ],
          env: process.env,
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
    try {
      connected = await connect();
      const notifications = [];
      const approvals = [];
      connected.connection.setNotificationObserver((message) =>
        notifications.push(message),
      );
      connected.connection.setServerRequestHandler((message) => {
        assert.equal(message.method, "item/commandExecution/requestApproval");
        approvals.push(message);
        connected.connection.respondServerRequest(message.id, { decision });
        return true;
      });
      const provider = await provisionToolExecutionFixtureProvider({
        fixture,
        invoke: async (_options, method, params) =>
          request(connected, method, params),
      });
      const started = await request(
        connected,
        "thread/start",
        buildToolExecutionThreadStartParams({
          provider,
          title: `approval ${decision}`,
          workspaceRoot: workspace,
        }),
      );
      const threadId = started.thread.id;
      const turned = await request(
        connected,
        "turn/start",
        buildToolExecutionTurnStartParams({
          provider,
          model: provider.modelPreference,
          threadId,
          message: `approval ${decision}`,
          workspaceRoot: workspace,
          approvalPolicy: "unless-trusted",
        }),
      );
      const turnId = turned.turn.id;
      let thread;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        thread = (
          await request(connected, "thread/read", {
            threadId,
            includeTurns: true,
          })
        ).thread;
        const turn = thread.turns.find((turn) => turn.id === turnId);
        if (
          turn?.status !== "inProgress" &&
          turn?.items.some(
            (item) =>
              item.id === `item_${callId}` && item.status !== "inProgress",
          )
        )
          break;
        await delay(25);
      }
      const turn = thread.turns.find((turn) => turn.id === turnId);
      const item = turn?.items.find((item) => item.id === `item_${callId}`);
      evidence.activeScenario = { decision, thread, approvals, notifications };
      assert.equal(
        approvals.length,
        1,
        `${decision}: one actual approval request`,
      );
      assert.equal(approvals[0].params.threadId, threadId);
      assert.equal(approvals[0].params.turnId, turnId);
      assert.equal(item?.type, "commandExecution", JSON.stringify(thread));
      assert.equal(
        item.status,
        "declined",
        `${decision}: rejected before execution`,
      );
      assert.equal(item.command, command);
      assert.equal(
        item.processId ?? null,
        null,
        `${decision}: no actual execution start`,
      );
      assert.equal(
        item.exitCode ?? null,
        null,
        `${decision}: no invented exit code`,
      );
      await assert.rejects(access(path.join(workspace, "must-not-exist")), {
        code: "ENOENT",
      });
      const completed = notifications.filter(
        (message) =>
          message.method === "item/completed" &&
          message.params.item.id === item.id,
      );
      assert.equal(
        completed.length,
        1,
        `${decision}: one terminal notification`,
      );
      assert.deepEqual(completed[0].params.item, item);
      assert.equal(completed[0].params.turnId, turnId);
      await connected.sidecar.close();
      connected = await connect();
      const cold = (
        await request(connected, "thread/read", {
          threadId,
          includeTurns: true,
        })
      ).thread;
      const coldTurn = cold.turns.find((turn) => turn.id === turnId);
      assert.equal(coldTurn.status, turn.status);
      assert.deepEqual(
        coldTurn.items.find((candidate) => candidate.id === item.id),
        item,
      );
      evidence.scenarios.push({
        decision,
        threadId,
        turnId,
        item,
        turnStatus: turn.status,
        approvalRequest: approvals[0],
        terminalNotification: completed[0],
        coldReadMatches: true,
        processNeverStarted: true,
        providerRequests: fixture.requests.length,
      });
      delete evidence.activeScenario;
      console.log(
        `COMMAND_APPROVAL_STATUS_OK decision=${decision} status=${item.status} process=none cold=ok backend=runtime`,
      );
    } finally {
      await connected?.sidecar.close();
      await fixture.close();
    }
  }
  evidence.status = "pass";
} catch (error) {
  evidence.status = "fail";
  evidence.error = error.stack;
  throw error;
} finally {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
}
