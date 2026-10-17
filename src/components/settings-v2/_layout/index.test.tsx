import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { SettingsTabs } from "@/types/settings";
import type {
  ExecutionPolicyFocusContext,
  Page,
  PageParams,
  ProviderSettingsFocusContext,
  SettingsPageParams,
} from "@/types/page";

const {
  mockSettingsSidebar,
  mockPreloadDeveloperDefaultSections,
  mockCloudProviderSettings,
  mockSettingsHomePage,
  mockDeveloperLabSettings,
  mockArchivedConversationsSettings,
  mockExecutionPolicySettings,
  mockProfileSettings,
  mockUserCenterSessionSettings,
} = vi.hoisted(() => ({
  mockSettingsSidebar: vi.fn(),
  mockPreloadDeveloperDefaultSections: vi.fn(),
  mockCloudProviderSettings: vi.fn(),
  mockSettingsHomePage: vi.fn(),
  mockDeveloperLabSettings: vi.fn(),
  mockArchivedConversationsSettings: vi.fn(),
  mockExecutionPolicySettings: vi.fn(),
  mockProfileSettings: vi.fn(),
  mockUserCenterSessionSettings: vi.fn(),
}));

const { mockResolveOemCloudRuntimeContext } = vi.hoisted(() => ({
  mockResolveOemCloudRuntimeContext: vi.fn(),
}));

vi.mock("./SettingsSidebar", () => ({
  SettingsSidebar: (props: unknown) => {
    mockSettingsSidebar(props);
    return <div data-testid="settings-sidebar">sidebar</div>;
  },
}));

