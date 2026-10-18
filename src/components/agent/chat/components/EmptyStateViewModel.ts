import type { CuratedTaskReferenceEntry } from "../utils/curatedTaskReferenceSelection";
import type { CreationReplaySurfaceModel } from "../utils/creationReplaySurface";

export function resolveEffectiveCuratedTaskReferences({
  defaultCuratedTaskReferenceMemoryIds,
  defaultCuratedTaskReferenceEntries,
  creationReplaySurface,
}: {
  defaultCuratedTaskReferenceMemoryIds?: string[];
  defaultCuratedTaskReferenceEntries?: CuratedTaskReferenceEntry[];
  creationReplaySurface?: CreationReplaySurfaceModel | null;
}): {
  effectiveDefaultCuratedTaskReferenceMemoryIds: string[];
  effectiveDefaultCuratedTaskReferenceEntries: CuratedTaskReferenceEntry[];
} {
  return {
    effectiveDefaultCuratedTaskReferenceMemoryIds:
      defaultCuratedTaskReferenceMemoryIds ??
      creationReplaySurface?.defaultReferenceMemoryIds ??
      [],
    effectiveDefaultCuratedTaskReferenceEntries:
      defaultCuratedTaskReferenceEntries ??
      creationReplaySurface?.defaultReferenceEntries ??
      [],
  };
}
