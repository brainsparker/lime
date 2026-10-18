import type {
  AppServerPluginMarketplaceEntry,
  AppServerPluginShareListResponse,
  AppServerPluginShareUpdateTargetsParams,
  AppServerPluginSummary,
} from "@/lib/api/appServerTypes";
import type { PluginCatalogEntry } from "./PluginCatalogPageViewModel";

export type PluginShareContext = NonNullable<
  AppServerPluginSummary["shareContext"]
>;
export type PluginSharePrincipal = NonNullable<
  PluginShareContext["sharePrincipals"]
>[number];
export type PluginShareTarget =
  AppServerPluginShareUpdateTargetsParams["shareTargets"][number];
export type PluginShareAccess =
  AppServerPluginShareUpdateTargetsParams["discoverability"];

export function mergePluginShareCatalog(
  marketplaces: AppServerPluginMarketplaceEntry[],
  shares: AppServerPluginShareListResponse,
  createdLabel: string,
): AppServerPluginMarketplaceEntry[] {
  const seen = new Set(
    marketplaces.flatMap((marketplace) =>
      marketplace.plugins.map((plugin) => plugin.id),
    ),
  );
  const added: AppServerPluginMarketplaceEntry[] = [];
  for (const { plugin } of shares.data) {
    if (seen.has(plugin.id)) continue;
    seen.add(plugin.id);
    const name =
      plugin.shareContext?.discoverability === "LISTED"
        ? "workspace-directory"
        : "workspace-shared-with-me";
    let marketplace = added.find((item) => item.name === name);
    if (!marketplace) {
      marketplace = {
        name,
        path: null,
        interface: { displayName: createdLabel },
        plugins: [],
      };
      added.push(marketplace);
    }
    marketplace.plugins.push(plugin);
  }
  return [...marketplaces, ...added];
}

export function pluginShareSelection(
  entry: PluginCatalogEntry,
  response: AppServerPluginShareListResponse,
) {
  const sourcePath =
    entry.plugin.source.type === "local" ? entry.plugin.source.path : null;
  const remoteId =
    entry.plugin.remotePluginId ?? entry.plugin.shareContext?.remotePluginId;
  const shared = response.data.find((item) =>
    remoteId
      ? (item.plugin.remotePluginId ??
          item.plugin.shareContext?.remotePluginId) === remoteId
      : sourcePath != null && item.localPluginPath === sourcePath,
  );
  return {
    context: shared?.plugin.shareContext ?? entry.plugin.shareContext ?? null,
    pluginPath: shared?.localPluginPath ?? sourcePath,
  };
}

export function pluginShareTargets(
  principals: PluginSharePrincipal[],
): PluginShareTarget[] {
  return principals.flatMap(({ principalType, principalId, role }) =>
    role === "owner" ? [] : [{ principalType, principalId, role }],
  );
}

export function pluginSharePermissions(
  context: PluginShareContext | null,
  userId: string,
) {
  const own =
    context?.creatorAccountUserId === userId ||
    context?.sharePrincipals?.some(
      (principal) =>
        principal.principalType === "user" &&
        principal.principalId === userId &&
        principal.role === "owner",
    ) === true;
  return {
    owner: own,
    editor:
      own ||
      context?.sharePrincipals?.some(
        (principal) =>
          principal.principalType === "user" &&
          principal.principalId === userId &&
          principal.role === "editor",
      ) === true,
  };
}

export function pluginShareAccessTargets(
  access: PluginShareAccess,
  targets: PluginShareTarget[],
  tenantId: string,
): PluginShareTarget[] {
  const specific = targets.filter(
    (target) => target.principalType !== "workspace",
  );
  return access === "PRIVATE"
    ? specific
    : [
        ...specific,
        { principalType: "workspace", principalId: tenantId, role: "reader" },
      ];
}

export function pluginShareDraftKey(
  access: PluginShareAccess,
  targets: PluginShareTarget[],
) {
  return JSON.stringify([
    access,
    [...targets].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)),
    ),
  ]);
}
