import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const INPUT_RESTORE_UI_OWNER_FILES = new Set([
  "src/components/agent/chat/components/EmptyState.tsx",
  "src/components/agent/chat/components/Inputbar/hooks/useInputbarController.ts",
]);

const INPUT_RESTORE_CONTROLLER_OWNER =
  "src/components/agent/chat/hooks/composerDraftRestore.ts";

const INPUT_RESTORE_REQUEST_PRODUCTION_FILES = new Set([
  "src/components/agent/chat/useAgentChatWorkspaceRuntime.tsx",
  "src/components/agent/chat/workspace/useAgentChatWorkspaceEntryRuntime.ts",
  "src/components/agent/chat/workspace/useAgentChatWorkspaceSceneRuntime.tsx",
  "src/components/agent/chat/components/EmptyState.tsx",
  "src/components/agent/chat/components/EmptyState.types.ts",
  "src/components/agent/chat/components/Inputbar/hooks/useInputbarController.ts",
  "src/components/agent/chat/components/Inputbar/index.tsx",
  "src/components/agent/chat/hooks/agentChatShared.ts",
  "src/components/agent/chat/hooks/agentStreamFlowControl.ts",
  "src/components/agent/chat/hooks/agentStreamInputRestoreTypes.ts",
  INPUT_RESTORE_CONTROLLER_OWNER,
  "src/components/agent/chat/hooks/index.ts",
  "src/components/agent/chat/hooks/useAgentStream.ts",
  "src/components/agent/chat/workspace/WorkspaceConversationScene.tsx",
  "src/components/agent/chat/workspace/chatSurfaceProps.ts",
  "src/components/agent/chat/workspace/useAgentChatWorkspaceLocalDisplayState.ts",
  "src/components/agent/chat/workspace/useWorkspaceConversationLandingSurfaceRuntime.tsx",
  "src/components/agent/chat/workspace/useWorkspaceConversationSceneRuntime.tsx",
  "src/components/agent/chat/workspace/useWorkspaceInputbarSceneRuntime.tsx",
]);

function readProductionAgentChatSources() {
  const root = join(process.cwd(), "src/components/agent/chat");
  const files: Array<{ relativePath: string; source: string }> = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) {
        continue;
      }
      if (entry.name.includes(".test.") || entry.name.includes(".unit.test.")) {
        continue;
      }
      const relativePath = relative(process.cwd(), absolutePath);
      files.push({
        relativePath,
        source: readFileSync(absolutePath, "utf8"),
      });
    }
  };
  visit(root);
  return files;
}

describe("AgentChatWorkspace input restore boundary", () => {
  it("local-display owner 只转发恢复请求，不执行 text/path-only fallback", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/components/agent/chat/workspace/useAgentChatWorkspaceLocalDisplayState.ts",
      ),
      "utf8",
    );
    const handlerStart = source.indexOf("const handleRestoreInterruptedInput");
    const handlerEnd = source.indexOf(
      "const handleInputRestoreRequestHandled",
      handlerStart,
    );
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);

    const handlerSource = source.slice(handlerStart, handlerEnd);
    expect(handlerSource).toContain("setInputRestoreRequest(request)");
    expect(handlerSource).not.toContain("setInput(request.draft.text)");
    expect(handlerSource).not.toContain("handleClearPathReferences()");
    expect(handlerSource).not.toContain("handleAddPathReferences");
    expect(handlerSource).not.toContain("replacePendingImages");
    expect(handlerSource).not.toContain("setActiveCapability");
  });

  it("两个 UI owner 委托同一恢复 helper，Controller 草稿不能绕过该 owner 写入", () => {
    const sources = readProductionAgentChatSources();
    const consumers = sources
      .filter(({ source }) => /\brestoreComposerDraft\(/.test(source))
      .map(({ relativePath }) => relativePath)
      .filter((relativePath) => relativePath !== INPUT_RESTORE_CONTROLLER_OWNER);
    expect(consumers.sort()).toEqual([...INPUT_RESTORE_UI_OWNER_FILES].sort());

    const directWriters = sources
      .filter(({ source }) => /\.restoreDraft\(/.test(source))
      .map(({ relativePath }) => relativePath);
    expect(directWriters).toEqual([INPUT_RESTORE_CONTROLLER_OWNER]);
  });

  it("inputRestoreRequest 只能停留在 source / pass-through / current UI owner 清单内", () => {
    const offenders = readProductionAgentChatSources()
      .filter(
        ({ source }) =>
          source.includes("inputRestoreRequest") ||
          source.includes("InterruptedInputRestoreRequest"),
      )
      .map(({ relativePath }) => relativePath)
      .filter(
        (relativePath) =>
          !INPUT_RESTORE_REQUEST_PRODUCTION_FILES.has(relativePath),
      );

    expect(offenders).toEqual([]);
  });
});
