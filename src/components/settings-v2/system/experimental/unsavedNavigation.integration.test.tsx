import { act, StrictMode, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import type { Config } from "@/lib/api/appConfig";
import type { SettingsPageParams } from "@/types/page";
import { SettingsTabs } from "@/types/settings";
import { SettingsNavigationGuard } from "../../_layout/SettingsNavigationGuard";
import { DeveloperLabSettings } from "../developer-lab";

const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  getExperimentalConfig: vi.fn(),
  saveExperimentalConfig: vi.fn(),
  applyCrashReportingSettings: vi.fn(),
}));
vi.mock("@/lib/api/appConfig", () => ({
  getConfig: api.getConfig,
  saveConfig: api.saveConfig,
  updateConfig: async (update: import("@/lib/api/appConfig").ConfigUpdater) => {
    const next = update(await api.getConfig());
    await api.saveConfig(next);
    return next;
  },
}));
vi.mock("@/lib/api/experimentalFeatures", () => ({
  getExperimentalConfig: api.getExperimentalConfig,
  saveExperimentalConfig: api.saveExperimentalConfig,
  DEFAULT_EXPERIMENTAL_FEATURES: { webmcp: { enabled: false } },
}));
vi.mock("@/lib/crashReporting", () => ({
  applyCrashReportingSettings: api.applyCrashReportingSettings,
}));
vi.mock("../developer", () => ({
  DeveloperSettings: () => <p>Developer tools</p>,
}));
vi.mock("./UpdateCheckSettings", () => ({ UpdateCheckSettings: () => null }));
vi.mock("../shared/WorkspaceRepairHistoryCard", () => ({
  WorkspaceRepairHistoryCard: () => null,
}));
vi.mock("../shared/ClipboardPermissionGuideCard", () => ({
  ClipboardPermissionGuideCard: () => null,
}));

