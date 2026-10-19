import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellBoundary = vi.hoisted(() => ({
  open: vi.fn(),
  reveal: vi.fn(),
  icon: vi.fn(),
  exec: vi.fn(),
}));
vi.mock("./electronRuntime", () => ({
  app: { getPath: () => os.tmpdir(), getFileIcon: shellBoundary.icon },
  BrowserWindow: {},
  shell: {
    openPath: shellBoundary.open,
    showItemInFolder: shellBoundary.reveal,
  },
}));
vi.mock("node:child_process", () => ({
  execFile: shellBoundary.exec,
  default: { execFile: shellBoundary.exec },
}));
import { FileShellHost } from "./fileShellHost";
import { FileTargetPreferences } from "./fileTargetPreferences";
import type { FileTargetPlatform } from "./fileTargets";

const cleanup: string[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  shellBoundary.open.mockResolvedValue("");
  shellBoundary.icon.mockResolvedValue({
    isEmpty: () => false,
    toDataURL: () => "data:image/png;base64,a",
  });
  shellBoundary.exec.mockImplementation((_file, _args, callback) =>
    callback(null),
  );
});
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function setup(platform: FileTargetPlatform = "darwin") {
  const root = await mkdtemp(path.join(os.tmpdir(), "file-targets-"));
  cleanup.push(root);
  const first = path.join(root, "First.app");
  const preferred = path.join(root, "Preferred.app");
  await Promise.all([mkdir(first), mkdir(preferred)]);
  const nativeQuery = vi.fn(async (args: Record<string, unknown>) =>
    args.method === "launchServices.urlHandlers"
      ? {
          applications: [first, preferred, first].map((appPath) => ({
            path: appPath,
            bundleIdentifier: path.basename(appPath),
          })),
        }
      : { path: preferred, bundleIdentifier: "Preferred.app" },
  );
  const host = new FileShellHost({ appDataRoot: root, nativeQuery, platform });
  const file = path.join(root, "source with spaces;$.txt");
  return { host, root, first, preferred, nativeQuery, file };
}

