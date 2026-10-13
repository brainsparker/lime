import assert from "node:assert/strict";
import test from "node:test";
import {
  AppServerConnection,
  createAgentRuntimeClient,
} from "../dist/index.js";

test("public lifecycle pipeline retains the original session Command after model Turn completion", async () => {
  const runtime = createAgentRuntimeClient(
    new AppServerConnection({
      send() {},
      async nextMessage() {
        throw new Error("unexpected transport read");
      },
    }),
  );
  const received = [];
  runtime.subscribeLifecycleEvents((notification) =>
    received.push(notification),
  );
  const command = {
    id: "command",
    type: "commandExecution",
    source: "unifiedExecStartup",
    processId: "process",
    command: "wait for release",
    cwd: "/workspace",
    status: "inProgress",
    aggregatedOutput: "ready\n",
  };
  const events = [
    {
      method: "turn/started",
      params: {
        threadId: "thread",
        turn: { id: "original", status: "inProgress", startedAt: 1 },
      },
    },
    {
      method: "item/started",
      params: {
        threadId: "thread",
        turnId: "original",
        item: command,
        startedAtMs: 1,
      },
    },
    {
      method: "turn/completed",
      params: {
        threadId: "thread",
        turn: {
          id: "original",
          status: "completed",
          startedAt: 1,
          completedAt: 2,
        },
      },
    },
    {
      method: "turn/started",
      params: {
        threadId: "thread",
        turn: { id: "next", status: "inProgress", startedAt: 3 },
      },
    },
    {
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread",
        turnId: "original",
        itemId: "command",
        delta: "tail\n",
      },
    },
    {
      method: "item/commandExecution/terminalInteraction",
      params: {
        threadId: "thread",
        turnId: "original",
        itemId: "command",
        processId: "process",
        stdin: "sent 9 chars",
      },
    },
    {
      method: "item/completed",
      params: {
        threadId: "thread",
        turnId: "original",
        item: {
          ...command,
          status: "completed",
          exitCode: 0,
          aggregatedOutput: "ready\ntail\n",
        },
        completedAtMs: 4,
      },
    },
  ];
  for (const event of events)
    assert.equal(await runtime.dispatchEvent(event), true);
  assert.deepEqual(received, events);
  assert.equal(await runtime.dispatchEvent(events[4]), false);
  assert.deepEqual(received, events, "late output must not reach subscribers");
});
