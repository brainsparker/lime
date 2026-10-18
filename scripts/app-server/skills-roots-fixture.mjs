#!/usr/bin/env node

// Test-only two real SDK connections -> shared catalog/watch -> runtime prompt.
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
import {
  provisionToolExecutionFixtureProvider,
  buildToolExecutionThreadStartParams,
} from "../agent-runtime/tool-execution-current-contract.mjs";
import { terminalGateRuntimeEnvironment } from "./terminal-gate-binaries.mjs";
import { runPluginSkillsScenario } from "./plugin-skills-scenario.mjs";
import { runMarketplaceUpgradeScenario } from "./marketplace-upgrade-scenario.mjs";

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
assert.ok(process.env.APP_SERVER_BIN, "supply a fixed App Server artifact");
const binary = path.resolve(process.env.APP_SERVER_BIN);
const binarySha256 = createHash("sha256")
  .update(await readFile(binary))
  .digest("hex");
const { connectRemoteAppServer } = await import(
  pathToFileURL(path.join(repo, "packages/app-server-client/dist/index.js"))
    .href
);
const temp = await realpath(
  await mkdtemp(path.join(tmpdir(), "skills-roots-")),
);
const workspace = path.join(temp, "workspace");
const extra = path.join(temp, "extra");
const skill = path.join(extra, "watch-root-proof");
const projectSkill = path.join(
  workspace,
  ".agents",
  "skills",
  "workspace-watch-proof",
);
const peers = [];
const turns = [];
const captures = [];
const importedSources = [];
const importedWorkspace = process.argv.includes("--scope-import");
const legacyBinary = importedWorkspace
  ? process.env.WORKSPACE_LEGACY_BIN?.trim() || undefined
  : undefined;
const runFile = promisify(execFile);
let daemon;
let daemonExit;
let stderr = "";
let active;
let succeeded = false;
let coldRestarts = 0;
let marketplaceUpgrade;
const fixture = await startOpenAiCompatibleFixtureServer({
  scriptedResponses: [
    ({ body }) => {
      assert.ok(active, "Provider call must belong to a controlled Turn");
      const messages = body.messages ?? [];
      const currentUser = messages.findLastIndex(
        (message) =>
          message.role === "user" &&
          JSON.stringify(message.content).includes(active.prompt),
      );
      assert.ok(
        currentUser >= 0,
        active.label + ": missing current user input",
      );
      // Selected Skill bodies are current user context on this wire. Historical
      // raw Skill instructions remain history and do not identify this snapshot.
      const instructions = JSON.stringify([
        ...messages.filter((message) =>
          ["system", "developer"].includes(message.role),
        ),
        ...messages.slice(currentUser),
      ]);
      for (const marker of active.present)
        assert.ok(
          instructions.includes(marker),
          active.label + ": missing current Skill marker " + marker,
        );
      for (const marker of active.absent)
        assert.ok(
          !instructions.includes(marker),
          active.label + ": stale or disabled Skill marker " + marker,
        );
      captures.push({
        label: active.label,
        present: active.present,
        absent: active.absent,
        instructionsSha256: createHash("sha256")
          .update(instructions)
          .digest("hex"),
      });
      return { type: "text", content: "SKILLS_SNAPSHOT_DONE_" + active.index };
    },
  ],
});

async function start(serverBinary = binary) {
  await mkdir(workspace, { recursive: true });
  daemon = spawn(
    serverBinary,
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
      cwd: workspace,
      env: {
        ...terminalGateRuntimeEnvironment({
          appServerBinaryPath: serverBinary,
        }),
        RUST_LOG: "app_server_transport=info",
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  daemonExit = once(daemon, "exit");
  daemon.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-32000);
  });
  let endpoint;
  const deadline = Date.now() + 30000;
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
        if (port) endpoint = "ws://127.0.0.1:" + port;
      } catch (error) {
        if (error.code !== 1) throw error;
      }
    } else {
      const port = stderr.match(/websocket listening.*127\.0\.0\.1:(\d+)/)?.[1];
      if (port) endpoint = "ws://127.0.0.1:" + port;
    }
    if (endpoint) break;
    await delay(50);
  }
  assert.ok(endpoint, "owned daemon listener deadline: " + stderr);
  for (const name of ["skills-host", "skills-observer"]) {
    const connected = await connectRemoteAppServer(
      { websocketUrl: endpoint },
      {
        clientInfo: { name, version: "1" },
        capabilities: { experimentalApi: true },
      },
    );
    connected.connection.setServerRequestHandler((message) => {
      if (message.method === "currentTime/read") {
        connected.connection.respondServerRequest(message.id, {
          currentTimeAt: Math.floor(Date.now() / 1000),
        });
      } else {
        connected.connection.rejectServerRequest(message.id, {
          code: -32601,
          message: "Unsupported fixture server request: " + message.method,
        });
      }
      return true;
    });
    peers.push({ ...connected, changes: 0 });
  }
}

