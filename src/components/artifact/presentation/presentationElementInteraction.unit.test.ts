import { readFileSync } from "node:fs";
import JSZip from "jszip";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
} from "@aiden0z/pptx-renderer";
import { describe, expect, it } from "vitest";
import { editPresentationPackage } from "./presentationPackage";
import {
  beginElementInteraction,
  endElementInteraction,
  updateElementInteraction,
  type PresentationElementInteraction,
  type PresentationResizeCorner,
} from "./presentationElementInteraction";
import {
  selectAllSlideElements,
  setSelectedElementId,
  type PresentationElementTarget,
} from "./presentationElementSelection";

function target(
  id = "2",
  x = 0,
  y = 0,
  width = 40,
  height = 20,
  rotation = 0,
): PresentationElementTarget {
  return {
    id,
    frame: { x, y, width, height },
    rotation,
    flipH: true,
    flipV: true,
  };
}
function begin(
  targets = [target()],
  mode: "move" | "resize" | "rotate" = "move",
  point = { x: 0, y: 0 },
  corner: PresentationResizeCorner = "se",
): PresentationElementInteraction {
  const session = beginElementInteraction({
    slideId: "512",
    targets,
    selection: selectAllSlideElements(targets),
    elementId: targets[0].id,
    point,
    mode,
    corner,
  });
  if (!session) throw new Error("fixture interaction rejected");
  return session;
}
function expectFrame(
  actual: PresentationElementTarget["frame"],
  expected: PresentationElementTarget["frame"],
) {
  for (const key of ["x", "y", "width", "height"] as const)
    expect(actual[key], key).toBeCloseTo(expected[key], 8);
}

