import { describe, expect, it, vi } from "vitest";
import { ComposerCommands } from "./ComposerCommands";

describe("scoped Composer commands", () => {
  it("targets the requested thread and ignores inactive editors", async () => {
    const commands = new ComposerCommands(),
      current = vi.fn(),
      foreign = vi.fn(),
      detached = vi.fn();
    commands.register("a", { isActive: () => true, run: current });
    commands.register("b", { isActive: () => true, run: foreign });
    commands.register("a", { isActive: () => false, run: detached });
    expect(await commands.run("composer.addFiles", "a")).toBe(true);
    expect(current).toHaveBeenCalledOnce();
    expect(foreign).not.toHaveBeenCalled();
    expect(detached).not.toHaveBeenCalled();
  });
  it("prefers an active normal handler and uses fallback only when none is active", async () => {
    const commands = new ComposerCommands(),
      normal = vi.fn(),
      fallback = vi.fn();
    let active = true;
    commands.register("a", { isActive: () => active, run: normal });
    commands.register("a", {
      isActive: () => true,
      priority: "fallback",
      run: fallback,
    });
    await commands.run("composer.addFiles", "a");
    expect(normal).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
    active = false;
    await commands.run("composer.addFiles", "a");
    expect(fallback).toHaveBeenCalledOnce();
  });
  it("an old disposer cannot remove its replacement and repeated disposal is harmless", async () => {
    const commands = new ComposerCommands(),
      replacement = vi.fn();
    const disposeOld = commands.register("a", {
      isActive: () => true,
      run: vi.fn(),
    });
    const disposeNew = commands.register("a", {
      isActive: () => true,
      run: replacement,
    });
    disposeOld();
    disposeOld();
    await commands.run("composer.addFiles", "a");
    expect(replacement).toHaveBeenCalledOnce();
    disposeNew();
    expect(await commands.run("composer.addFiles", "a")).toBe(false);
    expect(await commands.run("composer.addFiles", null)).toBe(false);
  });
  it("propagates current failures without invoking a second handler", async () => {
    const commands = new ComposerCommands(),
      fallback = vi.fn(),
      error = new Error("picker failed");
    commands.register("a", {
      isActive: () => true,
      run: () => Promise.reject(error),
    });
    commands.register("a", {
      isActive: () => true,
      run: fallback,
      priority: "fallback",
    });
    await expect(commands.run("composer.addFiles", "a")).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
  });
});
