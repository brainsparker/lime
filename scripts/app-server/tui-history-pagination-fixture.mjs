#!/usr/bin/env node

import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { deepStrictEqual } from "node:assert";
import { localAppServerBinaryPath } from "../lib/electron-dev-sidecar.mjs";
import { buildTerminalGateBinaries } from "./terminal-gate-binaries.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const clientDistPath = path.join(
  rootDir,
  "packages",
  "app-server-client",
  "dist",
  "index.js",
);
const cliBinaryName = process.platform === "win32" ? "lime.exe" : "lime";
const defaultCliBinaryPath = path.join(
  rootDir,
  "lime-rs",
  "target",
  "debug",
  cliBinaryName,
);

const {
  PROTOCOL_VERSION,
  connectAppServerSidecar,
  resolveSidecarBinaryPath,
  sidecarArgs,
  stdioSidecar,
} = await import(pathToFileURL(clientDistPath).href);

async function main() {
  await buildTerminalGateBinaries({ env: process.env, repoRoot: rootDir });
  const cliBinaryPath = path.resolve(
    process.env.LIME_CLI_BIN || defaultCliBinaryPath,
  );
  const appServerBinaryPath = path.resolve(
    process.env.APP_SERVER_BIN ||
      localAppServerBinaryPath({ repoRoot: rootDir }),
  );
  await Promise.all([
    assertExists(cliBinaryPath, "lime"),
    assertExists(appServerBinaryPath, "app-server"),
  ]);
  const runtimeEnv = await resolveRuntimeEnvironment();

  const tempDir = await mkdtemp(path.join(tmpdir(), "tui-history-pagination-"));
  const dataDir = path.join(tempDir, "data");
  const appDataDir = path.join(tempDir, "app-data");
  const backendPath = path.join(tempDir, "history-backend.mjs");
  const ledgerPath = path.join(tempDir, "history-backend.jsonl");
  let connected;
  try {
    await writeFile(backendPath, backendSource());
    const config = {
      ...stdioSidecar(appServerBinaryPath, undefined, dataDir),
      backendMode: "external",
      backendCommand: process.execPath,
      backendArgs: [backendPath, ledgerPath],
      backendTimeoutMs: 5_000,
    };
    connected = await connectAppServerSidecar(
      config,
      {
        clientInfo: { name: "tui-history-pagination-fixture", version: "1" },
        capabilities: { experimentalApi: true },
      },
      {
        initializeTimeoutMs: 10_000,
        expectedProtocolVersion: PROTOCOL_VERSION,
        args: [...sidecarArgs(config), "--app-data-dir", appDataDir],
        env: runtimeEnv,
      },
    );

    const connection = connected.connection;
    const started = await connection.startSession({
      cwd: tempDir,
      runtimeWorkspaceRoots: [tempDir],
      model: "fixture-model",
      modelProvider: "fixture-provider",
      historyMode: "paginated",
    });
    assertHistoryMode(started, "paginated");
    const threadId = started.result.thread.id;

    // Each completed turn contributes a user and assistant item. The paginated thread spans at
    // least three 100-item pages, matching Codex's complete transcript contract; legacy still
    // crosses its single-page boundary without paying the extra setup cost.
    await seedCompletedTurns(connection, threadId, "SEED", 101);

    const legacyStarted = await connection.startSession({
      cwd: tempDir,
      runtimeWorkspaceRoots: [tempDir],
      model: "fixture-model",
      modelProvider: "fixture-provider",
      historyMode: "legacy",
    });
    assertHistoryMode(legacyStarted, "legacy");
    const legacyThreadId = legacyStarted.result.thread.id;
    await seedCompletedTurns(connection, legacyThreadId, "LEGACY", 51);

    const readingStarted = await connection.startSession({
      cwd: tempDir,
      runtimeWorkspaceRoots: [tempDir],
      model: "fixture-model",
      modelProvider: "fixture-provider",
      historyMode: "paginated",
    });
    assertHistoryMode(readingStarted, "paginated");
    const readingThreadId = readingStarted.result.thread.id;
    const readingTurn = await connection.startTurn({
      threadId: readingThreadId,
      input: [{ type: "text", text: "GROUP_SEED" }],
    });
    await drainTurnCompletion(
      connection,
      readingTurn,
      readingTurn.result.turn.id,
    );
    const readingThread = await connection.readThread({
      threadId: readingThreadId,
      includeTurns: true,
    });
    const seededTurn = readingThread.result.thread.turns.find(
      (turn) => turn.id === readingTurn.result.turn.id,
    );
    if (seededTurn?.status !== "completed") {
      throw new Error(
        `reading seed failed: ${JSON.stringify(seededTurn?.error)}`,
      );
    }
    const readingStats = await threadItemStats(connection, readingThreadId);
    assertPagination(readingStats, { minimumItems: 122, minimumPages: 2 });
    const readingPage = await connection.listThreadItems({
      threadId: readingThreadId,
      limit: 100,
      sortDirection: "desc",
    });
    const initialActions = readingPage.result.data.filter(
      (entry) => entry.item.type === "mcpToolCall",
    ).length;
    if (initialActions !== 99) {
      throw new Error(
        `reading group must cross the page: actions=${initialActions}`,
      );
    }

    const commandStarted = await connection.startSession({
      cwd: tempDir,
      runtimeWorkspaceRoots: [tempDir],
      model: "fixture-model",
      modelProvider: "fixture-provider",
      historyMode: "paginated",
    });
    const commandThreadId = commandStarted.result.thread.id;
    const commandTurn = await connection.startTurn({
      threadId: commandThreadId,
      input: [{ type: "text", text: "COMMAND_SEED" }],
    });
    const commandNotifications = await drainTurnCompletion(
      connection,
      commandTurn,
      commandTurn.result.turn.id,
    );
    const commandRead = await connection.readThread({
      threadId: commandThreadId,
      includeTurns: true,
    });
    const commandItems = commandRead.result.thread.turns
      .flatMap((turn) => turn.items)
      .filter((item) => item.type === "commandExecution");
    deepStrictEqual(
      commandItems.map((item) =>
        item.commandActions.map((action) => action.type),
      ),
      [["read"], ["read"], ["search", "listFiles"], ["unknown"], ["read"]],
    );
    deepStrictEqual(
      commandItems[0].commandActions[0].path,
      path.join(tempDir, "docs/guide one.md"),
    );
    deepStrictEqual(commandItems[4].source, "userShell");
    for (const item of commandItems) {
      for (const method of ["item/started", "item/completed"]) {
        const notification = commandNotifications.find(
          (entry) =>
            entry.method === method && entry.params?.item?.id === item.id,
        );
        deepStrictEqual(
          notification?.params.item.commandActions,
          item.commandActions,
        );
      }
    }
    const commandPage = await connection.listThreadItems({
      threadId: commandThreadId,
      limit: 100,
      sortDirection: "asc",
    });
    deepStrictEqual(
      commandPage.result.data
        .filter((entry) => entry.item.type === "commandExecution")
        .map((entry) => entry.item),
      commandItems,
    );
    await writeFile(
      path.join(tempDir, "command-actions-live-read.json"),
      JSON.stringify(
        {
          threadId: commandThreadId,
          notifications: commandNotifications,
          thread: commandRead.result.thread,
          page: commandPage.result,
        },
        null,
        2,
      ),
    );

    const review = await connection.startReview({
      threadId,
      delivery: "inline",
      target: { type: "commit", sha: "fixture-sha", title: "fixture review" },
    });
    await drainTurnCompletion(connection, review, review.result.turn.id);

    const blocked = connection.startTurn({
      threadId,
      input: [{ type: "text", text: "NESTED_REVIEW_PROMPT" }],
    });
    const blockedTurnId = await waitForInProgressTurn(connection, threadId);
    await connection.steerTurn({
      threadId,
      expectedTurnId: blockedTurnId,
      clientUserMessageId: "nested-review-duplicate",
      input: [{ type: "text", text: "NESTED_REVIEW_PROMPT" }],
    });
    // Fork while the tail turn is still in progress. The runtime snapshots that turn as
    // Interrupted with no completion timestamp, matching Codex's nested-review replay shape
    // while preserving the canonical duplicate UserMessage items.
    const forked = await connection.forkThread({
      threadId,
      excludeTurns: true,
    });
    assertHistoryMode(forked, "paginated");
    const resumeThreadId = forked.result.thread.id;
    const paginatedStats = await threadItemStats(connection, resumeThreadId);
    assertPagination(paginatedStats, { minimumItems: 201, minimumPages: 3 });
    const legacyStats = await threadItemStats(connection, legacyThreadId);
    assertPagination(legacyStats, { minimumItems: 101, minimumPages: 2 });

    // Stop the seed sidecar before launching the independent TUI sidecar.
    await connected.sidecar.close("SIGKILL");
    connected = undefined;
    await blocked.catch(() => undefined);

    const metadataPath = path.join(tempDir, "thread.json");
    await writeFile(
      metadataPath,
      JSON.stringify({
        threadId: resumeThreadId,
        tempDir,
        dataDir,
        appDataDir,
        backendPath,
        ledgerPath,
        legacyThreadId,
        readingThreadId,
        commandThreadId,
      }),
    );
    const evidence = await execFileAsync(
      process.env.CARGO || "cargo",
      [
        "test",
        "--locked",
        "--manifest-path",
        path.join(rootDir, "lime-rs", "Cargo.toml"),
        "-p",
        "tui",
        "--test",
        "all",
        "suite::history_pagination::",
        "--",
        "--test-threads=1",
        "--nocapture",
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          ...runtimeEnv,
          LIME_TEST_TUI_HISTORY_PAGINATION: "1",
          LIME_TEST_CLI_BIN: cliBinaryPath,
          LIME_TEST_APP_SERVER_BIN: appServerBinaryPath,
          LIME_TEST_TERMINAL_BACKEND: backendPath,
          LIME_TEST_TERMINAL_LEDGER: ledgerPath,
          LIME_TEST_TERMINAL_CWD: tempDir,
          LIME_TEST_NODE_BIN: process.execPath,
          ...(runtimeEnv.DYLD_LIBRARY_PATH
            ? { LIME_TEST_DYLD_LIBRARY_PATH: runtimeEnv.DYLD_LIBRARY_PATH }
            : {}),
          LIME_TEST_TUI_HISTORY_THREAD_ID: resumeThreadId,
          LIME_TEST_TUI_LEGACY_THREAD_ID: legacyThreadId,
          LIME_TEST_TUI_READING_THREAD_ID: readingThreadId,
          LIME_TEST_TUI_COMMAND_THREAD_ID: commandThreadId,
          LIME_TEST_TUI_GATE_B: "1",
        },
        maxBuffer: 4 * 1024 * 1024,
        timeout: 180_000,
        windowsHide: true,
      },
    );
    const copyMarker = evidence.stdout.match(
      /TUI_COPY_HISTORY_OK thread=(\S+) pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=restored turns=none terminal=restored/u,
    );
    if (!copyMarker) {
      throw new Error(
        "copy history PTY fixture did not prove canonical pages and terminal restoration",
      );
    }
    if (copyMarker[1] !== resumeThreadId) {
      throw new Error(
        "copy history PTY evidence belongs to a different canonical thread",
      );
    }
    console.log(copyMarker[0]);
    const selectionMarker = evidence.stdout.match(
      /TUI_SELECTION_HISTORY_OK thread=(\S+) gesture=mouse pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=selection-first turns=none terminal=restored/u,
    );
    if (!selectionMarker || selectionMarker[1] !== resumeThreadId) {
      throw new Error(
        "ordinary selection PTY fixture did not prove history and restoration for the canonical thread",
      );
    }
    console.log(selectionMarker[0]);
    const mainSelectionMarker = evidence.stdout.match(
      /TUI_MAIN_SELECTION_HISTORY_OK thread=(\S+) gesture=mouse pages=canonical oldest=SEED_000 latest=frozen resize=preserved cancel=selection-only draft=preserved overlay=none turns=none terminal=restored/u,
    );
    if (!mainSelectionMarker || mainSelectionMarker[1] !== resumeThreadId) {
      throw new Error(
        "main selection PTY fixture did not prove canonical history, draft and terminal restoration",
      );
    }
    console.log(mainSelectionMarker[0]);
    const readingMarker = evidence.stdout.match(
      /TUI_READING_HISTORY_OK thread=(\S+) transport=ws-relay-real-stdio initial=99 joined=120 reading=retained navigation=current selection=retained resize=preserved latest=restored turns=none terminal=restored/u,
    );
    if (!readingMarker || readingMarker[1] !== readingThreadId) {
      throw new Error(
        "reading revision PTY fixture did not prove the canonical group join through the real App Server",
      );
    }
    console.log(readingMarker[0]);
    const commandMarker = evidence.stdout.match(
      /TUI_COMMAND_ACTIONS_OK thread=(\S+) transport=real-stdio read=grouped search=listFiles unknown=opaque userShell=separate resize=preserved turns=none terminal=restored/u,
    );
    if (!commandMarker || commandMarker[1] !== commandThreadId) {
      throw new Error(
        "command action PTY evidence is missing for the canonical thread",
      );
    }
    console.log(commandMarker[0]);
    console.log(
      `[smoke:tui-history-pagination] ok paginated=${resumeThreadId} pages=${paginatedStats.pages} items=${paginatedStats.items} legacy=${legacyThreadId} pages=${legacyStats.pages} items=${legacyStats.items} review=nested-filtered underfilled=auto-filled alternate-screen=restored`,
    );
  } finally {
    await connected?.sidecar.close("SIGKILL").catch(() => undefined);
    if (process.env.LIME_KEEP_TUI_HISTORY_PAGINATION_TMP !== "1") {
      await rm(tempDir, { recursive: true, force: true });
    } else {
      console.error(`[smoke:tui-history-pagination] kept temp dir ${tempDir}`);
    }
  }
}

