import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { invalidateAppConfigCache } from "@/lib/api/appConfig";
import { updateDesktopPreference } from "@/lib/api/desktopPreferences";
import { SettingsTabs } from "@/types/settings";
import { isSettingsSearchTarget } from "../../settingsSearch";
import { useSettingsSearchTarget } from "../../_layout/useSettingsSearchTarget";
import { BrowserUseSettings } from "./index";
import { KeyboardShortcutsSettings } from "../keyboard-shortcuts";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/appServer", () => ({
  AppServerClient: class {
    request = request;
  },
}));

let container: HTMLDivElement;
let root: Root;
let persisted: Record<string, unknown>;
let version: number;
let rejectWrite: boolean;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  invalidateAppConfigCache();
  window.localStorage.clear();
  persisted = {
    default_provider: "openai",
    language: "en-US",
    tui: { animations: false },
  };
  version = 1;
  rejectWrite = false;
  request.mockReset().mockImplementation(async (method, params) => {
    if (method === "config/read")
      return {
        result: {
          config: structuredClone(persisted),
          layers: [{ version: `v${version}` }],
        },
      };
    if (method !== "config/batchWrite")
      throw new Error(`Unexpected method ${method}`);
    if (rejectWrite) throw new Error("fixture write rejected");
    expect(params.expectedVersion).toBe(`v${version}`);
    for (const edit of params.edits)
      persisted[edit.keyPath] = structuredClone(edit.value);
    version += 1;
    return {
      result: {
        status: "ok",
        version: `v${version}`,
        filePath: "/fixture/config.yaml",
      },
    };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  invalidateAppConfigCache();
  vi.restoreAllMocks();
  await changeLimeLocale("zh-CN");
});

async function renderPage(keyboard = false) {
  await act(async () =>
    root.render(
      keyboard ? <KeyboardShortcutsSettings /> : <BrowserUseSettings />,
    ),
  );
}

async function choose(target: string, label: string) {
  const trigger = container.querySelector<HTMLButtonElement>(
    `#${target} button`,
  )!;
  await act(async () =>
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    ),
  );
  const option = [
    ...document.querySelectorAll<HTMLElement>("[role=menuitemradio]"),
  ].find((item) => item.textContent === label);
  expect(option, label).toBeDefined();
  await act(async () => option!.click());
}

