import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadSettingsNotificationMirrors } from "./threadSettingsNotifications";

const settings = (model: string) => ({
  method: "thread/settings/updated",
  params: {
    threadId: "thread-1",
    threadSettings: { model, modelProvider: "provider", cwd: "/workspace" },
  },
});

describe("thread settings notification mirrors", () => {
  afterEach(() => vi.useRealTimers());

  it("新 B 后的旧 A drain 镜像不会回滚，合法同来源 A→B→A 保留", () => {
    const mirrors = new ThreadSettingsNotificationMirrors();
    expect(mirrors.accept(settings("A"), "response")).toBe(true);
    expect(mirrors.accept(settings("B"), "response")).toBe(true);
    expect(mirrors.accept(settings("A"), "drain")).toBe(false);
    expect(mirrors.accept(settings("B"), "drain")).toBe(false);
    expect(mirrors.accept(settings("A"), "response")).toBe(true);
    expect(mirrors.accept(settings("A"), "drain")).toBe(false);
    expect(mirrors.accept(settings("A"), "drain")).toBe(true);
    const drainOnly = new ThreadSettingsNotificationMirrors();
    expect(
      ["A", "B", "A"].map((model) =>
        drainOnly.accept(settings(model), "drain"),
      ),
    ).toEqual([true, true, true]);
  });

  it("drain先于response仍只消费一对，reset与过期清空镜像", () => {
    vi.useFakeTimers();
    const mirrors = new ThreadSettingsNotificationMirrors();
    expect(mirrors.accept(settings("A"), "drain")).toBe(true);
    expect(mirrors.accept(settings("A"), "response")).toBe(false);
    expect(mirrors.accept(settings("B"), "drain")).toBe(true);
    mirrors.reset();
    expect(mirrors.accept(settings("B"), "response")).toBe(true);
    vi.advanceTimersByTime(30_001);
    expect(mirrors.accept(settings("B"), "drain")).toBe(true);
  });

  it("镜像有界，不改变其他通知的语义", () => {
    const mirrors = new ThreadSettingsNotificationMirrors();
    for (let i = 0; i < 2_049; i++)
      mirrors.accept(settings(String(i)), "response");
    expect(mirrors.accept(settings("0"), "drain")).toBe(true);
    const item = { method: "item/started", params: {} };
    expect(mirrors.accept(item, "response")).toBe(true);
    expect(mirrors.accept(item, "drain")).toBe(true);
  });
});
