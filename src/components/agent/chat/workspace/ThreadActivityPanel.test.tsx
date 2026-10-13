import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadActivityPanel } from "./ThreadActivityPanel";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

describe("ThreadActivityPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  function renderPanel(props: React.ComponentProps<typeof ThreadActivityPanel>) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ThreadActivityPanel {...props} />));
  }

  it("把 canonical 子线程、MCP 和 skill inventory 汇总到同一面板", () => {
    renderPanel({
        canonicalChildren: [
          {
            name: "reviewer",
            parentThreadId: "parent",
            sessionId: "session-child",
            status: "running",
            threadId: "child-thread",
            updatedAtMs: 1,
          },
        ],
        threadItems: [
          {
            id: "activity-1",
            thread_id: "parent",
            turn_id: "turn-1",
            type: "subagent_activity",
            status: "in_progress",
            status_label: "running",
            title: "reviewer",
            updated_at: "2026-08-30T00:00:00Z",
          },
        ],
        toolInventory: {
          request: { caller: "agent", surface: { workbench: true } },
          agent_initialized: true,
          warnings: [],
          mcp_servers: ["docs"],
          default_allowed_tools: [],
          counts: {
            catalog_total: 1,
            catalog_current_total: 1,
            catalog_compat_total: 0,
            catalog_deprecated_total: 0,
            default_allowed_total: 1,
            native_total: 0,
            native_visible_total: 0,
            native_catalog_unmapped_total: 0,
            extension_surface_total: 0,
            extension_mcp_bridge_total: 0,
            extension_runtime_total: 0,
            extension_tool_total: 0,
            extension_tool_visible_total: 0,
            mcp_server_total: 1,
            mcp_tool_total: 2,
            mcp_tool_visible_total: 2,
          },
          catalog_tools: [
            {
              name: "skill_review",
              profiles: ["core"],
              capabilities: ["skill_execution"],
              lifecycle: "current",
              source: "agent_builtin",
              permission_plane: "session_allowlist",
              workspace_default_allow: true,
              execution_warning_policy: "none",
              execution_warning_policy_source: "default",
              execution_restriction_profile: "none",
              execution_restriction_profile_source: "default",
              execution_sandbox_profile: "none",
              execution_sandbox_profile_source: "default",
            },
          ],
          native_tools: [],
          extension_surfaces: [],
          extension_tools: [],
          mcp_tools: [],
        },
    });

    expect(container.querySelector('[data-testid="thread-activity-panel"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="thread-activity-subagent"]')).toHaveLength(1);
    expect(container.textContent).toContain("docs");
    expect(container.textContent).toContain("skill_review");
  });

  it("同一线程的命令和补丁出现在活动面", () => {
    renderPanel({
      canonicalChildren: [
        {
          name: "reviewer",
          parentThreadId: "parent",
          sessionId: null,
          status: "running",
          taskSummary: "检查补丁",
          threadId: "child-1",
          updatedAtMs: 1,
        },
      ],
      threadItems: [
        {
          id: "cmd-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "command_execution",
          command: "npm test",
          cwd: "/workspace/lime",
          updated_at: "2026-10-12T00:00:00Z",
        },
        {
          id: "patch-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "patch",
          text: "",
          paths: ["src/app.ts"],
          updated_at: "2026-10-12T00:00:00Z",
        },
      ],
    });

    const changes = Array.from(
      container.querySelectorAll('[data-testid="thread-activity-change"]'),
    ).map((node) => node.textContent);
    expect(changes).toEqual(["npm test", "src/app.ts"]);
    expect(container.textContent).toContain("检查补丁");
  });

  it("同一线程的警告消息出现在活动面", () => {
    renderPanel({
      threadItems: [
        {
          id: "warning-blank",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "warning",
          message: "   ",
          updated_at: "2026-10-12T00:00:00Z",
        },
        {
          id: "warning-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "warning",
          code: "context_truncated",
          message: "上下文已截断",
          updated_at: "2026-10-12T00:00:00Z",
        },
      ],
    });

    const warnings = Array.from(
      container.querySelectorAll('[data-testid="thread-activity-warning"]'),
    ).map((node) => node.textContent);
    expect(warnings).toEqual(["context_truncated上下文已截断"]);
    expect(
      container.querySelector('[data-testid="thread-activity-empty"]'),
    ).toBeNull();
  });

  it("同一线程的上下文压缩出现在活动面", () => {
    renderPanel({
      threadItems: [
        {
          id: "compaction-blank",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "context_compaction",
          stage: "   ",
          trigger: " ",
          detail: " ",
          updated_at: "2026-10-13T00:00:00Z",
        },
        {
          id: "compaction-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "context_compaction",
          stage: "completed",
          trigger: "manual",
          detail: "已压成摘要",
          updated_at: "2026-10-13T00:00:00Z",
        },
      ],
    });

    const compactions = Array.from(
      container.querySelectorAll('[data-testid="thread-activity-compaction"]'),
    );
    expect(compactions).toHaveLength(1);
    expect(compactions[0]?.textContent).toContain("已压成摘要");
    expect(container.textContent).toContain(
      "agentChat.activityPanel.compactions",
    );
    expect(
      container.querySelector('[data-testid="thread-activity-empty"]'),
    ).toBeNull();
  });

  it("同一线程的自动钩子复用时间线文案", () => {
    renderPanel({
      threadItems: [
        {
          id: "hook-prompt-blank",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "hook_prompt",
          fragments: [{ hook_run_id: "run-0", text: "  " }],
          status: "completed",
          started_at: "2026-10-13T00:00:00Z",
          updated_at: "2026-10-13T00:00:00Z",
        },
        {
          id: "hook-running",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "hook",
          run_id: "run-1",
          status: "in_progress",
          status_message: "正在检查",
          started_at: "2026-10-13T00:00:00Z",
          updated_at: "2026-10-13T00:00:00Z",
        },
        {
          id: "hook-failed",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "hook",
          run_id: "run-2",
          status: "failed",
          output: "钩子输出",
          started_at: "2026-10-13T00:00:00Z",
          updated_at: "2026-10-13T00:00:00Z",
        },
        {
          id: "hook-prompt-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "hook_prompt",
          fragments: [{ hook_run_id: "run-3", text: "补充说明" }],
          status: "completed",
          started_at: "2026-10-13T00:00:00Z",
          updated_at: "2026-10-13T00:00:00Z",
        },
      ],
    });

    const hooks = Array.from(
      container.querySelectorAll('[data-testid="thread-activity-hook"]'),
    ).map((node) => node.textContent);
    expect(hooks).toEqual([
      "agentChat.threadTimeline.hook.running正在检查",
      "agentChat.threadTimeline.hook.failed钩子输出",
      "agentChat.threadTimeline.hookPrompt.title补充说明",
    ]);
    expect(container.textContent).toContain("agentChat.activityPanel.hooks");
    expect(
      container.querySelector('[data-testid="thread-activity-empty"]'),
    ).toBeNull();
  });

  it("同一线程的错误消息出现在活动面", () => {
    renderPanel({
      threadItems: [
        {
          id: "error-blank",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "error",
          message: " ",
          updated_at: "2026-10-12T00:00:00Z",
        },
        {
          id: "error-1",
          thread_id: "parent",
          turn_id: "turn-1",
          type: "error",
          message: "工具执行失败",
          updated_at: "2026-10-12T00:00:00Z",
        },
      ],
    });

    expect(
      container.querySelector('[data-testid="thread-activity-error"]')
        ?.textContent,
    ).toBe("工具执行失败");
    expect(
      container.querySelector('[data-testid="thread-activity-empty"]'),
    ).toBeNull();
  });

  it("无活动时提供稳定空态", () => {
    renderPanel({});
    expect(container.querySelector('[data-testid="thread-activity-empty"]')).not.toBeNull();
  });
});
