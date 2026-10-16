import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import type { Config, ConfigUpdater } from "@/lib/api/appConfig";
import { SettingsTabs } from "@/types/settings";
import { SettingsNavigationGuard } from "../../_layout/SettingsNavigationGuard";
import { ProfileSettings } from ".";

const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
}));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    api.getConfig.mockResolvedValue(config);
    return config;
  },
}));
let navigation: ReturnType<typeof useAppNavigation>;
function Harness() {
  navigation = useAppNavigation();
  const { handleNavigate } = navigation;
  useLayoutEffect(
    () => handleNavigate("settings", { tab: SettingsTabs.Profile }),
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
      navigation.requestedPageParams?.tab === SettingsTabs.Profile ? (
        <SettingsNavigationGuard navigationGuard={navigation.navigationGuard}>
          <ProfileSettings />
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
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (node) =>
      node.textContent?.trim() === text ||
      node.getAttribute("aria-label") === text,
  );
  if (!node) throw new Error("Missing button " + text);
  return node;
}
function input() {
  const node = container.querySelector(
    "#profile-field-displayName, #profile-field-bio",
  );
  if (
    !(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
  )
    throw new Error("Missing rule input");
  return node;
}
async function edit(value: string) {
  await act(async () => {
    const node = input();
    Object.getOwnPropertyDescriptor(
      node instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const click = async (node: HTMLElement) => act(async () => node.click());
const dialog = () =>
  document.querySelector('[data-testid="settings-unsaved-changes-dialog"]');
const mount = async () => act(async () => root.render(<Harness />));
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.sessionStorage.clear();
  vi.resetAllMocks();
  await changeLimeLocale("en-US");
  initial = {
    default_provider: "openai",
    user_profile: { nickname: "Ada", bio: "Original bio" },
  } as Config;
  api.getConfig.mockResolvedValue(initial);
  api.saveConfig.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await changeLimeLocale("zh-CN");
});

async function prepare(kind: string) {
  await mount();
  await click(
    button(kind === "displayName" ? "Edit Display name" : "Edit Bio"),
  );
  await edit("changed");
}
it.each(
  ["displayName", "bio"].flatMap((kind) =>
    ["Section", "Back", "Home", "Root", "New"].map((target) => [kind, target]),
  ),
)(
  "%s draft blocks %s and supports keep/discard without writes",
  async (kind, target) => {
    await prepare(kind);
    await click(button(target));
    expect(dialog()).not.toBeNull();
    expect(input().value).toBe("changed");
    await click(button("Keep editing"));
    expect(dialog()).toBeNull();
    expect(input().value).toBe("changed");
    await click(button(target));
    await click(button("Discard changes"));
    expect(
      container.querySelector('[data-testid="destination"]'),
    ).not.toBeNull();
    expect(api.saveConfig).not.toHaveBeenCalled();
  },
);
it.each(["displayName", "bio"])(
  "%s save blocks discard and retains newer text",
  async (kind) => {
    await prepare(kind);
    const pending = deferred<void>();
    api.saveConfig.mockReturnValueOnce(pending.promise);
    const submit = button(
      kind === "displayName" ? "Save Display name" : "Save Bio",
    );
    await act(async () => {
      submit.click();
      submit.click();
    });
    expect(api.saveConfig).toHaveBeenCalledTimes(1);
    await edit("newer");
    await click(button("Section"));
    expect(button("Discard changes").disabled).toBe(true);
    await act(async () =>
      navigation.navigationGuard.discardPendingNavigation(),
    );
    expect(input().value).toBe("newer");
    await click(button("Keep editing"));
    await act(async () => pending.resolve());
    expect(input().value).toBe("newer");
    await click(button("Section"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(
      button(kind === "displayName" ? "Save Display name" : "Save Bio"),
    );
    await click(button("Section"));
    expect(dialog()).toBeNull();
    expect(
      container.querySelector('[data-testid="destination"]'),
    ).not.toBeNull();
  },
);
it("canceling an inline edit makes navigation pristine", async () => {
  await prepare("displayName");
  await click(button("Cancel editing Display name"));
  await click(button("Section"));
  expect(dialog()).toBeNull();
  expect(api.saveConfig).not.toHaveBeenCalled();
});
it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
  "%s keeps unsaved bio and translates navigation dialog",
  async (locale) => {
    await prepare("bio");
    await act(async () => changeLimeLocale(locale));
    await click(button("Section"));
    const translated = getLimeI18n().t("settings.unsavedChanges.keepEditing", {
      ns: "settings",
    });
    expect(button(translated)).toBeTruthy();
    expect(input().value).toBe("changed");
    expect(api.getConfig).toHaveBeenCalledTimes(1);
  },
);