async function stop() {
  await Promise.all(peers.map((peer) => peer.transport.close()));
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
}

async function call(method, params, peer = peers[0]) {
  return (await peer.connection.request(peer.client.request(method, params)))
    .result;
}

async function changed(peer, label) {
  const deadline = Date.now() + 15000;
  try {
    while (Date.now() < deadline) {
      const message = await peer.connection.nextNotification(
        Math.max(1, deadline - Date.now()),
      );
      if (message.method === "skills/changed") {
        assert.deepEqual(message.params, {});
        peer.changes++;
        return;
      }
    }
    throw new Error("notification deadline elapsed");
  } catch (cause) {
    throw new Error(
      label + ": no skills/changed after mutation; stderr=" + stderr,
      { cause },
    );
  }
}

async function mutate(label, mutation) {
  console.error("Skills scenario=" + label);
  await mutation();
  await Promise.all(peers.map((peer) => changed(peer, label)));
}

async function writeSkill(directory, name, marker) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "SKILL.md"),
    "---\nname: " +
      name +
      "\ndescription: " +
      marker +
      "\n---\n\nControlled fixture Skill body.\n",
  );
}

async function catalog(name, peer = peers[0], cwd = workspace) {
  const response = await call(
    "skills/list",
    { cwds: [cwd], forceReload: false },
    peer,
  );
  return response.data
    .flatMap((entry) => entry.skills)
    .find((entry) => entry.name === name);
}

async function assertCatalog(name, marker, enabled = true) {
  for (const peer of peers) {
    const entry = await catalog(name, peer);
    if (marker === null) assert.equal(entry, undefined);
    else {
      assert.equal(entry?.description, marker);
      assert.equal(entry?.enabled, enabled);
    }
  }
}

async function turn(
  threadId,
  label,
  present,
  absent,
  overrides = {},
  skillNames = [
    "watch-root-proof",
    "workspace-watch-proof",
    "selected-watch-proof",
  ],
) {
  active = {
    index: turns.length + 1,
    label,
    present,
    absent,
    prompt: `Inspect the workspace using ${skillNames.map((name) => `$${name}`).join(", ")} for scenario ${label}`,
  };
  const captureBefore = captures.length;
  const response = await call("turn/start", {
    threadId,
    input: [
      {
        type: "text",
        text: active.prompt,
      },
    ],
    approvalPolicy: "never",
    sandboxPolicy: "danger-full-access",
    ...overrides,
  });
  const turnId = response.turn.id;
  const deadline = Date.now() + 30000;
  for (;;) {
    const message = await peers[0].connection.nextNotification(
      Math.max(1, deadline - Date.now()),
    );
    if (
      message.method === "turn/completed" &&
      message.params.threadId === threadId &&
      message.params.turn.id === turnId
    ) {
      assert.equal(
        message.params.turn.status,
        "completed",
        JSON.stringify(message),
      );
      break;
    }
    assert.ok(Date.now() < deadline, label + ": canonical Turn deadline");
  }
  assert.ok(
    captures.length > captureBefore,
    label + ": runtime must call the Provider",
  );
  const read = await call(
    "thread/read",
    { threadId, includeTurns: true },
    peers[1],
  );
  const canonical = read.thread.turns.find((turn) => turn.id === turnId);
  assert.equal(canonical?.status, "completed");
  assert.ok(
    JSON.stringify(canonical.items).includes(
      "SKILLS_SNAPSHOT_DONE_" + active.index,
    ),
  );
  turns.push({ threadId, turnId, label });
}

