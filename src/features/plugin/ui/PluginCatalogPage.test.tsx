import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { AppServerPluginSummary } from "@/lib/api/appServerTypes";
import { PluginCatalogPage } from "./PluginCatalogPage";

const mocks = vi.hoisted(() => ({
  appsSubscription: null as null | {
    onUpdate: (apps: unknown[]) => void;
  },
  getProject: vi.fn(),
  installPlugin: vi.fn(),
  listPlugins: vi.fn(),
  readAppsReadiness: vi.fn(),
  readPlugin: vi.fn(),
  setPluginEnabled: vi.fn(),
  subscribeAppsListUpdates: vi.fn(),
  uninstallPlugin: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/api/project", () => ({
  getProject: (...args: unknown[]) => mocks.getProject(...args),
}));

vi.mock("@/lib/api/apps", () => ({
  readAppsReadiness: (...args: unknown[]) => mocks.readAppsReadiness(...args),
  subscribeAppsListUpdates: (...args: unknown[]) =>
    mocks.subscribeAppsListUpdates(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/api/pluginCatalog", () => ({
  installPlugin: (...args: unknown[]) => mocks.installPlugin(...args),
  listPlugins: (...args: unknown[]) => mocks.listPlugins(...args),
  readPlugin: (...args: unknown[]) => mocks.readPlugin(...args),
  setPluginEnabled: (...args: unknown[]) => mocks.setPluginEnabled(...args),
  uninstallPlugin: (...args: unknown[]) => mocks.uninstallPlugin(...args),
}));

function summary(
  overrides: Partial<AppServerPluginSummary> = {},
): AppServerPluginSummary {
  return {
    authPolicy: "ON_USE",
    availability: "AVAILABLE",
    interface: {
      displayName: "Writer Plugin",
      shortDescription: "Writing and research tools",
    },
    enabled: true,
    id: "writer-plugin@personal",
    installPolicy: "AVAILABLE",
    installed: true,
    localVersion: "1.2.3",
    name: "writer-plugin",
    source: { type: "local", path: "/tmp/writer-plugin" },
    version: "1.2.3",
    ...overrides,
  };
}

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PluginCatalogPage />);
  });
  await flush();
  mounted.push({ container, root });
  return container;
}

async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  await flush();
}

