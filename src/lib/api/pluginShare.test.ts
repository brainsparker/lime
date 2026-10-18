import { expect, it, vi } from "vitest";
import { AppServerClient } from "./appServer";
import { PLUGIN_CATALOG_CHANGED_EVENT } from "./pluginCatalog";
import {
  savePluginShare,
  listPluginShares,
  updatePluginShareTargets,
  deletePluginShare,
  checkoutPluginShare,
} from "./pluginShare";

it("sends all share operations through the typed shared RPC and publishes successful mutations", async () => {
  const client = new AppServerClient();
  const exchange = vi.spyOn(client, "exchange");
  const changed = vi.fn();
  window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, changed);
  try {
    const save = {
      pluginPath: "/workspace/plugin",
      discoverability: "PRIVATE" as const,
    };
    const saved = {
      remotePluginId: "opaque~1",
      shareUrl: "https://cloud.test/share/one",
    };
    exchange.mockResolvedValueOnce([{ id: 1, result: saved }]);
    await expect(savePluginShare(save, client)).resolves.toEqual(saved);
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 1, method: "plugin/share/save", params: save }],
      {},
    );
    exchange.mockResolvedValueOnce([{ id: 2, result: { data: [] } }]);
    await expect(listPluginShares({}, client)).resolves.toEqual({ data: [] });
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 2, method: "plugin/share/list", params: {} }],
      {},
    );
    expect(changed).toHaveBeenCalledTimes(1);
    const update = {
      remotePluginId: "opaque~1",
      discoverability: "UNLISTED" as const,
      shareTargets: [
        {
          principalType: "user" as const,
          principalId: "two",
          role: "editor" as const,
        },
      ],
    };
    exchange.mockResolvedValueOnce([
      { id: 3, result: { principals: [], discoverability: "UNLISTED" } },
    ]);
    await updatePluginShareTargets(update, client);
    expect(exchange).toHaveBeenLastCalledWith(
      [{ id: 3, method: "plugin/share/updateTargets", params: update }],
      {},
    );
    exchange.mockResolvedValueOnce([{ id: 4, result: {} }]);
    await deletePluginShare({ remotePluginId: "opaque~1" }, client);
    expect(exchange).toHaveBeenLastCalledWith(
      [
        {
          id: 4,
          method: "plugin/share/delete",
          params: { remotePluginId: "opaque~1" },
        },
      ],
      {},
    );
    expect(changed).toHaveBeenCalledTimes(3);
    exchange.mockRejectedValueOnce(new Error("permission denied"));
    await expect(
      deletePluginShare({ remotePluginId: "opaque~1" }, client),
    ).rejects.toThrow("permission denied");
    expect(changed).toHaveBeenCalledTimes(3);
  } finally {
    window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, changed);
  }
});

it("checks out through the same RPC and only refreshes the catalog after successful registration", async () => {
  const client = new AppServerClient();
  const exchange = vi.spyOn(client, "exchange");
  const changed = vi.fn();
  window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, changed);
  try {
    const params = { remotePluginId: "opaque~1" };
    const result = {
      remotePluginId: "opaque~1",
      pluginId: "research@codex-curated",
      pluginName: "research",
      pluginPath: "/home/user/plugins/research",
      marketplaceName: "codex-curated",
      marketplacePath: "/home/user/.agents/plugins/marketplace.json",
      remoteVersion: "1.0.0",
    };
    exchange.mockResolvedValueOnce([{ id: 1, result }]);
    await expect(checkoutPluginShare(params, client)).resolves.toEqual(result);
    expect(exchange).toHaveBeenCalledWith(
      [{ id: 1, method: "plugin/share/checkout", params }],
      {},
    );
    expect(changed).toHaveBeenCalledTimes(1);
    exchange.mockRejectedValueOnce(new Error("registration failed"));
    await expect(checkoutPluginShare(params, client)).rejects.toThrow(
      "registration failed",
    );
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, changed);
  }
});
