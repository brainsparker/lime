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
  renderSlide,
} from "@aiden0z/pptx-renderer";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { formatFixture } from "../../../src/components/artifact/presentation/presentationTableFormatPackage.testFixtures.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import {
  assertPresentationTableFormatFixture,
  assertPresentationTableFormatSave,
  assertPresentationTableFormatRenderer,
  readPresentationTableFormatFile,
  writePresentationTableFormatFixture,
} from "./presentation-table-format-scenario.mjs";

const identity = { slideId: "512", tableId: "7" };
const range = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
const slidePath = "ppt/slides/slide1.xml";

async function setup(t, bytes) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-table-format-"),
  );
  t.onTestFinished(() =>
    fs.rmSync(directory, { recursive: true, force: true }),
  );
  const filePath = path.join(directory, "Format.pptx");
  const read = async (bytes) => {
    fs.writeFileSync(filePath, bytes);
    return readPresentationTableFormatFile(filePath);
  };
  return { filePath, read, original: bytes ? await read(bytes) : null };
}

async function render(bytes, original, expected) {
  const model = buildPresentation(
    await parseZip(Uint8Array.from(bytes).buffer),
  );
  const slide = model.slides[0];
  materializeSlideNodes(model, slide);
  const errors = [];
  const handle = renderSlide(model, slide, {
    onNodeError: (id, error) => errors.push({ id, error }),
  });
  try {
    await handle.ready;
    assert.deepEqual(errors, []);
    const table = handle.element.querySelector("table");
    assert.ok(table);
    const state = {
      renderingEnvironment: {
        userAgent: table.ownerDocument.defaultView.navigator.userAgent,
        devicePixelRatio: table.ownerDocument.defaultView.devicePixelRatio,
      },
      texts: Array.from(table.rows, (row) =>
        Array.from(row.cells, (cell) => cell.textContent),
      ),
      renderer: Array.from(table.rows, (row) =>
        Array.from(row.cells, (cell) => {
          const style = cell.ownerDocument.defaultView.getComputedStyle(cell);
          return Object.fromEntries(
            ["Top", "Bottom", "Left", "Right"].map((side) => [
              side.toLowerCase(),
              {
                declaredWidth: cell.style[`border${side}Width`],
                declaredStyle: cell.style[`border${side}Style`],
                computedWidth: style[`border${side}Width`],
                width: parseFloat(style[`border${side}Width`]) || 0,
                color: style[`border${side}Color`],
                style: style[`border${side}Style`],
              },
            ]),
          );
        }),
      ),
    };
    assertPresentationTableFormatRenderer(state, original, expected);
    return state;
  } finally {
    handle.dispose();
  }
}

it("普通Node worker写出独立4x5 custom style/theme夹具且不污染全局DOM", async (t) => {
  const { filePath } = await setup(t);
  const parser = globalThis.DOMParser,
    serializer = globalThis.XMLSerializer;
  const result = await writePresentationTableFormatFixture(filePath);
  assert.equal(result.rowCount, 4);
  assert.equal(result.columnCount, 5);
  const original = await readPresentationTableFormatFile(filePath);
  assertPresentationTableFormatFixture(original);
  assert.equal(result.sha256, original.sha256);
  assert.equal(globalThis.DOMParser, parser);
  assert.equal(globalThis.XMLSerializer, serializer);
});

it("格式renderer保留真实UA、inline声明和computed原值，两种宽度任一错误都拒绝", async (t) => {
  const bytes = await formatFixture(),
    { original } = await setup(t, bytes),
    state = await render(bytes, original, {});
  assert.match(state.renderingEnvironment.userAgent, /jsdom\/22\.1\.0/);
  assert.equal(state.renderer[0][0].top.declaredWidth, "2px");
  assert.equal(state.renderer[0][0].top.computedWidth, "2px");
  for (const mutate of [
    (clone) => {
      clone.renderer[0][0].top.declaredWidth = "2.01px";
    },
    (clone) => {
      clone.renderer[0][0].top.computedWidth = "2.01px";
      clone.renderer[0][0].top.width = 2.01;
    },
  ]) {
    const wrong = structuredClone(state);
    mutate(wrong);
    assert.throws(() =>
      assertPresentationTableFormatRenderer(wrong, original, {}),
    );
  }
});

