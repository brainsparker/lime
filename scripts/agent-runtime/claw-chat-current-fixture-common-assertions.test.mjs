import { describe, expect, it } from "vitest";
import { buildCommonAssertions } from "./claw-chat-current-fixture-common-assertions.mjs";
import { INPUTBAR_RICH_RESTORE_PROMPT } from "./claw-chat-current-fixture-constants.mjs";

const SCENARIO_FLAGS = [
  "isCancelOnlyScenario",
  "isCancelThenContinueScenario",
  "isPlanScenario",
  "isGoalScenario",
  "isHomeHotpathScenario",
  "isImageCommandScenario",
  "isInputbarRichRestoreScenario",
  "isActiveSteerScenario",
  "isWebToolsRenderingScenario",
  "isLiveTailCommitScenario",
  "isElectronResizeReflowScenario",
  "isMcpStructuredContentScenario",
  "isMediaReferenceScenario",
  "isReasoningFirstVisibleScenario",
  "isTerminalCanceledAfterAnswerScenario",
  "isTerminalFailedAfterAnswerScenario",
  "isTerminalStaleGuardScenario",
  "isTypedErrorRetryScenario",
  "isTypedErrorRetrySuccessScenario",
  "isSkillsRuntimeScenario",
  "isSoulStyleScenario",
  "isRightSurfaceVisualMatrixScenario",
  "isContentFactoryArticleWorkspaceScenario",
  "isAnyExpertSkillsRuntimeScenario",
  "isApprovalRequestResumeScenario",
  "isApprovalRequestDeclineScenario",
  "isApprovalRequestCancelScenario",
  "isApprovalRequestDecisionScenario",
  "isApprovalRequestFullAccessScenario",
  "isExpertPlazaSkillsRuntimeScenario",
  "isExpertPanelSkillsRuntimeScenario",
  "hasCancelPhase",
];

function buildContext({ typedError = false, summary = {} } = {}) {
  return {
    rendererSnapshot: {},
    appServerRequestMethods: [],
    guiTurnStartReachedBackend: false,
    backendLedger: [],
    runtimeRequest: {},
    pageText: "",
    errorRaw: null,
    actionableConsoleErrors: [],
    summary,
    ...Object.fromEntries(SCENARIO_FLAGS.map((flag) => [flag, false])),
    isTypedErrorRetryScenario: typedError,
    isTypedErrorRetrySuccessScenario: typedError,
  };
}

function buildTraceSummary({
  hasClientLocalOutputMs = true,
  hasFirstVisibleOutputMs = true,
  hasFirstTextDeltaToFirstTextPaintMs = true,
  hasAppServerMessageDelta = true,
  hasServerEventEmittedAt = true,
  hasW3cTraceContext = true,
} = {}) {
  return {
    agentUiPerformanceTrace: {
      available: true,
      hasProviderWaitMs: false,
      hasClientLocalOutputMs,
      hasFirstVisibleOutputMs,
      hasFirstTextDeltaToFirstTextPaintMs,
      rawEntriesExported: false,
      forbiddenFragmentPresent: false,
    },
    appServerTraceEvidence: {
      available: true,
      hasProviderFirstTextDelta: false,
      hasAppServerMessageDelta,
      hasProviderWaitMs: false,
      hasServerEventEmittedAt,
      hasW3cTraceContext,
      forbiddenFragmentPresent: false,
    },
  };
}

