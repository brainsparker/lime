import { describe, expect, it } from "vitest";
import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";
import type { CreationReplaySurfaceModel } from "../utils/creationReplaySurface";
import { resolveEffectiveCuratedTaskReferences } from "./EmptyStateViewModel";

function referenceEntry(
  overrides: Partial<CuratedTaskReferenceEntry> = {},
): CuratedTaskReferenceEntry {
  return {
    id: "memory-1",
    title: "品牌风格样本",
    summary: "保留轻盈但专业的表达。",
    category: "context",
    categoryLabel: "参考",
    tags: ["品牌"],
    ...overrides,
  };
}

function replaySurface(
  overrides: Partial<CreationReplaySurfaceModel> = {},
): CreationReplaySurfaceModel {
  return {
    kind: "memory_entry",
    eyebrow: "当前带入灵感",
    badgeLabel: "参考",
    title: "品牌风格样本",
    summary: "保留轻盈但专业的表达。",
    hint: "后续结果模板会默认把它一起带入。",
    defaultReferenceMemoryIds: ["memory-1"],
    defaultReferenceEntries: [referenceEntry()],
    ...overrides,
  };
}

describe("EmptyStateViewModel", () => {
  it("应优先使用显式 curated task 默认引用，其次使用 creation replay", () => {
    const explicitEntry = referenceEntry({ id: "explicit" });
    expect(
      resolveEffectiveCuratedTaskReferences({
        defaultCuratedTaskReferenceMemoryIds: ["explicit"],
        defaultCuratedTaskReferenceEntries: [explicitEntry],
        creationReplaySurface: replaySurface(),
      }),
    ).toEqual({
      effectiveDefaultCuratedTaskReferenceMemoryIds: ["explicit"],
      effectiveDefaultCuratedTaskReferenceEntries: [explicitEntry],
    });

    expect(
      resolveEffectiveCuratedTaskReferences({
        creationReplaySurface: replaySurface({
          defaultReferenceMemoryIds: ["from-replay"],
          defaultReferenceEntries: [referenceEntry({ id: "from-replay" })],
        }),
      }),
    ).toMatchObject({
      effectiveDefaultCuratedTaskReferenceMemoryIds: ["from-replay"],
      effectiveDefaultCuratedTaskReferenceEntries: [{ id: "from-replay" }],
    });
  });
});
