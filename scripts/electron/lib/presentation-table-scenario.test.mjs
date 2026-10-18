import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { it } from "vitest";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import {
  assertPresentationTableSave,
  readPresentationTableFile,
  writePresentationTableFixture,
} from "./presentation-table-scenario.mjs";

const slidePath = "ppt/slides/slide1.xml";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const target = { slideId: "512", tableId: "7" };
const first = { row: 0, column: 0, text: "第一格_中文 <&>", bold: true };
const second = { row: 0, column: 1, text: "第二格_独立内容" };
const cleared = { row: 1, column: 2, text: "" };

async function fixtureFor(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-pptx-table-scenario-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Preview-report.pptx");
  const manifest = await writePresentationTableFixture(filePath);
  return { directory, filePath, manifest, bytes: fs.readFileSync(filePath) };
}

async function editedBytes(bytes) {
  return editPresentationTablePackage(Uint8Array.from(bytes), [
    {
      ...target,
      type: "set-cell-text",
      row: first.row,
      column: first.column,
      text: first.text,
    },
    {
      ...target,
      type: "set-cell-text",
      row: second.row,
      column: second.column,
      text: second.text,
    },
    {
      ...target,
      type: "set-cell-style",
      range: { row: 0, column: 0, rowCount: 1, columnCount: 1 },
      style: { bold: true },
    },
    {
      ...target,
      type: "clear-cells",
      range: { row: 1, column: 2, rowCount: 1, columnCount: 1 },
    },
  ]);
}

async function writeMutation(directory, name, bytes, change) {
  const zip = await JSZip.loadAsync(bytes);
  await change(zip);
  const filePath = path.join(directory, `${name}.pptx`);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
  return readPresentationTableFile(filePath);
}

it("落盘夹具保留三页identity、两行三列表格和未知ZIP payload", async (t) => {
  const { directory, filePath, manifest, bytes } = await fixtureFor(t);
  const source = await readPresentationTableFile(filePath);
  assert.equal(manifest.sha256, digest(bytes));
  assert.equal(source.sha256, manifest.sha256);
  assert.deepEqual(source.slideIds, ["512", "900", "300"]);
  assert.equal(source.tableId, "7");
  assert.equal(source.tablePart, slidePath);
  assert.equal(source.rowCount, 2);
  assert.equal(source.columnCount, 3);
  assert.deepEqual(
    source.cells.map(({ row, column, text, bold }) => ({
      row,
      column,
      text,
      bold,
    })),
    [
      { row: 0, column: 0, text: "TABLE_R1C1", bold: false },
      { row: 0, column: 1, text: "TABLE_R1C2", bold: false },
      { row: 0, column: 2, text: "TABLE_R1C3", bold: false },
      { row: 1, column: 0, text: "TABLE_R2C1", bold: false },
      { row: 1, column: 1, text: "TABLE_R2C2", bold: false },
      { row: 1, column: 2, text: "TABLE_R2C3", bold: false },
    ],
  );
  assert.equal(
    source.parts["ppt/media/table-retained.bin"],
    digest(new Uint8Array([0, 255, 128, 19])),
  );
  assert.equal(
    source.parts["customXml/table-retained.xml"],
    digest('<keep xmlns="urn:keep">retained</keep>'),
  );
  assert.equal(
    fs.readFileSync(path.join(directory, "Broken.pptx"), "utf8"),
    "invalid presentation",
  );
});

it("真实生产codec的独立cell文字、加粗、清空可由场景断言完整读回", async (t) => {
  const { directory, filePath, bytes } = await fixtureFor(t);
  const before = await readPresentationTableFile(filePath);
  const savedPath = path.join(directory, "Edited.pptx");
  fs.writeFileSync(savedPath, await editedBytes(bytes));
  const saved = await readPresentationTableFile(savedPath);
  const preserved = assertPresentationTableSave(before, saved, [
    first,
    second,
    cleared,
  ]);
  assert.notEqual(saved.sha256, before.sha256);
  assert.equal(preserved.preservedParts, Object.keys(before.parts).length - 1);
  assert.equal(preserved.preservedCells, 3);
  assert.equal(saved.cells[0].text, first.text);
  assert.equal(saved.cells[0].bold, true);
  assert.equal(saved.cells[1].text, second.text);
  assert.equal(saved.cells.at(-1).text, "");
  assert.throws(
    () => assertPresentationTableSave(before, saved, [first, cleared]),
    /source cell text/,
  );
  assert.throws(
    () =>
      assertPresentationTableSave(before, saved, [
        { ...first, bold: false },
        second,
        cleared,
      ]),
    /source cell bold/,
  );
  assert.throws(
    () =>
      assertPresentationTableSave(before, saved, [
        first,
        second,
        cleared,
        { row: 9, column: 9 },
      ]),
    /expected cell exists/,
  );
  assert.throws(
    () =>
      assertPresentationTableSave(before, saved, [
        first,
        first,
        second,
        cleared,
      ]),
    /unique/,
  );
});