async function importWorkspace(id) {
  const root = path.join(temp, "source");
  const sourcePath = path.join(root, `rollout-${id}.jsonl`);
  await mkdir(root, { recursive: true });
  await writeFile(
    sourcePath,
    [
      {
        timestamp: "2026-06-16T00:00:00Z",
        type: "session_meta",
        payload: {
          id,
          cwd: workspace,
          source: "cli",
          model_provider: "openai",
          model: fixture.provider.modelPreference,
        },
      },
      {
        timestamp: "2026-06-16T00:00:01Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "Preserve imported workspace context.",
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join("\n") + "\n",
  );
  importedSources.push({
    sourcePath,
    sha256: createHash("sha256")
      .update(await readFile(sourcePath))
      .digest("hex"),
  });
  const started = await call("conversationImport/thread/commit", {
    sourceClient: "codex",
    sourceRoot: root,
    sourcePath,
    confirmed: true,
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { job } = await call("conversationImport/job/read", {
      jobId: started.job.jobId,
    });
    assert.notEqual(job.status, "failed", JSON.stringify(job));
    if (job.status === "completed") return job.result.session.threadId;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`import timed out: ${id}`);
}

try {
  await writeSkill(skill, "watch-root-proof", "EXTRA_BEFORE_WATCH_381");
  await writeSkill(
    projectSkill,
    "workspace-watch-proof",
    "PROJECT_BEFORE_WATCH_381",
  );
  await start(legacyBinary ?? binary);
  const provider = await provisionToolExecutionFixtureProvider({
    fixture,
    invoke: (_options, method, params) => call(method, params),
  });
  await mutate("extra roots registration", () =>
    call("skills/extraRoots/set", { extraRoots: [extra] }),
  );
  await assertCatalog("watch-root-proof", "EXTRA_BEFORE_WATCH_381");
  let threadId;
  if (importedWorkspace) {
    threadId = await importWorkspace("workspace-import-proof");
    await call("thread/settings/update", {
      threadId,
      model: provider.modelPreference,
      modelProvider: provider.providerPreference,
    });
    if (legacyBinary) {
      await stop();
      peers.length = 0;
      await start();
      coldRestarts++;
      await mutate("reopened process extra roots registration", () =>
        call("skills/extraRoots/set", { extraRoots: [extra] }),
      );
    }
    const imported = await call("thread/resume", {
      threadId,
      excludeTurns: true,
    });
    assert.equal(imported.cwd, workspace);
    assert.equal(imported.thread.extra.cwd, undefined);
    for (const key of ["importedContinuation", "importedThreadSettings"]) {
      for (const field of [
        "cwd",
        "workingDir",
        "workspaceRoot",
        "projectRoot",
        "runtimeWorkspaceRoots",
      ])
        assert.equal(
          imported.thread.extra[key]?.[field],
          undefined,
          key + "." + field,
        );
    }
  } else {
    const started = await call(
      "thread/start",
      buildToolExecutionThreadStartParams({
        provider,
        title: "Skills root proof",
        workspaceRoot: workspace,
      }),
    );
    threadId = started.thread.id;
  }
  await turn(
    threadId,
    "initial snapshot",
    ["EXTRA_BEFORE_WATCH_381", "PROJECT_BEFORE_WATCH_381"],
    [],
  );
  if (
    process.argv.includes("--marketplace-upgrade") ||
    process.argv.includes("--plugins")
  ) {
    const scenario = {
      temp,
      workspace,
      threadId,
      peers,
      call,
      turn,
      catalog,
      writeSkill,
      mutate,
      start,
      stop,
    };
    if (process.argv.includes("--marketplace-upgrade")) {
      marketplaceUpgrade = await runMarketplaceUpgradeScenario(scenario);
      coldRestarts += marketplaceUpgrade.coldRestarts;
    } else {
      coldRestarts += await runPluginSkillsScenario(scenario);
    }
  } else if (
    process.argv.includes("--scope-cwd") ||
    process.argv.includes("--scope-root") ||
    process.argv.includes("--scope-turn")
  ) {
    const selected = path.join(temp, "selected-workspace");
    const selectedSkill = path.join(
      selected,
      ".agents",
      "skills",
      "selected-watch-proof",
    );
    await writeSkill(
      selectedSkill,
      "selected-watch-proof",
      "SELECTED_BEFORE_WATCH_381",
    );
    let selectedThreadId = threadId;
    if (process.argv.includes("--scope-root")) {
      const selectedThread = await call("thread/start", {
        ...buildToolExecutionThreadStartParams({
          provider,
          title: "Selected workspace root proof",
          workspaceRoot: workspace,
        }),
        runtimeWorkspaceRoots: [selected],
      });
      selectedThreadId = selectedThread.thread.id;
    } else if (!process.argv.includes("--scope-turn")) {
      await call("thread/settings/update", { threadId, cwd: selected });
    }
    await turn(
      selectedThreadId,
      "selected workspace snapshot",
      ["SELECTED_BEFORE_WATCH_381"],
      [],
      process.argv.includes("--scope-turn")
        ? { cwd: selected, runtimeWorkspaceRoots: [selected] }
        : {},
    );
    if (process.argv.includes("--scope-turn")) {
      const read = await call(
        "thread/read",
        { threadId, includeTurns: false },
        peers[1],
      );
      assert.deepEqual(
        {
          cwd: read.thread.cwd,
          roots: read.thread.extra.runtimeWorkspaceRoots,
        },
        { cwd: selected, roots: [selected] },
        "turn/start workspace overrides must persist for subsequent turns",
      );
      await turn(
        threadId,
        "inherited workspace snapshot",
        ["SELECTED_BEFORE_WATCH_381"],
        ["PROJECT_BEFORE_WATCH_381"],
      );
    }
    if (importedWorkspace && process.argv.includes("--scope-turn")) {
      await turn(
        threadId,
        "import roots inherited independently from cwd",
        ["SELECTED_BEFORE_WATCH_381", "PROJECT_BEFORE_WATCH_381"],
        [],
        { runtimeWorkspaceRoots: [workspace] },
      );
      await turn(
        threadId,
        "import roots cleared",
        ["SELECTED_BEFORE_WATCH_381"],
        ["PROJECT_BEFORE_WATCH_381"],
        { runtimeWorkspaceRoots: [] },
      );
      const cleared = await call(
        "thread/read",
        { threadId, includeTurns: false },
        peers[1],
      );
      assert.deepEqual(cleared.thread.extra.runtimeWorkspaceRoots, []);
      await turn(
        threadId,
        "import cleared roots inherited",
        ["SELECTED_BEFORE_WATCH_381"],
        ["PROJECT_BEFORE_WATCH_381"],
      );
    }
    // Drain delayed changes from setup before testing this root's own edit.
    await Promise.all(
      peers.map(async (peer) => {
        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
          try {
            await peer.connection.nextNotification(
              Math.max(1, deadline - Date.now()),
            );
          } catch (error) {
            if (
              !String(error).includes(
                "timed out waiting for app-server message",
              )
            )
              throw error;
            break;
          }
        }
      }),
    );
    await mutate("updated Thread workspace root edit", () =>
      writeSkill(
        selectedSkill,
        "selected-watch-proof",
        "SELECTED_AFTER_WATCH_381",
      ),
    );
    for (const peer of peers) {
      const entry = await catalog("selected-watch-proof", peer, selected);
      assert.equal(entry?.description, "SELECTED_AFTER_WATCH_381");
    }
    await turn(
      selectedThreadId,
      "selected workspace refreshed",
      ["SELECTED_AFTER_WATCH_381"],
      ["SELECTED_BEFORE_WATCH_381"],
    );
    if (process.argv.includes("--scope-turn") || importedWorkspace) {
      await stop();
      peers.length = 0;
      await start();
      coldRestarts++;
      const resumed = await call("thread/resume", {
        threadId,
        excludeTurns: true,
      });
      assert.equal(resumed.cwd, selected);
      assert.deepEqual(
        resumed.runtimeWorkspaceRoots,
        importedWorkspace ? [] : [selected],
      );
      await turn(
        threadId,
        "cold workspace snapshot",
        ["SELECTED_AFTER_WATCH_381"],
        ["SELECTED_BEFORE_WATCH_381", "PROJECT_BEFORE_WATCH_381"],
      );
    }
  } else {
    await mutate("registered extra root edit", () =>
      writeSkill(skill, "watch-root-proof", "EXTRA_AFTER_WATCH_381"),
    );
    await assertCatalog("watch-root-proof", "EXTRA_AFTER_WATCH_381");
    await turn(
      threadId,
      "extra root refreshed",
      ["EXTRA_AFTER_WATCH_381"],
      ["EXTRA_BEFORE_WATCH_381"],
    );
    await mutate("registered extra root deletion", () =>
      rm(skill, { recursive: true }),
    );
    await assertCatalog("watch-root-proof", null);
    await mutate("registered extra root recreation", () =>
      writeSkill(skill, "watch-root-proof", "EXTRA_RECREATED_WATCH_381"),
    );
    await assertCatalog("watch-root-proof", "EXTRA_RECREATED_WATCH_381");
    await mutate("Thread project root edit", () =>
      writeSkill(
        projectSkill,
        "workspace-watch-proof",
        "PROJECT_AFTER_WATCH_381",
      ),
    );
    await assertCatalog("workspace-watch-proof", "PROJECT_AFTER_WATCH_381");
    await turn(
      threadId,
      "workspace root refreshed",
      ["EXTRA_RECREATED_WATCH_381", "PROJECT_AFTER_WATCH_381"],
      ["PROJECT_BEFORE_WATCH_381", "EXTRA_AFTER_WATCH_381"],
    );
    await mutate("disabled Skill config", () =>
      call("skills/config/write", {
        path: path.join(skill, "SKILL.md"),
        enabled: false,
      }),
    );
    await assertCatalog("watch-root-proof", "EXTRA_RECREATED_WATCH_381", false);
    await turn(
      threadId,
      "disabled snapshot",
      ["PROJECT_AFTER_WATCH_381"],
      ["EXTRA_RECREATED_WATCH_381"],
    );
    await mutate("reenabled Skill config", () =>
      call("skills/config/write", {
        path: path.join(skill, "SKILL.md"),
        enabled: true,
      }),
    );
    await turn(
      threadId,
      "reenabled snapshot",
      ["EXTRA_RECREATED_WATCH_381"],
      [],
    );
    await mutate("extra root replaced", () =>
      call("skills/extraRoots/set", { extraRoots: [] }),
    );
    await assertCatalog("watch-root-proof", null);
    await turn(
      threadId,
      "removed root snapshot",
      ["PROJECT_AFTER_WATCH_381"],
      ["EXTRA_RECREATED_WATCH_381"],
    );
    if (process.argv.includes("--disabled-project")) {
      await mutate("disabled project Skill config", () =>
        call("skills/config/write", {
          path: path.join(projectSkill, "SKILL.md"),
          enabled: false,
        }),
      );
      await assertCatalog(
        "workspace-watch-proof",
        "PROJECT_AFTER_WATCH_381",
        false,
      );
      await turn(
        threadId,
        "disabled project snapshot",
        [],
        ["PROJECT_AFTER_WATCH_381", "EXTRA_RECREATED_WATCH_381"],
      );
    }
  }
  for (const source of importedSources)
    assert.equal(
      createHash("sha256")
        .update(await readFile(source.sourcePath))
        .digest("hex"),
      source.sha256,
      "source rollout must remain unchanged",
    );
  const output = path.resolve(
    process.env.SKILLS_ROOTS_EVIDENCE ??
      ".lime/qc/shared-backend/s09a/skills-roots-runtime.json",
  );
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        schema: "skills-roots-runtime-v1",
        appServerBinary: binary,
        binarySha256,
        notificationsPerConnection: peers.map((peer) => peer.changes),
        turns,
        captures,
        importedSources,
        legacyBinary: legacyBinary
          ? {
              path: legacyBinary,
              sha256: createHash("sha256")
                .update(await readFile(legacyBinary))
                .digest("hex"),
            }
          : null,
        liveProviderUsed: false,
        runtimePromptVerified: true,
        coldRestarts,
        marketplaceUpgrade,
        multipleHostsVerified: true,
        hosts: "two SDK WebSocket connections; no GUI or PTY claim",
        platform: process.platform,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ ok: true, output, turns: turns.length }));
  succeeded = true;
} catch (error) {
  console.error("Skills fixture retained: " + temp);
  console.error(
    JSON.stringify(
      fixture.requests.map((request) => ({
        path: request.path,
        responseError: request.responseError,
        bodyKeys: Object.keys(request.body),
        roles: (request.body.messages ?? request.body.input ?? []).map(
          (message) => message.role,
        ),
        markers: (request.body.messages ?? request.body.input ?? []).map(
          (message) => ({
            role: message.role,
            markers: JSON.stringify(message.content).match(
              /(?:EXTRA|PROJECT)_[A-Z_]+_381/g,
            ),
          }),
        ),
      })),
    ),
  );
  throw error;
} finally {
  await stop();
  await fixture.close();
  if (succeeded) await rm(temp, { recursive: true, force: true });
}
