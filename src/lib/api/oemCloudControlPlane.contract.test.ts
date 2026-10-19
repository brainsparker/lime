import {
  seedCloudAccount,
  stubCloudRequest,
  cloudRequestMock,
} from "@/test/cloudAccountFixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClientAccessToken,
  createClientCreditTopupOrder,
  createClientCreditTopupOrderCheckout,
  createClientOrder,
  createClientOrderCheckout,
  createClientDesktopAuthSession,
  getClientActiveAccessToken,
  getClientCloudActivation,
  getClientCreditTopupOrder,
  getClientOrder,
  getClientBootstrap,
  getClientCreditsDashboard,
  getClientSceneSkillPreferences,
  getPublicAuthCatalog,
  getClientProviderOffer,
  listClientPaymentConfigs,
  listClientPlans,
  listClientProviderOfferModels,
  listClientProviderOffers,
  listClientTopupPackages,
  pollClientDesktopAuthSession,
  rotateClientAccessToken,
  updateClientSceneSkillPreferences,
} from "./oemCloudControlPlane";
import { parseAppServerConfig } from "./oemCloudControlPlaneCoreParsers";

describe("oemCloudControlPlane desktop auth", () => {
  beforeEach(() => {
    window.__LIME_OEM_CLOUD__ = {
      enabled: true,
      baseUrl: "https://user.limeai.run",
      tenantId: "tenant-0001",
    };
  });

  afterEach(() => {
    delete window.__LIME_OEM_CLOUD__;

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("应创建桌面授权会话并返回浏览器授权地址", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({
        code: 201,
        message: "success",
        data: {
          authSessionId: "desktop-auth-0001",
          deviceCode: "device-code-001",
          tenantId: "tenant-0001",
          clientId: "desktop-client",
          clientName: "Desktop Client",
          provider: "google",
          desktopRedirectUri: "lime://oauth/callback",
          status: "pending_login",
          expiresInSeconds: 600,
          pollIntervalSeconds: 2,
          authorizeUrl:
            "https://user.limeai.run/oauth/desktop/device-code-001/authorize?provider=google",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createClientDesktopAuthSession("tenant-0001", {
      clientId: "desktop-client",
      provider: "google",
      desktopRedirectUri: "lime://oauth/callback",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://user.limeai.run/api/v1/public/tenants/tenant-0001/desktop/auth-sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          clientId: "desktop-client",
          provider: "google",
          desktopRedirectUri: "lime://oauth/callback",
        }),
      }),
    );
    expect(result).toEqual({
      authSessionId: "desktop-auth-0001",
      deviceCode: "device-code-001",
      tenantId: "tenant-0001",
      clientId: "desktop-client",
      clientName: "Desktop Client",
      provider: "google",
      desktopRedirectUri: "lime://oauth/callback",
      status: "pending_login",
      expiresInSeconds: 600,
      pollIntervalSeconds: 2,
      authorizeUrl:
        "https://user.limeai.run/oauth/desktop/device-code-001/authorize?provider=google",
    });
  });

  it("应轮询桌面授权结果并解析 session token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        message: "success",
        data: {
          deviceCode: "device-code-001",
          tenantId: "tenant-0001",
          clientId: "desktop-client",
          clientName: "Desktop Client",
          provider: "google",
          status: "approved",
          expiresInSeconds: 388,
          pollIntervalSeconds: 2,
          sessionToken: "session-token-001",
          sessionExpiresAt: "2026-03-24T16:00:00.000Z",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pollClientDesktopAuthSession("device-code-001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://user.limeai.run/api/v1/public/desktop/auth-sessions/device-code-001/poll",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
    expect(result).toEqual({
      deviceCode: "device-code-001",
      tenantId: "tenant-0001",
      clientId: "desktop-client",
      clientName: "Desktop Client",
      provider: "google",
      desktopRedirectUri: undefined,
      status: "approved",
      expiresInSeconds: 388,
      pollIntervalSeconds: 2,
      sessionToken: "session-token-001",
      sessionExpiresAt: "2026-03-24T16:00:00.000Z",
    });
  });

  it("应读取公开登录目录与启动策略", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        message: "success",
        data: {
          items: [
            {
              provider: "google",
              displayName: "Google",
              scopes: ["openid", "email"],
              enabled: true,
            },
          ],
          authPolicy: {
            required: true,
            startupTrigger: "oauth",
            primaryProvider: "google",
          },
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const catalog = await getPublicAuthCatalog("tenant-0001");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://user.limeai.run/api/v1/public/tenants/tenant-0001/client/auth-catalog",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
    expect(catalog).toEqual({
      providers: [
        {
          provider: "google",
          displayName: "Google",
          authorizeUrl: undefined,
          redirectUri: undefined,
          scopes: ["openid", "email"],
          enabled: true,
          loginHint: undefined,
        },
      ],
      authPolicy: {
        required: true,
        startupTrigger: "oauth",
        primaryProvider: "google",
      },
    });
  });

  it("应通过共享账号读取 bootstrap 并解析 App Server 配置", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        message: "success",
        data: {
          session: {
            token: "session-token-001",
            tenant: { id: "tenant-0001", name: "Lime" },
            user: { id: "user-001", displayName: "晚风" },
            session: { id: "session-001", provider: "google" },
          },
          app: {
            id: "app-001",
            key: "lime",
            name: "Lime",
            slug: "lime",
            category: "official",
            status: "active",
            distributionChannels: ["desktop"],
          },
          providerOffersSummary: [],
          providerPreference: {
            tenantId: "tenant-0001",
            userId: "user-001",
            providerSource: "local",
            providerKey: "local",
            needsValidation: false,
            updatedAt: "2026-04-28T00:00:00.000Z",
          },
          appServer: {
            enabled: true,
            endpoint: "wss://llm.limeai.run/v1/app-server",
            transport: "websocket",
            protocol: "appserver.v0",
            authorizationHeader: "Authorization",
            authorizationScheme: "Bearer",
            tenantHeader: "X-Lime-Tenant-ID",
          },
          features: {
            gatewayEnabled: true,
          },
        },
      }),
    }));
    stubCloudRequest(fetchMock);

    const bootstrap = await getClientBootstrap("tenant-0001");

    expect(cloudRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1/public/tenants/tenant-0001/client/bootstrap",
        method: "GET",
      }),
    );
    expect(bootstrap.features.gatewayEnabled).toBe(true);
    expect(bootstrap.appServer).toEqual({
      enabled: true,
      endpoint: "wss://llm.limeai.run/v1/app-server",
      transport: "websocket",
      protocol: "appserver.v0",
      authorizationHeader: "Authorization",
      authorizationScheme: "Bearer",
      tenantHeader: "X-Lime-Tenant-ID",
    });
  });

  it("应拒绝带凭证或 query 的 App Server endpoint", () => {
    expect(() =>
      parseAppServerConfig({
        enabled: true,
        endpoint:
          "wss://user:secret@llm.example.com/v1/app-server?token=secret",
      }),
    ).toThrow("App Server endpoint");
  });

  it("旧 bootstrap 缺少 appServer 时应保持显式关闭", () => {
    expect(parseAppServerConfig(undefined)).toMatchObject({
      enabled: false,
      transport: "websocket",
      protocol: "appserver.v0",
    });
  });

  it("应读取并更新首页场景技能偏好", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const preferencePayload = {
      tenantId: "tenant-0001",
      userId: "user-0001",
      orderedEntryIds: ["custom_scene:daily-review", "skill:trend"],
      hiddenEntryIds: ["skill:hidden"],
      customScenes: [
        {
          id: "custom_scene:daily-review",
          title: "每日复盘",
          linkedEntryId: "skill:trend",
          templates: [
            {
              id: "default",
              title: "开始复盘",
              prompt: "请帮我复盘今天的内容表现。",
            },
          ],
          enabled: true,
        },
      ],
      updatedAt: "2026-04-30T00:00:00.000Z",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: "success",
          data: preferencePayload,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: "success",
          data: preferencePayload,
        }),
      });
    stubCloudRequest(fetchMock);

    const preference = await getClientSceneSkillPreferences("tenant-0001");
    expect(preference.customScenes[0]?.title).toBe("每日复盘");

    await updateClientSceneSkillPreferences("tenant-0001", {
      orderedEntryIds: preference.orderedEntryIds,
      hiddenEntryIds: preference.hiddenEntryIds,
      customScenes: preference.customScenes,
    });

    expect(cloudRequestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: "/v1/public/tenants/tenant-0001/client/scene-skill-preferences",
        method: "GET",
      }),
    );
    expect(cloudRequestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: "/v1/public/tenants/tenant-0001/client/scene-skill-preferences",
        method: "PUT",
        body: {
          orderedEntryIds: preference.orderedEntryIds,
          hiddenEntryIds: preference.hiddenEntryIds,
          customScenes: preference.customScenes,
        },
      }),
    );
  });

  it("应解析服务端下发的云端治理字段", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: "success",
          data: {
            items: [
              {
                providerKey: "lime-hub-main",
                displayName: "Lime Hub 主服务",
                source: "oem_cloud",
                state: "available_ready",
                visible: true,
                loggedIn: true,
                accountStatus: "logged_in",
                subscriptionStatus: "active",
                quotaStatus: "ok",
                canInvoke: true,
                defaultModel: "gpt-5.2-pro",
                effectiveAccessMode: "session",
                apiKeyModeEnabled: false,
                tenantOverrideApplied: true,
                configMode: "managed",
                modelsSource: "hub_catalog",
                developerAccessVisible: false,
                availableModelCount: 18,
                fallbackToLocalAllowed: true,
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          message: "success",
          data: {
            providerKey: "lime-hub-main",
            displayName: "Lime Hub 主服务",
            source: "oem_cloud",
            state: "available_ready",
            visible: true,
            loggedIn: true,
            accountStatus: "logged_in",
            subscriptionStatus: "active",
            quotaStatus: "ok",
            canInvoke: true,
            defaultModel: "gpt-5.2-pro",
            effectiveAccessMode: "session",
            apiKeyModeEnabled: true,
            tenantOverrideApplied: false,
            configMode: "hybrid",
            modelsSource: "manual",
            developerAccessVisible: true,
            availableModelCount: 6,
            fallbackToLocalAllowed: true,
            access: {
              offerId: "offer-001",
              accessMode: "api_key",
              hubTokenEnabled: true,
              hubTokenRef: "hub-token-ref",
            },
          },
        }),
      });
    stubCloudRequest(fetchMock);

    const [offers, detail] = await Promise.all([
      listClientProviderOffers("tenant-0001"),
      getClientProviderOffer("tenant-0001", "lime-hub-main"),
    ]);

    expect(offers[0]).toMatchObject({
      effectiveAccessMode: "session",
      apiKeyModeEnabled: false,
      tenantOverrideApplied: true,
      configMode: "managed",
      modelsSource: "hub_catalog",
      developerAccessVisible: false,
    });
    expect(detail).toMatchObject({
      effectiveAccessMode: "session",
      apiKeyModeEnabled: true,
      configMode: "hybrid",
      modelsSource: "manual",
      developerAccessVisible: true,
      access: {
        offerId: "offer-001",
        accessMode: "api_key",
        hubTokenEnabled: true,
        hubTokenRef: "hub-token-ref",
      },
    });
  });

  it("应解析服务端直接下发的 OEM 模型 taxonomy 字段", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        message: "success",
        data: {
          items: [
            {
              id: "model-001",
              offerId: "offer-001",
              modelId: "relay-gpt-images-2",
              displayName: "Relay GPT Images 2",
              abilities: ["image_generation"],
              task_families: ["image_generation"],
              input_modalities: ["text"],
              output_modalities: ["image"],
              runtime_features: ["images_api"],
              deployment_source: "oem_cloud",
              management_plane: "oem_control_plane",
              canonical_model_id: "openai/gpt-images-2",
              provider_model_id: "relay-gpt-images-2",
              alias_source: "oem",
              recommended: true,
              status: "active",
              sort: 10,
              createdAt: "2026-04-22T00:00:00.000Z",
              updatedAt: "2026-04-22T00:00:00.000Z",
            },
          ],
        },
      }),
    }));
    stubCloudRequest(fetchMock);

    const models = await listClientProviderOfferModels(
      "tenant-0001",
      "lime-hub-main",
    );

    expect(models).toEqual([
      expect.objectContaining({
        modelId: "relay-gpt-images-2",
        task_families: ["image_generation"],
        input_modalities: ["text"],
        output_modalities: ["image"],
        runtime_features: ["images_api"],
        deployment_source: "oem_cloud",
        management_plane: "oem_control_plane",
        canonical_model_id: "openai/gpt-images-2",
        provider_model_id: "relay-gpt-images-2",
        alias_source: "oem",
      }),
    ]);
  });

  it("应接入套餐、积分、订单和 API Key 控制面接口", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const accessToken = {
      id: "token-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      name: "Desktop Key",
      tokenMasked: "sk-lime-***abcd",
      tokenPrefix: "sk-lime-abcd",
      scopes: ["llm:invoke"],
      allowedModels: ["glm-4.6"],
      status: "active",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
      expiresAt: "2026-05-27T00:00:00.000Z",
    };
    const plan = {
      id: "plan-pro",
      tenantId: "tenant-0001",
      key: "pro",
      name: "Pro",
      priceMonthly: 9900,
      creditsMonthly: 1000000,
      features: ["Anthropic-compatible coding"],
      status: "active",
      recommended: true,
      billingCycles: [
        {
          key: "monthly",
          label: "月付",
          priceCents: 9900,
          credits: 1000000,
          autoRenew: true,
        },
      ],
      quotaSummaries: [],
      featureSections: [],
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const creditAccount = {
      tenantId: "tenant-0001",
      userId: "user-001",
      balance: 120000,
      reserved: 1000,
      currency: "credits",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const subscription = {
      id: "sub-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      planId: "plan-pro",
      planKey: "pro",
      planName: "Pro",
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      autoRenew: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const topupPackage = {
      id: "topup-100k",
      tenantId: "tenant-0001",
      key: "100k",
      name: "10 万积分包",
      credits: 100000,
      priceCents: 1900,
      validDays: 365,
      recommended: true,
      status: "active",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const order = {
      id: "order-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      planId: "plan-pro",
      planKey: "pro",
      planName: "Pro",
      amountCents: 9900,
      creditsGranted: 1000000,
      paymentChannel: "epay",
      paymentMethod: "alipay",
      billingCycle: "monthly",
      status: "pending",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const topupOrder = {
      id: "topup-order-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      packageId: "topup-100k",
      packageName: "10 万积分包",
      creditsGranted: 100000,
      amountCents: 1900,
      paymentChannel: "epay",
      paymentMethod: "alipay",
      status: "pending",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const response = (data: unknown, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        code: status,
        message: "success",
        data,
      }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: "pay-alipay",
              tenantId: "tenant-0001",
              provider: "epay",
              displayName: "易支付",
              notifyUrl: "https://user.limeai.run/pay/notify",
              returnUrl: "https://user.limeai.run/pay/return",
              enabled: true,
              methods: [
                {
                  key: "alipay",
                  displayName: "支付宝",
                  enabled: true,
                },
              ],
              providerOptions: {
                payAddress: "https://pay.example.com",
              },
              credentialMasks: {
                partnerId: "2088***0001",
              },
              createdAt: "2026-04-27T00:00:00.000Z",
              updatedAt: "2026-04-27T00:00:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ items: [plan] }))
      .mockResolvedValueOnce(
        response({
          creditAccount,
          subscription,
          topupPackages: [topupPackage],
          creditWallets: [],
          creditOrders: [topupOrder],
        }),
      )
      .mockResolvedValueOnce(response({ items: [topupPackage] }))
      .mockResolvedValueOnce(response({ hasActive: true, token: accessToken }))
      .mockResolvedValueOnce(
        response({ token: accessToken, apiKey: "sk-lime-new" }, 201),
      )
      .mockResolvedValueOnce(
        response(
          {
            previousToken: { ...accessToken, status: "revoked" },
            newToken: { ...accessToken, id: "token-002" },
            apiKey: "sk-lime-rotated",
          },
          200,
        ),
      )
      .mockResolvedValueOnce(response(order, 201))
      .mockResolvedValueOnce(
        response({
          orderKind: "plan_order",
          orderId: "order-001",
          paymentChannel: "epay",
          paymentMethod: "alipay",
          checkoutUrl:
            "https://pay.example.com/submit.php?out_trade_no=order-001",
          paymentReference:
            "https://pay.example.com/submit.php?out_trade_no=order-001",
          status: "pending",
        }),
      )
      .mockResolvedValueOnce(response(topupOrder, 201))
      .mockResolvedValueOnce(
        response({
          orderKind: "credit_topup_order",
          orderId: "topup-order-001",
          paymentChannel: "epay",
          paymentMethod: "alipay",
          checkoutUrl:
            "https://pay.example.com/submit.php?out_trade_no=topup-order-001",
          paymentReference:
            "https://pay.example.com/submit.php?out_trade_no=topup-order-001",
          status: "pending",
        }),
      );
    stubCloudRequest(fetchMock);

    await expect(listClientPaymentConfigs("tenant-0001")).resolves.toEqual([
      expect.objectContaining({
        provider: "epay",
        enabled: true,
        methods: [expect.objectContaining({ key: "alipay" })],
        providerOptions: { payAddress: "https://pay.example.com" },
        credentialMasks: { partnerId: "2088***0001" },
      }),
    ]);
    await expect(listClientPlans("tenant-0001")).resolves.toEqual([
      expect.objectContaining({
        name: "Pro",
        billingCycles: expect.any(Array),
      }),
    ]);
    await expect(
      getClientCreditsDashboard("tenant-0001"),
    ).resolves.toMatchObject({
      creditAccount: { balance: 120000 },
      subscription: { planName: "Pro" },
      topupPackages: [{ name: "10 万积分包" }],
    });
    await expect(listClientTopupPackages("tenant-0001")).resolves.toEqual([
      expect.objectContaining({ id: "topup-100k" }),
    ]);
    await expect(
      getClientActiveAccessToken("tenant-0001"),
    ).resolves.toMatchObject({
      hasActive: true,
      token: { tokenMasked: "sk-lime-***abcd" },
    });
    await expect(
      createClientAccessToken("tenant-0001", {
        name: "Desktop Key",
        scopes: ["llm:invoke"],
      }),
    ).resolves.toMatchObject({ apiKey: "sk-lime-new" });
    await expect(
      rotateClientAccessToken("tenant-0001", "token-001"),
    ).resolves.toMatchObject({ apiKey: "sk-lime-rotated" });
    await expect(
      createClientOrder("tenant-0001", {
        planId: "plan-pro",
        paymentChannel: "epay",
        paymentMethod: "alipay",
        billingCycle: "monthly",
      }),
    ).resolves.toMatchObject({ id: "order-001" });
    await expect(
      createClientOrderCheckout("tenant-0001", "order-001", {
        paymentMethod: "alipay",
      }),
    ).resolves.toMatchObject({
      orderKind: "plan_order",
      checkoutUrl: "https://pay.example.com/submit.php?out_trade_no=order-001",
    });
    await expect(
      createClientCreditTopupOrder("tenant-0001", {
        packageId: "topup-100k",
        paymentChannel: "epay",
        paymentMethod: "alipay",
      }),
    ).resolves.toMatchObject({ id: "topup-order-001" });
    await expect(
      createClientCreditTopupOrderCheckout("tenant-0001", "topup-order-001", {
        paymentMethod: "alipay",
      }),
    ).resolves.toMatchObject({
      orderKind: "credit_topup_order",
      checkoutUrl:
        "https://pay.example.com/submit.php?out_trade_no=topup-order-001",
    });

    expect(cloudRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1/public/tenants/tenant-0001/client/orders",
        method: "POST",
        body: {
          planId: "plan-pro",
          paymentChannel: "epay",
          paymentMethod: "alipay",
          billingCycle: "monthly",
        },
      }),
    );
    expect(cloudRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/v1/public/tenants/tenant-0001/client/orders/order-001/checkout",
        method: "POST",
        body: { paymentMethod: "alipay" },
      }),
    );
  });

  it("应解析云端激活聚合状态和订单详情", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );

    const paymentConfig = {
      id: "pay-alipay",
      tenantId: "tenant-0001",
      provider: "epay",
      displayName: "易支付",
      notifyUrl: "https://user.limeai.run/pay/notify",
      returnUrl: "https://user.limeai.run/pay/return",
      enabled: true,
      methods: [{ key: "alipay", displayName: "支付宝", enabled: true }],
      providerOptions: { payAddress: "https://pay.example.com" },
      credentialMasks: { partnerId: "2088***0001" },
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const plan = {
      id: "plan-pro",
      tenantId: "tenant-0001",
      key: "pro",
      name: "Pro",
      priceMonthly: 9900,
      creditsMonthly: 1000000,
      features: ["Anthropic-compatible coding"],
      status: "active",
      recommended: true,
      billingCycles: [],
      quotaSummaries: [],
      featureSections: [],
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const creditAccount = {
      tenantId: "tenant-0001",
      userId: "user-001",
      balance: 120000,
      reserved: 0,
      currency: "credits",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const subscription = {
      id: "sub-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      planId: "plan-pro",
      planKey: "pro",
      planName: "Pro",
      status: "active",
      currentPeriodStart: "2026-04-01T00:00:00.000Z",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      autoRenew: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const order = {
      id: "order-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      planId: "plan-pro",
      planKey: "pro",
      planName: "Pro",
      amountCents: 9900,
      creditsGranted: 1000000,
      paymentChannel: "epay",
      paymentMethod: "alipay",
      checkoutUrl: "https://pay.example.com/submit.php?out_trade_no=order-001",
      status: "pending",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const topupOrder = {
      id: "topup-order-001",
      tenantId: "tenant-0001",
      userId: "user-001",
      packageId: "topup-100k",
      packageName: "10 万积分包",
      creditsGranted: 100000,
      amountCents: 1900,
      paymentChannel: "epay",
      paymentMethod: "alipay",
      checkoutUrl:
        "https://pay.example.com/submit.php?out_trade_no=topup-order-001",
      status: "pending",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const model = {
      id: "model-kimi-coding",
      offerId: "offer-limehub",
      modelId: "kimi-coding-plan",
      displayName: "Kimi Coding Plan",
      abilities: ["Coding", "Anthropic 协议"],
      recommended: true,
      status: "active",
      sort: 10,
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    };
    const response = (data: unknown) => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, message: "success", data }),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          gateway: {
            basePath: "https://llm.limeai.run",
            openAIBaseUrl: "https://llm.limeai.run/v1",
            anthropicBaseUrl: "https://llm.limeai.run",
            chatCompletionsPath: "/v1/chat/completions",
            authorizationHeader: "Authorization",
            authorizationScheme: "Bearer",
            tenantHeader: "X-Lime-Tenant-ID",
          },
          llmBaseUrl: "https://llm.limeai.run",
          openAIBaseUrl: "https://llm.limeai.run/v1",
          anthropicBaseUrl: "https://llm.limeai.run",
          readiness: {
            status: "payment_pending",
            title: "存在待支付订单",
            canInvoke: false,
            blockers: ["payment"],
            steps: [{ key: "payment", label: "支付确认", done: false }],
          },
          pendingPayment: {
            kind: "plan_order",
            orderId: "order-001",
            title: "Pro",
            paymentChannel: "epay",
            paymentReference:
              "https://pay.example.com/submit.php?out_trade_no=order-001",
            amountCents: 9900,
            status: "pending",
            createdAt: "2026-04-27T00:00:00.000Z",
            updatedAt: "2026-04-27T00:00:00.000Z",
          },
          paymentConfigs: [paymentConfig],
          plans: [plan],
          subscription,
          creditAccount,
          creditsDashboard: {
            creditAccount,
            subscription,
            topupPackages: [],
            creditWallets: [],
            creditOrders: [topupOrder],
          },
          topupPackages: [],
          usageDashboard: {
            usageRecords: [],
            monthlySummary: {},
          },
          billingDashboard: {
            billingSummary: { currency: "CNY" },
            subscription,
            currentPlan: {},
            orders: [order],
          },
          providerOffers: [
            {
              providerKey: "limehub",
              displayName: "LimeHub",
              source: "oem_cloud",
              state: "available_ready",
              visible: true,
              loggedIn: true,
              accountStatus: "logged_in",
              subscriptionStatus: "active",
              quotaStatus: "ok",
              canInvoke: true,
              effectiveAccessMode: "session",
              apiKeyModeEnabled: true,
              tenantOverrideApplied: false,
              configMode: "managed",
              modelsSource: "hub_catalog",
              developerAccessVisible: true,
              availableModelCount: 1,
              fallbackToLocalAllowed: false,
            },
          ],
          selectedOffer: {
            providerKey: "limehub",
            displayName: "LimeHub",
            source: "oem_cloud",
            state: "available_ready",
            visible: true,
            loggedIn: true,
            accountStatus: "logged_in",
            subscriptionStatus: "active",
            quotaStatus: "ok",
            canInvoke: true,
            effectiveAccessMode: "session",
            apiKeyModeEnabled: true,
            tenantOverrideApplied: false,
            configMode: "managed",
            modelsSource: "hub_catalog",
            developerAccessVisible: true,
            availableModelCount: 1,
            fallbackToLocalAllowed: false,
            access: {
              offerId: "offer-limehub",
              accessMode: "session",
              hubTokenEnabled: true,
            },
          },
          providerModels: [model],
          providerPreference: {
            tenantId: "tenant-0001",
            userId: "user-001",
            providerSource: "oem_cloud",
            providerKey: "limehub",
            needsValidation: false,
            updatedAt: "2026-04-27T00:00:00.000Z",
          },
          accessTokens: [],
          activeAccessToken: { hasActive: false },
          orders: [order],
          creditTopupOrders: [topupOrder],
        }),
      )
      .mockResolvedValueOnce(response(order))
      .mockResolvedValueOnce(response(topupOrder));
    stubCloudRequest(fetchMock);

    await expect(
      getClientCloudActivation("tenant-0001"),
    ).resolves.toMatchObject({
      openAIBaseUrl: "https://llm.limeai.run/v1",
      gateway: { tenantHeader: "X-Lime-Tenant-ID" },
      readiness: { status: "payment_pending" },
      pendingPayment: { orderId: "order-001" },
      providerModels: [{ modelId: "kimi-coding-plan" }],
      billingDashboard: { currentPlan: null },
    });
    await expect(
      getClientOrder("tenant-0001", "order-001"),
    ).resolves.toMatchObject({
      id: "order-001",
    });
    await expect(
      getClientCreditTopupOrder("tenant-0001", "topup-order-001"),
    ).resolves.toMatchObject({ id: "topup-order-001" });
  });

  it("客户端激活应容忍未开通订阅只返回状态摘要", async () => {
    await seedCloudAccount(
      {
        token: "session-token-001",
        tenant: { id: "tenant-0001" },
        user: { id: "user-001" },
        session: { id: "session-001" },
      },
      "https://user.limeai.run",
    );
    const response = (data: unknown) => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 200, message: "success", data }),
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      response({
        gateway: {
          basePath: "https://llm.limeai.run",
          openAIBaseUrl: "https://llm.limeai.run/v1",
        },
        readiness: {
          status: "ready",
          title: "云端状态已同步",
          canInvoke: true,
        },
        subscription: {
          id: "sub-empty",
          tenantId: "tenant-0001",
          status: "none",
          planName: "未开通",
        },
        usageDashboard: {
          usageRecords: [],
          monthlySummary: {},
        },
        billingDashboard: {
          billingSummary: { currency: "CNY" },
          subscription: {
            id: "sub-billing-empty",
            tenantId: "tenant-0001",
            status: "none",
          },
          currentPlan: null,
          orders: [],
        },
        providerOffers: [],
        providerModels: [],
        accessTokens: [],
        activeAccessToken: { hasActive: false },
        orders: [],
        creditTopupOrders: [],
      }),
    );
    stubCloudRequest(fetchMock);

    await expect(
      getClientCloudActivation("tenant-0001"),
    ).resolves.toMatchObject({
      subscription: null,
      billingDashboard: {
        subscription: null,
        currentPlan: null,
      },
      readiness: { status: "ready" },
    });
  });
});
