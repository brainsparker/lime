import { act, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerPluginSummary } from "@/lib/api/appServerTypes";
import { PLUGIN_CATALOG_CHANGED_EVENT } from "@/lib/api/pluginCatalog";
import {
  cleanupMountedRoots,
  flushEffects,
  mountHarness,
  setupReactActEnvironment,
  type MountedRoot,
} from "@/components/workspace/hooks/testUtils";
import {
  useWorkspacePluginCatalogSuggestions,
  type UseWorkspacePluginCatalogSuggestionsOptions,
  type UseWorkspacePluginCatalogSuggestionsResult,
} from "./useWorkspacePluginCatalogSuggestions";

const mountedRoots: MountedRoot[] = [];

function plugin(enabled = true): AppServerPluginSummary {
  return {
    id: "browser@openai-bundled",
    name: "Browser",
    version: "1.0.0",
    interface: { shortDescription: "Control a browser" },
    source: { type: "local", path: "/plugins/browser" },
    installed: true,
    enabled,
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
    availability: "AVAILABLE",
  };
}

function Harness({
  options,
  onReady,
}: {
  options: UseWorkspacePluginCatalogSuggestionsOptions;
  onReady: (value: UseWorkspacePluginCatalogSuggestionsResult) => void;
}) {
  const value = useWorkspacePluginCatalogSuggestions(options);
  useEffect(() => onReady(value), [onReady, value]);
  return null;
}

describe("useWorkspacePluginCatalogSuggestions", () => {
  let latest: UseWorkspacePluginCatalogSuggestionsResult | null = null;

  beforeEach(() => {
    setupReactActEnvironment();
    latest = null;
  });

  afterEach(() => {
    cleanupMountedRoots(mountedRoots);
    vi.clearAllMocks();
  });

  it("按需读取 v2 installed catalog，并在 v2 变更事件后刷新", async () => {
    const listInstalled = vi
      .fn()
      .mockResolvedValueOnce({ marketplaces: [{ name: "openai-bundled", path: "/plugins/marketplace.json", plugins: [plugin()] }] })
      .mockResolvedValueOnce({
        marketplaces: [{ name: "openai-bundled", path: "/plugins/marketplace.json", plugins: [plugin(false)] }],
      });

    mountHarness(
      Harness,
      {
        options: { enabled: true, listInstalled },
        onReady: (value) => {
          latest = value;
        },
      },
      mountedRoots,
    );
    await flushEffects(6);

    expect(latest?.suggestions[0]).toMatchObject({
      pluginId: "browser@openai-bundled",
      disabled: false,
    });

    act(() => {
      window.dispatchEvent(new CustomEvent(PLUGIN_CATALOG_CHANGED_EVENT));
    });
    await flushEffects(6);

    expect(listInstalled).toHaveBeenCalledTimes(2);
    expect(latest?.suggestions[0]).toMatchObject({
      pluginId: "browser@openai-bundled",
      disabled: true,
      blockerCodes: ["PLUGIN_DISABLED"],
    });
  });
});
