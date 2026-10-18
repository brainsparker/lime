import { beforeEach, expect, it, vi } from "vitest";
import { safeInvoke } from "@/lib/dev-bridge";
import { AppServerClient, AppServerRequestAbortedError } from "./appServer";
import { readPluginSkill } from "./pluginCatalog";
import { AppServerClient as RequestClient } from "@limecloud/app-server-client";

vi.mock("@/lib/dev-bridge", () => ({ safeInvoke: vi.fn() }));
const params = {
  remoteMarketplaceName: "workspace-directory",
  remotePluginId: "opaque~1",
  skillName: "research",
};
beforeEach(() => vi.mocked(safeInvoke).mockReset());

it("package与renderer facade都序列化同一技能RPC，保留nullable正文", async () => {
  const request = new RequestClient({ initialRequestId: 7 }).readPluginSkill(
    params,
  );
  expect(request).toEqual({ id: 7, method: "plugin/skill/read", params });
  vi.mocked(safeInvoke).mockResolvedValueOnce({
    lines: [JSON.stringify({ id: 7, result: { contents: null } })],
  });
  expect(
    await readPluginSkill(
      params,
      undefined,
      new AppServerClient({ initialRequestId: 7 }),
    ),
  ).toEqual({ contents: null });
  expect(safeInvoke).toHaveBeenCalledWith("app_server_handle_json_lines", {
    request: { lines: [`${JSON.stringify(request)}\n`] },
  });
});

it("关闭时发cancelRequest并忽略迟到bridge正文", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(safeInvoke).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  vi.mocked(safeInvoke).mockResolvedValue({ lines: [] });
  const controller = new AbortController();
  const pending = readPluginSkill(
    params,
    { signal: controller.signal },
    new AppServerClient({ initialRequestId: 9 }),
  );
  controller.abort("closed");
  await expect(pending).rejects.toBeInstanceOf(AppServerRequestAbortedError);
  const requests = vi
    .mocked(safeInvoke)
    .mock.calls.flatMap(([, args]) =>
      (args as { request: { lines: string[] } }).request.lines.map((line) =>
        JSON.parse(line),
      ),
    );
  expect(requests).toContainEqual({
    method: "$/cancelRequest",
    params: { id: 9 },
  });
  resolve({
    lines: [JSON.stringify({ id: 9, result: { contents: "stale" } })],
  });
  await expect(pending).rejects.toMatchObject({
    method: "plugin/skill/read",
    requestId: 9,
  });
});
