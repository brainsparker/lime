import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { SettingsTabs } from "@/types/settings";
import type { SettingsPageParams } from "@/types/page";
import { SettingsPage } from ".";
import { searchSettings } from "../settingsSearch";
import { useSettingsCategory } from "../hooks/useSettingsCategory";
import { resolveSettingsSection } from "../sections";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: (config: object) => object) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    return config;
  },
}));
vi.mock("@/i18n/legacy-patch/I18nPatchProvider", () => ({
  useI18nPatch: () => ({ setLanguage: vi.fn() }),
}));
vi.mock("@/lib/api/project", () => ({ getDefaultProject: async () => null }));
vi.mock("@/lib/api/soulStylePacks", () => ({
  listSoulStylePacks: async () => ({ packs: [] }),
}));
vi.mock("@/lib/api/memoryStore", () => ({
  getMemoryStoreHealth: async () => ({ initialized: false }),
  listMemoryStoreReviewNotes: async () => ({ notes: [] }),
  listMemoryStore: async () => ({ entries: [] }),
}));
vi.mock("../home", () => ({ SettingsHomePage: () => null }));
vi.mock("./SettingsNavigation", async () => {
  const { SettingsSidebar } = await import("./SettingsSidebar");
  return {
    SettingsNavigation: (props: Parameters<typeof SettingsSidebar>[0]) => (
      <SettingsSidebar {...props} />
    ),
  };
});

let navigation: ReturnType<typeof useAppNavigation>;
let groups: ReturnType<typeof useSettingsCategory>;
function Harness() {
  navigation = useAppNavigation();
  groups = useSettingsCategory();
  const { handleNavigate } = navigation;
  useLayoutEffect(
    () => handleNavigate("settings", { tab: SettingsTabs.Appearance }),
    [handleNavigate],
  );
  return (
    <SettingsPage
      pageParams={navigation.requestedPageParams as SettingsPageParams}
      onNavigate={navigation.handleNavigate}
      onBack={navigation.returnFromSettings}
      navigationGuard={navigation.navigationGuard}
    />
  );
}

// 期望来自可见字段，独立于被测索引。
const targets = [
  [SettingsTabs.Memory, "memory", "memory-enabled", "memory.toggle.aria"],
  [SettingsTabs.Memory, "memory", "memory-store", "memory.everyday.title"],
  [
    SettingsTabs.Memory,
    "soul",
    "memory-style",
    "memory.soul.styleProfile.title",
  ],
  [
    SettingsTabs.Memory,
    "soul",
    "memory-templates",
    "memory.soul.template.title",
  ],
  [
    SettingsTabs.Memory,
    "advanced",
    "memory-embedding",
    "memory.embedding.providerSelect.title",
  ],
  [
    SettingsTabs.Memory,
    "advanced",
    "memory-export",
    "memory.soul.export.title",
  ],
  [
    SettingsTabs.Memory,
    "advanced",
    "memory-import",
    "memory.soul.import.title",
  ],
  [SettingsTabs.Appearance, "", "appearance-theme", "appearance.theme.title"],
  [
    SettingsTabs.Appearance,
    "",
    "appearance-skin",
    "appearance.colorScheme.title",
  ],
  [
    SettingsTabs.Appearance,
    "",
    "appearance-language",
    "appearance.language.title",
  ],
  [
    SettingsTabs.Appearance,
    "",
    "appearance-response-language",
    "appearance.responseLanguage.title",
  ],
  [
    SettingsTabs.Appearance,
    "",
    "appearance-recommendation",
    "appearance.recommendation.appendSelected.title",
  ],
] as const;
const t = (key: string) =>
  getLimeI18n().getFixedT("en-US", "settings")(`settings.${key}`);
let root: Root;
let container: HTMLDivElement;
const target = (id: string) =>
  container.querySelector<HTMLElement>(`[data-settings-search-target="${id}"]`);
const input = () =>
  container.querySelector<HTMLInputElement>(
    '[data-testid="settings-sidebar-search"]',
  )!;
const activeTab = () =>
  container
    .querySelector('[role="tab"][aria-selected="true"]')
    ?.getAttribute("data-testid");
