#!/usr/bin/env node

// Test-only public wire -> reviewer -> provider -> command -> durable evidence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startOpenAiCompatibleFixtureServer } from "../lib/openai-compatible-fixture-server.mjs";
import {
  buildToolExecutionThreadStartParams,
  provisionToolExecutionFixtureProvider,
} from "../agent-runtime/tool-execution-current-contract.mjs";
import { terminalGateRuntimeEnvironment } from "./terminal-gate-binaries.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
assert.ok(process.env.APP_SERVER_BIN, "supply a fixed App Server artifact");
const appServerBinaryPath = path.resolve(process.env.APP_SERVER_BIN);
const cliBinaryPath = process.env.LIME_CLI_BIN?.trim()
  ? path.resolve(process.env.LIME_CLI_BIN)
  : null;
const binarySha256 = createHash("sha256")
  .update(await readFile(appServerBinaryPath))
  .digest("hex");
const { connectAppServerSidecar, stdioSidecar } = await import(
  pathToFileURL(path.join(repoRoot, "packages/app-server-client/dist/index.js"))
    .href
);
const temp = await mkdtemp(path.join(tmpdir(), "approval-reviewer-fixture-"));
const transcript = [];
const turns = [];
let connected;
let active;
let succeeded = false;
const fixture = await startOpenAiCompatibleFixtureServer({
  scriptedResponses: [
    ({ body }) => {
      assert.ok(active, "an active test turn must own every provider request");
      const serialized = JSON.stringify(body);
      if (serialized.includes("You are Lime Guardian")) {
        active.reviewCount++;
        assert.equal(body.tools?.length ?? 0, 0, "the reviewer has no tools");
        assert.ok(
          serialized.includes(active.prompt),
          "review must include the actual user request",
        );
        if (active.decision === "cancel") {
          return new Promise((resolve) => {
            active.releaseReview = () =>
              resolve({ type: "text", content: "cancelled fixture response" });
          });
        }
        return {
          type: "text",
          content:
            active.decision === "invalid"
              ? "invalid assessment"
              : JSON.stringify({
                  decision: active.decision,
                  riskLevel: "low",
                  userAuthorization: "high",
                  rationale: "Controlled local fixture decision.",
                }),
        };
      }
      if (active.issued) return { type: "text", content: "REVIEWER_TURN_DONE" };
      const tools = (body.tools ?? []).map(
        (tool) => tool.function?.name ?? tool.name,
      );
      if (!tools.includes("exec_command")) {
        assert.ok(
          tools.includes("tool_search"),
          `exec_command cannot be discovered: ${tools}`,
        );
        return {
          type: "tool_call",
          id: `search-${active.index}`,
          name: "tool_search",
          arguments: { query: "exec_command" },
        };
      }
      active.issued = true;
      return {
        type: "tool_call",
        id: `command-${active.index}`,
        name: "exec_command",
        arguments: {
          cmd: "printf REVIEWER_EXECUTED >> reviewer-proof.txt",
          sandbox_permissions: "require_escalated",
          justification:
            "Verify the selected approval reviewer on an isolated fixture file.",
          yield_time_ms: 1000,
        },
      };
    },
  ],
});

async function start(binaryPath = appServerBinaryPath) {
  connected = await connectAppServerSidecar(
    {
      ...stdioSidecar(binaryPath, undefined, path.join(temp, "data")),
      backendMode: "runtime",
    },
    {
      clientInfo: { name: "approval-reviewer-fixture", version: "1" },
      capabilities: { experimentalApi: true },
    },
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
      initializeTimeoutMs: 30_000,
    },
  );
  connected.connection.setNotificationObserver((message) =>
    transcript.push(message),
  );
  connected.connection.setServerRequestHandler((message) => {
    transcript.push(message);
    assert.ok(active, "server request must belong to the active scenario");
    active.userRequests++;
    connected.connection.respondServerRequest(message.id, {
      decision:
        active.expectedReviewer === "user" ? "acceptForSession" : "cancel",
    });
    return true;
  });
}

async function call(method, params) {
  return (
    await connected.connection.request(
      connected.client.request(method, params),
      method,
      { timeoutMs: 30_000 },
    )
  ).result;
}