describe("演示对象集合变换", () => {
  it("操作已选对象复用集合，操作其他对象切单选，不解析的对象不启动", () => {
    const targets = [target("2"), target("3", 100)];
    expect(begin(targets).selection.selectedElementIds).toEqual(["2", "3"]);
    const session = beginElementInteraction({
      slideId: "512",
      targets,
      selection: setSelectedElementId(targets, "2"),
      elementId: "3",
      point: { x: 0, y: 0 },
      mode: "move",
    })!;
    expect(session.selection).toEqual({
      selectedElementIds: ["3"],
      primarySelectedElementId: "3",
    });
    expect(session.targets.map(({ id }) => id)).toEqual(["3"]);
    expect(
      beginElementInteraction({
        ...session,
        targets,
        elementId: "missing",
        mode: "move",
      }),
    ).toBeNull();
  });

  it("批量移动保持非均匀尺寸、旋转和flip，并且相对起点计算预览", () => {
    const targets = [
      target("2", -10, 5, 10, 20, 30),
      target("3", 40, 30, 50, 15, 90),
    ];
    const session = begin(targets, "move", { x: 5, y: 10 });
    const first = updateElementInteraction(session, {
      nextPoint: { x: 15, y: 30 },
    });
    const final = updateElementInteraction(first, {
      nextPoint: { x: -5, y: 5 },
    });
    expect(final.preview).toEqual(
      targets.map((element) => ({
        ...element,
        frame: {
          ...element.frame,
          x: element.frame.x - 10,
          y: element.frame.y - 5,
        },
      })),
    );
    expect(session.preview).toEqual(targets);
    const result = endElementInteraction(final, { commit: true });
    expect(result.edits).toEqual(
      targets.map((element) => ({
        slideId: "512",
        elementId: element.id,
        frame: {
          ...element.frame,
          x: element.frame.x - 10,
          y: element.frame.y - 5,
        },
      })),
    );
    expect(result.session).toBeNull();
    expect(
      endElementInteraction(result.session, { commit: true }).edits,
    ).toEqual([]);
  });

  it("Shift移动约束主方向，负向拖动保持符号", () => {
    const session = begin();
    expect(
      updateElementInteraction(session, {
        nextPoint: { x: -20, y: 10 },
        shiftKey: true,
      }).preview[0].frame,
    ).toEqual({ x: -20, y: 0, width: 40, height: 20 });
    expect(
      updateElementInteraction(session, {
        nextPoint: { x: -5, y: -20 },
        shiftKey: true,
      }).preview[0].frame,
    ).toEqual({ x: 0, y: -20, width: 40, height: 20 });
  });

  it("多选强制统一缩放，非均匀对象围绕共同固定角变换", () => {
    const targets = [target("2", 0, 0, 10, 20), target("3", 30, 10, 20, 10)];
    const session = begin(targets, "resize", { x: 50, y: 20 });
    const next = updateElementInteraction(session, {
      nextPoint: { x: 100, y: 40 },
    });
    expectFrame(next.preview[0].frame, { x: 0, y: 0, width: 20, height: 40 });
    expectFrame(next.preview[1].frame, { x: 60, y: 20, width: 40, height: 20 });
    expect(next.previewFrame).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      rotation: 0,
    });
    expect(
      next.preview.every((element) => element.flipH && element.flipV),
    ).toBe(true);
    expect(endElementInteraction(next, { commit: true }).edits).toHaveLength(2);
  });

  it("含旋转对象的多选缩放使用实际组合框，保留每个对象的旋转", () => {
    const session = begin(
      [target("2", 0, 0, 10, 20, 90), target("3", 30, 10, 20, 10)],
      "resize",
      { x: 50, y: 20 },
    );
    const next = updateElementInteraction(session, {
      nextPoint: { x: 105, y: 35 },
    });
    expectFrame(next.preview[0].frame, { x: 5, y: -5, width: 20, height: 40 });
    expectFrame(next.preview[1].frame, { x: 65, y: 15, width: 40, height: 20 });
    expect(next.preview.map(({ rotation }) => rotation)).toEqual([90, 0]);
  });

  it("单个旋转对象在局部轴缩放，固定端在世界坐标中保持不动", () => {
    const session = begin(
      [target("2", 10, 20, 40, 20, 90)],
      "resize",
      { x: 30, y: 50 },
      "e",
    );
    const next = updateElementInteraction(session, {
      nextPoint: { x: 30, y: 70 },
    });
    expectFrame(next.preview[0].frame, { x: 0, y: 30, width: 60, height: 20 });
    expect(next.preview[0].rotation).toBe(90);
    expectFrame(next.previewFrame, { x: 0, y: 30, width: 60, height: 20 });
  });

  it("单选可非均匀缩小，反向越过固定点拒绝生成负尺寸或新flip", () => {
    const session = begin([target("2", 10, 20)], "resize", { x: 50, y: 40 });
    const smaller = updateElementInteraction(session, {
      nextPoint: { x: 30, y: 30 },
    });
    expectFrame(smaller.preview[0].frame, {
      x: 10,
      y: 20,
      width: 20,
      height: 10,
    });
    expect(
      updateElementInteraction(smaller, { nextPoint: { x: 0, y: 0 } }),
    ).toBe(smaller);
    const fromNorthWest = begin([target()], "resize", { x: 0, y: 0 }, "nw");
    expectFrame(
      updateElementInteraction(fromNorthWest, { nextPoint: { x: -10, y: -5 } })
        .preview[0].frame,
      { x: -10, y: -5, width: 50, height: 25 },
    );
  });

  it("Alt围绕中心缩放，Shift将指针增量投影到等比对角线", () => {
    const session = begin([target()], "resize", { x: 40, y: 20 });
    expectFrame(
      updateElementInteraction(session, {
        nextPoint: { x: 50, y: 25 },
        altKey: true,
      }).preview[0].frame,
      { x: -10, y: -5, width: 60, height: 30 },
    );
    expectFrame(
      updateElementInteraction(session, {
        nextPoint: { x: 60, y: 20 },
        shiftKey: true,
      }).preview[0].frame,
      { x: 0, y: 0, width: 56, height: 28 },
    );
  });

  it("能力边界拒绝不支持的旋转与单轴缩放", () => {
    const options = {
      slideId: "512",
      selection: null,
      elementId: "2",
      point: { x: 40, y: 20 },
    };
    expect(
      beginElementInteraction({
        ...options,
        targets: [{ ...target(), canRotate: false }],
        mode: "rotate",
      }),
    ).toBeNull();
    expect(
      beginElementInteraction({
        ...options,
        targets: [{ ...target(), resizeAxis: "none" }],
        mode: "resize",
        corner: "se",
      }),
    ).toBeNull();
    const horizontal = [{ ...target(), resizeAxis: "horizontal" as const }];
    expect(
      beginElementInteraction({
        ...options,
        targets: horizontal,
        mode: "resize",
        corner: "se",
      }),
    ).toBeNull();
    expect(
      beginElementInteraction({
        ...options,
        targets: horizontal,
        mode: "resize",
        corner: "e",
      }),
    ).not.toBeNull();
    const horizontalSession = begin(
      horizontal,
      "resize",
      { x: 40, y: 20 },
      "e",
    );
    expect(
      updateElementInteraction(horizontalSession, {
        nextPoint: { x: 60, y: 20 },
        shiftKey: true,
      }),
    ).toBe(horizontalSession);
    expectFrame(
      updateElementInteraction(horizontalSession, {
        nextPoint: { x: 60, y: 20 },
      }).preview[0].frame,
      { x: 0, y: 0, width: 60, height: 20 },
    );
    expect(
      beginElementInteraction({
        ...options,
        targets: [{ ...target(), allowSingleAxisResize: false }],
        mode: "resize",
        corner: "e",
      }),
    ).toBeNull();
    const rotated = [target("2", 0, 0, 10, 20, 90), target("3", 30, 0)];
    expect(
      beginElementInteraction({
        ...options,
        targets: rotated,
        selection: selectAllSlideElements(rotated),
        mode: "resize",
        corner: "e",
      }),
    ).toBeNull();
    expect(
      beginElementInteraction({
        ...options,
        targets: [target()],
        point: { x: 20, y: 10 },
        mode: "rotate",
      }),
    ).toBeNull();
  });

  it("批量旋转围绕共同中心转动各自中心，累加自身rotation并保留flip", () => {
    const session = begin(
      [target("2", 0, 0, 10, 20), target("3", 30, 10, 20, 10)],
      "rotate",
      { x: 35, y: 10 },
    );
    const next = updateElementInteraction(session, {
      nextPoint: { x: 25, y: 20 },
    });
    expectFrame(next.preview[0].frame, {
      x: 20,
      y: -20,
      width: 10,
      height: 20,
    });
    expectFrame(next.preview[1].frame, { x: 10, y: 20, width: 20, height: 10 });
    expect(
      next.preview.map(({ rotation, flipH, flipV }) => [
        rotation,
        flipH,
        flipV,
      ]),
    ).toEqual([
      [90, true, true],
      [90, true, true],
    ]);
    expect(next.previewFrame.rotation).toBe(90);
    expect(
      endElementInteraction(next, { commit: true }).edits.map(
        ({ frame }) => frame?.rotation,
      ),
    ).toEqual([90, 90]);
    const single = begin([target("2", 0, 0, 20, 20, 30)], "rotate", {
      x: 20,
      y: 10,
    });
    expect(
      updateElementInteraction(single, { nextPoint: { x: 10, y: 20 } })
        .preview[0].rotation,
    ).toBe(120);
  });

  it("Shift按15度吸附，取消Shift恢复原始指针角而不累积吸附误差", () => {
    const session = begin([target("2", -10, -10, 20, 20)], "rotate", {
      x: 10,
      y: 0,
    });
    const point = {
      x: Math.cos((22 * Math.PI) / 180) * 10,
      y: Math.sin((22 * Math.PI) / 180) * 10,
    };
    const snapped = updateElementInteraction(session, {
      nextPoint: point,
      shiftKey: true,
    });
    expect(snapped.preview[0].rotation).toBe(15);
    expect(
      updateElementInteraction(snapped, { nextPoint: point }).preview[0]
        .rotation,
    ).toBeCloseTo(22);
  });

  it("跨越±180度连续旋转，完整一周回到原frame时不提交", () => {
    const atAngle = (angle: number) => ({
      x: Math.cos((angle * Math.PI) / 180) * 10,
      y: Math.sin((angle * Math.PI) / 180) * 10,
    });
    const crossing = begin(
      [target("2", -10, -10, 20, 20)],
      "rotate",
      atAngle(170),
    );
    expect(
      updateElementInteraction(crossing, { nextPoint: atAngle(-170) })
        .preview[0].rotation,
    ).toBeCloseTo(20);
    let session = begin([target("2", -10, -10, 20, 20)], "rotate", {
      x: 10,
      y: 0,
    });
    for (const angle of [90, 180, 270, 360])
      session = updateElementInteraction(session, {
        nextPoint: atAngle(angle),
      });
    expect(session.rotationDelta).toBeCloseTo(360);
    expect(session.moved).toBe(false);
    expect(endElementInteraction(session, { commit: true }).edits).toEqual([]);
  });

  it("取消、未拖动、拖回原位与低于原包精度的变化均不生成edit", () => {
    const session = begin();
    const next = updateElementInteraction(session, {
      nextPoint: { x: 20, y: 30 },
    });
    expect(endElementInteraction(next, { commit: false }).edits).toEqual([]);
    expect(endElementInteraction(session, { commit: true }).edits).toEqual([]);
    expect(
      endElementInteraction(
        updateElementInteraction(next, { nextPoint: { x: 0, y: 0 } }),
        { commit: true },
      ).edits,
    ).toEqual([]);
    expect(
      endElementInteraction(
        updateElementInteraction(session, { nextPoint: { x: 1e-7, y: 0 } }),
        { commit: true },
      ).edits,
    ).toEqual([]);
    expect(endElementInteraction(null, { commit: true }).edits).toEqual([]);
  });

  it("NaN、Infinity与EMU溢出不污染已有有效预览", () => {
    const session = begin([target("2", 8e11)]);
    const valid = updateElementInteraction(session, {
      nextPoint: { x: 1, y: 2 },
    });
    for (const point of [
      { x: NaN, y: 0 },
      { x: Infinity, y: 0 },
      { x: 8e11, y: 0 },
    ])
      expect(updateElementInteraction(valid, { nextPoint: point })).toBe(valid);
    expect(
      beginElementInteraction({
        ...session,
        targets: [target("2", NaN)],
        elementId: "2",
      }),
    ).toBeNull();
  });

  it("输入选择与对象在开始时复制，更新和结束不修改调用方数据", () => {
    const targets = [target()];
    const selection = selectAllSlideElements(targets);
    const session = beginElementInteraction({
      slideId: "512",
      targets,
      selection,
      elementId: "2",
      point: { x: 0, y: 0 },
      mode: "move",
    })!;
    targets[0].frame.x = 1000;
    selection.selectedElementIds.length = 0;
    const next = updateElementInteraction(session, {
      nextPoint: { x: 10, y: 20 },
    });
    expect(next.preview[0].frame.x).toBe(10);
    expect(session.targets[0].frame.x).toBe(0);
    expect(session.selection.selectedElementIds).toEqual(["2"]);
    const result = endElementInteraction(next, { commit: true });
    result.edits[0].frame!.x = 999;
    expect(next.preview[0].frame.x).toBe(10);
  });

  it.each([
    {
      mode: "move" as const,
      point: { x: 0, y: 0 },
      nextPoint: { x: -3.25, y: 4.5 },
    },
    {
      mode: "resize" as const,
      point: { x: 50, y: 20 },
      nextPoint: { x: 100, y: 40 },
    },
    {
      mode: "rotate" as const,
      point: { x: 35, y: 10 },
      nextPoint: { x: 25, y: 20 },
    },
  ])(
    "批量$mode edit可回写真实原包，重新解析保持对象及未编辑payload",
    async ({ mode, point, nextPoint }) => {
      const zip = await JSZip.loadAsync(
        readFileSync(
          "src/components/artifact/presentation/__fixtures__/review.pptx",
        ),
      );
      const path = "ppt/slides/slide1.xml";
      const source = await zip.file(path)!.async("string");
      const xml = new DOMParser().parseFromString(source, "application/xml");
      const shape = xml.getElementsByTagNameNS(
        "http://schemas.openxmlformats.org/presentationml/2006/main",
        "sp",
      )[0];
      const clone = shape.cloneNode(true) as Element;
      clone
        .getElementsByTagNameNS(
          "http://schemas.openxmlformats.org/presentationml/2006/main",
          "cNvPr",
        )[0]
        .setAttribute("id", "3");
      shape.parentElement!.append(clone);
      for (const [index, element] of [shape, clone].entries()) {
        const xfrm = element.getElementsByTagNameNS(
          "http://schemas.openxmlformats.org/drawingml/2006/main",
          "xfrm",
        )[0];
        xfrm.setAttribute("flipH", "1");
        xfrm.setAttribute("flipV", "1");
        const off = xfrm.children[0],
          ext = xfrm.children[1];
        off.setAttribute("x", String(index * 30 * 9525));
        off.setAttribute("y", String(index * 10 * 9525));
        ext.setAttribute("cx", String((index ? 20 : 10) * 9525));
        ext.setAttribute("cy", String((index ? 10 : 20) * 9525));
      }
      zip.file(path, new XMLSerializer().serializeToString(xml));
      zip.file(
        "customXml/interaction-retained.bin",
        new Uint8Array([0, 255, 19]),
      );
      const input = await zip.generateAsync({ type: "uint8array" });
      const session = updateElementInteraction(
        begin(
          [target("2", 0, 0, 10, 20), target("3", 30, 10, 20, 10)],
          mode,
          point,
        ),
        { nextPoint },
      );
      const edits = endElementInteraction(session, { commit: true }).edits;
      const output = await editPresentationPackage(input, edits);
      const model = buildPresentation(
        await parseZip(output.slice().buffer as ArrayBuffer),
      );
      materializeSlideNodes(model, model.slides[0]);
      expect(model.slides[0].nodes.map(({ id }) => id)).toEqual(["2", "3"]);
      for (const node of model.slides[0].nodes) {
        const expected = session.preview.find(({ id }) => id === node.id)!;
        expectFrame(
          { ...node.position, width: node.size.w, height: node.size.h },
          Object.fromEntries(
            Object.entries(expected.frame).map(([key, value]) => [
              key,
              Math.round(value * 9525) / 9525,
            ]),
          ) as PresentationElementTarget["frame"],
        );
        expect(node.rotation).toBe(expected.rotation);
        expect(node.flipH).toBe(true);
        expect(node.flipV).toBe(true);
      }
      const saved = await JSZip.loadAsync(output);
      for (const name of Object.keys(zip.files).filter(
        (name) => !zip.files[name].dir && name !== path,
      ))
        expect(await saved.file(name)!.async("uint8array"), name).toEqual(
          await zip.file(name)!.async("uint8array"),
        );
      const restored = await editPresentationPackage(
        output,
        session.targets.map((element) => ({
          slideId: "512",
          elementId: element.id,
          frame: { ...element.frame, rotation: element.rotation },
        })),
      );
      const roundtrip = buildPresentation(
        await parseZip(restored.slice().buffer as ArrayBuffer),
      );
      materializeSlideNodes(roundtrip, roundtrip.slides[0]);
      expect(
        roundtrip.slides[0].nodes.map((node) => [
          node.id,
          node.position,
          node.size,
          node.rotation,
          node.flipH,
          node.flipV,
        ]),
      ).toEqual([
        ["2", { x: 0, y: 0 }, { w: 10, h: 20 }, 0, true, true],
        ["3", { x: 30, y: 10 }, { w: 20, h: 10 }, 0, true, true],
      ]);
    },
  );
});
