import { accountFixture, seedCloudAccount } from "@/test/cloudAccountFixture";
import { describe, expect, it, vi } from "vitest";
import {
  CloudAccountChangedError,
  getCloudAccount,
  logoutCloudAccount,
} from "@/lib/cloudAccount";
import {
  PLUGIN_CATALOG_CHANGED_EVENT,
  setPluginEnabled,
  setPluginSkillEnabled,
} from "./pluginCatalog";

const seed = () =>
  seedCloudAccount({
    tenant: { id: "tenant" },
    user: { id: "user" },
    session: { id: "session" },
  });
function client() {
  return {
    request: vi.fn(),
    requestCloud: vi.fn().mockImplementation(async () => ({
      result: { status: 200, body: {}, account: getCloudAccount()!.account },
    })),
    readAccount: vi.fn().mockImplementation(async () => ({
      result: { account: accountFixture.account },
    })),
  };
}

describe.each(["plugin", "skill"] as const)("remote %s preferences", (kind) => {
  const write = (
    params: { remotePluginId: string; enabled: boolean },
    api: ReturnType<typeof client>,
  ) =>
    kind === "plugin"
      ? setPluginEnabled(params, api)
      : setPluginSkillEnabled(
          { ...params, skillName: "原文:research / 深入" },
          api,
        );
  const route =
    kind === "plugin"
      ? "/v1/public/tenants/tenant/client/ps/plugins/opaque~1"
      : `/v1/public/tenants/tenant/client/ps/plugins/opaque~1/skills/${encodeURIComponent("原文:research / 深入")}`;
  it("远端开关走无 body 的认证 RPC，不写本地配置或 renderer fetch", async () => {
    await seed();
    const api = client();
    const fetch = vi.spyOn(globalThis, "fetch");
    const listener = vi.fn();
    window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    try {
      for (const enabled of [false, true])
        await write({ remotePluginId: "opaque~1", enabled }, api);
      expect(api.requestCloud.mock.calls.map(([params]) => params)).toEqual([
        {
          path: `${route}/disable`,
          method: "POST",
        },
        {
          path: `${route}/enable`,
          method: "POST",
        },
      ]);
      expect(api.request).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
      fetch.mockRestore();
    }
  });
  it("未登录、HTTP 失败和响应账号不符不发成功事件", async () => {
    const api = client(),
      listener = vi.fn();
    window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    try {
      await expect(
        write({ remotePluginId: "opaque~1", enabled: false }, api),
      ).rejects.toThrow("cloud account");
      expect(api.requestCloud).not.toHaveBeenCalled();
      await seed();
      api.requestCloud.mockResolvedValueOnce({
        result: { status: 503, body: {}, account: getCloudAccount()!.account },
      });
      await expect(
        write({ remotePluginId: "opaque~1", enabled: false }, api),
      ).rejects.toThrow("HTTP 503");
      api.requestCloud.mockResolvedValueOnce({
        result: {
          status: 200,
          body: {},
          account: { ...getCloudAccount()!.account, userId: "other" },
        },
      });
      await expect(
        write({ remotePluginId: "opaque~1", enabled: false }, api),
      ).rejects.toBeInstanceOf(CloudAccountChangedError);
      expect(listener).not.toHaveBeenCalled();
      expect(api.request).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    }
  });
  it("切走再切回同账号，迟到写入响应仍被丢弃", async () => {
    await seed();
    const api = client(),
      old = getCloudAccount()!.account,
      listener = vi.fn();
    let finish!: (value: unknown) => void;
    api.requestCloud.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    window.addEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    try {
      const pending = write(
        { remotePluginId: "opaque~1", enabled: false },
        api,
      );
      const rejected = expect(pending).rejects.toBeInstanceOf(
        CloudAccountChangedError,
      );
      await logoutCloudAccount();
      await seed();
      finish({ result: { status: 200, body: {}, account: old } });
      await rejected;
      expect(listener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(PLUGIN_CATALOG_CHANGED_EVENT, listener);
    }
  });
});
