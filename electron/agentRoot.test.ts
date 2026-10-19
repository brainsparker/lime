import { describe, expect, it } from "vitest";
import { buildAgentRootArgument, readAgentRootArgument } from "./agentRoot";
import { resolveDesktopStorageRoots } from "./appDataPaths";

describe("Agent root preload metadata", () => {
  it.each([
    [
      "darwin",
      "/Users/test/Library/Application Support/lime",
      "/tmp/目标 #1&草稿",
    ],
    ["win32", "C:\\Users\\test\\AppData\\Roaming\\lime", "D:\\目标 #1&草稿"],
  ])(
    "%s 保持已解析 override，路径字符不会成为额外参数",
    (platform, hostUserData, agentRootOverride) => {
      const roots = resolveDesktopStorageRoots({
        platform,
        hostUserData,
        agentRootOverride,
        e2eMode: false,
        localAppData: "C:\\Users\\test\\AppData\\Local",
      });
      const argument = buildAgentRootArgument(roots.agentRoot);
      expect(readAgentRootArgument(["electron", argument])).toBe(
        agentRootOverride,
      );
    },
  );

  it("E2E 元数据只能指向隔离 App Server 根", () => {
    const roots = resolveDesktopStorageRoots({
      platform: "darwin",
      hostUserData: "/real/profile",
      agentRootOverride: "/real/agent",
      e2eMode: true,
      e2eUserDataDir: "/tmp/e2e profile",
    });
    expect(
      readAgentRootArgument([buildAgentRootArgument(roots.agentRoot)]),
    ).toBe("/tmp/e2e profile/app-server");
  });

  it.each([
    [],
    ["--other=/real/root"],
    ["--agent-root="],
    ["--agent-root=relative"],
    ["--agent-root=%XX"],
    ["--agent-root=%2Ftmp%00bad"],
    ["--agent-root=%2Fone", "--agent-root=%2Ftwo"],
  ])("缺失、相对、畸形或重复元数据 fail closed：%j", (...argv: string[]) => {
    expect(readAgentRootArgument(argv)).toBeUndefined();
  });

  it("Main 拒绝投影相对根", () => {
    expect(() => buildAgentRootArgument("relative")).toThrow("absolute path");
  });
});
