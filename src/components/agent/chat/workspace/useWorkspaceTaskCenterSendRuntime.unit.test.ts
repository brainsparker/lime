import { describe, expect, it } from "vitest";
import {
  isTaskCenterSendSourceCurrent,
  shouldSwitchToReadyTaskCenterSession,
} from "./useWorkspaceTaskCenterSendRuntime";
import { ComposerController } from "@/components/input-kit/ComposerController";
import type { TaskCenterSessionReadyOptions } from "../homePendingPreview";

describe("shouldSwitchToReadyTaskCenterSession", () => {
  it("实时 active session 已接管首页首发时不应再次切换话题", () => {
    expect(
      shouldSwitchToReadyTaskCenterSession({
        readySessionId: "session-ready",
        currentSessionId: null,
        activeSessionId: "session-ready",
      }),
    ).toBe(false);
  });

  it("当前 render 已指向目标 session 时不应重复切换", () => {
    expect(
      shouldSwitchToReadyTaskCenterSession({
        readySessionId: "session-ready",
        currentSessionId: "session-ready",
        activeSessionId: null,
      }),
    ).toBe(false);
  });

  it("目标 session 尚未接管时应执行真实切换", () => {
    expect(
      shouldSwitchToReadyTaskCenterSession({
        readySessionId: "session-ready",
        currentSessionId: "session-old",
        activeSessionId: "session-old",
      }),
    ).toBe(true);
  });

  it("空目标 session 不应触发切换", () => {
    expect(
      shouldSwitchToReadyTaskCenterSession({
        readySessionId: "  ",
        currentSessionId: null,
        activeSessionId: null,
      }),
    ).toBe(false);
  });
});

describe("captured TaskCenter send source", () => {
  const scope = { workspaceId: "w", kind: "draft" as const, id: "draft-a" };
  const options: TaskCenterSessionReadyOptions = {
    composerDraftCapture: {
      receipt: new ComposerController({ text: "sent" }).submit("start"),
      binding: {
        scope,
        identity: { draftId: "d", scopeVersion: "v" },
        generation: 3,
        payload: {},
      },
    },
    sendSource: {
      sessionId: null,
      workspaceId: "w",
      navigationEpoch: 7,
      newChatAt: 100,
    },
  };
  const current = {
    ...options.sendSource!,
    composerDraftStatus: {
      generation: 3,
      scope,
      identity: options.composerDraftCapture!.binding!.identity,
    },
  };

  it("allows the original surface without inventing an acceptance", () => {
    expect(isTaskCenterSendSourceCurrent(options, current)).toBe(true);
  });

  it.each([
    { sessionId: "new-draft" },
    { sessionId: "unrelated-session" },
    { workspaceId: "other-workspace" },
    { newChatAt: 101 },
    { navigationEpoch: 9 },
    {
      composerDraftStatus: {
        generation: 5,
        scope,
        identity: current.composerDraftStatus.identity,
      },
    },
    {
      composerDraftStatus: {
        generation: 3,
        scope,
        identity: { draftId: "d", scopeVersion: "new-version" },
      },
    },
    {
      composerDraftStatus: {
        generation: 3,
        scope,
        identity: { draftId: "new-draft", scopeVersion: "v" },
      },
    },
    { composerDraftStatus: { generation: 3, scope, identity: null } },
  ])("rejects a changed editing target %j, including away/back", (delta) => {
    expect(
      isTaskCenterSendSourceCurrent(options, { ...current, ...delta }, "ready"),
    ).toBe(false);
  });

  it("only permits epoch+1 for same-generation promotion to the accepted receipt session", () => {
    const promoted = {
      ...current,
      sessionId: "ready",
      navigationEpoch: 8,
      composerDraftStatus: {
        generation: 3,
        identity: null,
        scope: { workspaceId: "w", kind: "local" as const, id: "ready" },
      },
    };
    expect(isTaskCenterSendSourceCurrent(options, promoted)).toBe(false);
    expect(
      isTaskCenterSendSourceCurrent(options, promoted, "wrong-receipt"),
    ).toBe(false);
    expect(isTaskCenterSendSourceCurrent(options, promoted, "ready")).toBe(
      true,
    );
    expect(
      isTaskCenterSendSourceCurrent(
        options,
        { ...promoted, navigationEpoch: 10 },
        "ready",
      ),
    ).toBe(false);
    const newerPromotedDraft = {
      ...promoted,
      composerDraftStatus: {
        ...promoted.composerDraftStatus,
        identity: { draftId: "d", scopeVersion: "new-version" },
      },
    };
    expect(
      isTaskCenterSendSourceCurrent(options, newerPromotedDraft, "ready"),
    ).toBe(false);
    expect(
      isTaskCenterSendSourceCurrent(
        options,
        { ...promoted, sessionId: "new-draft" },
        "ready",
      ),
    ).toBe(false);
  });
});
