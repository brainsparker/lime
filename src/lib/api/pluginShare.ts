import { AppServerClient } from "./appServer";
import type {
  AppServerPluginShareSaveParams,
  AppServerPluginShareSaveResponse,
  AppServerPluginShareListParams,
  AppServerPluginShareListResponse,
  AppServerPluginShareUpdateTargetsParams,
  AppServerPluginShareUpdateTargetsResponse,
  AppServerPluginShareDeleteParams,
  AppServerPluginShareDeleteResponse,
  AppServerPluginShareCheckoutParams,
  AppServerPluginShareCheckoutResponse,
} from "./appServerTypes";
import { emitPluginCatalogChanged } from "./pluginCatalog";

export async function checkoutPluginShare(
  params: AppServerPluginShareCheckoutParams,
  client: Pick<AppServerClient, "checkoutPluginShare"> = new AppServerClient(),
): Promise<AppServerPluginShareCheckoutResponse> {
  const result = (await client.checkoutPluginShare(params)).result;
  emitPluginCatalogChanged();
  return result;
}

export async function savePluginShare(
  params: AppServerPluginShareSaveParams,
  client: Pick<AppServerClient, "savePluginShare"> = new AppServerClient(),
): Promise<AppServerPluginShareSaveResponse> {
  const result = (await client.savePluginShare(params)).result;
  emitPluginCatalogChanged();
  return result;
}

export async function listPluginShares(
  params: AppServerPluginShareListParams = {},
  client: Pick<AppServerClient, "listPluginShares"> = new AppServerClient(),
): Promise<AppServerPluginShareListResponse> {
  const result = (await client.listPluginShares(params)).result;
  return result;
}

export async function updatePluginShareTargets(
  params: AppServerPluginShareUpdateTargetsParams,
  client: Pick<
    AppServerClient,
    "updatePluginShareTargets"
  > = new AppServerClient(),
): Promise<AppServerPluginShareUpdateTargetsResponse> {
  const result = (await client.updatePluginShareTargets(params)).result;
  emitPluginCatalogChanged();
  return result;
}

export async function deletePluginShare(
  params: AppServerPluginShareDeleteParams,
  client: Pick<AppServerClient, "deletePluginShare"> = new AppServerClient(),
): Promise<AppServerPluginShareDeleteResponse> {
  const result = (await client.deletePluginShare(params)).result;
  emitPluginCatalogChanged();
  return result;
}
