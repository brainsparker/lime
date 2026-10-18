import { useCallback, useEffect, useRef, useState } from "react";
import { cloudAccountIdentity, getCloudAccount } from "@/lib/cloudAccount";
import { readPlugin } from "@/lib/api/pluginCatalog";
import { revealPathInFinder } from "@/lib/api/fileSystem";
import {
  checkoutPluginShare,
  deletePluginShare,
  listPluginShares,
  savePluginShare,
  updatePluginShareTargets,
} from "@/lib/api/pluginShare";
import {
  pluginLocation,
  type PluginCatalogEntry,
} from "./PluginCatalogPageViewModel";
import {
  pluginShareSelection,
  type PluginShareContext,
  type PluginShareAccess,
  type PluginShareTarget,
} from "./PluginShareViewModel";

export function usePluginShare(
  entry: PluginCatalogEntry,
  accountIdentity: string,
  onDeleted: () => void,
) {
  const [context, setContext] = useState<PluginShareContext | null>(null);
  const [pluginPath, setPluginPath] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const alive = useRef(false);
  const inFlight = useRef(false);
  const identity = useCallback(
    () =>
      alive.current &&
      accountIdentity === cloudAccountIdentity(getCloudAccount()),
    [accountIdentity],
  );

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setLoaded(false);
    setError(null);
    void (async () => {
      try {
        const response = await listPluginShares();
        if (cancelled || !identity()) return;
        const selection = pluginShareSelection(entry, response);
        // 收到的分享未必属于 created-by-me；详情仍由现役插件读取 owner 授权。
        if (entry.plugin.source.type === "remote") {
          const detail = await readPlugin(pluginLocation(entry));
          if (cancelled || !identity()) return;
          selection.context = detail.plugin.summary.shareContext ?? null;
        }
        setContext(selection.context);
        setPluginPath(selection.pluginPath);
        setLoaded(true);
      } catch (cause) {
        if (!cancelled && identity())
          setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [entry, identity, revision]);

  async function run(action: string, operation: () => Promise<void>) {
    if (inFlight.current || !identity()) return;
    inFlight.current = true;
    setPending(action);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      if (identity())
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      inFlight.current = false;
      if (identity()) setPending(null);
    }
  }

  async function saveVersion() {
    await run("save", async () => {
      if (!pluginPath) return;
      const response = await savePluginShare({
        pluginPath,
        ...(context
          ? { remotePluginId: context.remotePluginId }
          : { discoverability: "PRIVATE" }),
      });
      if (!identity()) return;
      // 远端成功立即保留身份，后续读取失败也不能重复创建。
      const saved: PluginShareContext = {
        ...context,
        remotePluginId: response.remotePluginId,
        shareUrl: response.shareUrl,
        canPublishToWorkspace:
          response.canPublishToWorkspace ?? context?.canPublishToWorkspace,
        ...(!context
          ? {
              discoverability: "PRIVATE",
              creatorAccountUserId: getCloudAccount()!.account.userId,
              sharePrincipals: [],
            }
          : {}),
      };
      setContext(saved);
      const responseList = await listPluginShares();
      if (!identity()) return;
      const updated = responseList.data.find(
        (item) =>
          item.plugin.shareContext?.remotePluginId === saved.remotePluginId,
      );
      if (updated?.plugin.shareContext) setContext(updated.plugin.shareContext);
    });
  }

  async function saveAccess(
    access: PluginShareAccess,
    shareTargets: PluginShareTarget[],
  ) {
    await run("access", async () => {
      if (!context) return;
      const response = await updatePluginShareTargets({
        remotePluginId: context.remotePluginId,
        discoverability: access,
        shareTargets,
      });
      if (!identity()) return;
      setContext({
        ...context,
        discoverability: response.discoverability,
        sharePrincipals: response.principals,
      });
    });
  }

  async function checkout() {
    await run("checkout", async () => {
      if (!context) return;
      const response = await checkoutPluginShare({
        remotePluginId: context.remotePluginId,
      });
      if (identity()) setPluginPath(response.pluginPath);
    });
  }

  async function revoke() {
    await run("delete", async () => {
      if (!context) return;
      await deletePluginShare({ remotePluginId: context.remotePluginId });
      if (identity()) onDeleted();
    });
  }

  return {
    context,
    pluginPath,
    loaded,
    pending,
    error,
    saveVersion,
    saveAccess,
    checkout,
    revoke,
    retry: () => setRevision((current) => current + 1),
    openDirectory: () =>
      run("open", async () => {
        if (pluginPath) await revealPathInFinder(pluginPath);
      }),
    copyLink: (onCopied: () => void) =>
      run("copy", async () => {
        if (!context?.shareUrl) return;
        await navigator.clipboard.writeText(context.shareUrl);
        if (identity()) onCopied();
      }),
  };
}