vi.mock("@/lib/workspace/workbenchUi", () => ({
  CanvasBreadcrumbHeader: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("../general/appearance", () => ({
  AppearanceSettings: () => <div>appearance</div>,
}));
vi.mock("../general/memory", () => ({
  MemorySettings: () => <div>memory</div>,
}));
vi.mock("../general/archived-conversations", () => ({
  ArchivedConversationsSettings: () => {
    mockArchivedConversationsSettings();
    return <div>archived-conversations</div>;
  },
}));
vi.mock("../system/developer-lab", () => ({
  DeveloperLabSettings: (props: unknown) => {
    mockDeveloperLabSettings(props);
    return <div>developer-lab</div>;
  },
}));
vi.mock("../system/developer/preload", () => ({
  preloadDeveloperDefaultSections: mockPreloadDeveloperDefaultSections,
}));
vi.mock("../system/about", () => ({
  AboutSection: () => <div>about</div>,
}));
vi.mock("../agent/skills", () => ({
  ExtensionsSettings: () => <div>skills</div>,
}));
vi.mock("../agent/media-services", () => ({
  MediaServicesSettings: () => <div>media-services</div>,
}));
vi.mock("../account/stats", () => ({
  StatsSettings: () => <div>stats</div>,
}));
vi.mock("../account/profile", () => ({
  ProfileSettings: () => {
    mockProfileSettings();
    return <div>PROFILE_SETTINGS</div>;
  },
}));
vi.mock("../account/user-center-session", () => ({
  UserCenterSessionSettings: () => {
    mockUserCenterSessionSettings();
    return <div>USER_CENTER_SESSION</div>;
  },
}));
vi.mock("../agent/providers", () => ({
  CloudProviderSettings: (props: unknown) => {
    mockCloudProviderSettings(props);
    return <div>providers</div>;
  },
}));
vi.mock("@/components/mcp", () => ({
  McpPanel: () => <div>mcp</div>,
}));
vi.mock("../system/environment", () => ({
  EnvironmentSettings: () => <div>environment</div>,
}));
vi.mock("../system/execution-policy", () => ({
  ExecutionPolicySettings: (props: unknown) => {
    mockExecutionPolicySettings(props);
    return <div>execution-policy</div>;
  },
}));
vi.mock("../system/web-search", () => ({
  WebSearchSettings: () => <div>web-search</div>,
}));
vi.mock("../home", () => ({
  SettingsHomePage: (props: unknown) => {
    mockSettingsHomePage(props);
    return <div>home</div>;
  },
}));
vi.mock("@/lib/api/oemCloudRuntime", () => ({
  resolveOemCloudRuntimeContext: () => mockResolveOemCloudRuntimeContext(),
}));
import { SettingsPage } from "..";

interface Mounted {
  container: HTMLDivElement;
  root: Root;
}

const mounted: Mounted[] = [];

function renderComponent(
  initialTab: SettingsTabs,
  onNavigate?: (page: Page, params?: PageParams) => void,
  initialProviderView?: "settings" | "cloud",
  initialProviderFocus?: ProviderSettingsFocusContext | null,
  initialExecutionPolicyFocus?: ExecutionPolicyFocusContext | null,
  onBack = vi.fn(),
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function ControlledSettings() {
    const [pageParams, setPageParams] = useState<SettingsPageParams>({
      tab: initialTab,
      providerView: initialProviderView,
      providerFocus: initialProviderFocus ?? undefined,
      executionPolicyFocus: initialExecutionPolicyFocus ?? undefined,
    });
    return (
      <SettingsPage
        navigationGuard={{
          register: () => () => {},
          pendingNavigation: false,
          saving: false,
          clearPendingNavigation: vi.fn(),
          discardPendingNavigation: vi.fn(),
        }}
        pageParams={pageParams}
        onBack={onBack}
        onNavigate={(page, params) => {
          onNavigate?.(page, params);
          if (page === "settings") setPageParams(params as SettingsPageParams);
        }}
      />
    );
  }
  act(() => {
    root.render(<ControlledSettings />);
  });

  mounted.push({ container, root });
  return container;
}

async function flushEffects(times = 6) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  await changeLimeLocale("en-US");
  mockResolveOemCloudRuntimeContext.mockReturnValue({
    baseUrl: "https://user.example.com",
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockSettingsSidebar.mockReset();
  mockPreloadDeveloperDefaultSections.mockReset();
  mockCloudProviderSettings.mockReset();
  mockSettingsHomePage.mockReset();
  mockDeveloperLabSettings.mockReset();
  mockArchivedConversationsSettings.mockReset();
  mockExecutionPolicySettings.mockReset();

  while (mounted.length > 0) {
    const current = mounted.pop();
    if (!current) {
      break;
    }

    act(() => {
      current.root.unmount();
    });
    current.container.remove();
  }

  await changeLimeLocale("zh-CN");
});

describe("SettingsPage Profile Tab", () => {
  it("OEM 运行时下只展示统一账户页，不再渲染本地资料编辑器，也不再注入壳层标题", async () => {
    const container = renderComponent(SettingsTabs.Profile);
    await flushEffects();
    const text = container.textContent ?? "";

    expect(text).toContain("USER_CENTER_SESSION");
    expect(text).not.toContain("PROFILE_SETTINGS");
    expect(mockUserCenterSessionSettings).toHaveBeenCalled();
    expect(mockProfileSettings).not.toHaveBeenCalled();
    expect(text).not.toContain("账号与资料");
  });

  it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
    "%s 非 OEM 资料页只挂载本地编辑器，不启动账户组件",
    async (locale) => {
      await changeLimeLocale(locale);
      mockResolveOemCloudRuntimeContext.mockReturnValue(null);

      const container = renderComponent(SettingsTabs.Profile);
      await flushEffects();
      const text = container.textContent ?? "";

      expect(text).not.toContain("USER_CENTER_SESSION");
      expect(text).toContain("PROFILE_SETTINGS");
      expect(mockProfileSettings).toHaveBeenCalled();
      expect(mockUserCenterSessionSettings).not.toHaveBeenCalled();
    },
  );
});

describe("SettingsPage Skills Tab", () => {
  it("技能页应从设置导航进入现有高级技能入口", async () => {
    const container = renderComponent(SettingsTabs.Skills);
    await flushEffects();

    expect(container.textContent).toContain("skills");
  });
});

describe("SettingsPage Experimental Tab", () => {
  it("未知设置页应回退到当前首页", async () => {
    const container = renderComponent(
      "unknown-settings-section" as SettingsTabs,
    );
    await flushEffects();
    const text = container.textContent ?? "";

    expect(text).toContain("home");
    expect(text).not.toContain("unknown-settings-section");
  });

  it("旧实验功能直达入口应切到开发者与实验功能合并页", async () => {
    const container = renderComponent(SettingsTabs.Experimental);
    await flushEffects();
    const text = container.textContent ?? "";
    const sidebarProps = mockSettingsSidebar.mock.calls.at(-1)?.[0] as
      | {
          activeTab?: SettingsTabs;
        }
      | undefined;

    expect(text).toContain("developer-lab");
    expect(text).not.toContain("experimental");
    expect(sidebarProps?.activeTab).toBe(SettingsTabs.Developer);
    expect(mockDeveloperLabSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      initialTab: "experimental",
    });
    expect(text).not.toContain("实验功能");
  });
});

describe("SettingsPage Developer Tab", () => {
  it("设置页应在上下文侧栏保留标题、返回和全局导航", async () => {
    vi.stubGlobal("navigator", {
      platform: "MacIntel",
      userAgent: "Mac OS X",
    });

    const onNavigate = vi.fn();
    const onBack = vi.fn();
    const container = renderComponent(
      SettingsTabs.Home,
      onNavigate,
      undefined,
      undefined,
      undefined,
      onBack,
    );
    await flushEffects();

    const header = container.querySelector(
      '[data-testid="settings-top-header"]',
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-back-button"]',
    );

    expect(header).not.toBeNull();
    expect(header?.textContent ?? "").not.toContain("设置中心");
    expect(header?.textContent ?? "").toContain("Settings");
    expect(header?.classList.contains("lime-settings-theme-scope")).toBe(true);
    expect(header?.getAttribute("data-window-controls-reserved")).toBe("true");
    expect(button).not.toBeNull();
    expect(button?.textContent ?? "").toContain("Back");
    expect(button?.getAttribute("aria-label")).toBe("Back");
    const navigation = container.querySelector(
      '[data-testid="settings-navigation"]',
    );
    expect(navigation?.contains(header)).toBe(true);
    expect(getComputedStyle(navigation as Element).width).toBe("280px");
    expect(
      container
        .querySelector('[data-testid="app-sidebar-rail-settings"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      container.querySelector('[data-testid="settings-title-group"]'),
    ).toBe(null);

    await act(async () => {
      button?.click();
      await Promise.resolve();
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="app-sidebar-nav-home-general"]',
        )
        ?.click();
    });
    expect(onNavigate).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({ agentEntry: "new-task" }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("设置页的全局图标栏应能够切回插件上下文", async () => {
    const onNavigate = vi.fn();
    const container = renderComponent(SettingsTabs.Home, onNavigate);
    await flushEffects();
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-testid="app-sidebar-rail-plugins"]',
        )
        ?.click();
    });
    expect(onNavigate).toHaveBeenCalledWith("plugins", undefined);
  });

  it("开发者页应展示开发者与实验功能合并页，不再复用壳层设置页标题", async () => {
    const container = renderComponent(SettingsTabs.Developer);
    await flushEffects();
    const text = container.textContent ?? "";

    expect(text).toContain("developer-lab");
    expect(mockDeveloperLabSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      initialTab: "developer",
    });
    expect(text).not.toContain("开发者");
  });

  it("设置内容区应挂载统一氛围层，避免页面背景过于单调", async () => {
    const container = renderComponent(SettingsTabs.Providers);
    await flushEffects();

    expect(
      container.querySelector('[data-testid="settings-content-atmosphere"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(".lime-settings-theme-scope"),
    ).not.toBeNull();
  });

  it("预取开发者页时应连同延迟区块一起预热", async () => {
    renderComponent(SettingsTabs.Home);
    const sidebarProps = mockSettingsSidebar.mock.calls[0]?.[0] as
      | {
          onTabPrefetch?: (tab: SettingsTabs) => void;
        }
      | undefined;

    expect(sidebarProps?.onTabPrefetch).toBeTypeOf("function");

    await act(async () => {
      sidebarProps?.onTabPrefetch?.(SettingsTabs.Developer);
      await flushEffects();
    });

    expect(mockPreloadDeveloperDefaultSections).toHaveBeenCalledTimes(1);
  });

  it("设置首页不应收到打开桌宠的快捷入口", async () => {
    renderComponent(SettingsTabs.Home);
    await flushEffects();

    expect(mockSettingsHomePage.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      "onOpenCompanion",
    );
  });

  it("直达已归档对话页时应渲染设置内归档入口", async () => {
    const container = renderComponent(SettingsTabs.ArchivedConversations);
    await flushEffects();

    expect(container.textContent ?? "").toContain("archived-conversations");
    expect(mockArchivedConversationsSettings).toHaveBeenCalledTimes(1);
  });

  it("直达服务商页时应只透传 current Provider 子视图", async () => {
    renderComponent(SettingsTabs.Providers, undefined, "settings");
    await flushEffects();

    expect(mockCloudProviderSettings).toHaveBeenCalled();
    expect(mockCloudProviderSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      initialView: "settings",
    });
  });

  it("直达执行策略页时应渲染真实策略设置入口", async () => {
    const container = renderComponent(SettingsTabs.ExecutionPolicy);
    await flushEffects();

    expect(container.textContent ?? "").toContain("execution-policy");
    expect(mockExecutionPolicySettings).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsPage Provider Focus", () => {
  it("服务商设置页应透传 provider focus 给 Provider 设置组件", async () => {
    const providerFocus: ProviderSettingsFocusContext = {
      providerId: "custom-coder",
      modelId: "coder-large",
      reasonCode: "missing_enabled_api_key",
      recoveryAction: "add_enabled_api_key",
    };

    renderComponent(
      SettingsTabs.Providers,
      undefined,
      "settings",
      providerFocus,
    );
    await flushEffects();

    expect(mockCloudProviderSettings.mock.calls.at(-1)?.[0]).toMatchObject({
      initialView: "settings",
      initialFocus: providerFocus,
    });
  });
});

