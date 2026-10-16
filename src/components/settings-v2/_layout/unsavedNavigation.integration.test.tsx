import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { ConfigUpdater } from "@/lib/api/appConfig";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { SettingsTabs } from "@/types/settings";
import type { SettingsPageParams } from "@/types/page";
import { MemorySettings } from "../general/memory";
import { SettingsPage } from ".";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    return config;
  },
}));
vi.mock("../general/memory/MemoryStoreStatusPanel", () => ({
  MemoryStoreStatusPanel: () => null,
}));
vi.mock("../general/memory/soul/StyleProfileSection", () => ({
  StyleProfileSection: () => null,
}));
vi.mock("../home", () => ({ SettingsHomePage: () => null }));
vi.mock("../sections", () => ({
  isSettingsSection: () => true,
  resolveSettingsSection: (tab?: SettingsTabs) => ({
    key: tab ?? SettingsTabs.Home,
    preload: () => null,
    render: () =>
      tab === SettingsTabs.Memory ? <MemorySettings /> : <p>Other section</p>,
  }),
}));
vi.mock("./SettingsNavigation", () => ({
  SettingsNavigation: ({
    onBack,
    onHome,
    onTabChange,
    onNavigate,
  }: {
    onBack: () => void;
    onHome: () => void;
    onTabChange: (tab: SettingsTabs) => void;
    onNavigate: (page: "resources") => void;
  }) => (
    <nav>
      <button onClick={() => onTabChange(SettingsTabs.About)}>Section</button>
      <button onClick={onBack}>Back</button>
      <button onClick={onHome}>Home</button>
      <button onClick={() => onNavigate("resources")}>Root</button>
    </nav>
  ),
}));

let navigation: ReturnType<typeof useAppNavigation>;
function Harness() {
  navigation = useAppNavigation();
  const { handleNavigate } = navigation;
  useLayoutEffect(
    () => handleNavigate("settings", { tab: SettingsTabs.Memory }),
    [handleNavigate],
  );
  return (
    <>
      <button
        onClick={() => navigation.startNewConversation({ freshDraft: true })}
      >
        New
      </button>
      {navigation.requestedPage === "settings" ? (
        <SettingsPage
          pageParams={navigation.requestedPageParams as SettingsPageParams}
          onNavigate={navigation.handleNavigate}
          onBack={navigation.returnFromSettings}
          navigationGuard={navigation.navigationGuard}
        />
      ) : (
        <p data-testid="destination">{navigation.requestedPage}</p>
      )}
    </>
  );
}

let root: Root;
let container: HTMLDivElement;
const testId = <T extends HTMLElement = HTMLElement>(id: string) => {
  const element = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
};
const dialog = () =>
  document.querySelector('[data-testid="settings-unsaved-changes-dialog"]');
