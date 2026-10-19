import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenInTarget, OpenInTargets } from "./api/openInTypes";
const boundary = vi.hoisted(() => ({
  get: vi.fn(),
  detect: vi.fn(),
  icon: vi.fn(),
  open: vi.fn(),
  global: vi.fn(),
}));
vi.mock("./api/openIn", () => ({
  openIn: {
    getTargets: boundary.get,
    detectTarget: boundary.detect,
    loadTargetIcon: boundary.icon,
    open: boundary.open,
    setGlobalPreferredTarget: boundary.global,
  },
}));
import {
  openInQueryClient,
  openInTargetsQueryOptions,
  openTarget,
  prefetchOpenInTargets,
  selectTargetApps,
  setGlobalPreferredTarget,
} from "./openInTargets";
const first: OpenInTarget = {
  id: "app:/Applications/One.app",
  target: "systemDefault",
  kind: "native",
  label: "One",
  appPath: "/Applications/One.app",
  available: true,
  icon: null,
};
const second: OpenInTarget = {
  ...first,
  id: "app:/Applications/Two.app",
  label: "Two",
  appPath: "/Applications/Two.app",
};
const builtin: OpenInTarget = {
  id: "systemDefault",
  target: "systemDefault",
  kind: "builtin",
  label: "Default",
  available: true,
  icon: null,
};
const metadata = (): OpenInTargets => ({
  targets: [first, second, builtin],
  availableTargets: [first.id, second.id, builtin.id],
  preferredTarget: second.id,
  mode: "native",
  discovery: "ready",
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks();
  openInQueryClient.clear();
  boundary.get.mockResolvedValue(metadata());
  boundary.detect.mockImplementation(
    async (params) =>
      metadata().targets.find(
        (target) =>
          target.target === params.target && target.appPath === params.appPath,
      ) ?? null,
  );
  boundary.icon.mockResolvedValue("data:image/png;base64,a");
  boundary.open.mockResolvedValue(undefined);
  boundary.global.mockResolvedValue(undefined);
});
afterEach(() => openInQueryClient.clear());
describe("shared open-in query", () => {
  it("prefetch and consumers share the same one-minute key, with host/path/defer isolation", async () => {
    const params = { cwd: "/work", path: "/work/a", hostId: "local" };
    await prefetchOpenInTargets(params);
    await openInQueryClient.fetchQuery(openInTargetsQueryOptions(params));
    expect(boundary.get).toHaveBeenCalledTimes(1);
    expect(openInTargetsQueryOptions(params).staleTime).toBe(60_000);
    const keys = [
      params,
      { ...params, hostId: "remote" },
      { ...params, path: "/work/b" },
      { ...params, deferEnrichment: false },
    ].map((value) => JSON.stringify(openInTargetsQueryOptions(value).queryKey));
    expect(new Set(keys).size).toBe(4);
  });
  it("detect failure removes readiness; icon failure preserves availability; selectors reject an unavailable preference", async () => {
    boundary.detect.mockImplementation(async (params) => {
      if (params.appPath === second.appPath) throw new Error("uninstalled");
      return params.appPath ? first : builtin;
    });
    boundary.icon.mockRejectedValue(new Error("icon missing"));
    const result = await openInQueryClient.fetchQuery(
      openInTargetsQueryOptions({ path: "/work/a" }),
    );
    expect(result.targets[0]).toMatchObject({ available: true, icon: null });
    expect(result.targets[1]).toMatchObject({ available: false, icon: null });
    expect(result.availableTargets).toEqual([first.id, builtin.id]);
    expect(
      boundary.icon.mock.calls.map(([params]) => params.appPath),
    ).not.toContain(second.appPath);
    expect(selectTargetApps(result)).toEqual({
      primaryTarget: result.targets[0],
      visibleTargets: [result.targets[0]],
    });
  });
  it("an aborted enrichment cannot republish late availability or icons", async () => {
    const late = deferred<OpenInTarget>();
    boundary.get.mockResolvedValue({
      ...metadata(),
      targets: [first],
      availableTargets: [first.id],
    });
    boundary.detect.mockReturnValue(late.promise);
    const options = openInTargetsQueryOptions({ path: "/work/a" });
    const request = openInQueryClient.fetchQuery(options).catch(() => null);
    await vi.waitFor(() => expect(boundary.detect).toHaveBeenCalledTimes(1));
    await openInQueryClient.cancelQueries({ queryKey: options.queryKey });
    late.resolve(first);
    await request;
    await Promise.resolve();
    expect(openInQueryClient.getQueryData(options.queryKey)).toBeUndefined();
    expect(boundary.icon).not.toHaveBeenCalled();
  });
  it("ordinary open sends no preference; explicit persistence rolls back on failure", async () => {
    const options = openInTargetsQueryOptions({
      cwd: "/work",
      path: "/work/a",
    });
    const initial = metadata();
    openInQueryClient.setQueryData(options.queryKey, initial);
    await openTarget({
      cwd: "/work",
      path: "/work/a",
      target: "systemDefault",
      appPath: first.appPath,
    });
    expect(boundary.open.mock.calls[0][0]).not.toHaveProperty(
      "persistPreferredTargetPath",
    );
    expect(openInQueryClient.getQueryData(options.queryKey)).toEqual(initial);
    boundary.open.mockRejectedValue(new Error("launch failed"));
    await expect(
      openTarget({
        cwd: "/work",
        path: "/work/a",
        target: "systemDefault",
        appPath: first.appPath,
        persistPreferredTargetPath: "/work",
      }),
    ).rejects.toThrow("launch failed");
    expect(openInQueryClient.getQueryData(options.queryKey)).toEqual(initial);
  });
  it("global preference mutation invalidates every target projection", async () => {
    const options = openInTargetsQueryOptions({ cwd: null, path: "/work/a" });
    openInQueryClient.setQueryData(options.queryKey, metadata());
    await setGlobalPreferredTarget({ target: "fileManager" });
    expect(boundary.global).toHaveBeenCalledWith({ target: "fileManager" });
    expect(
      openInQueryClient.getQueryData(options.queryKey)?.preferredTarget,
    ).toBe("fileManager");
    expect(
      openInQueryClient.getQueryState(options.queryKey)?.isInvalidated,
    ).toBe(true);
  });
});