function assertHistoryMode(started, expected) {
  const actual = started?.result?.thread?.historyMode;
  if (actual !== expected) {
    throw new Error(
      `thread/start historyMode mismatch: expected=${expected} actual=${actual}`,
    );
  }
}

async function seedCompletedTurns(connection, threadId, prefix, count) {
  for (let index = 0; index < count; index += 1) {
    const result = await connection.startTurn({
      threadId,
      input: [
        { type: "text", text: `${prefix}_${String(index).padStart(3, "0")}` },
      ],
    });
    await drainTurnCompletion(connection, result, result.result.turn.id);
  }
}

async function threadItemStats(connection, threadId) {
  const seenCursors = new Set();
  let cursor;
  let items = 0;
  let pages = 0;
  while (true) {
    const response = await connection.listThreadItems({
      threadId,
      cursor,
      limit: 100,
      sortDirection: "desc",
    });
    pages += 1;
    items += response.result.data.length;
    const nextCursor = response.result.nextCursor;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) {
      throw new Error(
        `thread/items/list repeated cursor for ${threadId}: ${nextCursor}`,
      );
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  return { items, pages };
}

function assertPagination(actual, expected) {
  if (
    actual.items < expected.minimumItems ||
    actual.pages < expected.minimumPages
  ) {
    throw new Error(
      `history pagination too small: expected>=${expected.minimumItems} items/${expected.minimumPages} pages actual=${actual.items} items/${actual.pages} pages`,
    );
  }
}

async function resolveRuntimeEnvironment() {
  if (process.platform !== "darwin") {
    return {};
  }
  const libraryDirs = [path.join(rootDir, "lime-rs", "target", "debug")];
  const prebuiltRoot = path.join(
    rootDir,
    "lime-rs",
    "target",
    "sherpa-onnx-prebuilt",
  );
  const entries = await readdir(prebuiltRoot, { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const libDir = path.join(prebuiltRoot, entry.name, "lib");
    try {
      await access(libDir);
      libraryDirs.push(libDir);
    } catch {
      // Optional prebuilt variants are absent on most developer machines.
    }
  }
  if (process.env.DYLD_LIBRARY_PATH) {
    libraryDirs.push(process.env.DYLD_LIBRARY_PATH);
  }
  return { DYLD_LIBRARY_PATH: libraryDirs.join(path.delimiter) };
}

async function drainTurnCompletion(connection, initial, turnId) {
  const notifications = initial.notifications || [];
  if (
    notifications.some(
      (entry) =>
        entry.method === "turn/completed" && entry.params?.turn?.id === turnId,
    )
  ) {
    return notifications;
  }
  while (true) {
    const notification = await connection.nextNotification(30_000);
    notifications.push(notification);
    if (
      notification.method === "turn/completed" &&
      notification.params?.turn?.id === turnId
    ) {
      return notifications;
    }
  }
}

async function waitForInProgressTurn(connection, threadId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const read = await connection.readThread({ threadId, includeTurns: true });
    const turn = [...(read.result.thread.turns || [])]
      .reverse()
      .find((candidate) => candidate.status === "inProgress");
    if (turn?.id) return turn.id;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("blocked turn did not become inProgress");
}

async function assertExists(target, label) {
  try {
    await access(target);
  } catch {
    throw new Error(`${label} binary not found: ${target}`);
  }
}

function backendSource() {
  return `#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));
const ledger = process.argv[2];
const request = input.request || {};
const text = JSON.stringify(request.input || []);
const turnId = request.turn?.turnId || null;
const threadId = request.session?.threadId || null;
const blocked = input.kind === "turnStart" && text.includes("NESTED_REVIEW_PROMPT");
let events = [{ type: "turn.started", payload: {} }];
if (input.kind === "turnStart" && !blocked) {
  const group = text.includes("GROUP_SEED");
  const commandActions = text.includes("COMMAND_SEED");
  if (commandActions) {
    const commands = [
      "cd docs && cat 'guide one.md'",
      "cat README.md | head -n 3",
      "rg -n 'COMMAND_QUERY' src; rg --files lib",
      "cat README.md && cargo test",
      "cat USER_SHELL.md",
    ];
    for (let index = 0; index < commands.length; index += 1) {
      const item = {
        sessionId: request.session.sessionId,
        threadId,
        turnId,
        itemId: "item_command-" + index + "-" + turnId,
        sequence: index + 2,
        ordinal: index + 2,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        completedAtMs: Date.now(),
        kind: "command",
        status: "completed",
        payload: { type: "command", command: commands[index], cwd: request.runtimeOptions.runtimeRequest.workingDir, output: "canonical command result", exitCode: 0 },
        metadata: index === 4 ? { commandExecutionSource: "userShell" } : {},
      };
      const started = { ...item, status: "inProgress", payload: { ...item.payload } };
      delete started.completedAtMs;
      delete started.payload.output;
      delete started.payload.exitCode;
      events.push({ type: "item.started", payload: { item: started } });
      events.push({ type: "item.completed", payload: { item } });
      if (index === 1) {
        const itemId = "command-separator-" + turnId;
        events.push({ type: "message.delta", payload: { itemId, text: "COMMAND_READS_DONE" } });
        events.push({ type: "message.completed", payload: { itemId, status: "completed", text: "COMMAND_READS_DONE" } });
      }
    }
  }
  if (group) {
    for (let index = 0; index < 120; index += 1) {
      const item = {
        sessionId: request.session.sessionId,
        threadId,
        turnId,
        itemId: "reading-action-" + index + "-" + turnId,
        sequence: index + 2,
        ordinal: index + 2,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        completedAtMs: Date.now(),
        kind: "mcpToolCall",
        status: "completed",
        payload: {
          type: "mcpToolCall",
          call_id: "reading-action-" + index,
          server_name: "cua_repl",
          tool_name: "js",
          arguments: [],
          output: { text: "canonical action " + index, truncated: false },
        },
        metadata: {},
      };
      const started = { ...item, status: "inProgress", payload: { ...item.payload } };
      delete started.completedAtMs;
      delete started.payload.output;
      events.push({ type: "item.started", payload: { item: started } });
      events.push({ type: "item.completed", payload: { item } });
    }
  }
  const assistantText = group
    ? Array.from({ length: 45 }, (_, index) => "READING_SURVIVING_ROW_" + String(index).padStart(2, "0")).join("\\n")
    : commandActions ? "COMMAND_ACTIONS_DONE" : text.match(/(?:SEED|LEGACY)_\\d{3}/)?.[0] || "review complete";
  events.push({ type: "message.delta", payload: { itemId: "assistant-" + turnId, text: assistantText } });
  events.push({ type: "message.completed", payload: { itemId: "assistant-" + turnId, status: "completed", text: assistantText } });
  events.push({ type: "turn.completed", payload: { status: "completed" } });
} else if (input.kind === "turnCancel") {
  events = [{ type: "turn.canceled", payload: { status: "canceled" } }];
}
appendFileSync(ledger, JSON.stringify({ kind: input.kind, threadId, turnId, blocked, eventTypes: events.map((event) => event.type) }) + "\\n");
console.log(JSON.stringify({ events }));
if (blocked) { setInterval(() => {}, 1000); await new Promise(() => {}); }
`;
}

main().catch((error) => {
  if (error.stdout) console.error(error.stdout);
  console.error(
    `[smoke:tui-history-pagination] failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
