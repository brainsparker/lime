import { seedCloudAccount } from "@/test/cloudAccountFixture";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveOemCloudRuntimeContext } from "./oemCloudRuntime";

describe("oemCloudRuntime", () => {
  beforeEach(() => {
    window.localStorage.clear();

    delete window.__LIME_OEM_CLOUD__;
  });

  afterEach(() => {
    window.localStorage.clear();

    delete window.__LIME_OEM_CLOUD__;
  });

  it("应优先从运行时配置解析基础地址与 Lime Hub 元信息", () => {
    window.__LIME_OEM_CLOUD__ = {
      enabled: true,
      baseUrl: "https://user.limeai.run/",
      gatewayBaseUrl: "https://gateway-api.limeai.run/root/",
      tenantId: "tenant-0001",
      hubProviderName: "Acme Hub",
      accountSessionId: null,
      loginPath: "/login",
      desktopClientId: "limehub-desktop",
      desktopOauthRedirectUrl: "lime://oauth/callback",
      desktopOauthNextPath: "/welcome",
    };

    expect(resolveOemCloudRuntimeContext()).toEqual({
      baseUrl: "https://user.limeai.run",
      controlPlaneBaseUrl: "https://user.limeai.run/api",
      sceneBaseUrl: "https://user.limeai.run/scene-api",
      gatewayBaseUrl: "https://gateway-api.limeai.run/root",
      tenantId: "tenant-0001",
      accountSessionId: null,
      hubProviderName: "Acme Hub",
      loginPath: "/login",
      desktopClientId: "limehub-desktop",
      desktopOauthRedirectUrl: "lime://oauth/callback",
      desktopOauthNextPath: "/welcome",
    });
  });

  it("未显式提供 gatewayBaseUrl 时应回退到 baseUrl/gateway-api", () => {
    window.__LIME_OEM_CLOUD__ = {
      enabled: true,
      baseUrl: "https://user.limeai.run",
      tenantId: "tenant-0001",
    };

    expect(resolveOemCloudRuntimeContext()).toMatchObject({
      baseUrl: "https://user.limeai.run",
      gatewayBaseUrl: "https://user.limeai.run/gateway-api",
      tenantId: "tenant-0001",
      hubProviderName: null,
      loginPath: "/login",
      desktopClientId: "desktop-client",
      desktopOauthRedirectUrl: "lime://oauth/callback",
      desktopOauthNextPath: "/welcome",
    });
  });

  it("运行时缺租户时应消费共享账号投影", async () => {
    await seedCloudAccount({
      token: "persisted-session-token",
      tenant: {
        id: "tenant-from-storage",
      },
      user: {
        id: "user-001",
      },
      session: {
        id: "session-001",
      },
    });

    window.__LIME_OEM_CLOUD__ = {
      enabled: true,
      baseUrl: "https://user.limeai.run",
    };

    expect(resolveOemCloudRuntimeContext()).toMatchObject({
      baseUrl: "https://user.limeai.run",
      gatewayBaseUrl: "https://user.limeai.run/gateway-api",
      tenantId: "tenant-from-storage",
      accountSessionId: "session-001",
      loginPath: "/login",
      desktopClientId: "desktop-client",
      desktopOauthRedirectUrl: "lime://oauth/callback",
      desktopOauthNextPath: "/welcome",
    });
  });
});
