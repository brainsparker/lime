import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
  type TableNodeData,
} from "@aiden0z/pptx-renderer";
import { tableFixture } from "./presentationTablePackage.testFixtures";
import {
  findPresentationTableElement,
  measurePresentationTableRows,
} from "./presentationTableMeasure";

describe("真实renderer表格绑定与测量准备状态", () => {
  let slide: HTMLDivElement;
  let table: TableNodeData;
  const markup = (target = table) => {
    const frame = document.createElement("div");
    Object.assign(frame.style, {
      left: `${target.position.x}px`,
      top: `${target.position.y}px`,
      width: `${target.size.w}px`,
      height: `${target.size.h}px`,
      transform: `rotate(${target.rotation}deg)`,
    });
    const element = document.createElement("table");
    for (let row = 0; row < target.rows.length; row++) {
      const tr = element.insertRow();
      for (let column = 0; column < target.columns.length; column++) {
        const cell = target.rows[row].cells[column];
        if (cell.hMerge || cell.vMerge) continue;
        const td = tr.insertCell();
        td.colSpan = cell.gridSpan;
        td.rowSpan = cell.rowSpan;
      }
    }
    frame.append(element);
    slide.append(frame);
    return element;
  };
  const fromFixture = async (merged = false) => {
    const bytes = await tableFixture({ merged });
    const model = buildPresentation(
      await parseZip(bytes.slice().buffer as ArrayBuffer),
    );
    materializeSlideNodes(model, model.slides[0]);
    const value = model.slides[0].nodes.find((node) => node.id === "7");
    if (value?.nodeType !== "table") throw new Error("missing table");
    return value;
  };
  beforeEach(async () => {
    table = await fromFixture();
    slide = document.createElement("div");
    document.body.append(slide);
  });
  afterEach(() => slide.remove());

  it("按renderer的实际wrapper几何与格网找唯一目标，避免首个table误绑定", () => {
    const unrelated = markup();
    unrelated.parentElement!.style.left = "999px";
    const expected = markup();
    expect(findPresentationTableElement(slide, table)).toBe(expected);
    // 真实 Chromium 会把 EMU 解码后的768.4374803149606序列化为768.437px。
    table.size.h = 768.4374803149606;
    expected.parentElement!.style.height = "768.437px";
    expect(findPresentationTableElement(slide, table)).toBe(expected);
    markup();
    expect(findPresentationTableElement(slide, table)).toBeNull();
  });

  it("旋转、flip与完整合并格网都必须相符，不以row.cells数量代替逻辑列数", async () => {
    table = await fromFixture(true);
    table.flipH = true;
    table.flipV = true;
    const expected = markup();
    expect(findPresentationTableElement(slide, table)).toBeNull();
    expected.parentElement!.style.transform += " scaleX(-1) scaleY(-1)";
    expect(findPresentationTableElement(slide, table)).toBe(expected);
    expected.rows[0].cells[0].colSpan = 1;
    expect(findPresentationTableElement(slide, table)).toBeNull();
  });

  it("JSDOM没有真实字体/layout时明确not-ready，不伪造自然内容高度", () => {
    const element = markup();
    const before = slide.outerHTML;
    expect(
      measurePresentationTableRows({
        table,
        element,
        columnWidths: table.columns,
      }),
    ).toEqual({
      status: "not-ready",
      reason: "fonts-not-ready",
    });
    expect(slide.outerHTML).toBe(before);
    expect(
      document.querySelector("[data-presentation-table-measurement]"),
    ).toBeNull();
  });

  it("脱离实际renderer的DOM拒绝测量，不修改原表格或持有第二编辑稿", () => {
    const element = markup();
    element.remove();
    expect(
      measurePresentationTableRows({
        table,
        element,
        columnWidths: table.columns,
      }),
    ).toEqual({
      status: "not-ready",
      reason: "detached-renderer",
    });
    expect(
      document.querySelector("[data-presentation-table-measurement]"),
    ).toBeNull();
  });
});