async function runTurn(
  threadId,
  patch,
  expectedReviewer,
  decision = "approved",
) {
  const index = turns.length + 1;
  active = {
    index,
    prompt: `Verify reviewer turn ${index} by appending to reviewer-proof.txt.`,
    expectedReviewer,
    decision,
    reviewCount: 0,
    userRequests: 0,
    issued: false,
  };
  const before = transcript.length;
  const { turn } = await call("turn/start", {
    threadId,
    input: [{ type: "text", text: active.prompt }],
    approvalPolicy: "on-request",
    sandboxPolicy: "workspace-write",
    ...patch,
  });
  if (decision === "cancel") {
    const reviewDeadline = Date.now() + 30_000;
    while (!active.releaseReview && Date.now() < reviewDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(
      active.releaseReview,
      "reviewer must enter provider request before interruption",
    );
    await call("turn/interrupt", { threadId, turnId: turn.id });
    active.releaseReview();
  }
  const deadline = Date.now() + 30_000;
  let canonical;
  while (Date.now() < deadline) {
    const read = await call("thread/read", { threadId, includeTurns: true });
    canonical = read.thread.turns.find((entry) => entry.id === turn.id);
    if (canonical && canonical.status !== "inProgress") break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(
    canonical?.status,
    decision === "cancel" ? "interrupted" : "completed",
    JSON.stringify(canonical),
  );
  // Durable state can become terminal before the asynchronous wire is drained.
  const turnCompleted = () =>
    transcript.slice(before).some(
      (message) =>
        message.method === "turn/completed" &&
        message.params?.turn?.id === turn.id,
    );
  const notificationDeadline = Date.now() + 30_000;
  while (!turnCompleted() && Date.now() < notificationDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(
    turnCompleted(),
    "public turn/completed must arrive before reviewing its lifecycle",
  );
  assert.equal(active.issued, true, "real runtime must call the command tool");
  assert.equal(active.reviewCount, expectedReviewer === "user" ? 0 : 1);
  assert.equal(active.userRequests, expectedReviewer === "user" ? 1 : 0);
  assert.equal(
    transcript
      .slice(before)
      .filter(
        (message) =>
          message.method === "autoApprovalReview/strictReviewRequired",
      ).length,
    0,
    "ordinary reviewer mode must not become a strict permission grant",
  );
  const reviews = transcript
    .slice(before)
    .filter((message) =>
      message.method?.startsWith("item/autoApprovalReview/"),
    );
  assert.equal(
    reviews.length,
    expectedReviewer === "user" ? 0 : 2,
    JSON.stringify(reviews),
  );
  if (reviews.length) {
    assert.equal(reviews[0].params.threadId, threadId);
    assert.equal(reviews[1].params.turnId, turn.id);
    assert.equal(reviews[0].params.reviewId, reviews[1].params.reviewId);
    assert.equal(
      reviews[0].params.targetItemId,
      reviews[1].params.targetItemId,
    );
    assert.equal(reviews[0].params.review.status, "inProgress");
    assert.equal(
      reviews[1].params.review.status,
      decision === "cancel"
        ? "aborted"
        : decision === "invalid"
          ? "denied"
          : decision,
    );
  }
  turns.push({
    turnId: turn.id,
    reviewer: expectedReviewer,
    decision,
    reviewCount: active.reviewCount,
    userRequests: active.userRequests,
  });
}

async function assertExecutions(count) {
  assert.equal(
    await readFile(path.join(temp, "reviewer-proof.txt"), "utf8"),
    "REVIEWER_EXECUTED".repeat(count),
  );
}

async function runCliReview(provider) {
  await connected.sidecar.close();
  const cliSha256 = createHash("sha256")
    .update(await readFile(cliBinaryPath))
    .digest("hex");
  active = {
    index: turns.length + 1,
    prompt: "Verify CLI automatic review by appending to reviewer-proof.txt.",
    expectedReviewer: "auto_review",
    decision: "approved",
    reviewCount: 0,
    userRequests: 0,
    issued: false,
  };
  const args = [
    "exec",
    active.prompt,
    "--json",
    "--approve-for-me",
    "--cd",
    temp,
    "--model",
    provider.modelPreference,
    "--provider",
    provider.providerPreference,
    "--app-server",
    appServerBinaryPath,
    "--app-server-arg=--backend",
    "--app-server-arg=runtime",
    `--app-server-arg=--data-dir=${path.join(temp, "data")}`,
    `--app-server-arg=--app-data-dir=${path.join(temp, "app")}`,
  ];
  const result = await new Promise((resolve, reject) => {
    const child = spawn(cliBinaryPath, args, {
      cwd: temp,
      env: terminalGateRuntimeEnvironment({ appServerBinaryPath }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
  assert.equal(result.code, 0, JSON.stringify(result));
  assert.equal(active.issued, true);
  assert.equal(active.reviewCount, 1, "CLI flag must execute Guardian review");
  await assertExecutions(4);
  const events = result.stdout.trim().split(/\r?\n/u).map(JSON.parse);
  const threadId = events[0]?.thread_id;
  assert.equal(events[0]?.type, "thread.started");
  assert.equal(events.at(-1)?.type, "turn.completed");
  const command = events.find(
    (event) =>
      event.type === "item.completed" &&
      event.item?.type === "command_execution",
  )?.item;
  assert.equal(command?.exit_code, 0, JSON.stringify(events));
  assert.equal(
    events.find(
      (event) =>
        event.type === "item.started" &&
        event.item?.type === "command_execution",
    )?.item.id,
    command.id,
    "CLI item identity must remain stable through completion",
  );
  await start();
  const read = await call("thread/read", { threadId, includeTurns: true });
  const canonical = read.thread.turns.find((turn) =>
    turn.items.some((item) => item.id === `item_command-${active.index}`),
  );
  assert.equal(canonical?.status, "completed", JSON.stringify(read));
  const canonicalCommand = canonical.items.find(
    (item) => item.id === `item_command-${active.index}`,
  );
  assert.equal(canonicalCommand.type, "commandExecution");
  assert.equal(canonicalCommand.command, command.command);
  assert.equal(canonicalCommand.exitCode, command.exit_code);
  return {
    cliBinaryPath,
    cliSha256,
    threadId,
    turnId: canonical.id,
    reviewCount: 1,
    cliItemId: command.id,
    canonicalItemId: canonicalCommand.id,
  };
}

try {
  await start();
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_, method, params) => call(method, params),
  });
  const started = await call("thread/start", {
    ...buildToolExecutionThreadStartParams({
      provider,
      title: "Approval reviewer fixture",
      workspaceRoot: temp,
    }),
  });
  assert.equal(
    started.approvalsReviewer,
    "user",
    "default reviewer is explicit on public responses",
  );
  const threadId = started.thread.id;
  // Seed a user session cache before switching the same command to auto review.
  await runTurn(threadId, {}, "user");
  await assertExecutions(1);
  await runTurn(
    threadId,
    { approvalsReviewer: "guardian_subagent" },
    "auto_review",
  );
  await assertExecutions(2);
  await runTurn(threadId, {}, "auto_review", "denied");
  await assertExecutions(2);
  await runTurn(threadId, {}, "auto_review", "invalid");
  await assertExecutions(2);
  await connected.sidecar.close();
  await start();
  const resumed = await call("thread/resume", { threadId, excludeTurns: true });
  assert.equal(
    resumed.approvalsReviewer,
    "auto_review",
    "legacy input only writes canonical reviewer",
  );
  await runTurn(threadId, {}, "auto_review");
  await assertExecutions(3);
  await runTurn(threadId, {}, "auto_review", "cancel");
  await assertExecutions(3);
  const cli = cliBinaryPath ? await runCliReview(provider) : null;
  succeeded = true;
  console.log(
    JSON.stringify({
      ok: true,
      backendMode: "runtime",
      liveProviderUsed: false,
      appServerBinaryPath,
      binarySha256,
      threadId,
      turns,
      actualCommandExecutions: cli ? 4 : 3,
      cli,
    }),
  );
} finally {
  await connected?.sidecar.close();
  await fixture.close();
  if (succeeded) {
    await rm(temp, { recursive: true, force: true });
  } else {
    await writeFile(
      path.join(temp, "transcript.json"),
      JSON.stringify(transcript, null, 2),
    );
    console.error(`Reviewer fixture evidence retained at: ${temp}`);
  }
}
