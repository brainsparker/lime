import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { changeLimeLocale } from "@/i18n/createI18n";
import type { ConfigUpdater } from "@/lib/api/appConfig";
import { useMemorySettingsDraft } from "./useMemorySettingsDraft";

const api = vi.hoisted(() => ({ getConfig: vi.fn(), saveConfig: vi.fn() }));
vi.mock("@/lib/api/appConfig", () => ({
  ...api,
  updateConfig: async (update: ConfigUpdater) => {
    const config = update(await api.getConfig());
    await api.saveConfig(config);
    return config;
  },
}));
const showMessage = vi.fn();
let draft: ReturnType<typeof useMemorySettingsDraft>;
function Probe() {
  draft = useMemorySettingsDraft(showMessage);
  return null;
}
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("en-US");
  api.getConfig.mockReset().mockResolvedValue({ memory: { enabled: true } });
  api.saveConfig.mockReset();
  showMessage.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Probe />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("two submissions in the same event persist once, and an in-flight reset cannot undo the save", async () => {
  let resolve!: () => void;
  api.saveConfig.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  await act(async () =>
    draft.setDraft((current) => ({ ...current, enabled: false })),
  );
  let first!: Promise<void>;
  await act(async () => {
    first = draft.save();
    void draft.save();
    draft.reset();
  });
  expect(api.saveConfig).toHaveBeenCalledTimes(1);
  expect(draft.draft.enabled).toBe(false);
  await act(async () => {
    resolve();
    await first;
  });
  expect(draft.dirty).toBe(false);
  expect(draft.saving).toBe(false);
});

it("saving Memory preserves other configuration changed after the form loaded", async () => {
  api.getConfig.mockResolvedValue({
    memory: { enabled: true },
    language: "ja-JP",
  });
  await act(async () =>
    draft.setDraft((current) => ({ ...current, enabled: false })),
  );
  await act(async () => draft.save());
  expect(api.saveConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      language: "ja-JP",
      memory: expect.objectContaining({ enabled: false }),
    }),
  );
});

it.each(["resolve", "reject"])(
  "a late %s after unmount cannot notify or alter the new form",
  async (outcome) => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    api.saveConfig.mockReturnValue(
      new Promise<void>((done, fail) => {
        resolve = done;
        reject = fail;
      }),
    );
    await act(async () =>
      draft.setDraft((current) => ({ ...current, enabled: false })),
    );
    let save!: Promise<void>;
    await act(async () => {
      save = draft.save();
    });
    await act(async () => root.render(null));
    api.getConfig.mockResolvedValue({ memory: { enabled: true } });
    await act(async () => root.render(<Probe />));
    await act(async () => {
      if (outcome === "resolve") resolve();
      else reject(new Error("late fixture rejection"));
      await save;
    });
    expect(draft.draft.enabled).toBe(true);
    expect(draft.dirty).toBe(false);
    expect(draft.saving).toBe(false);
    expect(showMessage).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  },
);
