import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { it } from "vitest";
import {
  buildPresentation,
  materializeSlideNodes,
  parseZip,
} from "@aiden0z/pptx-renderer";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import { structureFixture } from "../../../src/components/artifact/presentation/presentationTableStructurePackage.testFixtures.ts";
import {
  assertPresentationTableStructureSave,
  readPresentationTableStructureFile,
} from "./presentation-table-structure-scenario.mjs";

const target = { slideId: "512", tableId: "7" };
const slidePath = "ppt/slides/slide1.xml";
const source = (row, column) => ({ from: [row, column] });
const [A, B, C, D, E, F] = [
  source(0, 0),
  source(0, 1),
  source(0, 2),
  source(1, 0),
  source(1, 1),
  source(1, 2),
];
const blank = { text: "" };
const originalMatrix = [
  [A, B, C],
  [D, E, F],
];
const action = (type, index) => ({ ...target, type, index });

async function fixtureFor(t, bytes) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-table-structure-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Preview-report.pptx");
  fs.writeFileSync(filePath, bytes);
  const original = await readPresentationTableStructureFile(filePath);
  const read = async (value) => {
    fs.writeFileSync(filePath, value);
    return readPresentationTableStructureFile(filePath);
  };
  return { filePath, original, read };
}

async function renderedTable(bytes) {
  const model = buildPresentation(
    await parseZip(Uint8Array.from(bytes).buffer),
  );
  materializeSlideNodes(model, model.slides[0]);
  const table = model.slides[0].nodes.find((node) => node.id === "7");
  assert.equal(table?.nodeType, "table");
  return table;
}

it("逐次行插入、删除落盘可由手写矩阵验证，并逐格保留原包payload", async (t) => {
  let bytes = await tableFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const above = {
    matrix: [
      [A, B, C],
      [blank, blank, blank],
      [D, E, F],
    ],
    columnWidths: [192, 192, 192],
    rowHeights: [96, 96, 96],
  };
  const below = {
    ...above,
    matrix: [
      [A, B, C],
      [blank, blank, blank],
      [blank, blank, blank],
      [D, E, F],
    ],
    rowHeights: [96, 96, 96, 96],
  };
  for (const [edit, expected] of [
    [action("insert-rows", 1), above],
    [action("insert-rows", 1), below],
    [action("delete-rows", 1), above],
  ]) {
    bytes = await editPresentationTablePackage(bytes, [edit]);
    const evidence = assertPresentationTableStructureSave(
      original,
      await read(bytes),
      expected,
    );
    assert.equal(evidence.preservedCells, 6);
    assert.ok(evidence.preservedParts > 10);
  }
});

it("左右列操作和末行追加保留所有源格，外框与新增tracks一致", async (t) => {
  let bytes = await tableFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const left = {
    matrix: [
      [A, blank, B, C],
      [D, blank, E, F],
    ],
    columnWidths: [192, 192, 192, 192],
    rowHeights: [96, 96],
  };
  const right = {
    ...left,
    matrix: [
      [A, blank, blank, B, C],
      [D, blank, blank, E, F],
    ],
    columnWidths: [192, 192, 192, 192, 192],
  };
  const appended = {
    ...left,
    matrix: [...left.matrix, [blank, blank, blank, blank]],
    rowHeights: [96, 96, 96],
  };
  for (const [edit, expected] of [
    [action("insert-columns", 1), left],
    [action("insert-columns", 1), right],
    [action("delete-columns", 1), left],
    [action("insert-rows", 2), appended],
  ]) {
    bytes = await editPresentationTablePackage(bytes, [edit]);
    assert.equal(
      assertPresentationTableStructureSave(
        original,
        await read(bytes),
        expected,
      ).preservedCells,
      6,
    );
  }
});