let navigation: ReturnType<typeof useAppNavigation>;
function Harness() {
  navigation = useAppNavigation();
  const { handleNavigate } = navigation;
  useLayoutEffect(
    () => handleNavigate("settings", { tab: SettingsTabs.Experimental }),
    [handleNavigate],
  );
  return (
    <>
      <button
        onClick={() => handleNavigate("settings", { tab: SettingsTabs.About })}
      >
        Section
      </button>
      <button onClick={navigation.returnFromSettings}>Back</button>
      <button
        onClick={() =>
          navigation.startNewConversation({
            projectId: null,
            freshDraft: false,
          })
        }
      >
        Home
      </button>
      <button onClick={() => handleNavigate("resources")}>Root</button>
      <button
        onClick={() =>
          navigation.startNewConversation({ projectId: null, freshDraft: true })
        }
      >
        New
      </button>
      <button
        onClick={() =>
          handleNavigate("settings", {
            tab: SettingsTabs.Environment,
            searchFocus: { targetId: "environment-overrides", requestKey: 1 },
          })
        }
      >
        Search result
      </button>
      {navigation.requestedPage === "settings" &&
      (navigation.requestedPageParams as SettingsPageParams).tab ===
        SettingsTabs.Experimental ? (
        <SettingsNavigationGuard navigationGuard={navigation.navigationGuard}>
          <DeveloperLabSettings initialTab="experimental" />
        </SettingsNavigationGuard>
      ) : (
        <p data-testid="destination">{navigation.requestedPage}</p>
      )}
    </>
  );
}
let root: Root;
let container: HTMLDivElement;
let initial: Config;
const button = (text: string) => {
  const node = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === text,
  );
  if (!node) throw new Error(`Missing button ${text}`);
  return node;
};
const input = (name = "dsn") => {
  const node = container.querySelector<HTMLInputElement>(
    `#experimental-crash-${name}`,
  );
  if (!node) throw new Error(`Missing crash input ${name}`);
  return node;
};
const target = (id: string) => {
  const node = container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing target ${id}`);
  return node;
};
const click = async (node: HTMLElement) => act(async () => node.click());
const dialog = () =>
  document.querySelector('[data-testid="settings-unsaved-changes-dialog"]');
async function edit(value: string, name?: string) {
  await act(async () => {
    const node = input(name);
    node.closest("details")!.open = true;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const mount = async () => act(async () => root.render(<Harness />));
const save = () => target("experimental-crash-save");
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  vi.resetAllMocks();
  await changeLimeLocale("en-US");
  initial = {
    default_provider: "openai",
    tool_calling: {
      enabled: true,
      dynamic_filtering: true,
      native_input_examples: false,
    },
    crash_reporting: {
      enabled: false,
      dsn: null,
      environment: "production",
      sample_rate: 1,
      send_pii: false,
    },
  } as Config;
  api.getConfig.mockResolvedValue(initial);
  api.getExperimentalConfig.mockResolvedValue({ webmcp: { enabled: false } });
  api.saveConfig.mockResolvedValue(undefined);
  api.saveExperimentalConfig.mockResolvedValue(undefined);
  api.applyCrashReportingSettings.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await changeLimeLocale("zh-CN");
});

it.each(["Section", "Back", "Home", "Root", "New", "Search result"])(
  "%s protects the actual Experimental draft without persisting",
  async (target) => {
    await mount();
    await edit("https://unsaved.invalid/1");
    await click(button(target));
    expect(dialog()).not.toBeNull();
    expect(input().value).toBe("https://unsaved.invalid/1");
    await click(button("Keep editing"));
    await click(button(target));
    await click(button("Discard changes"));
    expect(
      container.querySelector('[data-testid="destination"]'),
    ).not.toBeNull();
    expect(api.saveConfig).not.toHaveBeenCalled();
    expect(api.applyCrashReportingSettings).not.toHaveBeenCalled();
  },
);

it("keeps a single hidden Experimental subtree, moves focus, and guards hidden drafts", async () => {
  await mount();
  await edit("retained draft");
  const original = input();
  original.focus();
  await click(target("developer-lab-tab-developer"));
  expect(input()).toBe(original);
  expect(input().closest("[hidden]")).not.toBeNull();
  expect(document.activeElement).toBe(target("developer-lab-tab-developer"));
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
  await click(button("Keep editing"));
  await click(target("developer-lab-tab-experimental"));
  expect(input()).toBe(original);
  expect(input().value).toBe("retained draft");
  expect(input().closest("[hidden]")).toBeNull();
  expect(api.getConfig).toHaveBeenCalledTimes(1);
});

it("focuses the static crash-reporting group without opening or focusing credential fields", async () => {
  await mount();
  const anchor = container.querySelector<HTMLDivElement>(
    '[data-settings-search-target="experimental-crash-reporting"]',
  )!;
  expect(anchor.tagName).toBe("DIV");
  expect(anchor.tabIndex).toBe(-1);
  const details = anchor.querySelector("details")!;
  expect(details.open).toBe(false);
  await edit("credential value remains private");
  details.open = false;
  anchor.focus();
  expect(document.activeElement).toBe(anchor);
  expect(details.open).toBe(false);
  expect(input().value).toBe("credential value remains private");
  expect(anchor.textContent).not.toContain("credential value remains private");
  expect(api.saveConfig).not.toHaveBeenCalled();
});

it("saves only edited fields into newer configuration and accepts normalized results", async () => {
  await mount();
  await edit("  staging  ", "environment");
  await edit("", "sample-rate");
  const latest = {
    ...initial,
    language: "ja-JP",
    crash_reporting: {
      ...initial.crash_reporting!,
      dsn: "https://later.invalid/2",
      send_pii: true,
    },
  };
  api.getConfig.mockResolvedValue(latest);
  await click(save());
  expect(api.saveConfig).toHaveBeenCalledExactlyOnceWith({
    ...latest,
    crash_reporting: {
      ...latest.crash_reporting,
      environment: "staging",
      sample_rate: 1,
    },
  });
  expect(input("environment").value).toBe("staging");
  expect(input("sample-rate").value).toBe("1");
  expect(input().value).toBe("https://later.invalid/2");
  await click(button("Root"));
  expect(dialog()).toBeNull();
});

it("enables crash reporting without committing a manual draft and keeps it dirty", async () => {
  await mount();
  await edit("https://unsaved.invalid/1");
  const latest = {
    ...initial,
    crash_reporting: {
      ...initial.crash_reporting!,
      environment: "external",
      dsn: "https://saved.invalid/2",
    },
  };
  api.getConfig.mockResolvedValue(latest);
  await click(
    container.querySelector<HTMLElement>(
      '[aria-label="Toggle crash reporting"]',
    )!,
  );
  expect(api.saveConfig).toHaveBeenCalledExactlyOnceWith({
    ...latest,
    crash_reporting: { ...latest.crash_reporting, enabled: true },
  });
  expect(input().value).toBe("https://unsaved.invalid/1");
  expect(input("environment").value).toBe("external");
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
});

it("tool switches preserve unsaved crash fields and merge only their own latest field", async () => {
  await mount();
  await edit("manual draft");
  const latest = {
    ...initial,
    tool_calling: { ...initial.tool_calling!, native_input_examples: true },
  };
  api.getConfig.mockResolvedValue(latest);
  await click(
    container.querySelector<HTMLElement>(
      '[aria-label="Toggle dynamic filtering"]',
    )!,
  );
  expect(api.saveConfig).toHaveBeenCalledExactlyOnceWith({
    ...latest,
    tool_calling: { ...latest.tool_calling, dynamic_filtering: false },
  });
  expect(input().value).toBe("manual draft");
  expect(api.applyCrashReportingSettings).not.toHaveBeenCalled();
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
});

it("locks duplicate and competing mutations and root discard until persistence and apply finish", async () => {
  await mount();
  await edit("https://saved.invalid/1");
  const pending = deferred<void>();
  api.saveConfig.mockReturnValueOnce(pending.promise);
  await act(async () => {
    save().click();
    save().click();
    container
      .querySelector<HTMLElement>(
        '[aria-label="Toggle WebMCP reserved entry"]',
      )!
      .click();
  });
  expect(api.saveConfig).toHaveBeenCalledTimes(1);
  expect(api.saveExperimentalConfig).not.toHaveBeenCalled();
  expect(input().disabled).toBe(true);
  await click(button("Root"));
  expect(button("Discard changes").disabled).toBe(true);
  await act(async () => navigation.navigationGuard.discardPendingNavigation());
  expect(input().value).toBe("https://saved.invalid/1");
  await act(async () => pending.resolve());
  await click(button("Discard changes"));
  expect(container.querySelector('[data-testid="destination"]')).not.toBeNull();
});

it("keeps failed saves dirty and supports retry without showing backend values", async () => {
  await mount();
  await edit("retry draft");
  api.saveConfig.mockRejectedValueOnce(
    new Error("private crash config marker"),
  );
  await click(save());
  expect(container.textContent).toContain(
    getLimeI18n().t(
      "settings:settings.experimental.message.crashReportingSaveFailed",
    ),
  );
  expect(container.textContent).not.toContain("private crash config marker");
  expect(input().value).toBe("retry draft");
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
  await click(button("Keep editing"));
  await click(save());
  expect(api.saveConfig).toHaveBeenCalledTimes(2);
  await click(button("Root"));
  expect(dialog()).toBeNull();
});

it("accepts persistence before an apply failure and allows Save to retry apply", async () => {
  await mount();
  await edit("applied later");
  api.applyCrashReportingSettings.mockRejectedValueOnce(
    new Error("private apply marker"),
  );
  await click(save());
  expect(input().value).toBe("applied later");
  expect(container.textContent).not.toContain("private apply marker");
  api.getConfig.mockResolvedValue(api.saveConfig.mock.calls[0][0]);
  await click(save());
  expect(api.applyCrashReportingSettings).toHaveBeenCalledTimes(2);
  await click(button("Root"));
  expect(dialog()).toBeNull();
});

it("renders retry after an initial load failure without enabling default writes", async () => {
  api.getConfig.mockRejectedValueOnce(new Error("private load marker"));
  await mount();
  expect(container.textContent).not.toContain("private load marker");
  expect(container.querySelector("#experimental-crash-dsn")).toBeNull();
  expect(api.saveConfig).not.toHaveBeenCalled();
  await click(
    button(getLimeI18n().t("settings:settings.experimental.action.retry")),
  );
  expect(input().value).toBe("");
});

it("survives StrictMode remount and ignores an older initial load", async () => {
  const older = deferred<Config>();
  api.getConfig.mockReturnValueOnce(older.promise);
  await act(async () =>
    root.render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    ),
  );
  expect(input().value).toBe("");
  await edit("newer draft");
  await act(async () =>
    older.resolve({
      ...initial,
      crash_reporting: {
        ...initial.crash_reporting!,
        dsn: "stale initial load",
      },
    }),
  );
  expect(input().value).toBe("newer draft");
  expect(api.getConfig).toHaveBeenCalledTimes(2);
});

it("clears success timers before a later failure and on owner unmount", async () => {
  vi.useFakeTimers();
  try {
    await mount();
    await edit("first draft");
    await click(save());
    await edit("second draft");
    api.saveConfig.mockRejectedValueOnce(new Error("private failure marker"));
    await click(save());
    await act(async () => vi.advanceTimersByTime(3000));
    expect(container.textContent).toContain(
      getLimeI18n().t(
        "settings:settings.experimental.message.crashReportingSaveFailed",
      ),
    );
    await click(save());
    await act(async () => root.render(<p>Replacement owner</p>));
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it.each(["read", "persist", "apply"])(
  "stops late %s continuation after the owner unmounts",
  async (phase) => {
    await mount();
    await edit("old owner");
    const read = deferred<Config>();
    const write = deferred<void>();
    const apply = deferred<void>();
    if (phase === "read") api.getConfig.mockReturnValueOnce(read.promise);
    else if (phase === "persist")
      api.saveConfig.mockReturnValueOnce(write.promise);
    else api.applyCrashReportingSettings.mockReturnValueOnce(apply.promise);
    await click(save());
    const writesBefore = api.saveConfig.mock.calls.length;
    const appliesBefore = api.applyCrashReportingSettings.mock.calls.length;
    await act(async () => root.render(<p>Replacement owner</p>));
    await act(async () => {
      read.resolve(initial);
      write.resolve();
      apply.resolve();
    });
    expect(container.textContent).toBe("Replacement owner");
    expect(api.saveConfig).toHaveBeenCalledTimes(writesBefore);
    expect(api.applyCrashReportingSettings).toHaveBeenCalledTimes(
      appliesBefore,
    );
  },
);

it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
  "%s preserves raw drafts without refetching configuration",
  async (locale) => {
    await mount();
    await edit("  ", "environment");
    await edit("", "sample-rate");
    await act(async () => changeLimeLocale(locale));
    expect(input("environment").value).toBe("  ");
    expect(input("sample-rate").value).toBe("");
    expect(api.getConfig).toHaveBeenCalledTimes(1);
    await click(button("Root"));
    expect(dialog()?.textContent).toContain(
      getLimeI18n().t("settings:settings.unsavedChanges.discardTitle"),
    );
  },
);
