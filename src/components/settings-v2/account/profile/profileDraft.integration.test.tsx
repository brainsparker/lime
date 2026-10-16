import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import type { Config, ConfigUpdater } from "@/lib/api/appConfig";
import { ProfileSettings } from ".";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
let persisted: Config;
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const next = update(await api.getConfig());
    await api.saveConfig(next);
    persisted = next;
    return next;
  },
}));

let root: Root;
let container: HTMLDivElement;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const click = async (node: HTMLElement) => act(async () => node.click());
function button(label: string) {
  const node = [...container.querySelectorAll("button")].find(
    (node) =>
      node.getAttribute("aria-label") === label ||
      node.textContent?.trim() === label,
  );
  if (!node) throw new Error("Missing button: " + label);
  return node;
}
function input(id: string) {
  const node = container.querySelector("#" + id);
  if (
    !(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
  )
    throw new Error("Missing input: " + id);
  return node;
}
async function edit(id: string, value: string) {
  await act(async () => {
    const node = input(id);
    Object.getOwnPropertyDescriptor(
      node instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const mount = async () => act(async () => root.render(<ProfileSettings />));
async function editDisplayName(value: string) {
  await click(button("Edit Display name"));
  await edit("profile-field-displayName", value);
}
beforeEach(async () => {
  await changeLimeLocale("en-US");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  persisted = {
    default_provider: "openai",
    user_profile: {
      nickname: "Ada",
      bio: "Original bio",
    },
  } as Config;
  api.getConfig.mockImplementation(async () => structuredClone(persisted));
  api.saveConfig.mockImplementation(async (config: Config) => {
    persisted = structuredClone(config);
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await changeLimeLocale("zh-CN");
});

it("failed inline save retains the editor and safe retry without exposing backend details", async () => {
  await mount();
  await editDisplayName("Unsaved nickname");
  api.saveConfig.mockRejectedValueOnce(
    new Error("EISDIR /private/secret user-value"),
  );
  await click(button("Save Display name"));
  expect(input("profile-field-displayName").value).toBe("Unsaved nickname");
  expect(container.textContent).toContain("Failed to save profile");
  expect(container.textContent).not.toMatch(/EISDIR|private|secret|user-value/);
  await click(button("Save Display name"));
  expect(persisted.user_profile?.nickname).toBe("Unsaved nickname");
  expect(container.querySelector("#profile-field-displayName")).toBeNull();
});

it("inline save preserves all latest untouched configuration and profile fields", async () => {
  await mount();
  await editDisplayName("Submitted");
  persisted = {
    ...persisted,
    default_provider: "peer-provider",
    user_profile: {
      ...persisted.user_profile,
      bio: "Peer bio",
    },
  };
  await click(button("Save Display name"));
  expect(persisted).toMatchObject({
    default_provider: "peer-provider",
    user_profile: {
      nickname: "Submitted",
      bio: "Peer bio",
    },
  });
});

it("duplicate submissions are rejected and newer inline text survives an in-flight save", async () => {
  await mount();
  await editDisplayName("Submitted");
  const pending = deferred();
  api.saveConfig.mockImplementationOnce(async (config: Config) => {
    await pending.promise;
    persisted = structuredClone(config);
  });
  const save = button("Save Display name");
  await act(async () => {
    save.click();
    save.click();
  });
  expect(api.saveConfig).toHaveBeenCalledTimes(1);
  expect(save.disabled).toBe(true);
  await edit("profile-field-displayName", "Newer text");
  expect(button("Cancel editing Display name").disabled).toBe(true);
  await act(async () => pending.resolve());
  expect(persisted.user_profile?.nickname).toBe("Submitted");
  expect(input("profile-field-displayName").value).toBe("Newer text");
  await click(button("Save Display name"));
  expect(persisted.user_profile?.nickname).toBe("Newer text");
});

it("locale changes retain draft and translate safe error without reloading", async () => {
  await mount();
  await editDisplayName("Draft");
  api.saveConfig.mockRejectedValueOnce(new Error("raw backend"));
  await click(button("Save Display name"));
  const reads = api.getConfig.mock.calls.length;
  await act(async () => changeLimeLocale("zh-CN"));
  expect(input("profile-field-displayName").value).toBe("Draft");
  expect(container.textContent).toContain("保存资料失败");
  expect(api.getConfig).toHaveBeenCalledTimes(reads);
});

it("load failure disables all writes, hides backend details and allows retry", async () => {
  api.getConfig.mockRejectedValueOnce(new Error("private-profile-load"));
  await mount();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Failed to load profile",
  );
  expect(container.textContent).not.toContain("private-profile-load");
  expect(button("Edit Display name").disabled).toBe(true);
  expect(button("Edit Bio").disabled).toBe(true);
  await click(button("Retry"));
  await editDisplayName("Recovered");
  await click(button("Save Display name"));
  expect(persisted.user_profile?.nickname).toBe("Recovered");
});

it("switching or canceling cannot discard another dirty field while saving", async () => {
  await mount();
  await editDisplayName("Draft");
  expect(button("Edit Bio").disabled).toBe(true);
  await click(button("Edit Bio"));
  expect(input("profile-field-displayName").value).toBe("Draft");
  await click(button("Cancel editing Display name"));
  await click(button("Edit Bio"));
  expect(container.querySelector("#profile-field-bio")).toBeInstanceOf(
    HTMLTextAreaElement,
  );
});

it.each(["displayName", "bio"])(
  "IME Enter does not submit %s",
  async (field) => {
    await mount();
    await click(
      button(field === "displayName" ? "Edit Display name" : "Edit Bio"),
    );
    await edit(`profile-field-${field}`, "组合输入");
    await act(async () => {
      input(`profile-field-${field}`).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        }),
      );
    });
    expect(api.saveConfig).not.toHaveBeenCalled();
  },
);

it.each(["zh-CN", "zh-TW", "en-US", "ja-JP", "ko-KR"])(
  "%s shows localized safe failure and preserves draft",
  async (locale) => {
    await mount();
    await editDisplayName("Draft");
    await act(async () => changeLimeLocale(locale));
    api.saveConfig.mockRejectedValueOnce(new Error("EISDIR private value"));
    const save = getLimeI18n().t("settings.profile.field.saveAria", {
      ns: "settings",
      label: getLimeI18n().t("settings.profile.field.displayName.label", {
        ns: "settings",
      }),
    });
    await click(button(save));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      getLimeI18n().t("settings.profile.message.saveFailed", {
        ns: "settings",
      }),
    );
    expect(container.textContent).not.toMatch(
      /EISDIR|private value|\{\{error\}\}/,
    );
    expect(input("profile-field-displayName").value).toBe("Draft");
  },
);

it.each(["load", "save"])(
  "a late %s cannot change a replacement owner",
  async (kind) => {
    const pending = deferred();
    if (kind === "load")
      api.getConfig.mockImplementationOnce(async () => {
        await pending.promise;
        return persisted;
      });
    await mount();
    if (kind === "save") {
      await editDisplayName("Submitted");
      api.saveConfig.mockReturnValueOnce(pending.promise);
      await click(button("Save Display name"));
    }
    await act(async () => root.render(<p>replacement owner</p>));
    await act(async () => pending.resolve());
    expect(container.textContent).toBe("replacement owner");
    expect(
      container.querySelector('[role="alert"], [role="status"]'),
    ).toBeNull();
  },
);
