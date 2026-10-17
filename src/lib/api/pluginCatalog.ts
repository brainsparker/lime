import {
  METHOD_CONFIG_BATCH_WRITE,
  type ConfigBatchWriteParams,
  type ConfigWriteResponse,
} from "@limecloud/app-server-client";
import { invalidateAppConfigCache } from "./appConfig";
import { AppServerClient } from "@/lib/api/appServer";
import type {
  AppServerPluginInstallParams,
  AppServerPluginInstallResponse,
  AppServerPluginInstalledParams,
  AppServerPluginInstalledResponse,
  AppServerPluginListParams,
  AppServerPluginListResponse,
  AppServerPluginReadParams,
  AppServerPluginReadResponse,
  AppServerPluginUninstallParams,
  AppServerPluginUninstallResponse,
  AppServerPluginSearchParams,
  AppServerPluginSearchResponse,
} from "@/lib/api/appServerTypes";

export type PluginCatalogClient = Pick<
  AppServerClient,
  | "listPlugins"
  | "searchPlugins"
  | "request"
  | "readPlugin"
  | "installPlugin"
  | "uninstallPlugin"
  | "listInstalledPlugins"
>;

export const PLUGIN_CATALOG_CHANGED_EVENT = "lime:plugin-catalog-changed";

function emitPluginCatalogChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLUGIN_CATALOG_CHANGED_EVENT));
  }
}

export async function listPlugins(
  params: AppServerPluginListParams = {},
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginListResponse> {
  return (await client.listPlugins(params)).result;
}

export async function searchPluginCatalog(
  params: AppServerPluginSearchParams,
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginSearchResponse> {
  return (await client.searchPlugins(params)).result;
}

export async function setPluginEnabled(
  params: { pluginId: string; enabled: boolean },
  client: PluginCatalogClient = new AppServerClient(),
): Promise<void> {
  await client.request<ConfigWriteResponse>(METHOD_CONFIG_BATCH_WRITE, {
    edits: [
      {
        keyPath: `plugins.${JSON.stringify(params.pluginId)}.enabled`,
        value: params.enabled,
        mergeStrategy: "replace",
      },
    ],
    reloadUserConfig: true,
  } satisfies ConfigBatchWriteParams);
  invalidateAppConfigCache();
  emitPluginCatalogChanged();
}

export async function readPlugin(
  params: AppServerPluginReadParams,
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginReadResponse> {
  return (await client.readPlugin(params)).result;
}

export async function installPlugin(
  params: AppServerPluginInstallParams,
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginInstallResponse> {
  const result = (await client.installPlugin(params)).result;
  emitPluginCatalogChanged();
  return result;
}

export async function uninstallPlugin(
  params: AppServerPluginUninstallParams,
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginUninstallResponse> {
  const result = (await client.uninstallPlugin(params)).result;
  emitPluginCatalogChanged();
  return result;
}

export async function listInstalledPlugins(
  params: AppServerPluginInstalledParams = {},
  client: PluginCatalogClient = new AppServerClient(),
): Promise<AppServerPluginInstalledResponse> {
  return (await client.listInstalledPlugins(params)).result;
}

export type MarketplaceClient = Pick<
  AppServerClient,
  "addMarketplace" | "removeMarketplace" | "upgradeMarketplace"
>;

export async function addMarketplace(
  params: import("@/lib/api/appServerTypes").AppServerMarketplaceAddParams,
  client: MarketplaceClient = new AppServerClient(),
): Promise<import("@/lib/api/appServerTypes").AppServerMarketplaceAddResponse> {
  const result = (await client.addMarketplace(params)).result;
  invalidateAppConfigCache();
  emitPluginCatalogChanged();
  return result;
}

export async function removeMarketplace(
  params: import("@/lib/api/appServerTypes").AppServerMarketplaceRemoveParams,
  client: MarketplaceClient = new AppServerClient(),
): Promise<
  import("@/lib/api/appServerTypes").AppServerMarketplaceRemoveResponse
> {
  const result = (await client.removeMarketplace(params)).result;
  invalidateAppConfigCache();
  emitPluginCatalogChanged();
  return result;
}

export async function upgradeMarketplace(
  params: import("@/lib/api/appServerTypes").AppServerMarketplaceUpgradeParams,
  client: MarketplaceClient = new AppServerClient(),
): Promise<
  import("@/lib/api/appServerTypes").AppServerMarketplaceUpgradeResponse
> {
  const result = (await client.upgradeMarketplace(params)).result;
  invalidateAppConfigCache();
  emitPluginCatalogChanged();
  return result;
}
