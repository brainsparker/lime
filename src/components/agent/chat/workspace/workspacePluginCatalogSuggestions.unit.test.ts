import { describe, expect, it } from "vitest";
import type { AppServerPluginSummary } from "@/lib/api/appServerTypes";
import { buildWorkspacePluginCatalogSuggestions } from "./workspacePluginCatalogSuggestions";

function plugin(
  overrides: Partial<AppServerPluginSummary> = {},
): AppServerPluginSummary {
  return {
    id: "browser@openai-bundled",
    name: "Browser",
    version: "1.0.0",
    interface: { shortDescription: "Control a browser" },
    source: { type: "local", path: "/plugins/browser" },
    installed: true,
    enabled: true,
    installPolicy: "AVAILABLE",
    authPolicy: "ON_USE",
    availability: "AVAILABLE",
    ...overrides,
  };
}

describe("workspacePluginCatalogSuggestions", () => {
  it("只从 current installed summary 投影稳定 Plugin 候选", () => {
    expect(
      buildWorkspacePluginCatalogSuggestions([
        plugin(),
        plugin({
          id: "available@openai-bundled",
          name: "Available",
          installed: false,
        }),
        plugin({
          id: "disabled@openai-bundled",
          name: "Disabled",
          enabled: false,
        }),
      ]),
    ).toEqual([
      {
        pluginId: "browser@openai-bundled",
        displayName: "Browser",
        description: "Control a browser",
        disabled: false,
        blockerCodes: [],
      },
      {
        pluginId: "disabled@openai-bundled",
        displayName: "Disabled",
        description: "Control a browser",
        disabled: true,
        blockerCodes: ["PLUGIN_DISABLED"],
      },
    ]);
  });

  it("同名插件保留完整市场身份，不重复拼接 marketplace", () => {
    expect(
      buildWorkspacePluginCatalogSuggestions([
        plugin(),
        plugin({ id: "browser@personal" }),
      ]).map((suggestion) => suggestion.pluginId),
    ).toEqual(["browser@openai-bundled", "browser@personal"]);
  });
});