it("非均匀tracks resize保留旋转/翻转和未知transform，真实renderer按原identity重建", async (t) => {
  const bytes = await structureFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const output = await editPresentationTablePackage(bytes, [
    {
      ...target,
      type: "resize-table",
      frame: { left: 96, top: 192, width: 600, height: 300 },
      rowHeights: [100, 200],
      columnWidths: [100, 200, 300],
    },
  ]);
  const after = await read(output);
  assert.equal(
    assertPresentationTableStructureSave(original, after, {
      matrix: originalMatrix,
      columnWidths: [100, 200, 300],
      rowHeights: [100, 200],
    }).preservedCells,
    6,
  );
  const table = await renderedTable(output);
  assert.deepEqual(table.columns, [100, 200, 300]);
  assert.deepEqual(
    table.rows.map((row) => row.height),
    [100, 200],
  );
  assert.deepEqual(
    [
      table.position.x,
      table.position.y,
      table.size.w,
      table.size.h,
      table.rotation,
      table.flipH,
      table.flipV,
    ],
    [96, 192, 600, 300, 1, true, true],
  );
});

it("合并区内部插行和插列保留锚点正文，renderer读回3×3合并跨度与continuation", async (t) => {
  const bytes = await structureFixture({ merged: true });
  const { original, read } = await fixtureFor(t, bytes);
  const output = await editPresentationTablePackage(bytes, [
    action("insert-rows", 1),
    action("insert-columns", 1),
  ]);
  const after = await read(output);
  assert.equal(
    assertPresentationTableStructureSave(original, after, {
      matrix: [
        [{ text: "TABLE_R1C1" }, blank, blank, C],
        [blank, blank, blank, blank],
        [blank, blank, blank, F],
      ],
      columnWidths: [80, 160, 160, 240],
      rowHeights: [72, 120, 120],
    }).preservedCells,
    2,
  );
  assert.deepEqual(after.cells[0][0].merge, {
    gridSpan: "3",
    rowSpan: "3",
    hMerge: null,
    vMerge: null,
  });
  assert.deepEqual(after.cells[0][1].merge, {
    gridSpan: null,
    rowSpan: "3",
    hMerge: "1",
    vMerge: null,
  });
  assert.deepEqual(after.cells[2][2].merge, {
    gridSpan: null,
    rowSpan: null,
    hMerge: "1",
    vMerge: "1",
  });
  const table = await renderedTable(output);
  assert.deepEqual(table.columns, [80, 160, 160, 240]);
  assert.deepEqual(
    table.rows.map((row) => row.height),
    [72, 120, 120],
  );
  assert.deepEqual(
    [table.rows[0].cells[0].gridSpan, table.rows[0].cells[0].rowSpan],
    [3, 3],
  );
  assert.equal(
    table.rows[0].cells[0].textBody.paragraphs[0].runs[0].text,
    "TABLE_R1C1",
  );
});

it("证据断言拒绝源格格式、table属性、transform或非目标ZIP payload被改写", async (t) => {
  const bytes = await tableFixture();
  const { original, read } = await fixtureFor(t, bytes);
  const expected = {
    matrix: originalMatrix,
    columnWidths: [192, 192, 192],
    rowHeights: [96, 96],
  };
  const mutations = [
    [
      (xml) => xml.replace('typeface="Arial"', 'typeface="Changed"'),
      /original cell payload/,
    ],
    [
      (xml) => xml.replace('firstRow="1"', 'firstRow="0"'),
      /table style and unknown properties/,
    ],
    [
      (xml) => xml.replace('rot="60000"', 'rot="120000"'),
      /rotation, flips and transform/,
    ],
    [
      (xml) => xml.replace('cx="5486400"', 'cx="5486401"'),
      /frame width equals persisted/,
    ],
  ];
  for (const [mutate, failure] of mutations) {
    const zip = await JSZip.loadAsync(bytes);
    zip.file(slidePath, mutate(await zip.file(slidePath).async("string")));
    const after = await read(await zip.generateAsync({ type: "uint8array" }));
    assert.throws(
      () => assertPresentationTableStructureSave(original, after, expected),
      failure,
    );
  }
  const zip = await JSZip.loadAsync(bytes);
  zip.file("ppt/media/table-retained.bin", new Uint8Array([1]));
  const after = await read(await zip.generateAsync({ type: "uint8array" }));
  assert.throws(
    () => assertPresentationTableStructureSave(original, after, expected),
    /non-target ZIP payload/,
  );
});
