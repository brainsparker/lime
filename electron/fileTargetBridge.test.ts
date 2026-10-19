import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_INVOKE_CHANNEL } from "./ipcChannels";
const boundary = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
}));
vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) =>
      boundary.exposed.set(key, value),
  },
  ipcRenderer: {
    invoke: boundary.invoke,
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
}));
type Bridge = {
  supportsCommand(command: string): boolean;
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>;
  devBridgeFallback: boolean;
};
beforeEach(() => {
  vi.resetModules();
  boundary.exposed.clear();
  boundary.invoke.mockReset();
});
describe("file target real preload boundary", () => {
  it("supports every target command through the shared IPC allowlist and propagates Host errors", async () => {
    await import("./preload");
    const bridge = boundary.exposed.get("electronAPI") as Bridge;
    expect(bridge.devBridgeFallback).toBe(false);
    expect(bridge.supportsCommand("open_with_default_app")).toBe(false);
    const params = {
      path: "/work/a",
      cwd: "/work",
      target: "systemDefault",
      appPath: "/Applications/One.app",
    };
    for (const command of [
      "open_in_get_targets",
      "open_in_detect_target",
      "open_in_load_target_icon",
      "open_in_open",
      "open_in_set_global_preferred_target",
    ]) {
      expect(bridge.supportsCommand(command)).toBe(true);
      boundary.invoke.mockResolvedValueOnce({
        ok: true,
        result: { real: command },
      });
      expect(await bridge.invoke(command, params)).toEqual({ real: command });
      expect(boundary.invoke).toHaveBeenLastCalledWith(
        IPC_INVOKE_CHANNEL,
        command,
        params,
      );
    }
    boundary.invoke.mockResolvedValueOnce({
      ok: false,
      error: { code: "unavailable", message: "Application disappeared" },
    });
    await expect(bridge.invoke("open_in_open", params)).rejects.toMatchObject({
      code: "unavailable",
      message: "Application disappeared",
    });
  });
});