const button = (text: string) => {
  const result = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  );
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
};
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function mount() {
  await act(async () => root.render(<Harness />));
  await act(async () => {
    await Promise.resolve();
  });
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.sessionStorage.clear();
  api.getConfig.mockReset().mockResolvedValue({ memory: { enabled: true } });
  api.saveConfig.mockReset().mockResolvedValue(undefined);
  await changeLimeLocale("en-US");
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

describe("Settings unsaved navigation with the real Memory owner", () => {
  it.each(["Section", "Back", "Home", "Root", "New"])(
    "%s keeps canonical navigation until explicit discard",
    async (target) => {
      await mount();
      await click(testId("settings-memory-toggle"));
      const requestId = navigation.navigationRequestId;
      const params = navigation.requestedPageParams;
      const restore = window.sessionStorage.getItem(
        "lime.appNavigation.restore.v1",
      );
      await click(button(target));
      expect(dialog()).not.toBeNull();
      expect(navigation.requestedPage).toBe("settings");
      expect(navigation.pageParams).toEqual(params);
      expect(navigation.navigationRequestId).toBe(requestId);
      expect(
        window.sessionStorage.getItem("lime.appNavigation.restore.v1"),
      ).toBe(restore);
      expect(document.activeElement).toBe(button("Keep editing"));
      await click(button("Keep editing"));
      expect(dialog()).toBeNull();
      expect(
        testId("settings-memory-toggle").getAttribute("aria-checked"),
      ).toBe("false");
      await click(button(target));
      await click(button("Discard changes"));
      expect(dialog()).toBeNull();
      expect(navigation.navigationRequestId).toBeGreaterThan(requestId);
      if (target === "Section")
        expect(navigation.requestedPageParams).toEqual({
          tab: SettingsTabs.About,
        });
      else
        expect(navigation.requestedPage).toBe(
          target === "Root" ? "resources" : "agent",
        );
      expect(api.saveConfig).not.toHaveBeenCalled();
    },
  );

  it("failed save retains the draft; a successful retry permits clean navigation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.saveConfig.mockRejectedValueOnce(new Error("fixture save failure"));
    await mount();
    await click(testId("settings-memory-toggle"));
    await click(testId("settings-memory-save"));
    expect(testId("settings-memory-toggle").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(testId<HTMLButtonElement>("settings-memory-save").disabled).toBe(
      false,
    );
    await click(button("Section"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(testId("settings-memory-save"));
    expect(api.saveConfig).toHaveBeenCalledTimes(2);
    await click(button("Section"));
    expect(dialog()).toBeNull();
    expect(navigation.requestedPageParams).toEqual({ tab: SettingsTabs.About });
  });

  it("saving blocks discard and does not overwrite edits made while the save is pending", async () => {
    const save = deferred();
    api.saveConfig.mockReturnValueOnce(save.promise);
    await mount();
    await click(testId("settings-memory-toggle"));
    await click(testId("settings-memory-save"));
    await click(testId("settings-memory-toggle"));
    await click(button("Home"));
    expect(dialog()).not.toBeNull();
    expect(button("Discard changes").disabled).toBe(true);
    await act(async () =>
      navigation.navigationGuard.discardPendingNavigation(),
    );
    expect(navigation.requestedPage).toBe("settings");
    await click(button("Keep editing"));
    await act(async () => save.resolve());
    expect(navigation.requestedPage).toBe("settings");
    expect(testId("settings-memory-toggle").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(testId<HTMLButtonElement>("settings-memory-save").disabled).toBe(
      false,
    );
    await click(button("Back"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(testId("settings-memory-cancel"));
    expect(testId("settings-memory-toggle").getAttribute("aria-checked")).toBe(
      "false",
    );
    await click(button("Back"));
    expect(navigation.requestedPage).toBe("agent");
  });

  it("unapplied SOUL input is protected without implicitly persisting it", async () => {
    await mount();
    await click(testId("settings-memory-tab-advanced"));
    const textarea = testId<HTMLTextAreaElement>(
      "settings-memory-soul-import-textarea",
    );
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )!.set!.call(textarea, "# Draft personality");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button("Home"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    expect(textarea.value).toBe("# Draft personality");
    expect(api.saveConfig).not.toHaveBeenCalled();
  });

  it("editing imported text invalidates the old preview before it can consume new input", async () => {
    await mount();
    await click(testId("settings-memory-tab-advanced"));
    const textarea = testId<HTMLTextAreaElement>(
      "settings-memory-soul-import-textarea",
    );
    const edit = async (value: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )!.set!.call(textarea, value);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await edit("# First personality\n\nBe precise and direct.");
    await click(button("Preview import"));
    expect(button("Apply to draft").disabled).toBe(false);
    await edit("# New personality\n\nKeep this new input.");
    const staleApply = [...document.querySelectorAll("button")].find(
      (node) => node.textContent === "Apply to draft",
    );
    expect(staleApply?.disabled ?? true).toBe(true);
    expect(textarea.value).toContain("New personality");
    await click(button("Preview import"));
    await click(button("Apply to draft"));
    expect(textarea.value).toBe("");
    await click(testId("settings-memory-save"));
    expect(api.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        memory: expect.objectContaining({
          soul: expect.objectContaining({ name: "New personality" }),
        }),
      }),
    );
  });

  it.each([
    ["en-US", "Discard changes?", "Keep editing"],
    ["zh-CN", "放弃更改？", "继续编辑"],
    ["zh-TW", "捨棄變更？", "繼續編輯"],
    ["ja-JP", "変更を破棄しますか？", "編集を続ける"],
    ["ko-KR", "변경 사항을 삭제할까요?", "계속 편집"],
  ] as const)(
    "%s localizes the dialog and Escape returns focus without discarding",
    async (locale, title, keep) => {
      await changeLimeLocale(locale);
      await mount();
      const toggle = testId("settings-memory-toggle");
      await click(toggle);
      toggle.focus();
      await act(async () => navigation.handleNavigate("resources"));
      expect(
        document.querySelector('[role="alertdialog"]')?.textContent,
      ).toContain(title);
      expect(document.activeElement).toBe(button(keep));
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      // Radix restores focus after its focus scope unmounts.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(toggle);
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(navigation.requestedPage).toBe("settings");
      expect(api.saveConfig).not.toHaveBeenCalled();
    },
  );
});
