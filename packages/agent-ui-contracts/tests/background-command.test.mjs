import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeSequenceVerifier } from "../dist/index.js";

function event(id, eventClass, payload = {}, overrides = {}) {
  return {
    id,
    eventClass,
    payload,
    runtimeId: "app-server",
    threadId: "thread",
    turnId: "original",
    toolCallId: "command",
    sequence: 1,
    kind: "tool",
    status: "running",
    title: "Command",
    ...overrides,
  };
}

function command(status = "inProgress", processId = "process") {
  return {
    id: "command",
    type: "commandExecution",
    source: "unifiedExecStartup",
    processId,
    status,
  };
}

test("restore canonical Command scopes without emitting starts or reopening their Turn", () => {
  const verifier = createRuntimeSequenceVerifier();
  const snapshot = {
    threadId: "thread",
    turns: [
      {
        turnId: "original",
        terminal: true,
        commands: [
          { commandId: "command", processId: "process", active: true },
        ],
      },
    ],
  };
  assert.deepEqual(verifier.restoreCommands(snapshot), []);
  const scope = {
    eventId: "output",
    threadId: "thread",
    turnId: "original",
    commandId: "command",
  };
  assert.deepEqual(verifier.checkCommandStream(scope), []);
  for (const foreign of [
    { threadId: "foreign" },
    { turnId: "next" },
    { commandId: "other" },
    { processId: "other" },
  ]) {
    assert.equal(
      verifier.checkCommandStream({ ...scope, ...foreign }).length,
      1,
    );
  }
  assert.deepEqual(
    verifier.push(
      event("restored-exit", "command.exited", {
        canonical: command("completed"),
      }),
    ),
    [],
  );
  assert.deepEqual(
    verifier.restoreCommands(snapshot),
    [],
    "stale replay must not revive an exited Command",
  );
  assert.deepEqual(
    verifier.checkCommandStream(scope).map((v) => v.code),
    ["execution_after_turn_terminal"],
  );
  assert.deepEqual(
    verifier.push(event("late-model", "model.delta")).map((v) => v.code),
    ["execution_after_turn_terminal"],
  );
});

test("snapshot restore is atomic on process drift and completion only moves forward", () => {
  const verifier = createRuntimeSequenceVerifier();
  const snapshot = (commands) => ({
    threadId: "thread",
    turns: [{ turnId: "original", terminal: true, commands }],
  });
  const original = { commandId: "command", processId: "process", active: true };
  verifier.restoreCommands(snapshot([original]));
  assert.equal(
    verifier.restoreCommands(
      snapshot([
        { commandId: "new", processId: "new-process", active: true },
        { ...original, processId: "foreign" },
      ]),
    ).length,
    1,
  );
  const scope = {
    eventId: "output",
    threadId: "thread",
    turnId: "original",
    commandId: "new",
  };
  assert.equal(
    verifier.checkCommandStream(scope).length,
    1,
    "invalid snapshot cannot partially authorize a new Command",
  );
  assert.deepEqual(
    verifier.restoreCommands(snapshot([{ ...original, active: false }])),
    [],
  );
  assert.equal(
    verifier.checkCommandStream({ ...scope, commandId: "command" }).length,
    1,
  );
});

test("canonical session command outlives its Turn and completes only in its original process scope", () => {
  const verifier = createRuntimeSequenceVerifier();
  assert.deepEqual(
    verifier.push(event("start", "command.started", { canonical: command() })),
    [],
  );
  assert.deepEqual(verifier.push(event("turn-end", "turn.completed")), []);
  assert.deepEqual(
    verifier.push(event("other-turn", "model.delta", {}, { turnId: "next" })),
    [],
  );
  assert.deepEqual(
    verifier.push(
      event("output", "command.output", {
        commandId: "command",
        processId: "process",
      }),
    ),
    [],
  );
  for (const candidate of [
    event("wrong-process", "command.exited", {
      canonical: command("completed", "other"),
    }),
    event("wrong-item", "command.exited", {
      canonical: { ...command("completed"), id: "other" },
    }),
    event("late-model", "model.delta"),
    event("new-start", "command.started", { canonical: command() }),
  ]) {
    assert.deepEqual(
      verifier.push(candidate).map((v) => v.code),
      ["execution_after_turn_terminal"],
    );
  }
  assert.deepEqual(
    verifier.push(
      event("exit", "command.exited", { canonical: command("completed") }),
    ),
    [],
  );
  assert.deepEqual(
    verifier
      .push(
        event("late-output", "command.output", {
          commandId: "command",
          processId: "process",
        }),
      )
      .map((v) => v.code),
    ["execution_after_turn_terminal"],
  );
});

test("ordinary or unscoped commands must still close before their Turn", () => {
  for (const canonical of [
    undefined,
    command("inProgress", ""),
    { ...command(), source: "agent" },
  ]) {
    const verifier = createRuntimeSequenceVerifier();
    verifier.push(event("start", "command.started", { canonical }));
    assert.deepEqual(
      verifier.push(event("end", "turn.completed")).map((v) => v.code),
      ["command_unclosed_at_turn_end"],
    );
  }
});

test("unsequenced direct Command stream checks the shared active scope without inventing event ids", () => {
  const verifier = createRuntimeSequenceVerifier();
  verifier.push(event("start", "command.started", { canonical: command() }));
  const scope = {
    eventId: "item/commandExecution/outputDelta",
    threadId: "thread",
    turnId: "original",
    commandId: "command",
  };
  assert.deepEqual(verifier.checkCommandStream(scope), []);
  assert.deepEqual(
    verifier.checkCommandStream(scope),
    [],
    "repeated chunks have no synthetic sequence identity",
  );
  for (const overrides of [
    { threadId: "other" },
    { turnId: "other" },
    { commandId: "other" },
  ]) {
    assert.deepEqual(
      verifier
        .checkCommandStream({ ...scope, ...overrides })
        .map((v) => v.code),
      ["command_output_without_start"],
    );
  }
  assert.deepEqual(
    verifier
      .checkCommandStream({ ...scope, processId: "other" })
      .map((v) => v.code),
    ["command_process_scope_mismatch"],
  );
  verifier.push(event("end", "turn.completed"));
  assert.deepEqual(verifier.checkCommandStream(scope), []);
  verifier.push(
    event("exit", "command.exited", { canonical: command("completed") }),
  );
  assert.deepEqual(
    verifier.checkCommandStream(scope).map((v) => v.code),
    ["execution_after_turn_terminal"],
  );
});

test("active Turn also rejects Command process drift without losing its original lifecycle", () => {
  const verifier = createRuntimeSequenceVerifier();
  verifier.push(event("start", "command.started", { canonical: command() }));
  for (const candidate of [
    event("output-wrong", "command.output", {
      commandId: "command",
      processId: "other",
    }),
    event("interaction-wrong", "command.interaction", {
      commandId: "command",
      processId: "other",
    }),
    event("exit-wrong", "command.exited", {
      canonical: command("completed", "other"),
    }),
  ])
    assert.deepEqual(
      verifier.push(candidate).map((v) => v.code),
      ["command_process_scope_mismatch"],
    );
  assert.deepEqual(
    verifier.push(
      event("output", "command.output", {
        commandId: "command",
        processId: "process",
      }),
    ),
    [],
  );
  assert.deepEqual(
    verifier.push(
      event("exit", "command.exited", { canonical: command("completed") }),
    ),
    [],
  );
  assert.deepEqual(verifier.push(event("turn-end", "turn.completed")), []);
});
