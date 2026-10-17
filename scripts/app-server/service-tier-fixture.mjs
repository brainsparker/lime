#!/usr/bin/env node

// Test-only public wire -> runtime -> provider -> cold-resume evidence.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
const binarySha256 = createHash("sha256")
  .update(await readFile(appServerBinaryPath))
  .digest("hex");
const { connectAppServerSidecar, stdioSidecar } = await import(
  pathToFileURL(path.join(repoRoot, "packages/app-server-client/dist/index.js"))
    .href
);
const temp = await mkdtemp(path.join(tmpdir(), "service-tier-fixture-"));
const fixture = await startOpenAiCompatibleFixtureServer({
  modelServiceTiers: [{ id: "priority" }, { id: "flex" }],
  modelDefaultServiceTier: "priority",
  content: "SERVICE_TIER_OK",
});
let connected;
const turns = [];

async function start() {
  connected = await connectAppServerSidecar(
    {
      ...stdioSidecar(appServerBinaryPath, undefined, path.join(temp, "data")),
      backendMode: "runtime",
    },
    { clientInfo: { name: "service-tier-fixture", version: "1" } },
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
      env: terminalGateRuntimeEnvironment({ appServerBinaryPath }),
      initializeTimeoutMs: 30_000,
    },
  );
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

async function runTurn(threadId, patch, expected) {
  const before = fixture.requests.length;
  const { turn } = await call("turn/start", {
    threadId,
    input: [{ type: "text", text: "reply SERVICE_TIER_OK" }],
    ...patch,
  });
  const deadline = Date.now() + 30_000;
  let canonical;
  while (Date.now() < deadline) {
    const read = await call("thread/read", { threadId, includeTurns: true });
    canonical = read.thread.turns.find((entry) => entry.id === turn.id);
    if (canonical && canonical.status !== "inProgress") break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(canonical?.status, "completed", JSON.stringify(canonical));
  const requests = fixture.requests.slice(before);
  assert.ok(
    requests.length > 0,
    "the real runtime must reach the loopback provider",
  );
  for (const request of requests)
    assert.equal(request.body.service_tier, expected);
  turns.push({
    turnId: turn.id,
    serviceTier: expected ?? null,
    requests: requests.length,
  });
}

try {
  await start();
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_, method, params) => call(method, params),
  });
  const fetched = await call("modelProvider/fetchModels", {
    providerId: provider.providerPreference,
  });
  const model = fetched.models.find(
    (entry) => entry.id === provider.modelPreference,
  );
  assert.deepEqual(
    model.serviceTiers.map((tier) => tier.id),
    ["priority", "flex"],
  );
  const defaults = buildToolExecutionThreadStartParams({
    provider,
    title: "Service tier defaults",
    workspaceRoot: temp,
  });
  const inherited = await call("thread/start", defaults);
  assert.equal(
    inherited.serviceTier,
    "priority",
    `Thread catalog default: ${JSON.stringify(inherited)}`,
  );
  await runTurn(inherited.thread.id, {}, "priority");
  const cleared = await call("thread/start", {
    ...defaults,
    serviceTier: null,
  });
  await runTurn(cleared.thread.id, {}, undefined);
  const started = await call("thread/start", {
    ...buildToolExecutionThreadStartParams({
      provider,
      title: "Service tier fixture",
      workspaceRoot: temp,
    }),
    serviceTier: "priority",
  });
  const threadId = started.thread.id;
  await runTurn(threadId, {}, "priority");
  const forked = await call("thread/fork", { threadId, serviceTier: null });
  await runTurn(forked.thread.id, {}, undefined);
  await assert.rejects(
    call("thread/resume", { threadId, serviceTier: null }),
    /serviceTier/,
  );
  await runTurn(threadId, { serviceTier: null }, undefined);
  await runTurn(threadId, {}, undefined);
  await connected.sidecar.close();
  await start();
  await call("thread/resume", { threadId, excludeTurns: true });
  await runTurn(threadId, {}, undefined);
  const beforeRejected = fixture.requests.length;
  await assert.rejects(
    call("turn/start", {
      threadId,
      input: [{ type: "text", text: "invalid tier" }],
      serviceTier: "unsupported",
    }),
    (error) => {
      assert.equal(
        error.response?.error?.data?.reasonCode,
        "service_tier_unsupported",
      );
      return true;
    },
  );
  assert.equal(
    fixture.requests.length,
    beforeRejected,
    "rejected tier must not execute",
  );
  await runTurn(threadId, {}, undefined);
  await runTurn(threadId, { serviceTier: "flex" }, "flex");
  await runTurn(threadId, {}, "flex");
  await connected.sidecar.close();
  await start();
  await call("thread/resume", { threadId, excludeTurns: true });
  await runTurn(threadId, {}, "flex");
  console.log(
    JSON.stringify({
      ok: true,
      backendMode: "runtime",
      liveProviderUsed: false,
      appServerBinaryPath,
      binarySha256,
      threadId,
      turns,
    }),
  );
} finally {
  await connected?.sidecar.close();
  await fixture.close();
  await rm(temp, { recursive: true, force: true });
}