describe("FileShellHost target contract", () => {
  it("uses native file associations, deduplicates by app identity and orders the actual default first", async () => {
    const { host, nativeQuery, first, preferred, file } = await setup();
    const result = await host.getTargets({ path: file, deferEnrichment: true });
    expect(nativeQuery).toHaveBeenCalledWith({
      method: "launchServices.urlHandlers",
      params: { url: pathToFileURL(file).href },
    });
    expect(result.targets.map((target) => target.id)).toEqual([
      `app:${preferred}`,
      `app:${first}`,
      "systemDefault",
      "fileManager",
    ]);
    expect(result.discovery).toBe("ready");
    expect(result.availableTargets).toEqual(
      result.targets.map((target) => target.id),
    );
    expect(shellBoundary.icon).not.toHaveBeenCalled();
  });

  it("keeps system default readiness separate from unavailable native discovery and never invents installed apps", async () => {
    const { host, nativeQuery, file } = await setup();
    nativeQuery.mockRejectedValue(new Error("helper handshake unavailable"));
    const result = await host.getTargets({ path: file });
    expect(result.discovery).toBe("unavailable");
    expect(result.targets.map((entry) => entry.id)).toEqual([
      "systemDefault",
      "fileManager",
    ]);
    expect(
      await host.detectTarget({
        path: file,
        target: "systemDefault",
        appPath: "/Applications/Missing.app",
      }),
    ).toBeNull();
    await expect(
      host.open({
        path: file,
        target: "systemDefault",
        appPath: "/Applications/Missing.app",
      }),
    ).rejects.toThrow("unavailable");
    expect(shellBoundary.exec).not.toHaveBeenCalled();
    expect(shellBoundary.open).not.toHaveBeenCalled();
  });

  it("checks selected app again and launches with the evidenced argument array, without ordinary preference writes", async () => {
    const { host, root, preferred, file } = await setup();
    await host.open({
      path: file,
      target: "systemDefault",
      appPath: preferred,
      openMode: "file",
    });
    expect(shellBoundary.exec).toHaveBeenCalledWith(
      "/usr/bin/open",
      ["-a", preferred, file],
      expect.any(Function),
    );
    await expect(
      stat(path.join(root, "open-in-target-preferences.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await rm(preferred, { recursive: true });
    await expect(
      host.open({ path: file, target: "systemDefault", appPath: preferred }),
    ).rejects.toThrow("unavailable");
    expect(shellBoundary.exec).toHaveBeenCalledTimes(1);
  });

  it("propagates launch failure and never persists a failed choice", async () => {
    const { host, root, file } = await setup();
    shellBoundary.exec.mockImplementation((_file, _args, callback) =>
      callback(new Error("launch failed")),
    );
    await expect(
      host.open({
        path: file,
        target: "systemDefault",
        persistPreferredTargetPath: root,
      }),
    ).rejects.toThrow("launch failed");
    await expect(
      stat(path.join(root, "open-in-target-preferences.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persists global and requested per-path choices in the same Host value; global mutation leaves per-path intact", async () => {
    const { host, root, file, preferred } = await setup();
    await host.open({
      path: file,
      target: "systemDefault",
      appPath: preferred,
      persistPreferredTargetPath: root,
    });
    await host.setGlobalPreferredTarget({ target: "fileManager" });
    const preferences = JSON.parse(
      await readFile(
        path.join(root, "open-in-target-preferences.json"),
        "utf8",
      ),
    );
    expect(preferences).toEqual({
      global: "fileManager",
      perPath: { [root]: `app:${preferred}` },
    });
    expect(
      (await host.getTargets({ path: file, cwd: root })).preferredTarget,
    ).toBe(`app:${preferred}`);
    expect(
      (await host.getTargets({ path: file, cwd: path.dirname(root) }))
        .preferredTarget,
    ).toBe("fileManager");
  });

  it("does not lose concurrent per-path writes", async () => {
    const { root } = await setup();
    const store = new FileTargetPreferences(root);
    await Promise.all([
      store.write("systemDefault", "/one"),
      store.write("fileManager", "/two"),
    ]);
    expect(await store.read()).toEqual({
      global: "fileManager",
      perPath: { "/one": "systemDefault", "/two": "fileManager" },
    });
  });

  it("preserves an available app when icon loading fails", async () => {
    const { host, preferred, file } = await setup();
    shellBoundary.icon.mockRejectedValue(new Error("no icon"));
    expect((await host.getTargets({ path: file })).targets[0]).toMatchObject({
      id: `app:${preferred}`,
      available: true,
      icon: null,
    });
    expect(
      await host.loadTargetIcon({
        path: file,
        target: "systemDefault",
        appPath: preferred,
      }),
    ).toBeNull();
  });

  it("rejects remote, relative, invalid target and app identity before any launch", async () => {
    const { host, file, preferred } = await setup();
    await expect(
      host.getTargets({ path: file, hostId: "remote-host" }),
    ).rejects.toThrow("transport");
    await expect(
      host.open({ path: "relative.txt", target: "systemDefault" }),
    ).rejects.toThrow("绝对路径");
    await expect(
      host.open({ path: file, target: `app:${preferred}` }),
    ).rejects.toThrow("Unsupported");
    await expect(
      host.open({ path: file, target: "fileManager", appPath: preferred }),
    ).rejects.toThrow("Invalid native");
    expect(shellBoundary.exec).not.toHaveBeenCalled();
  });

  it("Windows exposes only evidenced shell entry points and reports association discovery as unsupported", async () => {
    const { host, nativeQuery, root } = await setup("win32");
    const targets = await host.getTargets({ path: root });
    expect(targets.discovery).toBe("unsupported");
    expect(targets.targets.map((entry) => entry.id)).toEqual([
      "systemDefault",
      "fileManager",
    ]);
    expect(nativeQuery).not.toHaveBeenCalled();
    await host.open({ path: root, target: "systemDefault" });
    expect(shellBoundary.open).toHaveBeenCalledWith(root);
    shellBoundary.open.mockResolvedValue("Windows error");
    await expect(
      host.open({ path: root, target: "systemDefault" }),
    ).rejects.toThrow("Windows error");
    expect(shellBoundary.exec).not.toHaveBeenCalled();
  });
});
