import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

describe("AgentChatWorkspace right surface composition boundary", () => {
  it("文件入口和 Composer 工具复用 current owner，旧组件不得恢复", () => {
    for (const retired of [
      "src/components/agent/chat/components/FileManager/FileManagerSidebar.tsx",
      "src/components/agent/chat/components/Inputbar/components/InputbarTools.tsx",
      "src/components/agent/chat/components/Inputbar/components/inputbarToolsCopy.ts",
      "src/components/agent/chat/hooks/useFileManagerSidebar.ts",
      "src/components/agent/chat/workspace/WorkspaceFileManagerSidebarRuntime.tsx",
    ])
      expect(existsSync(join(process.cwd(), retired))).toBe(false);
    for (const owner of [
      "WorkspaceShellScene.tsx",
      "useAgentChatWorkspaceEntryRuntime.ts",
      "useAgentChatWorkspaceSceneRuntime.tsx",
      "agentChatWorkspaceHelpers.ts",
    ]) {
      const source = readFileSync(
        join(process.cwd(), "src/components/agent/chat/workspace", owner),
        "utf8",
      );
      expect(source).not.toMatch(
        /fileManager(?:Node|Sidebar|Open)|useFileManagerSidebar|lime\.file-manager\.sidebar-open/,
      );
    }
  });

  it("Article Editor、coordinator、host 和 chrome 必须由 composition runtime 组合", () => {
    const workspaceSource = [
      "src/components/agent/chat/useAgentChatWorkspaceRuntime.tsx",
      "src/components/agent/chat/workspace/useAgentChatWorkspaceEntryRuntime.ts",
      "src/components/agent/chat/workspace/useAgentChatWorkspaceSetupRuntime.ts",
      "src/components/agent/chat/workspace/useAgentChatWorkspaceCommandRuntime.ts",
      "src/components/agent/chat/workspace/useAgentChatWorkspaceSceneRuntime.tsx",
    ]
      .map((ownerPath) => readFileSync(join(process.cwd(), ownerPath), "utf8"))
      .join("\n");
    const ownerSource = readFileSync(
      join(
        process.cwd(),
        "src/components/agent/chat/workspace/useWorkspaceRightSurfaceCompositionRuntime.ts",
      ),
      "utf8",
    );
    const sceneCompositionSource = readFileSync(
      join(
        process.cwd(),
        "src/components/agent/chat/workspace/useAgentChatWorkspaceSceneComposition.tsx",
      ),
      "utf8",
    );

    expect(workspaceSource).toContain(
      "useAgentChatWorkspaceSceneComposition({",
    );
    expect(workspaceSource).not.toContain(
      "useWorkspaceRightSurfaceCompositionRuntime({",
    );
    expect(sceneCompositionSource).toContain(
      "useWorkspaceRightSurfaceCompositionRuntime({",
    );
    expect(sceneCompositionSource).toContain(
      "useWorkspaceRightSurfaceExpertPanelRuntime(expertPanel)",
    );
    expect(sceneCompositionSource).toContain(
      "useWorkspaceBackgroundSessionRuntime(backgroundSession)",
    );
    expect(sceneCompositionSource).not.toContain(
      "WorkspaceFileManagerSidebarRuntime",
    );
    expect(sceneCompositionSource).toContain("<WorkspaceShellScene");
    expect(sceneCompositionSource.split("\n").length).toBeLessThan(180);
    expect(ownerSource.split("\n").length).toBeLessThan(160);
    for (const retiredWorkspaceRightSurfaceGlue of [
      "useWorkspaceArticleEditorImageSlotRuntime(",
      "useWorkspaceArticleEditorRightSurfaceRuntime(",
      "useWorkspaceRightSurfaceCoordinatorRuntime(",
      "useWorkspaceRightSurfaceHostRuntime(",
      "buildWorkspaceConversationRightSurfaceChrome(",
    ]) {
      expect(workspaceSource).not.toContain(retiredWorkspaceRightSurfaceGlue);
      expect(ownerSource).toContain(retiredWorkspaceRightSurfaceGlue);
    }
  });
});
