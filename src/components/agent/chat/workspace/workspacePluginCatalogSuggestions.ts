import type { AppServerPluginSummary } from "@/lib/api/appServerTypes";
import type { InputbarPluginCapability } from "../components/Inputbar/pluginInputCapability";

const PLUGIN_DISABLED_BLOCKER = "PLUGIN_DISABLED";

export function buildWorkspacePluginCatalogSuggestions(
  plugins: readonly AppServerPluginSummary[],
): InputbarPluginCapability[] {
  return plugins
    .filter((plugin) => plugin.installed)
    .map((plugin) => ({
      pluginId: plugin.id,
      displayName: plugin.interface?.displayName?.trim() || plugin.name.trim() || plugin.id,
      description: plugin.interface?.shortDescription?.trim() || plugin.id,
      disabled: !plugin.enabled,
      blockerCodes: plugin.enabled ? [] : [PLUGIN_DISABLED_BLOCKER],
    }));
}
