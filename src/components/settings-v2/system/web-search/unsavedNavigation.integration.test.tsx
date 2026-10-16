import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import type { ConfigUpdater } from "@/lib/api/appConfig";
import { SettingsTabs } from "@/types/settings";
import { SettingsNavigationGuard } from "../../_layout/SettingsNavigationGuard";
import { WebSearchSettings } from ".";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    api.getConfig.mockResolvedValue(config);
    return config;
  },
}));
vi.mock("@/lib/api/externalUrl", () => ({
  openExternalUrlWithSystemBrowser: vi.fn(),
}));

let navigation: ReturnType<typeof useAppNavigation>;
function Harness() {
  navigation = useAppNavigation();
  const { handleNavigate } = navigation;
  useLayoutEffect(
    () => handleNavigate("settings", { tab: SettingsTabs.WebSearch }),
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
        onClick={() => navigation.startNewConversation({ freshDraft: false })}
      >
        Home
      </button>
      <button onClick={() => handleNavigate("resources")}>Root</button>
      <button
        onClick={() => navigation.startNewConversation({ freshDraft: true })}
      >
        New
      </button>
      {navigation.requestedPage === "settings" &&
      navigation.requestedPageParams?.tab === SettingsTabs.WebSearch ? (
        <SettingsNavigationGuard navigationGuard={navigation.navigationGuard}>
          <WebSearchSettings />
        </SettingsNavigationGuard>
      ) : (
        <p data-testid="destination">{navigation.requestedPage}</p>
      )}
    </>
  );
}
let root: Root;
let container: HTMLDivElement;
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  );
  if (!node) throw new Error("Missing button " + text);
  return node;
}
function input(id: string) {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement))
    throw new Error("Missing input " + id);
  return node;
}
async function edit(id: string, value: string) {
  await act(async () => {
    const node = input(id);
    const prototype =
      node instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(
      new Event(node instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
const click = async (node: HTMLElement) => act(async () => node.click());
const dialog = () =>
  document.querySelector('[data-testid="settings-unsaved-changes-dialog"]');
const mount = async (key = "initial") =>
  act(async () => root.render(<Harness key={key} />));
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.sessionStorage.clear();
  vi.resetAllMocks();
  await changeLimeLocale("en-US");
  api.getConfig.mockResolvedValue({
    web_search: { engine: "google", provider: "duckduckgo_instant" },
  });
  api.saveConfig.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

it.each(["Section", "Back", "Home", "Root", "New"])(
  "%s protects the actual Web Search form without saving",
  async (target) => {
    await mount();
    await edit("web-search-engine", "xiaohongshu");
    const before = {
      id: navigation.navigationRequestId,
      params: navigation.requestedPageParams,
      restore: sessionStorage.getItem("lime.appNavigation.restore.v1"),
    };
    await click(button(target));
    expect(dialog()).not.toBeNull();
    expect(navigation.navigationRequestId).toBe(before.id);
    expect(navigation.requestedPageParams).toEqual(before.params);
    expect(sessionStorage.getItem("lime.appNavigation.restore.v1")).toBe(
      before.restore,
    );
    await click(button("Keep editing"));
    expect(input("web-search-engine").value).toBe("xiaohongshu");
    await click(button(target));
    await click(button("Discard changes"));
    expect(dialog()).toBeNull();
    expect(
      document.querySelector('[data-testid="destination"]'),
    ).not.toBeNull();
    expect(api.saveConfig).not.toHaveBeenCalled();
  },
);

it("saving an engine preserves later unrelated config, image settings, priorities and custom engines", async () => {
  const loaded = {
    web_search: {
      engine: "google",
      provider: "duckduckgo_instant",
      multi_search: {
        engines: [
          {
            name: "private-a",
            url_template: "https://a.invalid/?q={query}",
            enabled: false,
          },
          {
            name: "private-b",
            url_template: "https://b.invalid/?q={query}",
            enabled: true,
          },
        ],
      },
    },
    image_gen: { default_model: "old" },
    language: "en-US",
  };
  api.getConfig.mockResolvedValue(loaded);
  await mount();
  const latest = {
    ...loaded,
    language: "ja-JP",
    memory: { enabled: false },
    web_search: { ...loaded.web_search, provider_priority: ["tavily"] },
    image_gen: {
      default_model: "new",
      image_search_pexels_api_key: "later-key",
    },
  };
  api.getConfig.mockResolvedValue(latest);
  await edit("web-search-engine", "xiaohongshu");
  await click(button("Save"));
  expect(api.saveConfig).toHaveBeenCalledWith({
    ...latest,
    web_search: { ...latest.web_search, engine: "xiaohongshu" },
  });
});

it("a failed save keeps input and retry does not reload over it", async () => {
  api.saveConfig.mockRejectedValueOnce(new Error("fixture failure"));
  await mount();
  await edit("web-search-engine", "xiaohongshu");
  await click(button("Save"));
  expect(input("web-search-engine").value).toBe("xiaohongshu");
  expect(
    [...document.querySelectorAll("button")].some(
      (node) => node.textContent === "Reload",
    ),
  ).toBe(false);
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
  await click(button("Keep editing"));
  await click(button("Save"));
  expect(api.saveConfig).toHaveBeenCalledTimes(2);
  await click(button("Root"));
  expect(dialog()).toBeNull();
});

it("same-event submissions persist once; pending save blocks discard/reset and keeps later edits", async () => {
  const pending = deferred();
  api.saveConfig.mockReturnValueOnce(pending.promise);
  await mount();
  await edit("web-search-engine", "xiaohongshu");
  const save = button("Save");
  await act(async () => {
    save.click();
    save.click();
  });
  expect(api.saveConfig).toHaveBeenCalledTimes(1);
  await click(button("Cancel"));
  await edit("web-search-provider-priority", "tavily");
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
  expect(button("Discard changes").disabled).toBe(true);
  await click(button("Keep editing"));
  await act(async () => pending.resolve());
  expect(navigation.requestedPage).toBe("settings");
  expect(input("web-search-provider-priority").value).toBe("tavily");
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
});

it("normalized save confirms only the captured revision, even if new input equals the old text", async () => {
  const pending = deferred();
  api.saveConfig.mockReturnValueOnce(pending.promise);
  await mount();
  await click(button("MSE Aggregation"));
  await edit("web-search-mse-timeout", "99999");
  await click(button("Save"));
  await edit("web-search-mse-timeout", "88888");
  await edit("web-search-mse-timeout", "99999");
  await act(async () => pending.resolve());
  expect(input("web-search-mse-timeout").value).toBe("99999");
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
});

it("successful normalization makes the submitted form clean and Cancel restores that saved snapshot", async () => {
  await mount();
  await click(button("MSE Aggregation"));
  await edit("web-search-mse-timeout", "99999");
  await click(button("Save"));
  expect(input("web-search-mse-timeout").value).toBe("15000");
  expect(button("Save").disabled).toBe(true);
  await edit("web-search-mse-timeout", "bad");
  await click(button("Cancel"));
  expect(input("web-search-mse-timeout").value).toBe("15000");
  await click(button("Root"));
  expect(dialog()).toBeNull();
});

it.each(["resolve", "reject"])(
  "late save %s cannot alter or notify a new form",
  async (outcome) => {
    const pending = deferred();
    api.saveConfig.mockReturnValueOnce(pending.promise);
    await mount();
    await edit("web-search-engine", "xiaohongshu");
    await click(button("Save"));
    await mount("new-owner");
    await act(async () => {
      if (outcome === "resolve") pending.resolve();
      else pending.reject(new Error("late failure"));
    });
    expect(input("web-search-engine").value).toBe("google");
    expect(container.textContent).not.toContain("Web search settings saved");
    expect(container.textContent).not.toContain("late failure");
    await click(button("Root"));
    expect(dialog()).toBeNull();
  },
);

it("local tabs retain credential input and guard without persisting it", async () => {
  await mount();
  await click(button("Provider Credentials"));
  await edit("web-search-tavily-key", "fixture-only-input");
  await click(button("Image Search"));
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
  await click(button("Keep editing"));
  await click(button("Provider Credentials"));
  expect(input("web-search-tavily-key").value).toBe("fixture-only-input");
  expect(api.saveConfig).not.toHaveBeenCalled();
});

it("in-flight field edits do not revert untouched fields refreshed by the save", async () => {
  const pending = deferred();
  api.saveConfig.mockReturnValueOnce(pending.promise);
  await mount();
  api.getConfig.mockResolvedValue({
    web_search: {
      engine: "google",
      provider: "duckduckgo_instant",
      tavily_api_key: "later-config-value",
    },
  });
  await edit("web-search-engine", "xiaohongshu");
  await click(button("Save"));
  await edit("web-search-provider-priority", "tavily");
  await act(async () => pending.resolve());
  await click(button("Save"));
  expect(api.saveConfig).toHaveBeenLastCalledWith({
    web_search: {
      engine: "xiaohongshu",
      provider: "duckduckgo_instant",
      tavily_api_key: "later-config-value",
      provider_priority: ["tavily"],
    },
  });
});

it("an invalid custom template retains every edit and cannot persist a partial form", async () => {
  await mount();
  await edit("web-search-engine", "xiaohongshu");
  await click(button("MSE Aggregation"));
  await edit("web-search-mse-custom-engine-name", "fixture");
  await edit(
    "web-search-mse-custom-engine-template",
    "https://example.invalid/",
  );
  await click(button("Save"));
  expect(api.saveConfig).not.toHaveBeenCalled();
  expect(input("web-search-mse-custom-engine-template").value).toBe(
    "https://example.invalid/",
  );
  await click(button("Root"));
  expect(dialog()).not.toBeNull();
});

it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
  "%s shows a localized safe failure without backend config values",
  async (locale) => {
    await changeLimeLocale(locale);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    api.saveConfig.mockRejectedValueOnce(new Error("private-fixture-value"));
    await mount();
    await edit("web-search-engine", "xiaohongshu");
    await click(
      container.querySelector<HTMLElement>('[data-testid="web-search-save"]')!,
    );
    const expected = getLimeI18n().t("settings.webSearch.message.saveFailed", {
      ns: "settings",
    });
    expect(container.textContent).toContain(expected);
    expect(expected).not.toContain("settings.webSearch");
    expect(container.textContent).not.toContain("private-fixture-value");
    expect(error).not.toHaveBeenCalled();
  },
);

it("language changes translate the form without reloading or dropping input", async () => {
  await mount();
  await edit("web-search-provider-priority", "tavily");
  const reads = api.getConfig.mock.calls.length;
  await act(async () => changeLimeLocale("ja-JP"));
  expect(input("web-search-provider-priority").value).toBe("tavily");
  expect(api.getConfig).toHaveBeenCalledTimes(reads);
});

it("initial load failure disables saving and allows explicit retry without exposing values", async () => {
  api.getConfig.mockRejectedValueOnce(new Error("private-load-value"));
  await mount();
  expect(button("Save").disabled).toBe(true);
  expect(container.textContent).not.toContain("private-load-value");
  await click(button("Reload"));
  expect(input("web-search-engine").value).toBe("google");
  await edit("web-search-engine", "xiaohongshu");
  await click(button("Save"));
  expect(api.saveConfig).toHaveBeenCalledTimes(1);
});

it.each(["resolve", "reject"])(
  "late initial load %s cannot replace a new form",
  async (outcome) => {
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    api.getConfig.mockReturnValueOnce(
      new Promise((done, fail) => {
        resolve = done;
        reject = fail;
      }),
    );
    await mount();
    await mount("replacement");
    await edit("web-search-provider-priority", "tavily");
    await act(async () => {
      if (outcome === "resolve")
        resolve({ web_search: { engine: "xiaohongshu" } });
      else reject(new Error("private-late-load"));
    });
    expect(input("web-search-engine").value).toBe("google");
    expect(input("web-search-provider-priority").value).toBe("tavily");
    expect(container.textContent).not.toContain("private-late-load");
  },
);
