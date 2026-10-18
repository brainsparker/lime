import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, it, onTestFinished } from "vitest";
import {
  importPresentationDocument,
  renderPresentationSlide,
} from "../../../src/components/artifact/presentation/presentationDocument.ts";
import { editPresentationTablePackage } from "../../../src/components/artifact/presentation/presentationTablePackage.ts";
import { formatFixture } from "../../../src/components/artifact/presentation/presentationTableFormatPackage.testFixtures.ts";
import { tableFixture } from "../../../src/components/artifact/presentation/presentationTablePackage.testFixtures.ts";
import {
  writePresentationTableBuiltinFixture,
  readPresentationTableBuiltinFile,
  assertPresentationTableBuiltinFixture,
  assertPresentationTableBuiltinSave,
  assertPresentationTableBuiltinRenderer,
  assertPresentationTableBuiltinIo,
  presentationBuiltinDom,
} from "./presentation-table-builtin-scenario.mjs";

const identity = { slideId: "512", tableId: "7" };
const range = { row: 0, column: 0, rowCount: 4, columnCount: 5 };
const slidePath = "ppt/slides/slide1.xml";

async function setup(styleList = "missing") {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lime-table-builtin-"),
  );
  onTestFinished(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "Builtin.pptx");
  const globals = [
    globalThis.DOMParser,
    globalThis.XMLSerializer,
    globalThis.document,
    globalThis.window,
  ];
  const receipt = await writePresentationTableBuiltinFixture(filePath, {
    styleList,
  });
  assert.deepEqual(
    [
      globalThis.DOMParser,
      globalThis.XMLSerializer,
      globalThis.document,
      globalThis.window,
    ],
    globals,
  );
  const original = await readPresentationTableBuiltinFile(filePath);
  const read = async (bytes) => {
    fs.writeFileSync(filePath, bytes);
    return readPresentationTableBuiltinFile(filePath);
  };
  return { filePath, receipt, original, read };
}

async function render(bytes, original, expected = {}) {
  const snapshot = await importPresentationDocument(
    Uint8Array.from(bytes),
    new AbortController().signal,
  );
  const styles = snapshot.model.tableStyles,
    themes = snapshot.model.themes;
  const handle = renderPresentationSlide(snapshot, 0);
  const shell = document.createElement("div");
  shell.setAttribute("data-testid", "presentation-panel");
  const iframe = document.createElement("iframe");
  shell.append(iframe);
  document.body.append(shell);
  try {
    await handle.ready;
    const slide = iframe.contentDocument.createElement("div");
    slide.setAttribute("data-slide-id", "512");
    slide.append(handle.element);
    iframe.contentDocument.body.append(slide);
    const state = presentationBuiltinDom();
    assertPresentationTableBuiltinRenderer(state, original, expected);
    assert.equal(snapshot.model.tableStyles, styles);
    assert.equal(snapshot.model.themes, themes);
    assert.deepEqual(snapshot.sourceBytes, Uint8Array.from(bytes));
    return state;
  } finally {
    handle.dispose();
    shell.remove();
  }
}

