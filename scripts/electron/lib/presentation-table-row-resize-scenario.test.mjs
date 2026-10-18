import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { it } from "vitest";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import { readPresentationTableStructureFile } from "./presentation-table-structure-scenario.mjs";
import {
  assertPresentationTableRowResizeSave,
  assertPresentationTableRowContent,
  presentationTableRowPointerDelta,
} from "./presentation-table-row-resize-scenario.mjs";

const emusPerPixel = 9525;
const target = { slideId: "512", tableId: "7", type: "resize-row", index: 0 };
const slidePath = "ppt/slides/slide1.xml";

async function fixtureFor(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-row-resize-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Preview-report.pptx");
  const bytes = await tableFixture();
  const read = async (value) => {
    fs.writeFileSync(filePath, value);
    return readPresentationTableStructureFile(filePath);
  };
  return { bytes, original: await read(bytes), read };
}

it("行拖动保存断言读取真实包尺寸，保留六格XML、列轨和非目标ZIP", async (t) => {
  const { bytes, original, read } = await fixtureFor(t);
  const resized = await read(
    await editPresentationTablePackage(bytes, [{ ...target, size: 108 }]),
  );
  const result = assertPresentationTableRowResizeSave(original, resized, {
    size: 108,
  });
  assert.equal(result.preservedCells, 6);
  assert.ok(result.preservedParts > 10);
  assert.equal(resized.rowHeights[1], 96 * emusPerPixel);
  assert.equal(resized.geometry.height, 204 * emusPerPixel);
  assert.throws(
    () =>
      assertPresentationTableRowResizeSave(original, resized, { size: 109 }),
    /independently expected/,
  );
  assert.throws(
    () =>
      assertPresentationTableRowResizeSave(original, resized, { maximum: 100 }),
    /within/,
  );
});

it("内容下限断言接受较小的合法目标行并拒绝其他行列一起变化", async (t) => {
  const { bytes, original, read } = await fixtureFor(t);
  const after = await read(
    await editPresentationTablePackage(bytes, [{ ...target, size: 28 }]),
  );
  assertPresentationTableRowResizeSave(original, after, {
    minimum: 20,
    maximum: 95,
  });
  assert.throws(
    () =>
      assertPresentationTableRowResizeSave(original, after, { minimum: 29 }),
    /within/,
  );
  for (const axis of ["rowHeights", "columnWidths"]) {
    const changed = structuredClone(after);
    changed[axis][1] += emusPerPixel;
    changed.geometry[axis === "rowHeights" ? "height" : "width"] +=
      emusPerPixel;
    assert.throws(
      () => assertPresentationTableRowResizeSave(original, changed),
      /deep-equal/,
    );
  }
});

it("reader与保存护栏拒绝格内格式和非目标二进制payload被重写", async (t) => {
  const { bytes, original, read } = await fixtureFor(t);
  const cellZip = await JSZip.loadAsync(bytes);
  cellZip.file(
    slidePath,
    (await cellZip.file(slidePath).async("string")).replace(
      'typeface="Arial"',
      'typeface="Changed"',
    ),
  );
  const alteredCell = await read(
    await cellZip.generateAsync({ type: "uint8array" }),
  );
  assert.throws(
    () => assertPresentationTableRowResizeSave(original, alteredCell),
    /original cell payload/,
  );
  const binaryZip = await JSZip.loadAsync(bytes);
  binaryZip.file("ppt/media/table-retained.bin", new Uint8Array([1, 2, 3]));
  const alteredBinary = await read(
    await binaryZip.generateAsync({ type: "uint8array" }),
  );
  assert.throws(
    () => assertPresentationTableRowResizeSave(original, alteredBinary),
    /non-target ZIP payload/,
  );
});

it("行轴原生增量由屏幕向量投影校验，支持旋转和翻转且拒绝缺失坐标", () => {
  const lifecycle = (end) => ({
    events: [
      { type: "pointerdown", screenX: 100, screenY: 200 },
      { type: "pointermove", screenX: 88, screenY: 200 },
      { type: "pointerup", ...end },
    ],
  });
  assert.equal(
    presentationTableRowPointerDelta(lifecycle({ screenX: 76, screenY: 200 }), {
      x: -2,
      y: 0,
    }),
    12,
  );
  assert.equal(
    presentationTableRowPointerDelta(
      lifecycle({ screenX: 100, screenY: 176 }),
      { x: 0, y: -2 },
    ),
    12,
  );
  assert.equal(
    presentationTableRowPointerDelta(
      lifecycle({ screenX: 103, screenY: 204 }),
      { x: 0.3, y: 0.4 },
    ),
    10,
  );
  assert.throws(
    () =>
      presentationTableRowPointerDelta(lifecycle({ screenX: 76 }), {
        x: -2,
        y: 0,
      }),
    /coordinates/,
  );
  assert.throws(() =>
    presentationTableRowPointerDelta(lifecycle({ screenX: 76, screenY: 200 }), {
      x: 0,
      y: 0,
    }),
  );
});

it("内容证明只接受六个已布局格的实测scroll/client高度，溢出和空证据均失败", () => {
  const cells = () =>
    Array.from({ length: 2 }, () =>
      Array.from({ length: 3 }, () => ({
        rows: 1,
        columns: 1,
        clientHeight: 28,
        scrollHeight: 28,
      })),
    );
  assert.equal(assertPresentationTableRowContent(cells()), 6);
  const clipped = cells();
  clipped[0][1].scrollHeight = 31;
  assert.throws(
    () => assertPresentationTableRowContent(clipped),
    /cell 0:1 content is not clipped/,
  );
  for (const value of [0, undefined, NaN]) {
    const unobserved = cells();
    unobserved[1][2].clientHeight = value;
    assert.throws(
      () => assertPresentationTableRowContent(unobserved),
      /observable live layout/,
    );
  }
  assert.throws(
    () => assertPresentationTableRowContent([]),
    /two physical rows/,
  );
});
