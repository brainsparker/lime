import { describe, expect, it, vi } from "vitest";
import type { AgentRuntimeFileCheckpointThreadSummary } from "@/lib/api/agentRuntime/sessionTypes";
import { projectCodingWorkbenchViewFromEvents } from "@limecloud/agent-runtime-projection";
import {
  buildCanvasWorkbenchChangeViewFromCodingProjection,
  buildQuotedReplyText,
  buildSessionRuntimeCountersFromCodingProjection,
  buildSessionRuntimeProjectionIdentity,
  buildSessionRuntimeProjectionState,
  resolveNextSessionRuntimeProjectionState,
  resolveSessionRuntimeProjectionStatus,
  shouldConsiderSessionRuntimeProjectionDeferral,
} from "./workspaceConversationSceneViewModel";

function createCheckpointSummary(
  overrides: Partial<AgentRuntimeFileCheckpointThreadSummary> = {},
): AgentRuntimeFileCheckpointThreadSummary {
  return {
    count: 1,
    latest_checkpoint: {
      path: "src/App.tsx",
      snapshot_path: ".lime/checkpoints/app-v4.tsx",
      version_no: 4,
    },
    ...overrides,
  } as AgentRuntimeFileCheckpointThreadSummary;
}

describe("workspaceConversationSceneViewModel", () => {
  it("应构造引用回复文本，并保留已有输入", () => {
    expect(
      buildQuotedReplyText({ content: "  第一行\n第二行  ", input: "" }),
    ).toBe("> 第一行\n> 第二行\n\n");
    expect(buildQuotedReplyText({ content: "继续", input: "已有内容\n" })).toBe(
      "已有内容\n\n> 继续\n\n",
    );
    expect(
      buildQuotedReplyText({ content: "   ", input: "已有内容" }),
    ).toBeNull();
  });

  it("应从 canonical 投影派生运行状态与文件计数", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        active_command_id: "command-active",
        commands: [
          {
            command_id: "command-active",
            status: "running",
            command: "npm test",
            output_preview: "running tests",
          },
        ],
        tests: [
          {
            test_run_id: "test-current",
            status: "failed",
            command_id: "command-active",
            suite: "unit",
            passed: 3,
            failed: 1,
          },
        ],
        pending_requests: [
          {
            id: "action-approve-command",
            turn_id: "turn-1",
            request_type: "approval",
            status: "pending",
            title: "确认执行命令",
          },
        ],
        artifacts: [
          {
            artifactRef: "artifact-src-app",
            eventId: "evt-file-app",
            sequence: 1,
            turnId: "turn-1",
            path: "src/App.tsx",
            title: "App.tsx",
            kind: "code_file",
            status: "completed",
          },
        ],
      },
    });
    const counters = buildSessionRuntimeCountersFromCodingProjection({
      codingView,
      fileCheckpointSummary: createCheckpointSummary({ count: 1 }),
      pendingActionCount: 1,
    });
    expect(counters).toMatchObject({
      shouldUseRuntimeWorkbench: true,
      shouldExposeSessionProgress: true,
      inProgressItemCount: 1,
      generatedFileCount: 1,
      hasRuntimeFileChanges: true,
      hasRuntimeOutputs: true,
    });
  });

  it("应通过标准 coding projection 派生工作台 change view", () => {
    const onOpenFile = vi.fn();
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        artifacts: [
          {
            artifactRef: "artifact-src-app",
            eventId: "evt-file-app",
            sequence: 1,
            turnId: "turn-1",
            path: "src/App.tsx",
            title: "App.tsx",
            kind: "code_file",
            status: "completed",
            metadata: {
              previewText: "更新 App",
              checkpointRef: "checkpoint-app",
              diffRef: "artifact://diff/app",
            },
          },
        ],
      },
    });
    const changeView = buildCanvasWorkbenchChangeViewFromCodingProjection({
      codingView,
      fileCheckpointSummary: createCheckpointSummary(),
      onOpenFile,
    });

    expect(codingView.changes).toHaveLength(1);
    expect(changeView).toMatchObject({
      checkpointCount: 1,
      items: [
        {
          id: "evt-file-app",
          path: "src/App.tsx",
          displayName: "App.tsx",
          source: "runtime",
          status: "completed",
          preview: "更新 App",
          checkpointPath: "checkpoint-app",
        },
      ],
    });
    expect(changeView?.onOpenFile).toBe(onOpenFile);
  });

  it("应保留 canonical Turn 的空 diff，表示精确 net-zero", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
      },
    });
    const changeView = buildCanvasWorkbenchChangeViewFromCodingProjection({
      codingView,
      turnDiff: "",
    });

    expect(changeView).toEqual(
      expect.objectContaining({
        items: [],
        turnDiff: "",
      }),
    );
  });

  it("应直接投影 canonical fileChange，并保留 move 目标路径", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        thread_items: [
          {
            id: "file-change-1",
            type: "fileChange",
            status: "completed",
            changes: [
              {
                path: "src/added.ts",
                kind: { type: "add" },
                diff: "+export const added = true;",
              },
              {
                path: "src/deleted.ts",
                kind: { type: "delete" },
                diff: "-export const deleted = true;",
              },
              {
                path: "src/coding-target.ts",
                kind: { type: "update" },
                diff: "+export const codingWorkbenchSmoke = true;",
              },
              {
                path: "src/source.ts",
                kind: { type: "update", move_path: "src/destination.ts" },
                diff: "+export const destination = true;",
              },
            ],
          },
        ],
      },
    });
    const changeView = buildCanvasWorkbenchChangeViewFromCodingProjection({
      codingView,
    });

    expect(codingView.changes).toMatchObject([
      { path: "src/added.ts", changeKind: "add" },
      { path: "src/deleted.ts", changeKind: "delete" },
      { path: "src/coding-target.ts", changeKind: "update" },
      {
        path: "src/source.ts",
        destinationPath: "src/destination.ts",
        changeKind: "renamed",
      },
    ]);
    expect(changeView?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src/source.ts",
          displayName: "source.ts -> destination.ts",
          destinationPath: "src/destination.ts",
        }),
      ]),
    );
  });

  it("空变更仍保留 canonical thread identity 和既有文件动作", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: { thread_id: "thread-empty" },
    });
    const onOpenFile = vi.fn();
    expect(
      buildCanvasWorkbenchChangeViewFromCodingProjection({
        codingView,
        reviewThreadId: "thread-empty",
        onOpenFile,
      }),
    ).toMatchObject({ reviewThreadId: "thread-empty", items: [], onOpenFile });
  });

  it("完整 patch 不受 preview 截断影响，保留 hunk 行号和删除语义", () => {
    const diff = [
      "@@ -40,2 +40,2 @@",
      " context",
      "-old",
      `+${"x".repeat(400)}`,
    ].join("\n");
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        thread_items: [
          {
            id: "patch",
            type: "fileChange",
            status: "completed",
            changes: [{ path: "src/app.ts", kind: { type: "update" }, diff }],
          },
        ],
      },
    });
    const view = buildCanvasWorkbenchChangeViewFromCodingProjection({
      codingView,
      reviewThreadId: "thread-1",
    });
    expect(codingView.changes[0].preview!.length).toBeLessThan(diff.length);
    expect(view?.items[0].diffLines).toMatchObject([
      {
        type: "context",
        value: "context",
        oldLineNumber: 40,
        newLineNumber: 40,
      },
      { type: "remove", value: "old", oldLineNumber: 41 },
      { type: "add", value: "x".repeat(400), newLineNumber: 41 },
    ]);
    expect(view?.items[0].currentContent).toBeUndefined();
  });

  it("应从 current thread read model 合并 coding command/test/action 状态", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        active_command_id: "command-active",
        active_test_run_id: "test-active",
        commands: [
          {
            command_id: "command-active",
            status: "running",
            command: "npm test",
            cwd: "app",
            output_refs: ["output://command-active"],
            output_preview: "running tests",
          },
        ],
        tests: [
          {
            test_run_id: "test-active",
            status: "running",
            command_id: "command-active",
            suite: "unit",
            passed: 3,
            failed: 0,
          },
        ],
        pending_requests: [
          {
            id: "action-approve-command",
            turn_id: "turn-1",
            request_type: "approval",
            status: "pending",
            title: "确认执行命令",
          },
        ],
      },
    });

    expect(codingView.mainObject.id).toBe("turn-1");
    expect(codingView.mainObject.activeCommandId).toBe("command-active");
    expect(codingView.mainObject.activeTestRunId).toBe("test-active");
    expect(codingView.commands).toMatchObject([
      {
        commandId: "command-active",
        status: "running",
        command: "npm test",
        cwd: "app",
        preview: "running tests",
      },
    ]);
    expect(codingView.tests).toMatchObject([
      {
        testRunId: "test-active",
        status: "running",
        commandId: "command-active",
        suite: "unit",
        passed: 3,
      },
    ]);
    expect(codingView.actions[0]?.actionId).toBe("action-approve-command");
    expect(codingView.ui.preferredTab).toBe("summary");
  });

  it("应从 current coding projection 计算 workbench 输出和进度计数", () => {
    const codingView = projectCodingWorkbenchViewFromEvents({
      executionEvents: [],
      codingReadModel: {
        thread_id: "thread-1",
        active_turn_id: "turn-1",
        active_command_id: "command-active",
        active_test_run_id: "test-active",
        commands: [
          {
            command_id: "command-active",
            status: "running",
            command: "npm test",
            cwd: "app",
            output_preview: "running tests",
          },
        ],
        tests: [
          {
            test_run_id: "test-active",
            status: "failed",
            command_id: "command-active",
            suite: "unit",
            passed: 3,
            failed: 1,
          },
        ],
        pending_requests: [
          {
            id: "action-approve-command",
            turn_id: "turn-1",
            request_type: "approval",
            status: "pending",
            title: "确认执行命令",
          },
        ],
      },
    });

    expect(
      buildSessionRuntimeCountersFromCodingProjection({
        codingView,
        fileCheckpointSummary: null,
        pendingActionCount: 1,
      }),
    ).toEqual({
      inProgressItemCount: 1,
      generatedFileCount: 0,
      hasRuntimeFileChanges: false,
      hasRuntimeOutputs: true,
      shouldUseRuntimeWorkbench: true,
      shouldExposeSessionProgress: true,
    });
  });

  it("projection state 未变化时应复用当前对象", () => {
    const current = buildSessionRuntimeProjectionState({
      key: "session-1:ready",
      sessionId: "session-1",
      firstMessageId: "message-1",
      lastMessageId: "message-9",
      ready: true,
    });
    const same = buildSessionRuntimeProjectionState({ ...current });
    const changed = buildSessionRuntimeProjectionState({
      ...current,
      lastMessageId: "message-10",
    });

    expect(resolveNextSessionRuntimeProjectionState(current, same)).toBe(
      current,
    );
    expect(resolveNextSessionRuntimeProjectionState(current, changed)).toBe(
      changed,
    );
  });

  it("应构造 session runtime projection identity", () => {
    const identity = buildSessionRuntimeProjectionIdentity({
      sessionId: "session-1",
      messages: [{ id: "message-1" }, { id: "message-2" }],
      turns: [{ id: "turn-1" }],
      threadItems: [{ id: "item-1" }, { id: "item-2" }],
    });

    expect(identity).toEqual({
      key: "session-1|message-1|message-2|turn-1|item-2",
      sessionId: "session-1",
      firstMessageId: "message-1",
      lastMessageId: "message-2",
      lastTurnId: "turn-1",
      lastItemId: "item-2",
    });
  });

  it("应只在恢复重载窗口且无活跃交互时考虑延迟 projection", () => {
    expect(
      shouldConsiderSessionRuntimeProjectionDeferral({
        isRestoringSession: true,
        isSending: false,
        focusedTimelineItemId: null,
        pendingA2UIForm: null,
        messageCount: 20,
        turnCount: 0,
        threadItemCount: 0,
        messageThreshold: 20,
        turnThreshold: 6,
        threadItemThreshold: 24,
      }),
    ).toBe(true);
    expect(
      shouldConsiderSessionRuntimeProjectionDeferral({
        isRestoringSession: true,
        isSending: true,
        focusedTimelineItemId: null,
        pendingA2UIForm: null,
        messageCount: 20,
        turnCount: 0,
        threadItemCount: 0,
        messageThreshold: 20,
        turnThreshold: 6,
        threadItemThreshold: 24,
      }),
    ).toBe(false);
  });

  it("应保留 append-only 消息更新的即时 projection 快路径", () => {
    const current = buildSessionRuntimeProjectionState({
      key: "session-1|message-1|message-2|turn-1|item-1",
      sessionId: "session-1",
      firstMessageId: "message-1",
      lastMessageId: "message-2",
      ready: true,
    });
    const identity = buildSessionRuntimeProjectionIdentity({
      sessionId: "session-1",
      messages: [{ id: "message-1" }, { id: "message-3" }],
      turns: [{ id: "turn-1" }],
      threadItems: [{ id: "item-1" }],
    });

    expect(
      resolveSessionRuntimeProjectionStatus({
        currentState: current,
        identity,
        shouldConsiderDeferring: true,
      }),
    ).toMatchObject({
      appendOnlyMessageUpdate: true,
      shouldDefer: false,
      ready: true,
      shouldUseDeferredProjection: false,
    });
  });
});
