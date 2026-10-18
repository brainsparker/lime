import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { spawnSync } from "node:child_process";
import { it } from "vitest";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import {
  assertPresentationTableAdvancedSave,
  readPresentationTableAdvancedFile,
  assertPresentationTableNativePointerEvents,
} from "./presentation-table-advanced-scenario.mjs";

const target = { slideId: "512", tableId: "7" };
const range = { row: 0, column: 0, rowCount: 2, columnCount: 2 };
const originalTracks = {
  columnWidths: [1828800, 1828800, 1828800],
  rowHeights: [914400, 914400],
};
const merged = { ...originalTracks, merged: true };
const unmerged = { ...originalTracks, merged: false };
const slidePath = "ppt/slides/slide1.xml";

async function fixtureFor(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-table-advanced-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Preview-report.pptx");
  const bytes = await tableFixture();
  const read = async (value) => {
    fs.writeFileSync(filePath, value);
    return readPresentationTableAdvancedFile(filePath);
  };
  return { bytes, read, original: await read(bytes) };
}

it("原包reader保留六格独立正文和非merge payload摘要", async (t) => {
  const { original } = await fixtureFor(t);
  assert.deepEqual(
    original.cells.map((row) => row.map((cell) => cell.text)),
    [
      ["TABLE_R1C1", "TABLE_R1C2", "TABLE_R1C3"],
      ["TABLE_R2C1", "TABLE_R2C2", "TABLE_R2C3"],
    ],
  );
  assert.equal(new Set(original.payloads).size, 6);
  assert.equal(
    assertPresentationTableAdvancedSave(original, original, unmerged)
      .preservedCells,
    6,
  );
});

it("取消证据只接受同一trusted touch pointer的原生move/cancel", () => {
  const event = (type, pointerId = 4) => ({
    type,
    pointerId,
    pointerType: "touch",
    isTrusted: true,
  });
  const valid = [
    event("pointerdown"),
    event("pointermove"),
    event("pointercancel"),
  ];
  assert.equal(
    assertPresentationTableNativePointerEvents(valid, "touch", "pointercancel")
      .pointerId,
    4,
  );
  for (const events of [
    valid.map((item) => ({ ...item, isTrusted: false })),
    [event("pointerdown"), event("pointermove"), event("pointercancel", 5)],
    valid.map((item) => ({ ...item, pointerType: "mouse" })),
    [event("pointerdown"), event("pointercancel")],
    [...valid, event("pointerup")],
  ])
    assert.throws(() =>
      assertPresentationTableNativePointerEvents(
        events,
        "touch",
        "pointercancel",
      ),
    );
});

it("主入口在任何进程或证据创建前拒绝advanced混用源稿和错误格式", () => {
  const entry = path.resolve(
    "scripts/electron/document-preview-fixture-smoke.mjs",
  );
  for (const [flags, message] of [
    [
      [
        "--presentation",
        "--presentation-table-advanced",
        "--presentation-table-structure",
      ],
      "independent source fixtures",
    ],
    [
      [
        "--presentation",
        "--presentation-table-advanced",
        "--presentation-editing",
      ],
      "independent source fixture",
    ],
    [["--presentation-table-advanced"], "requires presentation format"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [entry, "advanced-invalid-options", ...flags],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(message), result.stderr);
  }
  assert.equal(
    fs.existsSync(
      path.resolve(".lime/qc/professional-files/advanced-invalid-options"),
    ),
    false,
  );
});

it("合并四格只改手写markers，partial解除合并完整恢复六格payload", async (t) => {
  const { bytes, read, original } = await fixtureFor(t);
  const joined = await editPresentationTablePackage(bytes, [
    { ...target, type: "merge-cells", range },
  ]);
  const snapshot = await read(joined);
  assert.equal(
    assertPresentationTableAdvancedSave(original, snapshot, merged)
      .preservedCells,
    6,
  );
  const split = await editPresentationTablePackage(joined, [
    {
      ...target,
      type: "unmerge-cells",
      range: { row: 1, column: 1, rowCount: 1, columnCount: 1 },
    },
  ]);
  assert.equal(
    assertPresentationTableAdvancedSave(original, await read(split), unmerged)
      .preservedCells,
    6,
  );
});

it("单轨键盘步长后均分轴，精确尺寸与所有原格payload一同验收", async (t) => {
  const { bytes, read, original } = await fixtureFor(t);
  const resized = await editPresentationTablePackage(bytes, [
    { ...target, type: "resize-column", index: 0, size: 202 },
    { ...target, type: "resize-row", index: 0, size: 106 },
  ]);
  assertPresentationTableAdvancedSave(original, await read(resized), {
    columnWidths: [1924050, 1828800, 1828800],
    rowHeights: [1009650, 914400],
    merged: false,
  });
  const whole = { row: 0, column: 0, rowCount: 2, columnCount: 3 };
  const distributed = await editPresentationTablePackage(resized, [
    { ...target, type: "distribute-rows", range: whole },
    { ...target, type: "distribute-columns", range: whole },
  ]);
  const after = await read(distributed);
  assertPresentationTableAdvancedSave(original, after, {
    columnWidths: [1860550, 1860550, 1860550],
    rowHeights: [962025, 962025],
    merged: false,
  });
  assert.equal(after.geometry.width, 5581650);
  assert.equal(after.geometry.height, 1924050);
});

it("证据拒绝隐藏continuation正文、格式、未知payload或markers的额外改写", async (t) => {
  const { bytes, read, original } = await fixtureFor(t);
  const joined = await editPresentationTablePackage(bytes, [
    { ...target, type: "merge-cells", range },
  ]);
  for (const [mutate, failure] of [
    [
      (xml) => xml.replace("TABLE_R2C2", "LOST_HIDDEN_TEXT"),
      /cell retains its complete non-merge payload|source cell|deep-equal/,
    ],
    [
      (xml) => xml.replace('typeface="Arial"', 'typeface="Changed"'),
      /non-merge payload/,
    ],
    [
      (xml) => xml.replace('value="retained"', 'value="lost"'),
      /non-merge payload/,
    ],
    [(xml) => xml.replace('gridSpan="2"', 'gridSpan="3"'), /merge markers/],
  ]) {
    const zip = await JSZip.loadAsync(joined);
    zip.file(slidePath, mutate(await zip.file(slidePath).async("string")));
    const after = await read(await zip.generateAsync({ type: "uint8array" }));
    assert.throws(
      () => assertPresentationTableAdvancedSave(original, after, merged),
      failure,
    );
  }
});
