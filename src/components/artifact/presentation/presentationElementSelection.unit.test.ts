import { describe, expect, it } from "vitest";
import {
  beginSelectionMarquee,
  endSelectionMarquee,
  normalizePresentationElementSelection,
  presentationElementCorners,
  presentationElementSelectionFrame,
  selectAllSlideElements,
  setSelectedElementId,
  updateSelectionMarquee,
  type PresentationElementTarget,
} from "./presentationElementSelection";

function target(
  id: string,
  x = 0,
  y = 0,
  width = 20,
  height = 20,
  rotation = 0,
): PresentationElementTarget {
  return { id, frame: { x, y, width, height }, rotation };
}

describe("演示对象集合选择", () => {
  it("去重、去除隐藏与失效对象，primary始终属于当前集合", () => {
    const targets = [
      target("2"),
      target("3"),
      { ...target("4"), hidden: true },
    ];
    expect(
      normalizePresentationElementSelection(targets, {
        selectedElementIds: ["3", "2", "3", "4", "missing"],
        primarySelectedElementId: "missing",
      }),
    ).toEqual({
      selectedElementIds: ["3", "2"],
      primarySelectedElementId: "2",
    });
    expect(
      normalizePresentationElementSelection(targets, {
        selectedElementIds: ["3", "2"],
        primarySelectedElementId: "3",
      }).primarySelectedElementId,
    ).toBe("3");
    expect(setSelectedElementId(targets, "2")).toEqual({
      selectedElementIds: ["2"],
      primarySelectedElementId: "2",
    });
    expect(setSelectedElementId(targets, "4")).toEqual({
      selectedElementIds: [],
      primarySelectedElementId: null,
    });
    expect(selectAllSlideElements(targets)).toEqual({
      selectedElementIds: ["2", "3"],
      primarySelectedElementId: "3",
    });
  });

  it("非法数、原包精度下零尺寸与不可表示的旋转不进入选区", () => {
    expect(
      selectAllSlideElements([
        target("2"),
        target("2"),
        target("3", NaN),
        target("4", Infinity),
        target("5", 0, 0, 0),
        target("6", 0, 0, 1e-9),
        target("7", 0, 0, -20),
        target("8", 0, 0, 20, 20, 1e9),
        target("9", Number.MAX_SAFE_INTEGER),
      ]).selectedElementIds,
    ).toEqual(["2"]);
    expect(presentationElementSelectionFrame([], null)).toBeNull();
  });

  it("单选保留自身旋转，多选以每个旋转矩形四角计算组合框", () => {
    const a = target("2", 0, 0, 10, 20, 90);
    const expectedCorners = [
      [15, 5],
      [15, 15],
      [-5, 15],
      [-5, 5],
    ];
    for (const [index, point] of presentationElementCorners(a).entries()) {
      expect(point.x).toBeCloseTo(expectedCorners[index][0]);
      expect(point.y).toBeCloseTo(expectedCorners[index][1]);
    }
    expect(
      presentationElementSelectionFrame([a], setSelectedElementId([a], "2")),
    ).toEqual({ x: 0, y: 0, width: 10, height: 20, rotation: 90 });
    const targets = [a, target("3", 30, 10, 20, 10)];
    const frame = presentationElementSelectionFrame(
      targets,
      selectAllSlideElements(targets),
    )!;
    expect(frame.x).toBeCloseTo(-5);
    expect(frame.y).toBeCloseTo(5);
    expect(frame.width).toBeCloseTo(55);
    expect(frame.height).toBeCloseTo(15);
    expect(frame.rotation).toBe(0);
  });

  it("45度对象的组合框由实际角点确定，flip不扩大几何范围", () => {
    const targets = [
      target("2", 0, 0, 20, 20, 45),
      { ...target("3", 5, 5, 10, 10), flipH: true, flipV: true },
    ];
    const frame = presentationElementSelectionFrame(
      targets,
      selectAllSlideElements(targets),
    )!;
    expect(frame.x).toBeCloseTo(10 - 10 * Math.SQRT2);
    expect(frame.y).toBeCloseTo(10 - 10 * Math.SQRT2);
    expect(frame.width).toBeCloseTo(20 * Math.SQRT2);
    expect(frame.height).toBeCloseTo(20 * Math.SQRT2);
  });

  it("反向框选使用旋转矩形相交，排除AABB角落的误命中", () => {
    const targets = [target("2", 0, 0, 20, 20, 45)];
    const session = beginSelectionMarquee({
      targets,
      selection: null,
      point: { x: -3, y: -3 },
    })!;
    const miss = updateSelectionMarquee(session, {
      nextPoint: { x: -4, y: -4 },
    });
    expect(miss.frame).toEqual({ x: -4, y: -4, width: 1, height: 1 });
    expect(miss.selection.selectedElementIds).toEqual([]);
    const hit = updateSelectionMarquee(session, {
      nextPoint: { x: 11, y: 11 },
    });
    expect(hit.selection.selectedElementIds).toEqual(["2"]);
    const atTip = beginSelectionMarquee({
      targets,
      selection: null,
      point: { x: -5, y: 9 },
    })!;
    expect(
      updateSelectionMarquee(atTip, { nextPoint: { x: -3, y: 11 } }).selection
        .selectedElementIds,
    ).toEqual(["2"]);
  });

  it("additive以初始选区合并，每次预览不累积已离开的命中", () => {
    const targets = [target("2"), target("3", 40), target("4", 80)];
    const session = beginSelectionMarquee({
      targets,
      selection: setSelectedElementId(targets, "2"),
      point: { x: 39, y: -1 },
      additive: true,
    })!;
    const wide = updateSelectionMarquee(session, {
      nextPoint: { x: 101, y: 21 },
    });
    expect(wide.selection).toEqual({
      selectedElementIds: ["2", "3", "4"],
      primarySelectedElementId: "4",
    });
    const narrow = updateSelectionMarquee(wide, {
      nextPoint: { x: 61, y: 21 },
    });
    expect(narrow.selection).toEqual({
      selectedElementIds: ["2", "3"],
      primarySelectedElementId: "3",
    });
    expect(endSelectionMarquee(narrow, { commit: false })).toEqual({
      session: null,
      selection: setSelectedElementId(targets, "2"),
    });
    expect(endSelectionMarquee(narrow, { commit: true }).selection).toEqual(
      narrow.selection,
    );
    expect(session.selection.selectedElementIds).toEqual(["2"]);
  });

  it("空白点击清选、additive点击保留、取消恢复且重复结束无选择修改", () => {
    const targets = [target("2")];
    const selection = setSelectedElementId(targets, "2");
    const session = beginSelectionMarquee({
      targets,
      selection,
      point: { x: 50, y: 50 },
    })!;
    expect(endSelectionMarquee(session, { commit: true }).selection).toEqual({
      selectedElementIds: [],
      primarySelectedElementId: null,
    });
    expect(endSelectionMarquee(session, { commit: false }).selection).toEqual(
      selection,
    );
    expect(
      endSelectionMarquee({ ...session, additive: true }, { commit: true })
        .selection,
    ).toEqual(selection);
    expect(endSelectionMarquee(null, { commit: true })).toEqual({
      session: null,
      selection: null,
    });
    expect(
      beginSelectionMarquee({ targets, selection, point: { x: NaN, y: 0 } }),
    ).toBeNull();
    expect(
      updateSelectionMarquee(session, { nextPoint: { x: Infinity, y: 0 } }),
    ).toBe(session);
    const large = beginSelectionMarquee({
      targets,
      selection,
      point: { x: -8e11, y: 0 },
    })!;
    expect(
      updateSelectionMarquee(large, { nextPoint: { x: 8e11, y: 1 } }),
    ).toBe(large);
  });

  it("开始时复制外部输入，后续框选不改写调用方的对象与选择", () => {
    const targets = [target("2")];
    const selection = setSelectedElementId(targets, "2");
    const session = beginSelectionMarquee({
      targets,
      selection,
      point: { x: 50, y: 50 },
    })!;
    targets[0].frame.x = 1000;
    selection.selectedElementIds.length = 0;
    const next = updateSelectionMarquee(session, {
      nextPoint: { x: -1, y: -1 },
    });
    expect(next.selection.selectedElementIds).toEqual(["2"]);
    expect(session.targets[0].frame.x).toBe(0);
    expect(session.initialSelection.selectedElementIds).toEqual(["2"]);
  });
});
