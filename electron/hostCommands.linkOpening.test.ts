// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { ElectronHostCommands } from "./hostCommands";
import type { ElectronAppServerHost } from "./appServerHost";

const { query, request } = vi.hoisted(() => ({
  query: vi.fn(() => false),
  request: vi.fn(),
}));

vi.mock("./electronRuntime", () => ({
  app: { isDefaultProtocolClient: query },
}));

afterEach(() => vi.clearAllMocks());

it.each([true, false])(
  "默认浏览器 IPC 委托真实系统 owner 并保持启动身份 %s",
  async (value) => {
    query.mockReturnValueOnce(value);
    const host = new ElectronHostCommands(
      { request } as unknown as ElectronAppServerHost,
      "/tmp/link-opening-user-data",
      () => undefined,
      "/tmp/link-opening-app-data",
    );
    try {
      await expect(host.invoke("is_default_browser")).resolves.toBe(value);
      await expect(host.invoke("is_default_browser")).resolves.toBe(value);
      expect(query).toHaveBeenCalledExactlyOnceWith("https");
      expect(request).not.toHaveBeenCalled();
    } finally {
      host.dispose();
    }
  },
);
