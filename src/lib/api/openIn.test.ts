import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/lib/dev-bridge", () => ({ safeInvoke: boundary.invoke }));
import { openIn } from "./openIn";

const target = {
  id: "systemDefault",
  target: "systemDefault",
  kind: "builtin",
  label: "Default application",
  available: true,
  icon: null,
};
beforeEach(() => vi.resetAllMocks());
describe("openIn gateway", () => {
  it("preserves host/path/deferred identity and validates the real target snapshot", async () => {
    const snapshot = {
      targets: [target],
      availableTargets: [target.id],
      preferredTarget: target.id,
      mode: "native",
      discovery: "unavailable",
    };
    boundary.invoke.mockResolvedValue(snapshot);
    const params = {
      cwd: "/work",
      path: "/work/a.txt",
      hostId: "local",
      deferEnrichment: true,
    };
    expect(await openIn.getTargets(params)).toEqual(snapshot);
    expect(boundary.invoke).toHaveBeenCalledWith("open_in_get_targets", params);
    boundary.invoke.mockResolvedValue({
      ...snapshot,
      availableTargets: ["uninstalled-app"],
    });
    await expect(openIn.getTargets(params)).rejects.toThrow("Invalid");
  });
  it("rejects diagnostic facade and malformed app identity", async () => {
    boundary.invoke.mockResolvedValue({
      kind: "electron-host-diagnostic",
      command: "open_in_get_targets",
    });
    await expect(openIn.getTargets({ path: "/work/a" })).rejects.toThrow();
    boundary.invoke.mockResolvedValue({
      ...target,
      kind: "native",
      appPath: "/Applications/One.app",
    });
    await expect(
      openIn.detectTarget({ target: "systemDefault", path: "/work/a" }),
    ).rejects.toThrow("Invalid");
  });
  it("does not introduce persistence into an ordinary open and checks mutation results", async () => {
    boundary.invoke.mockResolvedValue({});
    await openIn.open({
      path: "/work/a",
      target: "systemDefault",
      appPath: "/Applications/One.app",
    });
    expect(boundary.invoke).toHaveBeenCalledWith("open_in_open", {
      path: "/work/a",
      target: "systemDefault",
      appPath: "/Applications/One.app",
    });
    await openIn.setGlobalPreferredTarget({ target: "fileManager" });
    expect(boundary.invoke).toHaveBeenLastCalledWith(
      "open_in_set_global_preferred_target",
      { target: "fileManager" },
    );
    boundary.invoke.mockResolvedValue({ success: false });
    await expect(
      openIn.open({ path: "/work/a", target: "fileManager" }),
    ).rejects.toThrow("empty Electron");
  });
  it("validates optional icons without turning icon absence into availability", async () => {
    boundary.invoke.mockResolvedValue(null);
    expect(await openIn.loadTargetIcon({ target: "systemDefault" })).toBeNull();
    boundary.invoke.mockResolvedValue("file:///unexpected");
    await expect(
      openIn.loadTargetIcon({ target: "systemDefault" }),
    ).rejects.toThrow("Invalid");
  });
});