describe("PluginCatalogPage", () => {
  beforeEach(async () => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await changeLimeLocale("zh-CN");
    vi.clearAllMocks();
    mocks.appsSubscription = null;
    mocks.listPlugins.mockResolvedValue({
      marketplaces: [
        {
          name: "personal",
          path: "/tmp/marketplace.json",
          plugins: [summary()],
        },
      ],
    });
    mocks.readPlugin.mockResolvedValue({
      plugin: {
        summary: summary(),
        skills: [
          {
            name: "Article Writing",
            description: "",
            shortDescription: null,
            interface: null,
            path: "/tmp/writer-plugin/skills/article-writing/SKILL.md",
            enabled: true,
          },
        ],
        mcpServers: [],
        apps: [
          {
            id: "writer-app",
            name: "Writer App",
            description: "",
            installUrl: null,
            category: null,
          },
        ],
        hooks: [],
      },
    });
    mocks.setPluginEnabled.mockResolvedValue(undefined);
    mocks.uninstallPlugin.mockResolvedValue({});
    mocks.readAppsReadiness.mockResolvedValue({
      apps: [
        {
          id: "writer-app",
          name: "Writer App",
          description: null,
          logoUrl: null,
          logoUrlDark: null,
          iconAssets: null,
          iconDarkAssets: null,
          distributionChannel: "local",
          branding: null,
          appMetadata: null,
          labels: null,
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
          pluginDisplayNames: ["Writer Plugin"],
        },
      ],
      installed: [
        {
          id: "writer-app",
          runtimeName: "Writer App",
          enabled: true,
          callable: false,
        },
      ],
      ready: false,
    });
    mocks.subscribeAppsListUpdates.mockImplementation(
      (subscription: { onUpdate: (apps: unknown[]) => void }) => {
        mocks.appsSubscription = subscription;
        return vi.fn();
      },
    );
  });

  afterEach(async () => {
    while (mounted.length) {
      const entry = mounted.pop();
      if (!entry) {
        continue;
      }
      await act(async () => entry.root.unmount());
      entry.container.remove();
    }
  });

  it("同页侧栏导航应同步安装筛选、搜索和选中的插件详情", async () => {
    mocks.listPlugins.mockResolvedValue({
      marketplaces: [
        {
          name: "personal",
          path: "/tmp/marketplace.json",
          plugins: [
            summary(),
            summary({ id: "browser", name: "Browser", installed: false }),
          ],
        },
      ],
    });
    const container = await renderPage();
    const { root } = mounted.at(-1)!;
    await act(async () => {
      root.render(
        <PluginCatalogPage
          pageParams={{
            statusFilter: "installed",
            selectedPluginId: "writer-plugin@personal",
            query: "Writer",
          }}
        />,
      );
    });
    await flush();
    expect(
      container
        .querySelector('[data-testid="plugin-catalog-search"]')
        ?.getAttribute("value"),
    ).toBe("Writer");
    expect(
      container.querySelector('[data-testid="plugin-catalog-card-browser"]'),
    ).toBeNull();
    expect(mocks.readPlugin).toHaveBeenLastCalledWith({
      marketplacePath: "/tmp/marketplace.json",
      pluginName: "writer-plugin",
    });

    await click(
      container.querySelector('[data-testid="plugin-catalog-view-all"]'),
    );
    await act(async () => {
      root.render(
        <PluginCatalogPage pageParams={{ statusFilter: "installed" }} />,
      );
    });
    await flush();
    expect(
      container.querySelector<HTMLInputElement>(
        '[data-testid="plugin-catalog-search"]',
      )?.value,
    ).toBe("");
    expect(
      container.querySelector('[data-testid="plugin-catalog-card-browser"]'),
    ).toBeNull();

    await act(async () => {
      root.render(<PluginCatalogPage pageParams={{}} />);
    });
    await flush();
    expect(
      container.querySelector('[data-testid="plugin-catalog-card-browser"]'),
    ).not.toBeNull();
  });

  it("项目切换后忽略旧市场请求，使用新项目的显式 cwd", async () => {
    mocks.getProject.mockImplementation(async (id: string) => ({
      rootPath: `/tmp/${id}`,
    }));
    let finishOldRequest!: (value: { marketplaces: unknown[] }) => void;
    mocks.listPlugins.mockImplementation(({ cwds }: { cwds?: string[] }) => {
      if (cwds?.[0] === "/tmp/old-project") {
        return new Promise((resolve) => {
          finishOldRequest = resolve;
        });
      }
      return Promise.resolve({ marketplaces: [] });
    });
    const container = await renderPage();
    const { root } = mounted.at(-1)!;
    await act(async () => {
      root.render(
        <PluginCatalogPage pageParams={{ currentProjectId: "old-project" }} />,
      );
    });
    await flush();
    expect(mocks.listPlugins).toHaveBeenCalledWith({
      cwds: ["/tmp/old-project"],
    });
    await act(async () => {
      root.render(
        <PluginCatalogPage pageParams={{ currentProjectId: "new-project" }} />,
      );
    });
    await flush();
    expect(mocks.listPlugins).toHaveBeenLastCalledWith({
      cwds: ["/tmp/new-project"],
    });
    await act(async () => {
      finishOldRequest({
        marketplaces: [
          { name: "personal", path: "/tmp/old.json", plugins: [summary()] },
        ],
      });
    });
    await flush();
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-card-writer-plugin@personal"]',
      ),
    ).toBeNull();
  });

  it("从 v2 catalog 展示安装状态并读取详情", async () => {
    const container = await renderPage();

    expect(container.textContent).toContain("插件中心");
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-card-writer-plugin@personal"]',
      ),
    ).not.toBeNull();
    expect(mocks.listPlugins).toHaveBeenCalledWith({});
    expect(mocks.readPlugin).toHaveBeenCalledWith({
      marketplacePath: "/tmp/marketplace.json",
      pluginName: "writer-plugin",
    });
    expect(container.textContent).toContain("Article Writing");
    expect(
      container
        .querySelector(
          '[data-testid="plugin-catalog-app-readiness-writer-app"]',
        )
        ?.getAttribute("data-callable"),
    ).toBe("false");
    expect(container.textContent).toContain("宿主待接入");

    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-actions-writer-plugin@personal"]',
      ),
    );
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-toggle-writer-plugin@personal"]',
      ),
    );
    expect(mocks.setPluginEnabled).toHaveBeenCalledWith({
      pluginId: "writer-plugin@personal",
      enabled: false,
    });
  });

  it("收到 typed app/list/updated 后刷新 Apps readiness", async () => {
    const container = await renderPage();
    mocks.readAppsReadiness.mockResolvedValueOnce({
      apps: [],
      installed: [
        {
          id: "writer-app",
          runtimeName: "Writer App",
          enabled: false,
          callable: false,
        },
      ],
      ready: true,
    });

    await act(async () => {
      mocks.appsSubscription?.onUpdate([]);
      await Promise.resolve();
    });
    await flush();

    expect(mocks.readAppsReadiness).toHaveBeenCalledTimes(2);
    const row = container.querySelector(
      '[data-testid="plugin-catalog-app-readiness-writer-app"]',
    );
    expect(row?.getAttribute("data-enabled")).toBe("false");
    expect(row?.getAttribute("data-status")).toBe("disabled");
    expect(row?.textContent).toContain("已停用");
  });

  it("卸载空响应后刷新市场安装态、关闭确认并提示成功", async () => {
    mocks.uninstallPlugin.mockResolvedValue({});
    const container = await renderPage();
    mocks.listPlugins.mockResolvedValue({
      marketplaces: [
        {
          name: "personal",
          path: "/tmp/marketplace.json",
          plugins: [summary({ installed: false, enabled: false })],
        },
      ],
    });
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-actions-writer-plugin@personal"]',
      ),
    );
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-uninstall-writer-plugin@personal"]',
      ),
    );
    const confirm = container.querySelector(
      '[data-testid="plugin-catalog-uninstall-confirm"]',
    );
    await click(confirm?.querySelector("button:last-child") ?? null);

    expect(mocks.uninstallPlugin).toHaveBeenCalledWith({
      pluginId: "writer-plugin@personal",
    });
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-card-writer-plugin@personal"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-uninstall-confirm"]',
      ),
    ).toBeNull();
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("卸载失败时保留卡片和确认状态，不提示成功", async () => {
    mocks.uninstallPlugin.mockRejectedValue(new Error("uninstall rejected"));
    const container = await renderPage();
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-actions-writer-plugin@personal"]',
      ),
    );
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-uninstall-writer-plugin@personal"]',
      ),
    );
    const confirm = container.querySelector(
      '[data-testid="plugin-catalog-uninstall-confirm"]',
    );
    await click(confirm?.querySelector("button:last-child") ?? null);

    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-card-writer-plugin@personal"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-uninstall-confirm"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="plugin-catalog-error"]')
        ?.textContent,
    ).toContain("uninstall rejected");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("按市场定位安装并从服务端刷新，不依赖安装响应中的插件", async () => {
    mocks.listPlugins
      .mockResolvedValueOnce({
        marketplaces: [
          {
            name: "personal",
            path: "/tmp/marketplace.json",
            plugins: [summary({ installed: false, enabled: false })],
          },
        ],
      })
      .mockResolvedValue({
        marketplaces: [
          {
            name: "personal",
            path: "/tmp/marketplace.json",
            plugins: [summary()],
          },
        ],
      });
    mocks.installPlugin.mockResolvedValue({
      authPolicy: "ON_USE",
      appsNeedingAuth: [],
    });
    const container = await renderPage();
    expect(
      container.querySelector('[data-testid="plugin-catalog-install-local"]'),
    ).toBeNull();
    await click(
      container.querySelector(
        '[data-testid="plugin-catalog-install-writer-plugin@personal"]',
      ),
    );
    await click(
      document.body.querySelector(
        '[data-testid="plugin-catalog-confirm-install"]',
      ),
    );
    expect(mocks.installPlugin).toHaveBeenCalledWith({
      marketplacePath: "/tmp/marketplace.json",
      pluginName: "writer-plugin",
      installAttemptId: expect.any(String),
    });
    expect(mocks.listPlugins).toHaveBeenCalledTimes(2);
    expect(
      container.querySelector(
        '[data-testid="plugin-catalog-actions-writer-plugin@personal"]',
      ),
    ).not.toBeNull();
  });

  it.each([
    ["zh-CN", "管理市场中的插件，查看详情并安装到当前环境。"],
    ["zh-TW", "管理市集中的外掛，檢視詳情並安裝到目前環境。"],
    [
      "en-US",
      "Browse marketplace plugins, inspect their details, and install them.",
    ],
    ["ja-JP", "マーケットプレイスのプラグインを確認し、インストールします。"],
    ["ko-KR", "마켓플레이스 플러그인의 세부 정보를 확인하고 설치합니다."],
  ] as const)("%s 展示市场安装文案", async (locale, description) => {
    await changeLimeLocale(locale);
    const container = await renderPage();
    expect(container.textContent).toContain(description);
    expect(
      container.querySelector('[data-testid="plugin-catalog-install-local"]'),
    ).toBeNull();
  });
});
