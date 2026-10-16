import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { ConfigUpdater, UserProfile } from "@/lib/api/appConfig";
import { ProfileSettings } from ".";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    return config;
  },
}));
let root: Root;
let container: HTMLDivElement;
const click = async (label: string) => {
  const button = container.querySelector<HTMLButtonElement>(
    `[aria-label="${label}"]`,
  );
  if (!button) throw new Error("Missing button: " + label);
  await act(async () => button.click());
};
function input() {
  const node = container.querySelector("input, textarea");
  if (
    !(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)
  )
    throw new Error("Missing editor");
  return node;
}
async function edit(value: string) {
  await act(async () => {
    const node = input();
    const prototype =
      node instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await changeLimeLocale("en-US");
  vi.resetAllMocks();
  api.getConfig.mockResolvedValue({
    default_provider: "openai",
    user_profile: {
      nickname: "Ada",
      bio: "Builds useful tools.",
      email: "retired@example.test",
      tags: ["retired-tag"],
      avatar_url: "retired-avatar",
    },
  });
  api.saveConfig.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ProfileSettings />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await changeLimeLocale("zh-CN");
});

it("renders only the current name and bio content without local summary or preference panels", () => {
  expect(container.textContent).toContain("Ada");
  expect(container.textContent).toContain("Builds useful tools.");
  expect(container.textContent).not.toMatch(
    /Completion|Status:|Preference Tags|Basic Profile|How Profile Is Used|Suggested Tags|retired/,
  );
  expect(container.querySelector("img, #profile-new-tag")).toBeNull();
  expect(
    [...container.querySelectorAll("button")].map((node) =>
      node.getAttribute("aria-label"),
    ),
  ).toEqual(["Edit Display name", "Edit Bio"]);
});

it.each([
  ["Display name", 64],
  ["Bio", 140],
] as const)(
  "%s exposes the browser limit and blocks oversized programmatic submissions",
  async (label, limit) => {
    await click("Edit " + label);
    expect(input().maxLength).toBe(limit);
    await edit("x".repeat(limit + 1));
    expect(
      container.querySelector<HTMLButtonElement>(`[aria-label="Save ${label}"]`)
        ?.disabled,
    ).toBe(true);
    await act(async () =>
      input().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(api.saveConfig).not.toHaveBeenCalled();
    await edit("x".repeat(limit));
    await click("Save " + label);
    expect(api.saveConfig).toHaveBeenCalledTimes(1);
  },
);

it("requires a non-empty trimmed name and saves through the explicit nickname mapping", async () => {
  await click("Edit Display name");
  await edit("   ");
  expect(
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Save Display name"]',
    )?.disabled,
  ).toBe(true);
  await click("Save Display name");
  expect(api.saveConfig).not.toHaveBeenCalled();
  await edit("  Grace  ");
  await click("Save Display name");
  expect(api.saveConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      default_provider: "openai",
      user_profile: expect.objectContaining({
        nickname: "Grace",
        bio: "Builds useful tools.",
      }),
    }),
  );
});

it("normalizes bio line separators and trims at save; Enter does not submit", async () => {
  await click("Edit Bio");
  await edit("  one\r\ntwo\rthree\nfour\u2028five\u2029six  ");
  expect(input().value).toBe("  one two three four five six  ");
  const key = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  });
  await act(async () => input().dispatchEvent(key));
  expect(key.defaultPrevented).toBe(true);
  expect(api.saveConfig).not.toHaveBeenCalled();
  await click("Save Bio");
  expect(api.saveConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      user_profile: expect.objectContaining({
        bio: "one two three four five six",
      }),
    }),
  );
});

it("allows clearing the bio", async () => {
  await click("Edit Bio");
  await edit("");
  await click("Save Bio");
  expect(api.saveConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      user_profile: expect.objectContaining({ bio: "" }),
    }),
  );
});

it("renders Rust nullable defaults and preserves an untouched null field when saving", async () => {
  const user_profile: UserProfile = { nickname: null, bio: null };
  api.getConfig.mockResolvedValue({ default_provider: "openai", user_profile });
  await act(async () => root.render(<ProfileSettings key="nullable-config" />));
  expect(container.textContent).toContain("Add a display name");
  expect(container.textContent).toContain("Add a bio");
  await click("Edit Display name");
  expect(input().value).toBe("");
  expect(
    container.querySelector<HTMLButtonElement>(
      '[aria-label="Save Display name"]',
    )?.disabled,
  ).toBe(true);
  await edit("Grace");
  await click("Save Display name");
  expect(api.saveConfig).toHaveBeenCalledWith({
    default_provider: "openai",
    user_profile: { nickname: "Grace", bio: null },
  });
});
