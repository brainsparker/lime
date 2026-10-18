import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

// Isolated real Git transport, consumed by the same two SDK/runtime fixture.
export async function runMarketplaceUpgradeScenario({
  temp,
  workspace,
  threadId,
  peers,
  call,
  turn,
  catalog,
  mutate,
  start,
  stop,
}) {
  const remote = path.join(temp, "market.git");
  await mkdir(remote);
  function git(args, input) {
    return execFileSync("git", ["-C", remote, ...args], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  }
  git(["init", "--bare", "--initial-branch=main"]);
  let previous;
  const upgrades = [];
  function publish(version, marker) {
    const files = [
      [
        ".agents/plugins/marketplace.json",
        JSON.stringify({
          name: "upgrade-fixture",
          plugins: [{ name: "upgrade-proof", source: "./plugin" }],
        }),
      ],
      [
        "plugin/plugin.json",
        JSON.stringify({
          $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
          name: "upgrade-proof",
          version,
        }),
      ],
      [
        "plugin/skills/check/SKILL.md",
        `---\nname: check\ndescription: ${marker}\n---\n${marker}\n`,
      ],
    ];
    let input =
      "commit refs/heads/main\ncommitter Fixture <fixture@example.invalid> 1700000000 +0000\ndata 7\nfixture\n";
    if (previous) input += `from ${previous}\n`;
    input += "deleteall\n";
    for (const [file, body] of files)
      input += `M 100644 inline ${file}\ndata ${Buffer.byteLength(body)}\n${body}\n`;
    git(["fast-import", "--quiet"], input + "\ndone\n");
    git(["update-server-info"]);
    previous = git(["rev-parse", "refs/heads/main"]);
  }
  const http = createServer(async (request, response) => {
    const relative = new URL(request.url, "http://localhost").pathname.slice(1);
    try {
      if (
        !relative.startsWith("market.git/") ||
        relative.split("/").includes("..")
      )
        throw new Error("invalid fixture path");
      const body = await readFile(
        path.join(remote, relative.slice("market.git/".length)),
      );
      response.writeHead(200, { "Content-Length": body.length });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const before = "UPGRADE_BEFORE_381";
  const after = "UPGRADE_AFTER_381";
  const same = "UPGRADE_SAME_VERSION_381";
  async function assertCurrent(marker) {
    for (const peer of peers)
      assert.equal(
        (await catalog("upgrade-proof:check", peer, workspace))?.description,
        marker,
      );
  }
  async function assertTurn(label, marker, absent) {
    await turn(threadId, label, [marker], absent, {}, ["upgrade-proof:check"]);
  }
  try {
    publish("1.0.0", before);
    const added = await call("marketplace/add", {
      source: `http://127.0.0.1:${http.address().port}/market.git`,
      refName: "main",
    });
    await mutate("upgrade fixture install", () =>
      call("plugin/install", {
        marketplacePath: path.join(
          added.installedRoot,
          ".agents/plugins/marketplace.json",
        ),
        pluginName: "upgrade-proof",
      }),
    );
    await assertCurrent(before);
    await assertTurn("before marketplace upgrade", before, []);
    const plugins = (await call("config/read", {})).config.plugins;
    for (const [marker, absent] of [
      [after, [before]],
      [same, [before, after]],
    ]) {
      publish("2.0.0", marker);
      await mutate("marketplace upgrade " + marker, async () => {
        const result = await call("marketplace/upgrade", {
          marketplaceName: "upgrade-fixture",
        });
        assert.deepEqual(result.selectedMarketplaces, ["upgrade-fixture"]);
        assert.equal(result.upgradedRoots.length, 1);
        assert.deepEqual(result.errors, []);
        upgrades.push({ revision: previous, version: "2.0.0", marker, result });
      });
      await assertCurrent(marker);
      assert.deepEqual((await call("config/read", {})).config.plugins, plugins);
      await assertTurn("marketplace upgrade " + marker, marker, absent);
    }
    await stop();
    peers.length = 0;
    await start();
    await call("thread/resume", { threadId, excludeTurns: true });
    await assertCurrent(same);
    await assertTurn("cold marketplace snapshot", same, [before, after]);
    await mutate("upgrade fixture uninstall", () =>
      call("plugin/uninstall", {
        pluginId: "upgrade-proof@upgrade-fixture",
      }),
    );
    await call("marketplace/remove", { marketplaceName: "upgrade-fixture" });
    return { coldRestarts: 1, upgrades, coldCatalogVerified: true };
  } finally {
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
  }
}
