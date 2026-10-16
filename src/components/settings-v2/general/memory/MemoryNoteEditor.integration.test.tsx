import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { SettingsTabs } from "@/types/settings";
import { SettingsNavigationGuard } from "../../_layout/SettingsNavigationGuard";
import { MemorySettings } from ".";

const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  addMemoryStoreNote: vi.fn(),
  getMemoryStoreHealth: vi.fn(),
  listMemoryStoreReviewNotes: vi.fn(),
  getDefaultProject: vi.fn(),
}));
vi.mock("@/lib/api/appConfig", () => ({
  getConfig: api.getConfig,
  updateConfig: api.updateConfig,
}));
vi.mock("@/lib/api/memoryStore", () => ({
  addMemoryStoreNote: api.addMemoryStoreNote,
  getMemoryStoreHealth: api.getMemoryStoreHealth,
  listMemoryStoreReviewNotes: api.listMemoryStoreReviewNotes,
}));
vi.mock("@/lib/api/project", () => ({
  getDefaultProject: api.getDefaultProject,
}));
vi.mock("./soul/StyleProfileSection", () => ({
  StyleProfileSection: () => null,
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
      navigation.requestedPageParams?.tab === SettingsTabs.Memory ? (
        <SettingsNavigationGuard navigationGuard={navigation.navigationGuard}>
          <MemorySettings />
        </SettingsNavigationGuard>
      ) : (
        <p data-testid="destination">{navigation.requestedPage}</p>
      )}
    </>
  );
}