it("拒绝旧2x3 builtin或合并表格冒充独立格式夹具", async (t) => {
  const { read } = await setup(t);
  assert.throws(
    () => assertPresentationTableFormatFixture({ styleId: "builtin" }),
    /independent custom style/,
  );
  const builtin = await read(await tableFixture());
  assert.throws(
    () => assertPresentationTableFormatFixture(builtin),
    /independent custom style/,
  );
  const merged = await read(await formatFixture({ merged: true }));
  assert.throws(
    () => assertPresentationTableFormatFixture(merged),
    /explicitly unmerged/,
  );
});

it("标题行true/false与独立标题列只改tblPr，20格XML与全部styles/theme/ZIP不变", async (t) => {
  let bytes = await formatFixture();
  const { original, read } = await setup(t, bytes);
  assertPresentationTableFormatFixture(original);
  await render(bytes, original, {});
  for (const [options, header] of [
    [{ headerRow: true }, { row: true, column: false }],
    [{ headerRow: false }, { row: false, column: false }],
    [{ headerColumn: true }, { row: false, column: true }],
    [{ headerColumn: false }, { row: false, column: false }],
  ]) {
    bytes = await editPresentationTablePackage(bytes, [
      { ...identity, type: "set-table-options", ...options },
    ]);
    const preserved = assertPresentationTableFormatSave(
      original,
      await read(bytes),
      { header },
    );
    assert.equal(preserved.preservedCells, 20);
    assert.ok(preserved.preservedParts > 10);
    await render(bytes, original, { header });
  }
});

it("五个preset/改色/线宽/none后重建逐物理格验收，并由真实renderer呈现", async (t) => {
  let bytes = await formatFixture();
  const { original, read } = await setup(t, bytes);
  const all = { preset: "all", color: "#336699", width: 2 };
  const colored = { ...all, color: "#AA3344" };
  const weighted = { ...colored, width: 3.25 };
  const steps = [
    [{ type: "set-border-preset", preset: "all" }, all],
    [{ type: "format-existing-borders", color: "#AA3344" }, colored],
    [{ type: "format-existing-borders", width: 3.25 }, weighted],
    ...["inside", "columns", "rows"].map((preset) => [
      { type: "set-border-preset", preset },
      { ...weighted, preset },
    ]),
    [
      { type: "set-border-preset", preset: "none" },
      { preset: "none", width: 0, color: "#AA3344" },
    ],
    [
      { type: "set-border-preset", preset: "all" },
      { preset: "all", width: 1, color: "#D1D5DB" },
    ],
  ];
  for (const [edit, expected] of steps) {
    bytes = await editPresentationTablePackage(bytes, [
      { ...identity, range, ...edit },
    ]);
    const after = await read(bytes);
    const result = assertPresentationTableFormatSave(original, after, expected);
    assert.equal(result.preservedCells, 20);
    await render(bytes, original, expected);
  }
});

it("格式断言拒绝错误direct边、正文/格式/未知payload丢失和非目标ZIP篡改", async (t) => {
  const input = await formatFixture();
  const { original, read } = await setup(t, input);
  const expected = { preset: "all", color: "#336699", width: 2 };
  const bytes = await editPresentationTablePackage(input, [
    { ...identity, range, type: "set-border-preset", preset: "all" },
  ]);
  assertPresentationTableFormatSave(original, await read(bytes), expected);
  for (const [part, mutate, failure] of [
    [
      slidePath,
      (xml) => xml.replace('w="19050"', 'w="28575"'),
      /handwritten direct border/,
    ],
    [slidePath, (xml) => xml.replace("ADV_R0C0", "LOST"), /frame and cell XML/],
    [
      slidePath,
      (xml) => xml.replace('typeface="Arial"', 'typeface="Changed"'),
      /frame and cell XML/,
    ],
    [
      slidePath,
      (xml) => xml.replace('keep:cell="0:0"', 'keep:cell="lost"'),
      /frame and cell XML/,
    ],
    [
      slidePath,
      (xml) => xml.replace('keep:column="0"', 'keep:column="lost"'),
      /frame and cell XML/,
    ],
    [
      "ppt/theme/table-format.xml",
      (xml) => xml.replace("336699", "FFFFFF"),
      /non-target ZIP payload/,
    ],
    [
      "ppt/tableStyles.xml",
      (xml) => xml.replace("ABCDEF", "FFFFFF"),
      /non-target ZIP payload/,
    ],
  ]) {
    const zip = await JSZip.loadAsync(bytes);
    const value = await zip.file(part).async("string");
    assert.notEqual(mutate(value), value, `tampering actually changes ${part}`);
    zip.file(part, mutate(value));
    const damaged = await read(await zip.generateAsync({ type: "uint8array" }));
    assert.throws(
      () => assertPresentationTableFormatSave(original, damaged, expected),
      failure,
    );
  }
});
