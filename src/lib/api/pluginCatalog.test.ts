import { describe, expect, it, vi } from "vitest";
import {
  PLUGIN_CATALOG_CHANGED_EVENT,
  installPlugin,
  listInstalledPlugins,
  listPlugins,
  readPlugin,
  searchPluginCatalog,
  setPluginEnabled,
  uninstallPlugin,
  type PluginCatalogClient,
} from "./pluginCatalog";

function client(): PluginCatalogClient {
  return {
    listPlugins: vi
      .fn()
      .mockResolvedValue({
        result: {
          marketplaces: [],
          marketplaceLoadErrors: [],
          featuredPluginIds: [],
        },
      }),
    searchPlugins: vi
      .fn()
      .mockResolvedValue({ result: { data: [], nextCursor: null } }),
    request: vi.fn().mockResolvedValue({ result: { plugin: {} } }),
    readPlugin: vi.fn().mockResolvedValue({ result: { plugin: {} } }),
    installPlugin: vi.fn().mockResolvedValue({ result: { plugin: {} } }),
    uninstallPlugin: vi.fn().mockResolvedValue({ result: {} }),
    listInstalledPlugins: vi
      .fn()
      .mockResolvedValue({
        result: {
          marketplaces: [],
          marketplaceLoadErrors: [],
          featuredPluginIds: [],
        },
      }),
  };
}

describe("Plugin catalog API", () => {
  it("只通过 typed App Server client 访问 catalog/install owner", async () => {
    const appServerClient = client();

    await listPlugins({ cwds: ["/tmp/workspace"] }, appServerClient);
    await searchPluginCatalog({ searchTerm: "demo" }, appServerClient);
    await readPlugin(
      { marketplacePath: "/tmp/marketplace.json", pluginName: "demo" },
      appServerClient,
    );
    await setPluginEnabled(
      { pluginId: "demo@market", enabled: true },
      appServerClient,
    );
    await installPlugin(
      { marketplacePath: "/tmp/marketplace.json", pluginName: "demo" },
      appServerClient,
    );
    await listInstalledPlugins({}, appServerClient);
    await uninstallPlugin({ pluginId: "demo" }, appServerClient);

    expect(appServerClient.listPlugins).toHaveBeenCalledWith({
      cwds: ["/tmp/workspace"],
    });
    expect(appServerClient.searchPlugins).toHaveBeenCalledWith({
      searchTerm: "demo",
    });
    expect(appServerClient.request).toHaveBeenCalledWith("config/batchWrite", {
      edits: [
        {
          keyPath: 'plugins."demo@market".enabled',
          value: true,
          mergeStrategy: "replace",
        },
      ],
      reloadUserConfig: true,
    });
    expect(appServerClient.readPlugin).toHaveBeenCalledWith({
      marketplacePath: "/tmp/marketplace.json",
      pluginName: "demo",
    });
    expect(appServerClient.installPlugin).toHaveBeenCalledWith({
      marketplacePath: "/tmp/marketplace.json",
      pluginName: "demo",
    });
    expect(appServerClient.listInstalledPlugins).toHaveBeenCalledWith({});
    expect(appServerClient.uninstallPlugin).toHaveBeenCalledWith({
      pluginId: "demo",
    });
  });

  it("安装、启停和卸载后应通知 v2 catalog 消费者刷新", async () => {
    const appServerClient = client();
    const listener = vi.fn();
    window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);

    try {
      await installPlugin(
        { marketplacePath: "/tmp/marketplace.json", pluginName: "demo" },
        appServerClient,
      );
      await setPluginEnabled(
        { pluginId: "demo@market", enabled: false },
        appServerClient,
      );
      await uninstallPlugin({ pluginId: "demo" }, appServerClient);
    } finally {
      window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    }

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("卸载失败不发布已成功变更通知", async () => {
    const appServerClient = client();
    vi.mocked(appServerClient.uninstallPlugin).mockRejectedValue(
      new Error("uninstall rejected"),
    );
    const listener = vi.fn();
    window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    try {
      await expect(
        uninstallPlugin({ pluginId: "demo@market" }, appServerClient),
      ).rejects.toThrow("uninstall rejected");
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    }
  });
});
