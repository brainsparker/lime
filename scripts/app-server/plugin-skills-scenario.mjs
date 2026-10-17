import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Test-only scenario; transports, runtime Turns and Provider capture stay in the
// shared Skills fixture. No alternative catalog or simulated notifications.
export async function runPluginSkillsScenario({
  temp,
  workspace,
  threadId,
  peers,
  call,
  turn: runTurn,
  catalog,
  writeSkill,
  mutate,
  start,
  stop,
}) {
  function turn(threadId, label, present, absent) {
    return runTurn(threadId, label, present, absent, {}, [
      "watch-root-proof",
      "workspace-watch-proof",
      "watch-plugin:selected-watch-proof",
    ]);
  }

  const source = path.join(temp, "plugin-source");
  await writeSkill(
    path.join(source, "skills", "selected-watch-proof"),
    "selected-watch-proof",
    "PLUGIN_BEFORE_WATCH_381",
  );
  await writeFile(
    path.join(source, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "watch-plugin",
      version: "1.0.0",
      description: "Controlled plugin Skills",
    }),
  );
  const marketplacePath = path.join(temp, ".agents/plugins/marketplace.json");
  await mkdir(path.dirname(marketplacePath), { recursive: true });
  await writeFile(marketplacePath, JSON.stringify({
    name: "fixture", plugins: [{ name: "watch-plugin", source: "./plugin-source" }],
  }));
  // Drain setup OS notifications before asserting plugin mutation broadcasts.
  async function drain() {
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
  }
  async function assertCatalog(marker) {
    let selected;
    for (const peer of peers) {
      const entry = await catalog(
        "watch-plugin:selected-watch-proof",
        peer,
        workspace,
      );
      assert.equal(entry?.description, marker ?? undefined);
      if (entry) selected = entry;
    }
    return selected;
  }
  await drain();
  await mutate("plugin install", () =>
    call("plugin/install", {
      marketplacePath,
      pluginName: "watch-plugin",
    }),
  );
  const entry = await assertCatalog("PLUGIN_BEFORE_WATCH_381");
  const installedSkill = path.dirname(entry.path);
  assert.notEqual(
    installedSkill,
    path.join(source, "skills", "selected-watch-proof"),
  );
  await turn(
    threadId,
    "installed plugin snapshot",
    ["PLUGIN_BEFORE_WATCH_381"],
    [],
  );
  await drain();
  await mutate("installed plugin Skill edit", () =>
    writeSkill(
      installedSkill,
      "selected-watch-proof",
      "PLUGIN_AFTER_WATCH_381",
    ),
  );
  await assertCatalog("PLUGIN_AFTER_WATCH_381");
  await turn(
    threadId,
    "edited plugin snapshot",
    ["PLUGIN_AFTER_WATCH_381"],
    ["PLUGIN_BEFORE_WATCH_381"],
  );
  await mutate("plugin disabled", () =>
    call("config/batchWrite", {
      edits: [
        {
          keyPath: 'plugins."watch-plugin@fixture".enabled',
          value: false,
          mergeStrategy: "replace",
        },
      ],
    }),
  );
  await assertCatalog(null);
  await turn(
    threadId,
    "disabled plugin snapshot",
    [],
    ["PLUGIN_AFTER_WATCH_381", "PLUGIN_BEFORE_WATCH_381"],
  );
  await mutate("plugin enabled", () =>
    call("config/batchWrite", {
      edits: [
        {
          keyPath: 'plugins."watch-plugin@fixture".enabled',
          value: true,
          mergeStrategy: "replace",
        },
      ],
    }),
  );
  await assertCatalog("PLUGIN_AFTER_WATCH_381");
  await turn(
    threadId,
    "enabled plugin snapshot",
    ["PLUGIN_AFTER_WATCH_381"],
    ["PLUGIN_BEFORE_WATCH_381"],
  );
  await stop();
  peers.length = 0;
  await start();
  await call("thread/resume", { threadId, excludeTurns: true });
  await assertCatalog("PLUGIN_AFTER_WATCH_381");
  await turn(
    threadId,
    "cold plugin snapshot",
    ["PLUGIN_AFTER_WATCH_381"],
    ["PLUGIN_BEFORE_WATCH_381"],
  );
  await drain();
  await mutate("cold initialized plugin Skill edit", () =>
    writeSkill(installedSkill, "selected-watch-proof", "PLUGIN_COLD_WATCH_381"),
  );
  await assertCatalog("PLUGIN_COLD_WATCH_381");
  await turn(
    threadId,
    "cold edited plugin snapshot",
    ["PLUGIN_COLD_WATCH_381"],
    ["PLUGIN_AFTER_WATCH_381", "PLUGIN_BEFORE_WATCH_381"],
  );
  await mutate("plugin uninstalled", () =>
    call("plugin/uninstall", { pluginId: "watch-plugin@fixture" }),
  );
  await assertCatalog(null);
  await turn(
    threadId,
    "uninstalled plugin snapshot",
    [],
    [
      "PLUGIN_COLD_WATCH_381",
      "PLUGIN_AFTER_WATCH_381",
      "PLUGIN_BEFORE_WATCH_381",
    ],
  );
  return 1;
}
