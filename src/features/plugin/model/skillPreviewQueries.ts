import { QueryClient, queryOptions } from "@tanstack/react-query";
import type { AppServerPluginDetail } from "@/lib/api/appServerTypes";
import { readPluginSkill } from "@/lib/api/pluginCatalog";
import { readFileBytes } from "@/lib/api/fileBrowser";
import {
  CloudAccountChangedError,
  cloudAccountIdentity,
  cloudAccountIdentityVersion,
  getCloudAccount,
  subscribeCloudAccount,
} from "@/lib/cloudAccount";

const FIVE_MINUTES = 5 * 60 * 1000;

function retryPreview(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3 || error instanceof CloudAccountChangedError)
    return false;
  const status =
    typeof error === "object" &&
    error != null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  return (
    !status ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

/** Disposable preview projection; authorization and file access stay behind the gateways. */
export const skillPreviewQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      refetchOnWindowFocus: false,
      retry: retryPreview,
    },
  },
});

let observedIdentityVersion = cloudAccountIdentityVersion();

export function subscribeSkillPreviewAccount(listener: () => void): () => void {
  return subscribeCloudAccount(() => {
    const version = cloudAccountIdentityVersion();
    if (version !== observedIdentityVersion) {
      observedIdentityVersion = version;
      skillPreviewQueryClient.clear();
    }
    listener();
  });
}

export function skillPreviewQueryOptions({
  detail,
  skill,
  accountIdentity,
  accountVersion,
}: {
  detail: AppServerPluginDetail;
  skill: AppServerPluginDetail["skills"][number];
  accountIdentity: string | null;
  accountVersion: number;
}) {
  const remoteId = detail.summary.remotePluginId;
  const location =
    skill.path != null
      ? ["file", skill.path]
      : ["remote", detail.marketplaceName, remoteId, skill.name];
  return queryOptions({
    queryKey: [
      "plugin-skill-markdown",
      accountIdentity,
      accountVersion,
      ...location,
    ],
    queryFn: async ({ signal }) => {
      const ensureCurrent = () => {
        signal.throwIfAborted();
        if (
          accountIdentity !== cloudAccountIdentity(getCloudAccount()) ||
          accountVersion !== cloudAccountIdentityVersion()
        )
          throw new CloudAccountChangedError();
      };
      ensureCurrent();
      let contents: string | null;
      if (skill.path != null) {
        contents = new TextDecoder("utf-8", { fatal: true }).decode(
          await readFileBytes(skill.path),
        );
      } else {
        if (
          detail.summary.source.type !== "remote" ||
          !remoteId ||
          !accountIdentity
        )
          throw new Error("missing skill location");
        const response = await readPluginSkill(
          {
            remoteMarketplaceName: detail.marketplaceName,
            remotePluginId: remoteId,
            skillName: skill.name,
          },
          { signal },
        );
        contents = response.contents ?? null;
      }
      ensureCurrent();
      return { contents };
    },
  });
}