let root: Root;
let container: HTMLDivElement;
function element<T extends HTMLElement = HTMLElement>(id: string) {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
const note = () =>
  element<HTMLTextAreaElement>("settings-memory-note-textarea");
const dialog = () =>
  document.querySelector('[data-testid="settings-unsaved-changes-dialog"]');
function button(text: string) {
  const node = [...document.querySelectorAll("button")].find(
    (node) => node.textContent === text,
  );
  if (!node) throw new Error(`Missing button ${text}`);
  return node;
}
async function click(node: HTMLElement) {
  await act(async () => node.click());
}
async function edit(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(note(), value);
    note().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function mount(key = "initial") {
  await act(async () => root.render(<Harness key={key} />));
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.sessionStorage.clear();
  vi.resetAllMocks();
  await changeLimeLocale("en-US");
  api.getConfig.mockResolvedValue({ memory: { enabled: true } });
  api.updateConfig.mockImplementation(async (update) =>
    update(await api.getConfig()),
  );
  api.addMemoryStoreNote.mockResolvedValue(undefined);
  api.getMemoryStoreHealth.mockResolvedValue({
    rootScope: "global",
    rootPath: "/fixture/memories",
    notesCount: 0,
  });
  api.listMemoryStoreReviewNotes.mockResolvedValue({ notes: [] });
  api.getDefaultProject.mockResolvedValue(null);
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

describe("Memory correction note with the real configuration and navigation owners", () => {
  it.each(["Section", "Back", "Home", "Root", "New"])(
    "%s requires explicit discard without saving the note",
    async (target) => {
      await mount();
      await edit("Keep my correction");
      const before = {
        id: navigation.navigationRequestId,
        params: navigation.requestedPageParams,
        restore: window.sessionStorage.getItem("lime.appNavigation.restore.v1"),
      };
      await click(button(target));
      expect(dialog()).not.toBeNull();
      expect(navigation.requestedPage).toBe("settings");
      expect(navigation.navigationRequestId).toBe(before.id);
      expect(navigation.requestedPageParams).toEqual(before.params);
      expect(
        window.sessionStorage.getItem("lime.appNavigation.restore.v1"),
      ).toBe(before.restore);
      await click(button("Keep editing"));
      expect(note().value).toBe("Keep my correction");
      await click(button(target));
      await click(button("Discard changes"));
      expect(dialog()).toBeNull();
      expect(
        document.querySelector('[data-testid="destination"]'),
      ).not.toBeNull();
      expect(api.addMemoryStoreNote).not.toHaveBeenCalled();
      expect(api.updateConfig).not.toHaveBeenCalled();
    },
  );

  it("retains a failed note and permits clean navigation after a successful retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.addMemoryStoreNote.mockRejectedValueOnce(
      new Error("fixture write failure"),
    );
    await mount();
    await edit("  Correct the memory  ");
    await click(element("settings-memory-note-save"));
    expect(note().value).toBe("  Correct the memory  ");
    await click(button("Section"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(element("settings-memory-note-save"));
    expect(api.addMemoryStoreNote).toHaveBeenCalledTimes(2);
    expect(api.addMemoryStoreNote).toHaveBeenLastCalledWith({
      scope: "global",
      title: expect.any(String),
      content: "Correct the memory",
    });
    expect(note().value).toBe("");
    await click(button("Section"));
    expect(dialog()).toBeNull();
    expect(navigation.requestedPageParams).toEqual({ tab: SettingsTabs.About });
  });

  it("a pending save consumes only the submitted version", async () => {
    const pending = deferred();
    api.addMemoryStoreNote.mockReturnValueOnce(pending.promise);
    await mount();
    await edit("Submitted correction");
    await click(element("settings-memory-note-save"));
    await edit("New correction while saving");
    await act(async () => pending.resolve());
    expect(note().value).toBe("New correction while saving");
    expect(api.addMemoryStoreNote).toHaveBeenCalledWith({
      scope: "global",
      title: expect.any(String),
      content: "Submitted correction",
    });
    await click(button("Root"));
    expect(dialog()).not.toBeNull();
  });

  it.each(["soul", "advanced"])(
    "switching to %s preserves the note and its navigation guard",
    async (tab) => {
      await mount();
      await edit("Retained across local tabs");
      await click(element(`settings-memory-tab-${tab}`));
      await click(button("Root"));
      expect(dialog()).not.toBeNull();
      await click(button("Keep editing"));
      await click(element("settings-memory-tab-memory"));
      expect(note().value).toBe("Retained across local tabs");
      expect(api.addMemoryStoreNote).not.toHaveBeenCalled();
    },
  );

  it("a hidden pending note still blocks discard until persistence acknowledges it", async () => {
    const pending = deferred();
    api.addMemoryStoreNote.mockReturnValueOnce(pending.promise);
    await mount();
    await edit("Save across local tabs");
    await click(element("settings-memory-note-save"));
    await click(element("settings-memory-tab-advanced"));
    await click(button("Root"));
    expect(dialog()).not.toBeNull();
    expect(button("Discard changes").disabled).toBe(true);
    await click(button("Keep editing"));
    await act(async () => pending.resolve());
    await click(element("settings-memory-tab-memory"));
    expect(note().value).toBe("");
    await click(button("Root"));
    expect(dialog()).toBeNull();
    expect(navigation.requestedPage).toBe("resources");
  });

  it.each([
    ["en-US", "Add memory correction", "Save correction"],
    ["zh-CN", "添加记忆修正", "保存修正"],
    ["zh-TW", "新增記憶修正", "儲存修正"],
    ["ja-JP", "メモリ修正を追加", "修正を保存"],
    ["ko-KR", "메모리 수정 추가", "수정 저장"],
  ] as const)(
    "%s names the editor and save action in the active language",
    async (locale, label, action) => {
      await changeLimeLocale(locale);
      await mount();
      expect(note().labels?.[0]?.textContent).toBe(label);
      expect(element("settings-memory-note-save").textContent).toBe(action);
      const description = document.getElementById(
        note().getAttribute("aria-describedby")!,
      );
      expect(description?.textContent?.trim()).toBeTruthy();
      expect(description?.textContent).not.toContain("settings.memory.");
    },
  );

  it("blocks discard while saving and preserves a newer input revision, even if its text matches", async () => {
    const pending = deferred();
    api.addMemoryStoreNote.mockReturnValueOnce(pending.promise);
    await mount();
    await edit("Original correction");
    const save = element("settings-memory-note-save");
    await act(async () => {
      save.click();
      save.click();
    });
    expect(api.addMemoryStoreNote).toHaveBeenCalledTimes(1);
    await edit("New correction");
    await edit("Original correction");
    await click(button("Home"));
    expect(button("Discard changes").disabled).toBe(true);
    await act(async () =>
      navigation.navigationGuard.discardPendingNavigation(),
    );
    expect(navigation.requestedPage).toBe("settings");
    await click(button("Keep editing"));
    await act(async () => pending.resolve());
    expect(note().value).toBe("Original correction");
    expect(navigation.requestedPage).toBe("settings");
    await click(button("Back"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(element("settings-memory-note-save"));
    expect(note().value).toBe("");
  });

  it.each(["resolve", "reject"] as const)(
    "ignores a %s from an unmounted note owner",
    async (settle) => {
      const pending = deferred();
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      api.addMemoryStoreNote.mockReturnValueOnce(pending.promise);
      await mount();
      await edit("Old correction");
      await click(element("settings-memory-note-save"));
      await mount("replacement");
      await edit("New owner's correction");
      const healthCalls = api.getMemoryStoreHealth.mock.calls.length;
      await act(async () =>
        settle === "resolve"
          ? pending.resolve()
          : pending.reject(new Error("late fixture error")),
      );
      expect(note().value).toBe("New owner's correction");
      expect(api.getMemoryStoreHealth).toHaveBeenCalledTimes(healthCalls);
      expect(errors).not.toHaveBeenCalled();
      await click(button("Section"));
      expect(dialog()).not.toBeNull();
    },
  );

  it("a late health-refresh failure after saving does not notify the replacement owner", async () => {
    const pending = deferred();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await mount();
    api.getMemoryStoreHealth.mockReturnValueOnce(pending.promise);
    await edit("Saved correction");
    await click(element("settings-memory-note-save"));
    expect(note().value).toBe("");
    await mount("replacement");
    await edit("Replacement input");
    await act(async () => pending.reject(new Error("late health error")));
    expect(errors).not.toHaveBeenCalled();
    expect(note().value).toBe("Replacement input");
  });

  it("keeps the note guard when configuration is canceled, and configuration guard when the note is saved", async () => {
    await mount();
    await edit("Independent note");
    await click(element("settings-memory-toggle"));
    await click(element("settings-memory-cancel"));
    expect(note().value).toBe("Independent note");
    await click(button("Section"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(element("settings-memory-toggle"));
    await click(element("settings-memory-note-save"));
    expect(note().value).toBe("");
    await click(button("Section"));
    expect(dialog()).not.toBeNull();
    await click(button("Keep editing"));
    await click(element("settings-memory-cancel"));
    await click(button("Section"));
    expect(dialog()).toBeNull();
  });
});