const click = async (node: HTMLElement) => act(async () => node.click());
async function edit(
  node: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    const prototype =
      node instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function search(key: string) {
  await edit(
    input(),
    t(
      key === "memory.embedding.providerSelect.title"
        ? "memory.embedding.providerSelect.description"
        : key,
    ),
  );
  await act(async () =>
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
}
async function confirm(key: "keepEditing" | "discard") {
  const button = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === t(`unsavedChanges.${key}`),
  );
  if (!button) throw new Error(`Missing ${key}`);
  await click(button);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
const mount = async () => act(async () => root.render(<Harness />));
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.__LIME_OEM_CLOUD__ = { enabled: false };
  api.getConfig
    .mockReset()
    .mockResolvedValue({ language: "en-US", memory: { enabled: true } });
  api.saveConfig.mockReset().mockResolvedValue(undefined);
  await changeLimeLocale("en-US");
  await Promise.all([
    resolveSettingsSection(SettingsTabs.Memory).preload(),
    resolveSettingsSection(SettingsTabs.Appearance).preload(),
  ]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.sessionStorage.clear();
  window.localStorage.clear();
  delete window.__LIME_OEM_CLOUD__;
  vi.restoreAllMocks();
});

it.each(targets)(
  "%s / %s / %s focuses the real non-editable field",
  async (section, tab, id, key) => {
    await mount();
    await search(key);
    expect(navigation.requestedPageParams).toMatchObject({
      tab: section,
      searchFocus: { targetId: id },
    });
    if (tab) expect(activeTab()).toBe(`settings-memory-tab-${tab}`);
    expect(target(id)).not.toBeNull();
    expect(document.activeElement).toBe(target(id));
    expect(target(id)?.dataset.settingsSearchActive).toBe("true");
    expect(target(id)?.closest("[hidden]")).toBeNull();
    expect(target(id)?.matches("input, textarea, select, button")).toBe(false);
    expect(api.saveConfig).not.toHaveBeenCalled();
  },
);

it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
  "%s resolves all 12 static targets",
  async (locale) => {
    await changeLimeLocale(locale);
    await mount();
    const translate = getLimeI18n().getFixedT(locale, "settings");
    for (const [section, , targetId, key] of targets) {
      expect(translate(`settings.${key}`)).not.toBe(`settings.${key}`);
      expect(
        searchSettings(translate(`settings.${key}`), groups, translate, true),
      ).toContainEqual(expect.objectContaining({ section, targetId }));
    }
    expect(
      searchSettings("fixture private imported text", groups, translate, true),
    ).toEqual([]);
  },
);

it("keeps import draft and preview through local tabs and pending search; discard alone opens the target", async () => {
  await mount();
  await search("memory.soul.import.title");
  const textarea = () =>
    container.querySelector<HTMLTextAreaElement>(
      '[data-testid="settings-memory-soul-import-textarea"]',
    )!;
  await edit(textarea(), "# SOUL.md\n\nfixture private imported text");
  await click(
    [...container.querySelectorAll("button")].find(
      (node) => node.textContent === t("memory.soul.action.previewImport"),
    )!,
  );
  await click(
    container.querySelector<HTMLElement>(
      '[data-testid="settings-memory-tab-soul"]',
    )!,
  );
  await click(
    container.querySelector<HTMLElement>(
      '[data-testid="settings-memory-tab-advanced"]',
    )!,
  );
  expect(textarea().value).toContain("fixture private imported text");
  expect(container.textContent).toContain(t("memory.soul.import.preview"));
  const params = navigation.requestedPageParams;
  const restore = sessionStorage.getItem("lime.appNavigation.restore.v1");
  await search("memory.soul.styleProfile.title");
  expect(activeTab()).toBe("settings-memory-tab-advanced");
  expect(navigation.requestedPageParams).toBe(params);
  expect(sessionStorage.getItem("lime.appNavigation.restore.v1")).toBe(restore);
  await confirm("keepEditing");
  expect(textarea().value).toContain("fixture private imported text");
  await search("memory.soul.styleProfile.title");
  await confirm("discard");
  expect(activeTab()).toBe("settings-memory-tab-soul");
  expect(document.activeElement).toBe(target("memory-style"));
  const first = (navigation.requestedPageParams as SettingsPageParams)
    .searchFocus;
  await click(
    container.querySelector<HTMLElement>(
      '[data-testid="settings-memory-tab-memory"]',
    )!,
  );
  await search("memory.soul.styleProfile.title");
  expect(document.activeElement).toBe(target("memory-style"));
  expect(
    (navigation.requestedPageParams as SettingsPageParams).searchFocus
      ?.requestKey,
  ).toBeGreaterThan(first!.requestKey!);
  await search("memory.soul.import.title");
  expect(textarea().value).toBe("");
  expect(container.textContent).not.toContain(t("memory.soul.import.preview"));
  expect(api.saveConfig).not.toHaveBeenCalled();
});

it("waits for asynchronous config and cancels stale target after leaving", async () => {
  await mount();
  let resolve!: (config: object) => void;
  api.getConfig.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await search("memory.soul.import.title");
  expect(target("memory-import")).toBeNull();
  await act(async () => resolve({ memory: {} }));
  expect(document.activeElement).toBe(target("memory-import"));
  let late!: (config: object) => void;
  api.getConfig.mockReturnValue(
    new Promise((done) => {
      late = done;
    }),
  );
  await search("memory.soul.export.title");
  await act(async () =>
    navigation.handleNavigate("settings", { tab: SettingsTabs.Home }),
  );
  await act(async () => late({ memory: {} }));
  expect(target("memory-export")).toBeNull();
  expect(container.querySelector("[data-settings-search-active]")).toBeNull();
});

it("rejects cross-section and forged paths without exposing hidden panels", async () => {
  await mount();
  let requestKey = 200;
  for (const targetId of [
    "appearance-language",
    "advanced",
    'memory-import"] textarea',
  ]) {
    await act(async () =>
      navigation.handleNavigate("settings", {
        tab: SettingsTabs.Memory,
        searchFocus: { targetId, requestKey: ++requestKey },
      }),
    );
    expect(activeTab()).toBe("settings-memory-tab-memory");
    expect(target("memory-import")).toBeNull();
    expect(container.querySelector("[data-settings-search-active]")).toBeNull();
  }
});
