import { describe, expect, it } from "vitest";
import {
  buildThreadLayout,
  getThreadRange,
  preserveThreadAnchor,
} from "./threadVirtualizer";

const entries = Array.from({ length: 1000 }, (_, index) => ({
  id: `turn-${index}`,
  estimatedHeightPx: index % 2 ? 300 : 100,
}));

describe("threadVirtualizer", () => {
  it("keeps a bounded window across a large variable-height history", () => {
    const layout = buildThreadLayout(entries, new Map());
    for (const top of [0, 50000, layout.totalHeight - 600]) {
      const range = getThreadRange(layout, top, 600);
      expect(range.endIndex - range.startIndex).toBeLessThanOrEqual(11);
      expect(layout.offsets[range.startIndex]).toBeLessThanOrEqual(top);
      const last = range.endIndex - 1;
      expect(
        layout.offsets[last] + layout.heights[last],
      ).toBeGreaterThanOrEqual(Math.min(top + 600, layout.totalHeight));
    }
  });
  it("preserves the same owner and intra-row offset after prepend and reflow", () => {
    const previous = buildThreadLayout(entries, new Map());
    const top = previous.offsets[250] + 35;
    const next = buildThreadLayout(
      [{ id: "older", estimatedHeightPx: 500 }, ...entries],
      new Map([["turn-249", 450]]),
    );
    const compensated = preserveThreadAnchor(previous, next, top);
    expect(compensated - next.offsets[251]).toBe(35);
  });
  it("uses surviving stable keys when an anchor disappears", () => {
    const previous = buildThreadLayout(entries, new Map());
    const next = buildThreadLayout(
      entries.filter((entry) => entry.id !== "turn-250"),
      new Map(),
    );
    const top = previous.offsets[250] + 20;
    const compensated = preserveThreadAnchor(previous, next, top);
    expect(next.offsets[250] - compensated).toBe(previous.offsets[251] - top);
    expect(getThreadRange(buildThreadLayout([], new Map()), 0, 600)).toEqual({
      startIndex: 0,
      endIndex: 0,
    });
  });
});