describe("SettingsPage current sections", () => {
  it("切章回写canonical参数并清理旧focus，重新进入不重放；点击当前章节保留focus", async () => {
    const onNavigate = vi.fn();
    const focus = { providerId: "provider", requestKey: 42 };
    const container = renderComponent(
      SettingsTabs.Providers,
      onNavigate,
      "cloud",
      focus,
    );
    await flushEffects();
    const select = async (tab: SettingsTabs) => {
      const props = mockSettingsSidebar.mock.calls.at(-1)![0] as {
        onTabChange: (tab: SettingsTabs) => void;
      };
      await act(async () => {
        props.onTabChange(tab);
      });
      await flushEffects();
    };
    await select(SettingsTabs.Providers);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(mockCloudProviderSettings.mock.calls.at(-1)![0]).toMatchObject({
      initialView: "cloud",
      initialFocus: focus,
    });
    await select(SettingsTabs.Appearance);
    expect(onNavigate).toHaveBeenLastCalledWith("settings", {
      tab: SettingsTabs.Appearance,
    });
    expect(container.textContent).toContain("appearance");
    await select(SettingsTabs.Providers);
    expect(onNavigate).toHaveBeenLastCalledWith("settings", {
      tab: SettingsTabs.Providers,
    });
    expect(mockCloudProviderSettings.mock.calls.at(-1)![0]).toMatchObject({
      initialView: undefined,
      initialFocus: undefined,
    });
    await select(SettingsTabs.ExecutionPolicy);
    expect(mockExecutionPolicySettings.mock.calls.at(-1)![0]).toEqual({
      focus: null,
    });
    await select(SettingsTabs.Experimental);
    expect(onNavigate).toHaveBeenLastCalledWith("settings", {
      tab: SettingsTabs.Experimental,
    });
    expect(mockSettingsSidebar.mock.calls.at(-1)![0]).toMatchObject({
      activeTab: SettingsTabs.Developer,
    });
    expect(mockDeveloperLabSettings.mock.calls.at(-1)![0]).toEqual({
      initialTab: "experimental",
    });
    await select(SettingsTabs.Developer);
    expect(mockDeveloperLabSettings.mock.calls.at(-1)![0]).toEqual({
      initialTab: "developer",
    });
  });

  it.each([
    ["zh-CN", "返回"],
    ["zh-TW", "返回"],
    ["en-US", "Back"],
    ["ja-JP", "戻る"],
    ["ko-KR", "뒤로"],
  ])("%s页头提供可访问的返回动作", async (locale, label) => {
    await changeLimeLocale(locale as Parameters<typeof changeLimeLocale>[0]);
    const onBack = vi.fn();
    const container = renderComponent(
      SettingsTabs.Home,
      undefined,
      undefined,
      undefined,
      undefined,
      onBack,
    );
    await flushEffects();
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-back-button"]',
    )!;
    expect(button.textContent).toBe(label);
    expect(button.getAttribute("aria-label")).toBe(label);
    act(() => {
      button.click();
    });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it.each([
    [SettingsTabs.Home, "home"],
    [SettingsTabs.Profile, "USER_CENTER_SESSION"],
    [SettingsTabs.Stats, "stats"],
    [SettingsTabs.Appearance, "appearance"],
    [SettingsTabs.Memory, "memory"],
    [SettingsTabs.ArchivedConversations, "archived-conversations"],
    [SettingsTabs.Providers, "providers"],
    [SettingsTabs.Skills, "skills"],
    [SettingsTabs.MediaServices, "media-services"],
    [SettingsTabs.McpServer, "mcp"],
    [SettingsTabs.WebSearch, "web-search"],
    [SettingsTabs.Environment, "environment"],
    [SettingsTabs.ExecutionPolicy, "execution-policy"],
    [SettingsTabs.Developer, "developer-lab"],
    [SettingsTabs.About, "about"],
  ])("公开设置页应渲染 current %s 章节", async (tab, text) => {
    const container = renderComponent(tab);
    await flushEffects();
    expect(container.textContent).toContain(text);
    expect(mockSettingsSidebar.mock.calls.at(-1)?.[0]).toMatchObject({
      activeTab: tab,
    });
  });

  it("执行策略直达应保留完整 focus 上下文", async () => {
    const focus: ExecutionPolicyFocusContext = {
      section: "network",
      target: "host",
      value: "example.invalid",
      ruleId: "policy-rule",
      reasonCode: "blocked_network_target",
      requestKey: 17,
    };
    renderComponent(
      SettingsTabs.ExecutionPolicy,
      undefined,
      undefined,
      undefined,
      focus,
    );
    await flushEffects();
    expect(mockExecutionPolicySettings.mock.calls.at(-1)?.[0]).toEqual({
      focus,
    });
  });
});
