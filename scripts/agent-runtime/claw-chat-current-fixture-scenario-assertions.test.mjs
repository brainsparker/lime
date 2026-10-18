import { describe, expect, it } from "vitest";
import { buildScenarioAssertions } from "./claw-chat-current-fixture-scenario-assertions.mjs";
import { buildContentFactoryArticleWorkspaceScenarioAssertions } from "./claw-chat-current-fixture-content-factory-assertions.mjs";
import { findArticleDraftObjectRef } from "./claw-chat-current-fixture-inline-image-article-workspace.mjs";
import { IMAGE_PROVIDER_FIXTURE_DATA_URL } from "./claw-chat-current-fixture-backend-file.mjs";

function assertions(summary = {}) {
  return buildScenarioAssertions({
    isInputbarRichRestoreScenario: true,
    summary,
    appServerRequestMethods: [],
    backendLedger: [],
    pageText: "",
  });
}

describe("rich scenario marks Gate wiring", () => {
  function evidence() {
    return {
      inputbarRichRestoreDraftPrepared: {
        marks: { preparation: { ok: true }, codeBoundary: { ok: true } },
      },
      inputbarRichRestoreHistoryBoundary: {
        ok: true,
        marksSemanticsPreserved: true,
      },
      inputbarRichRestoreMarksCanceled: { ok: true },
    };
  }
  const names = [
    "inputbarRichRestoreMarksPrepared",
    "inputbarRichRestoreCodeEditingOnly",
    "inputbarRichRestoreMarksHistory",
    "inputbarRichRestoreMarksCanceled",
  ];

  it("cannot inherit a historical rich green without new marks/code/cancel evidence", () => {
    expect(assertions()).toMatchObject({
      inputbarRichRestoreMarksPrepared: false,
      inputbarRichRestoreCodeEditingOnly: false,
      inputbarRichRestoreMarksHistory: false,
      inputbarRichRestoreMarksCanceled: false,
    });
  });

  it("passes every new assertion only after its concrete stage reports success", () => {
    const result = assertions(evidence());
    expect(names.map((name) => result[name])).toEqual([true, true, true, true]);
  });

  it.each(["paste", "code", "history-semantics", "history-input", "cancel"])(
    "routes failed %s into actual scenario pass/fail",
    (mode) => {
      const summary = evidence();
      if (mode === "paste")
        summary.inputbarRichRestoreDraftPrepared.marks.preparation.ok = false;
      if (mode === "code")
        summary.inputbarRichRestoreDraftPrepared.marks.codeBoundary.ok = false;
      if (mode === "history-semantics")
        summary.inputbarRichRestoreHistoryBoundary.marksSemanticsPreserved = false;
      if (mode === "history-input")
        summary.inputbarRichRestoreHistoryBoundary.ok = false;
      if (mode === "cancel")
        summary.inputbarRichRestoreMarksCanceled.ok = false;
      const result = assertions(summary);
      expect(
        names.map((name) => result[name]).filter((value) => value === false),
      ).toHaveLength(1);
    },
  );

  it("retains the original canonical/media/terminal requirements alongside new marks checks", () => {
    const result = assertions(evidence());
    expect(result.inputbarRichRestoreCanonicalRichInputPreserved).toBe(false);
    expect(result.inputbarRichRestoreImageRestored).toBe(false);
    expect(result.inputbarRichRestoreReadModelCanceled).toBe(false);
  });
});

describe("Article storyboard content evidence", () => {
  const key = "contentFactoryArticleWorkspaceStoryboardContentPreserved";
  function storyboardAssertions(storyboardArtifact, selected = true) {
    return buildContentFactoryArticleWorkspaceScenarioAssertions({
      appServerRequestMethods: [],
      backendLedger: [],
      pageText: "",
      summary: {
        contentFactoryArticleWorkspaceStoryboardObjectSelection: {
          objectKind: "videoStoryboard",
          selected,
        },
        contentFactoryArticleWorkspaceReadModel: { storyboardArtifact },
      },
    });
  }

  it("cannot count old renderer metadata as preserved storyboard content", () => {
    const result = storyboardAssertions({
      rendererContract: {
        rendererKind: "app_declared",
        entry: "./renderer/storyboard.tsx",
      },
    });
    expect(result[key]).toBe(false);
  });

  it("requires both the storyboard selection and its persisted scene content", () => {
    const artifact = {
      scenes: [
        { id: "shot-1", title: "厨房开场", description: "镜头推近产品" },
      ],
    };
    expect(storyboardAssertions(artifact)[key]).toBe(true);
    expect(storyboardAssertions(artifact, false)[key]).toBe(false);
    expect(
      storyboardAssertions({ scenes: [{ id: "shot-1", title: "厨房开场" }] })[
        key
      ],
    ).toBe(false);
  });
});

describe("Article inline image source identity", () => {
  it("requires the actual Provider output and matching image slot at completion", () => {
    const completed = {
      normalizedStatus: "succeeded",
      relationshipSlotId: "article-inline-image-slot-e2e",
      firstImageSlotId: "article-inline-image-slot-e2e",
      firstImageUrl: IMAGE_PROVIDER_FIXTURE_DATA_URL,
    };
    const check = (overrides = {}) =>
      buildScenarioAssertions({
        isContentFactoryArticleWorkspaceScenario: true,
        isContentFactoryInlineImageArticleWorkspaceScenario: true,
        summary: {
          contentFactoryInlineImageTaskCompleted: {
            ...completed,
            ...overrides,
          },
        },
        appServerRequestMethods: [],
        backendLedger: [],
        pageText: "",
      }).contentFactoryInlineImageTaskCompleted;
    expect(check()).toBe(true);
    expect(check({ firstImageSlotId: "image-slot-1" })).toBe(false);
    expect(check({ firstImageUrl: "file:///stale-fixture.svg" })).toBe(false);
    expect(check({ normalizedStatus: "running" })).toBe(false);
  });

  it("selects the matching artifact source and refuses an unrelated first article", () => {
    const objects = ["unrelated-task", "workspace-patch-fixture"].map(
      (sourceTaskId) => ({
        ref: {
          appId: "article",
          sessionId: "session",
          kind: "articleDraft",
          id: `article-${sourceTaskId}`,
          sourceTaskId,
        },
      }),
    );
    const result = { thread: { extra: { articleWorkspace: { objects } } } };
    expect(
      findArticleDraftObjectRef(result, "workspace-patch-fixture"),
    ).toMatchObject({
      id: "article-workspace-patch-fixture",
      sourceTaskId: "workspace-patch-fixture",
    });
    expect(findArticleDraftObjectRef(result, "missing-task")).toBeNull();
    expect(findArticleDraftObjectRef({}, "workspace-patch-fixture")).toBeNull();
  });
});