it("允许目标正文补齐同义namespace声明，仍逐字保护未编辑cell", async (t) => {
  const { directory, filePath, bytes } = await fixtureFor(t);
  const before = await readPresentationTableFile(filePath);
  const saved = await writeMutation(
    directory,
    "namespace-closure",
    await editedBytes(bytes),
    async (zip) => {
      const xml = await zip.file(slidePath).async("string");
      const closed = xml.replace(
        "<a:txBody>",
        '<a:txBody xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      );
      assert.notEqual(closed, xml);
      zip.file(slidePath, closed);
    },
  );
  assert.notEqual(saved.cells[0].xmlSha256, before.cells[0].xmlSha256);
  const preserved = assertPresentationTableSave(before, saved, [
    first,
    second,
    cleared,
  ]);
  assert.equal(preserved.preservedCells, 3);
});

it("拒绝静默改变格网/几何、cell扩展、原文字格式或非表格XML", async (t) => {
  const { directory, filePath, bytes } = await fixtureFor(t);
  const original = await readPresentationTableFile(filePath);
  const edited = await editedBytes(bytes);
  const mutateSlide = (replace) => async (zip) =>
    zip.file(slidePath, replace(await zip.file(slidePath).async("string")));
  const mutations = [
    [
      "column-width",
      (xml) => xml.replace('<a:gridCol w="1828800"', '<a:gridCol w="2000000"'),
      /geometry, grid/,
    ],
    [
      "table-rotation",
      (xml) => xml.replace('rot="60000"', 'rot="120000"'),
      /geometry, grid/,
    ],
    [
      "cell-extension",
      (xml) => xml.replace('value="retained"', 'value="lost"'),
      /geometry, grid/,
    ],
    [
      "font-family",
      (xml) => xml.replace('typeface="Arial"', 'typeface="Changed"'),
      /other run formatting/,
    ],
    [
      "body-properties",
      (xml) => xml.replace('wrap="square"', 'wrap="none"'),
      /body, list and paragraph properties/,
    ],
    [
      "paragraph-properties",
      (xml) => xml.replace('algn="ctr"', 'algn="l"'),
      /body, list and paragraph properties/,
    ],
    [
      "list-properties",
      (xml) => xml.replace('marL="42"', 'marL="43"'),
      /body, list and paragraph properties/,
    ],
    [
      "list-namespace",
      (xml) =>
        xml.replace(
          '<a:lvl1pPr marL="42"/>',
          '<other:lvl1pPr xmlns:other="urn:changed" marL="42"/>',
        ),
      /body, list and paragraph properties/,
    ],
    [
      "shape-text",
      (xml) => xml.replace("SLIDE_PREVIEW_01", "UNRELATED_TITLE_OVERWRITE"),
      /non-table slide XML/,
    ],
    [
      "unselected-cell",
      (xml) => xml.replace("TABLE_R1C3", "UNSELECTED_OVERWRITE"),
      /source cell text/,
    ],
  ];
  for (const [name, replace, failure] of mutations) {
    const after = await writeMutation(
      directory,
      name,
      edited,
      mutateSlide(replace),
    );
    assert.throws(
      () =>
        assertPresentationTableSave(original, after, [first, second, cleared]),
      failure,
    );
  }
});

it("拒绝非目标ZIP成员被覆盖或丢弃，允许的cell编辑不能掩盖包损坏", async (t) => {
  const { directory, filePath, bytes } = await fixtureFor(t);
  const original = await readPresentationTableFile(filePath);
  const edited = await editedBytes(bytes);
  const overwritten = await writeMutation(
    directory,
    "overwritten",
    edited,
    (zip) => {
      zip.file("ppt/media/table-retained.bin", new Uint8Array([1]));
    },
  );
  assert.throws(
    () =>
      assertPresentationTableSave(original, overwritten, [
        first,
        second,
        cleared,
      ]),
    /unedited ZIP part/,
  );
  const missing = await writeMutation(directory, "missing", edited, (zip) => {
    zip.remove("customXml/table-retained.xml");
  });
  assert.throws(
    () =>
      assertPresentationTableSave(original, missing, [first, second, cleared]),
    assert.AssertionError,
  );
  await assert.rejects(
    readPresentationTableFile(path.join(directory, "Broken.pptx")),
  );
  await assert.rejects(
    writeMutation(directory, "wrong-table", edited, async (zip) => {
      zip.file(
        slidePath,
        (await zip.file(slidePath).async("string")).replace('id="7"', 'id="8"'),
      );
    }),
    /table identity is unique/,
  );
  await assert.rejects(
    writeMutation(directory, "merged", edited, async (zip) => {
      zip.file(
        slidePath,
        (await zip.file(slidePath).async("string")).replace(
          "<a:tc>",
          '<a:tc gridSpan="2">',
        ),
      );
    }),
    /span one slot/,
  );
});