function SearchResult({
  section,
  targetId,
}: {
  section: SettingsTabs;
  targetId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSettingsSearchTarget(ref, section, { targetId, requestKey: 1 }, true);
  return (
    <div ref={ref}>
      {section === SettingsTabs.Browser ? (
        <BrowserUseSettings />
      ) : (
        <KeyboardShortcutsSettings />
      )}
    </div>
  );
}

it.each([
  [SettingsTabs.Browser, "browser-web-target"],
  [SettingsTabs.Browser, "browser-local-target"],
  [SettingsTabs.KeyboardShortcuts, "keyboard-external-browser-link"],
])(
  "focuses the actual %s preference after selecting search result %s",
  async (section, targetId) => {
    await act(async () =>
      root.render(
        <SearchResult section={section as SettingsTabs} targetId={targetId} />,
      ),
    );
    const row = container.querySelector<HTMLElement>(`#${targetId}`)!;
    expect(row).not.toBeNull();
    expect(document.activeElement).toBe(row);
    expect(row.dataset.settingsSearchActive).toBe("true");
    expect(row.querySelector("button")?.disabled).toBe(false);
    expect(row.getAttribute("aria-labelledby")).toBe(`${targetId}-label`);
  },
);

it("keeps web/local defaults independent and persists only the selected preference through the current gateway", async () => {
  await renderPage();
  expect(
    container.querySelector("#browser-web-target-value")?.textContent,
  ).toBe("Default browser");
  expect(
    container.querySelector("#browser-local-target-value")?.textContent,
  ).toBe("Lime");
  await choose("browser-web-target", "Lime");
  expect(persisted.desktop).toEqual({
    "open-link-in-target-preference": "in-app-browser",
  });
  await choose("browser-local-target", "Default browser");
  expect(persisted.desktop).toEqual({
    "open-link-in-target-preference": "in-app-browser",
    "open-local-url-in-target-preference": "external-browser",
  });
  expect(persisted.tui).toEqual({ animations: false });
  expect(
    request.mock.calls.filter(([method]) => method === "config/batchWrite"),
  ).toHaveLength(2);
  invalidateAppConfigCache();
  await renderPage(true);
  await renderPage();
  expect(
    container.querySelector("#browser-web-target-value")?.textContent,
  ).toBe("Lime");
  expect(
    container.querySelector("#browser-local-target-value")?.textContent,
  ).toBe("Default browser");
});

it("restores the authoritative value after a rejected save and allows a subsequent retry", async () => {
  await renderPage();
  rejectWrite = true;
  await choose("browser-web-target", "Lime");
  expect(container.querySelector("[role=alert]")?.textContent).toContain(
    "Could not save",
  );
  expect(
    container.querySelector("#browser-web-target-value")?.textContent,
  ).toBe("Default browser");
  expect(persisted.desktop).toBeUndefined();
  expect(
    request.mock.calls.filter(([method]) => method === "config/read"),
  ).toHaveLength(2);
  rejectWrite = false;
  await choose("browser-web-target", "Lime");
  expect(container.querySelector("[role=alert]")).toBeNull();
  expect(persisted.desktop).toEqual({
    "open-link-in-target-preference": "in-app-browser",
  });
});

it("serializes concurrent preference updates without overwriting another key", async () => {
  await act(async () => {
    await Promise.all([
      updateDesktopPreference(
        "open-link-in-target-preference",
        "in-app-browser",
      ),
      updateDesktopPreference("external-browser-link-shortcut", "alt"),
    ]);
  });
  expect(persisted.desktop).toEqual({
    "open-link-in-target-preference": "in-app-browser",
    "external-browser-link-shortcut": "alt",
  });
  expect(version).toBe(3);
});

it.each(["MacIntel", "Win32"])(
  "renders platform modifier choices in order and saves the exact enum on %s",
  async (platform) => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue(platform);
    await renderPage(true);
    const trigger = container.querySelector<HTMLButtonElement>(
      "#keyboard-external-browser-link button",
    )!;
    await act(async () =>
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    const labels = [
      ...document.querySelectorAll<HTMLElement>("[role=menuitemradio]"),
    ].map((item) => item.textContent);
    expect(labels).toEqual(
      platform === "MacIntel"
        ? ["Unassigned", "⌘+Click", "⌥+Click", "⇧⌘+Click"]
        : ["Unassigned", "Ctrl+Click", "Alt+Click", "Ctrl+Shift+Click"],
    );
    await act(async () =>
      document.querySelectorAll<HTMLElement>("[role=menuitemradio]")[3].click(),
    );
    expect(persisted.desktop).toEqual({
      "external-browser-link-shortcut": "primary-shift",
    });
  },
);

it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"] as const)(
  "exposes both searchable destinations and the keyboard preference in %s",
  async (locale) => {
    await changeLimeLocale(locale);
    await renderPage();
    expect(container.textContent).not.toContain("settings.");
    for (const target of ["browser-web-target", "browser-local-target"]) {
      expect(isSettingsSearchTarget(SettingsTabs.Browser, target, true)).toBe(
        true,
      );
      expect(container.querySelector(`#${target}`)).not.toBeNull();
    }
    await renderPage(true);
    expect(container.textContent).not.toContain("settings.");
    expect(
      isSettingsSearchTarget(
        SettingsTabs.KeyboardShortcuts,
        "keyboard-external-browser-link",
        true,
      ),
    ).toBe(true);
    expect(
      container.querySelector("#keyboard-external-browser-link"),
    ).not.toBeNull();
  },
);
