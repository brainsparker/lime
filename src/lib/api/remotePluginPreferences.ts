import type { AppServerClient } from "./appServerClient";
import {
  cloudAccountIdentity,
  cloudAccountIdentityVersion,
  CloudAccountChangedError,
  getCloudAccount,
} from "@/lib/cloudAccount";

export type RemotePluginPreferenceClient = Pick<
  AppServerClient,
  "requestCloud" | "readAccount"
>;

export async function writeRemotePluginPreference(
  params: { remotePluginId: string; enabled: boolean; skillName?: string },
  client: RemotePluginPreferenceClient,
): Promise<void> {
  const account = getCloudAccount();
  if (!account || !params.remotePluginId || params.skillName === "") {
    throw new Error(
      "remote plugin preference requires a cloud account and plugin ID/skill name",
    );
  }
  const identity = cloudAccountIdentity(account);
  const epoch = cloudAccountIdentityVersion();
  const skillPath =
    params.skillName === undefined
      ? ""
      : `/skills/${encodeURIComponent(params.skillName)}`;
  const response = (
    await client.requestCloud({
      path: `/v1/public/tenants/${encodeURIComponent(account.account.tenantId)}/client/ps/plugins/${encodeURIComponent(params.remotePluginId)}${skillPath}/${params.enabled ? "enable" : "disable"}`,
      method: "POST",
    })
  ).result;
  const current = (await client.readAccount({})).result.account;
  if (
    epoch !== cloudAccountIdentityVersion() ||
    identity !== cloudAccountIdentity(getCloudAccount()) ||
    !current ||
    identity !== cloudAccountIdentity({ account: current }) ||
    identity !== cloudAccountIdentity({ account: response.account })
  ) {
    throw new CloudAccountChangedError();
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `remote plugin preference failed (HTTP ${response.status})`,
    );
  }
}