describe("rich Composer restored readiness assertion", () => {
  function context() {
    const prepared = {
      editorCount: 1,
      editorSessionId: "rich-session",
      editorVisible: true,
      editorDisabled: false,
      hasInputbarCore: true,
      sendButtonExists: true,
      sendButtonDisabled: false,
      stopButtonVisible: false,
      editorText: `${INPUTBAR_RICH_RESTORE_PROMPT} [Pasted text 1: 1620 characters] /user:capability-report`,
      skillTokenData: [
        {
          id: "user:capability-report",
          name: "capability-report",
          path: "/fixture/.agents/skills/capability-report/SKILL.md",
          label: "/user:capability-report",
          editable: "false",
        },
      ],
    };
    return {
      ...buildContext({
        summary: {
          sessionId: "rich-session",
          inputbarRichRestoreDraftPrepared: { prepared },
          inputbarRichRestoreGuiCanceled: structuredClone(prepared),
        },
      }),
      isInputbarRichRestoreScenario: true,
    };
  }

  it("accepts the exact prepared rich draft with a unique same-session ready editor", () => {
    expect(buildCommonAssertions(context()).guiInputRemainsReady).toBe(true);
  });

  it.each([
    "wrong-session",
    "duplicate-editor",
    "hidden-editor",
    "disabled-editor",
    "missing-core",
    "missing-send",
    "disabled-send",
    "stop-active",
    "plain-prompt",
    "missing-paste",
    "missing-skill",
    "same-label-wrong-id",
    "same-label-wrong-path",
    "missing-token",
    "missing-prepared",
  ])("rejects %s restored evidence", (mode) => {
    const input = context();
    const restored = input.summary.inputbarRichRestoreGuiCanceled;
    if (mode === "wrong-session") restored.editorSessionId = "foreign";
    if (mode === "duplicate-editor") restored.editorCount = 2;
    if (mode === "hidden-editor") restored.editorVisible = false;
    if (mode === "disabled-editor") restored.editorDisabled = true;
    if (mode === "missing-core") restored.hasInputbarCore = false;
    if (mode === "missing-send") restored.sendButtonExists = false;
    if (mode === "disabled-send") restored.sendButtonDisabled = true;
    if (mode === "stop-active") restored.stopButtonVisible = true;
    if (mode === "plain-prompt")
      restored.editorText = INPUTBAR_RICH_RESTORE_PROMPT;
    if (mode === "missing-paste")
      restored.editorText = restored.editorText.replace(
        "[Pasted text 1: 1620 characters] ",
        "",
      );
    if (mode === "missing-skill")
      restored.editorText = restored.editorText.replace(
        " /user:capability-report",
        "",
      );
    if (mode === "same-label-wrong-id")
      restored.skillTokenData[0].id = "project:capability-report";
    if (mode === "same-label-wrong-path")
      restored.skillTokenData[0].path = "/foreign/SKILL.md";
    if (mode === "missing-token") restored.skillTokenData = [];
    if (mode === "missing-prepared")
      delete input.summary.inputbarRichRestoreDraftPrepared;
    expect(buildCommonAssertions(input).guiInputRemainsReady).toBe(false);
  });
});

describe("claw chat current fixture common trace assertions", () => {
  it("requires provider first-text evidence for ordinary text streaming", () => {
    const assertions = buildCommonAssertions(
      buildContext({ summary: buildTraceSummary() }),
    );

    expect(assertions.agentUiPerformanceTraceSeparatesProviderAndClient).toBe(
      false,
    );
    expect(assertions.appServerTraceEvidenceSeparatesProviderAndServer).toBe(
      false,
    );
    expect(
      assertions.appServerTraceEvidenceHasProviderFirstTextCheckpoint,
    ).toBe(false);
    expect(assertions.appServerTraceEvidenceHasProviderWaitMs).toBe(false);
    expect(assertions.appServerTraceEvidenceHasMessageDeltaCheckpoint).toBe(
      true,
    );
    expect(assertions.appServerTraceEvidenceHasServerEmissionTimestamp).toBe(
      true,
    );
  });

  it("does not require provider first-text evidence for typed error retries", () => {
    const assertions = buildCommonAssertions(
      buildContext({ typedError: true, summary: buildTraceSummary() }),
    );

    expect(assertions.agentUiPerformanceTraceSeparatesProviderAndClient).toBe(
      true,
    );
    expect(assertions.appServerTraceEvidenceSeparatesProviderAndServer).toBe(
      true,
    );
    expect(
      assertions.appServerTraceEvidenceHasProviderFirstTextCheckpoint,
    ).toBe(true);
    expect(assertions.appServerTraceEvidenceHasProviderWaitMs).toBe(true);
    expect(assertions.appServerTraceEvidenceHasMessageDeltaCheckpoint).toBe(
      true,
    );
    expect(assertions.appServerTraceEvidenceHasServerEmissionTimestamp).toBe(
      true,
    );
  });

  it("keeps non-provider trace evidence mandatory for typed error retries", () => {
    const assertions = buildCommonAssertions(
      buildContext({
        typedError: true,
        summary: buildTraceSummary({
          hasClientLocalOutputMs: false,
          hasFirstVisibleOutputMs: false,
          hasFirstTextDeltaToFirstTextPaintMs: false,
          hasAppServerMessageDelta: false,
          hasServerEventEmittedAt: false,
          hasW3cTraceContext: false,
        }),
      }),
    );

    expect(assertions.agentUiPerformanceTraceSeparatesProviderAndClient).toBe(
      false,
    );
    expect(assertions.agentUiPerformanceTraceHasFirstVisibleTextPaint).toBe(
      false,
    );
    expect(assertions.appServerTraceEvidenceSeparatesProviderAndServer).toBe(
      false,
    );
    expect(assertions.appServerTraceEvidenceHasMessageDeltaCheckpoint).toBe(
      false,
    );
    expect(assertions.appServerTraceEvidenceHasServerEmissionTimestamp).toBe(
      false,
    );
    expect(assertions.appServerTraceEvidenceUsesCurrentMethods).toBe(false);
    expect(assertions.appServerTraceEvidenceHasW3cCarrier).toBe(false);
  });
});