// 一个 case 包含隔离 Worker、十次真实 ZIP 保存和 DOM 重建，预算只约束单测宿主。
describe("builtin native场景的独立domain验收", { timeout: 120_000 }, () => {
  it.each(["missing", "empty"])(
    "%s builtin原包由隔离writer生成：4x5真实主题且无custom/direct伪装",
    async (styleList) => {
      const { filePath, receipt, original } = await setup(styleList);
      assert.equal(
        fs.readFileSync(
          path.join(path.dirname(filePath), "Broken.pptx"),
          "utf8",
        ),
        "invalid presentation",
      );
      assertPresentationTableBuiltinFixture(original, styleList);
      assert.equal(receipt.sha256, original.sha256);
      assert.equal(receipt.rowCount, 4);
      assert.equal(receipt.columnCount, 5);
      assert.equal(receipt.styleList, styleList);
      assert.deepEqual(receipt.framePixels, { width: 600, height: 280 });
      const state = await render(fs.readFileSync(filePath), original);
      assert.equal(state.renderer[0][0].fill, "rgb(232, 234, 239)");
      assert.equal(state.renderer[0][0].textStyles[0].color, "rgb(0, 0, 0)");
      assert.equal(state.renderer[0][0].top.color, "rgb(255, 255, 255)");
      assert.ok(Math.abs(state.renderer[0][0].top.width - 4 / 3) < 0.0001);
      assert.match(state.renderingEnvironment.userAgent, /jsdom\/22\.1\.0/);
      assert.equal(
        state.renderer[0][0].top.declaredWidth,
        state.renderer[0][0].top.computedWidth,
      );
    },
  );

  it.each(["missing", "empty"])(
    "%s builtin的header/preset/color/width保存后由真实renderer逐格核对且主题与ZIP原件不变",
    async (styleList) => {
      const { filePath, original, read } = await setup(styleList);
      let bytes = Uint8Array.from(fs.readFileSync(filePath));
      const all = { preset: "all", width: 4 / 3, color: "#FFFFFF" };
      const colored = { ...all, color: "#AA3344" };
      const weighted = { ...colored, width: 3.25 };
      for (const [edit, expected] of [
        [
          { type: "set-table-options", headerRow: true },
          { header: { row: true, column: false } },
        ],
        [{ type: "set-table-options", headerRow: false }, {}],
        [
          { type: "set-table-options", headerColumn: true },
          { header: { row: false, column: true } },
        ],
        [{ type: "set-table-options", headerColumn: false }, {}],
        [{ type: "set-border-preset", range, preset: "all" }, all],
        [{ type: "format-existing-borders", range, color: "#AA3344" }, colored],
        [{ type: "format-existing-borders", range, width: 3.25 }, weighted],
        [
          { type: "set-border-preset", range, preset: "inside" },
          { ...weighted, preset: "inside" },
        ],
        [
          { type: "set-border-preset", range, preset: "none" },
          { preset: "none", width: 0, color: "#AA3344" },
        ],
        [
          { type: "set-border-preset", range, preset: "all" },
          { preset: "all", width: 1, color: "#D1D5DB" },
        ],
      ]) {
        bytes = await editPresentationTablePackage(bytes, [
          { ...identity, ...edit },
        ]);
        const saved = await read(bytes);
        const preserved = assertPresentationTableBuiltinSave(
          original,
          saved,
          expected,
        );
        assert.equal(preserved.preservedCells, 20);
        assert.ok(preserved.preservedParts > 10);
        await render(bytes, original, expected);
      }
    },
  );

  it("custom或旧2x3无theme不能冒充独立builtin场景，原夹具仍由各自路径使用", async () => {
    const { read } = await setup();
    assert.throws(
      () => assertPresentationTableBuiltinFixture({ styleId: "custom" }),
      /genuine UUID/,
    );
    const custom = await read(await formatFixture());
    assert.equal(custom.styleList, "custom");
    assert.throws(
      () => assertPresentationTableBuiltinFixture(custom),
      /genuine UUID/,
    );
    await assert.rejects(
      read(await tableFixture()),
      /one genuine slideLayout relationship/,
    );
  });

  it("手写验收拒绝错误direct线、20格payload丢失、主题篡改和偷偷写入builtin列表", async () => {
    const { filePath, original, read } = await setup();
    const expected = { preset: "all", width: 4 / 3, color: "#FFFFFF" };
    const saved = await editPresentationTablePackage(
      Uint8Array.from(fs.readFileSync(filePath)),
      [{ ...identity, range, type: "set-border-preset", preset: "all" }],
    );
    assertPresentationTableBuiltinSave(original, await read(saved), expected);
    for (const [part, mutate, failure] of [
      [
        slidePath,
        (xml) => xml.replace('w="12700"', 'w="19050"'),
        /handwritten direct border/,
      ],
      [
        slidePath,
        (xml) => xml.replace("ADV_R0C0", "LOST"),
        /frame and cell XML/,
      ],
      [
        slidePath,
        (xml) => xml.replace('keep:cell="0:0"', 'keep:cell="LOST"'),
        /frame and cell XML/,
      ],
      [
        "ppt/theme/table-format.xml",
        (xml) => xml.replace("336699", "FFFFFF"),
        /Expected values to be strictly deep-equal|non-target ZIP payload/,
      ],
    ]) {
      const zip = await JSZip.loadAsync(saved),
        source = await zip.file(part).async("string");
      assert.notEqual(mutate(source), source);
      zip.file(part, mutate(source));
      const damaged = await read(
        await zip.generateAsync({ type: "uint8array" }),
      );
      assert.throws(
        () => assertPresentationTableBuiltinSave(original, damaged, expected),
        failure,
      );
    }
    const zip = await JSZip.loadAsync(saved);
    zip.file(
      "ppt/tableStyles.xml",
      '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>',
    );
    const injected = await read(
      await zip.generateAsync({ type: "uint8array" }),
    );
    assert.throws(
      () => assertPresentationTableBuiltinSave(original, injected, expected),
      /no builtin definition is added/,
    );
  });

  it("手写初始DOM验收不能被错误fill/text/border/尺寸或空格子蒙混通过", async () => {
    const { filePath, original } = await setup();
    const state = await render(fs.readFileSync(filePath), original);
    for (const mutate of [
      (clone) => {
        clone.renderer[0][0].fill = "rgb(255, 255, 255)";
      },
      (clone) => {
        clone.renderer[0][0].textStyles[0].color = "rgb(255, 255, 255)";
      },
      (clone) => {
        clone.renderer[0][0].textStyles[0].bold = true;
      },
      (clone) => {
        clone.renderer[0][0].top.width = 2;
      },
      (clone) => {
        clone.renderer[0][0].top.declaredWidth = "1.33px";
      },
      (clone) => {
        clone.renderer[0][0].top.computedWidth = "1.33px";
        clone.renderer[0][0].top.width = 1.33;
      },
      (clone) => {
        clone.renderer[0][0].top.color = "rgb(0, 0, 0)";
      },
      (clone) => {
        clone.framePixels.width = 480;
      },
      (clone) => {
        clone.texts[0][0] = "";
      },
    ]) {
      const wrong = structuredClone(state);
      mutate(wrong);
      assert.throws(() =>
        assertPresentationTableBuiltinRenderer(wrong, original),
      );
    }
  });

  it("每动作IPC必须精确read2/write1，缺失读取或重复写不能算验收通过", () => {
    assert.deepEqual(
      assertPresentationTableBuiltinIo(
        { read: 10, write: 4 },
        { read: 12, write: 5 },
      ),
      { read: 2, write: 1 },
    );
    for (const after of [
      { read: 11, write: 5 },
      { read: 13, write: 5 },
      { read: 12, write: 4 },
      { read: 12, write: 6 },
    ])
      assert.throws(
        () => assertPresentationTableBuiltinIo({ read: 10, write: 4 }, after),
        /two real source reads and one autosave write/,
      );
  });
});
