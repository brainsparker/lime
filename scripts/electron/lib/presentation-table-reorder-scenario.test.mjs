import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { it } from "vitest";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import {
  modifyStructure,
  structureFixture,
} from "../../../src/components/artifact/presentation/presentationTableStructurePackage.testFixtures.ts";
import {
  assertPresentationTableReorderSave,
  presentationTableReorderExpectations,
  readPresentationTableReorderFile,
} from "./presentation-table-reorder-scenario.mjs";

const target = { slideId: "512", tableId: "7", type: "move-column" };
const slidePath = "ppt/slides/slide1.xml";

async function fixtureFor(t, bytes) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-table-reorder-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Preview-report.pptx");
  const read = async (bytes) => {
    fs.writeFileSync(filePath, bytes);
    return readPresentationTableReorderFile(filePath);
  };
  return { original: await read(bytes), read };
}

it("手写六格矩阵明确初稿、AltRight和外侧列移到首列的独立期望", async (t) => {
  const { original } = await fixtureFor(t, await tableFixture());
  const plan = presentationTableReorderExpectations(original);
  assert.deepEqual(plan.keyboard, {
    matrix: [
      [{ from: [0, 1] }, { from: [0, 0] }, { from: [0, 2] }],
      [{ from: [1, 1] }, { from: [1, 0] }, { from: [1, 2] }],
    ],
    columnOrder: [1, 0, 2],
  });
  assert.deepEqual(plan.pointer, {
    matrix: [
      [{ from: [0, 2] }, { from: [0, 1] }, { from: [0, 0] }],
      [{ from: [1, 2] }, { from: [1, 1] }, { from: [1, 0] }],
    ],
    columnOrder: [2, 1, 0],
  });
  assert.equal(
    assertPresentationTableReorderSave(original, original, plan.initial)
      .preservedCells,
    6,
  );
});

it("两次原包列移动由手写矩阵验收，所有原格XML/非目标ZIP保留", async (t) => {
  let bytes = await tableFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const plan = presentationTableReorderExpectations(original);
  for (const [index, insertionIndex, expected] of [
    [0, 2, plan.keyboard],
    [2, 0, plan.pointer],
  ]) {
    bytes = await editPresentationTablePackage(bytes, [
      { ...target, index, insertionIndex },
    ]);
    const preserved = assertPresentationTableReorderSave(
      original,
      await read(bytes),
      expected,
    );
    assert.equal(preserved.preservedCells, 6);
    assert.ok(preserved.preservedParts > 10);
  }
});

it("非均匀轨道、列元数据、行未知兄弟与frame未知内容随正确owner保留", async (t) => {
  let bytes = await modifyStructure(
    await structureFixture(),
    ({ frame, rows, xml }) => {
      const frameNote = xml.createElementNS("urn:keep", "keep:frame-note");
      frameNote.textContent = "FRAME_RETAINED";
      frame.append(frameNote);
      const rowNote = xml.createElementNS("urn:keep", "keep:row-note");
      rowNote.textContent = "ROW_RETAINED";
      rows[0].append(rowNote);
    },
  );
  const { original, read } = await fixtureFor(t, bytes);
  const plan = presentationTableReorderExpectations(original);
  bytes = await editPresentationTablePackage(bytes, [
    { ...target, index: 0, insertionIndex: 2 },
  ]);
  assertPresentationTableReorderSave(
    original,
    await read(bytes),
    plan.keyboard,
  );
  bytes = await editPresentationTablePackage(bytes, [
    { ...target, index: 2, insertionIndex: 0 },
  ]);
  const after = await read(bytes);
  assertPresentationTableReorderSave(original, after, plan.pointer);
  assert.deepEqual(after.columnWidths, [2286000, 1524000, 762000]);
  assert.deepEqual(after.rowHeights, [685800, 1143000]);
  for (const [mutate, failure] of [
    [
      (xml) => xml.replace('keep:column="0"', 'keep:column="lost"'),
      /column metadata/,
    ],
    [(xml) => xml.replace("ROW_RETAINED", "ROW_LOST"), /row metadata/],
    [
      (xml) => xml.replace("FRAME_RETAINED", "FRAME_LOST"),
      /graphic-frame content/,
    ],
  ]) {
    const zip = await JSZip.loadAsync(bytes);
    zip.file(slidePath, mutate(await zip.file(slidePath).async("string")));
    const damaged = await read(await zip.generateAsync({ type: "uint8array" }));
    assert.throws(
      () => assertPresentationTableReorderSave(original, damaged, plan.pointer),
      failure,
    );
  }
});

it("拒绝只改文字矩阵而丢失cell格式，或错误顺序/重复列的伪通过", async (t) => {
  const bytes = await tableFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const plan = presentationTableReorderExpectations(original);
  const moved = await editPresentationTablePackage(bytes, [
    { ...target, index: 0, insertionIndex: 2 },
  ]);
  const zip = await JSZip.loadAsync(moved);
  zip.file(
    slidePath,
    (await zip.file(slidePath).async("string")).replace(
      'typeface="Arial"',
      'typeface="Changed"',
    ),
  );
  const damaged = await read(await zip.generateAsync({ type: "uint8array" }));
  assert.throws(
    () => assertPresentationTableReorderSave(original, damaged, plan.keyboard),
    /original cell payload/,
  );
  const actual = await read(moved);
  assert.throws(() =>
    assertPresentationTableReorderSave(original, actual, plan.pointer),
  );
  assert.throws(
    () =>
      assertPresentationTableReorderSave(original, actual, {
        ...plan.keyboard,
        columnOrder: [1, 1, 2],
      }),
    /handwritten permutation/,
  );
});

it("native场景前置检查明确拒绝merged和非2x3源稿，不扩大覆盖声明", async (t) => {
  const { original } = await fixtureFor(
    t,
    await tableFixture({ merged: true }),
  );
  assert.throws(
    () => presentationTableReorderExpectations(original),
    /explicitly unmerged/,
  );
  assert.throws(() =>
    presentationTableReorderExpectations({ ...original, cells: [] }),
  );
});
