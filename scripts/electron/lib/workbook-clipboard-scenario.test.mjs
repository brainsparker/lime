import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import {
  assertWorkbookClipboardFixture,
  assertWorkbookClipboardSave,
  readWorkbookClipboardFile,
  withWorkbookClipboard,
  writeWorkbookClipboardFixture,
} from "./workbook-clipboard-scenario.mjs";
import {
  assertWorkbookClipboardIo,
  workbookClipboardCopyText,
  workbookClipboardDelimitedText,
  workbookClipboardFormat,
  workbookClipboardIo,
  workbookClipboardPasteText,
  workbookClipboardSheetPart,
} from "./workbook-clipboard-scenario-oracle.mjs";

async function fixture(format, perform) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "workbook-clipboard-"),
  );
  const filePath = path.join(directory, `Preview-report.${format}`);
  try {
    const info = await writeWorkbookClipboardFixture(filePath);
    await perform({
      filePath,
      directory,
      info,
      before: await readWorkbookClipboardFile(filePath),
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function mutate(filePath, perform) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath), {
    checkCRC32: true,
  });
  await perform(zip);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "uint8array" }));
}

// 手写最终格XML；不依赖生产 Clipboard/Controller/Package writer 生成期望。
const copiedCellXml = {
  A10: '<c r="A10" t="inlineStr"><is><t xml:space="preserve">SOURCE</t></is></c>',
  B10: '<c r="B10"><v>7</v></c>',
  C10: '<c r="C10"/>',
  A11: '<c r="A11" t="inlineStr"><is><t xml:space="preserve"> one\t"quote"\n二 </t></is></c>',
  B11: '<c r="B11" t="inlineStr"><is><t xml:space="preserve">  padded  </t></is></c>',
  C11: '<c r="C11"/>',
};
const pastedCellXml = {
  D5: '<c r="D5" s="1" keep:cell="retained" t="inlineStr"><is><t xml:space="preserve">HAND\tCELL</t></is></c>',
  E5: '<c r="E5" t="inlineStr"><is><t xml:space="preserve">line 1\nline "2"</t></is></c>',
  F5: '<c r="F5" t="inlineStr"><is><t xml:space="preserve">  keep  </t></is></c>',
  D6: '<c r="D6"><f>1+1</f></c>',
  E6: '<c r="E6" t="inlineStr"><is><t xml:space="preserve">0012</t></is></c>',
  F6: '<c r="F6"/>',
};
async function handwrittenSavedPackage(filePath, stage) {
  await mutate(filePath, async (zip) => {
    let source = await zip.file(workbookClipboardSheetPart).async("string");
    source = source
      .replace('<dimension ref="A1:J30"/>', "")
      .replace("<v>7</v>", "");
    const cells =
      stage === "copied"
        ? copiedCellXml
        : { ...copiedCellXml, ...pastedCellXml };
    for (const [address, xml] of Object.entries(cells))
      source = source.replace(
        new RegExp(`<c r="${address}"[^>]*>.*?</c>`, "s"),
        xml,
      );
    zip.file(workbookClipboardSheetPart, source);
    zip.file(
      "xl/workbook.xml",
      (await zip.file("xl/workbook.xml").async("string")).replace(
        'calcId="12345"',
        'calcId="12345" fullCalcOnLoad="1" forceFullCalc="1"',
      ),
    );
  });
}

test("handwritten XLSX is readable independently with cached7, missing formula cache, merged cells, styles and preserved second sheet", async () =>
  fixture("xlsx", async ({ filePath, info, before }) => {
    assertWorkbookClipboardFixture(before);
    assert.equal(info.sha256, before.sha256);
    assert.equal(info.sheetName, "Clipboard");
    assert.equal(before.worksheet.cells.D5.attributes.s, "1");
    assert.equal(before.worksheet.cells.D5.attributes["keep:cell"], "retained");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fs.readFileSync(filePath));
    assert.deepEqual(
      workbook.worksheets.map((sheet) => [sheet.id, sheet.name]),
      [
        [7, "Clipboard"],
        [19, "Preserved"],
      ],
    );
    const sheet = workbook.getWorksheet(7);
    assert.equal(sheet.getCell("B1").formula, "1+1");
    assert.equal(sheet.getCell("B1").result, 7);
    assert.equal(sheet.getCell("C1").formula, "2+2");
    assert.equal(sheet.getCell("C1").result, undefined);
    assert.equal(sheet.getCell("A2").text, ' one\t"quote"\n二 ');
    assert.equal(sheet.getCell("B2").text, "  padded  ");
    assert.deepEqual(sheet.model.merges, ["A4:B4"]);
    assert.equal(sheet.getCell("D5").fill.fgColor.argb, "FFFDE68A");
    assert.equal(
      workbook.getWorksheet(19).getCell("A1").text,
      "PRESERVED_SECOND_SHEET",
    );
  }));

test("copy and paste expectations preserve quotes, embedded line endings, spaces, empty fields, formula display and exact matrix extent", () => {
  assert.equal(
    workbookClipboardCopyText("xlsx"),
    'SOURCE\t7\t""\n" one\t""quote""\n二 "\t  padded  \t""',
  );
  assert.equal(
    workbookClipboardCopyText("xlsx", true),
    'SOURCE\t""\t""\n" one\t""quote""\n二 "\t  padded  \t""',
  );
  assert.equal(
    workbookClipboardCopyText("csv"),
    'SOURCE\t=1+1\t""\n" one\t""quote""\n二 "\t  padded  \t""',
  );
  assert.equal(
    workbookClipboardCopyText("tsv"),
    workbookClipboardCopyText("csv"),
  );
  assert.equal(
    workbookClipboardPasteText,
    '"HAND\tCELL"\t"line 1\nline ""2"""\t"  keep  "\r\n=1+1\t0012\t""',
  );
  assert.equal(workbookClipboardPasteText.endsWith("\n"), false);
});

test("independent handwritten XLSX save states pass exact package/cell/cache preservation oracle", async () =>
  fixture("xlsx", async ({ filePath, before }) => {
    const bytes = fs.readFileSync(filePath);
    for (const stage of ["copied", "pasted"]) {
      fs.writeFileSync(filePath, bytes);
      await handwrittenSavedPackage(filePath, stage);
      const after = await readWorkbookClipboardFile(filePath);
      const result = assertWorkbookClipboardSave(before, after, stage);
      assert.ok(result.preservedParts >= 5);
      assert.equal(result.preservedSecondSheet, true);
      assert.equal(after.worksheet.cells.B10.formula, null);
      assert.equal(after.worksheet.cells.B10.text, "7");
      assert.equal(after.worksheet.cells.C10.text, "");
      assert.equal(after.worksheet.cells.C11.text, "");
      if (stage === "pasted") {
        assert.equal(after.worksheet.cells.D6.formula, "1+1");
        assert.equal(after.worksheet.cells.D6.cached, null);
        assert.equal(after.worksheet.cells.E6.text, "0012");
        assert.equal(after.worksheet.cells.F6.text, "");
      }
    }
  }));

test("XLSX oracle rejects wrong values, stale/evaluated caches, formula conversion, whitespace loss, repeated/extra cells and style damage", async () =>
  fixture("xlsx", async ({ filePath, before }) => {
    await handwrittenSavedPackage(filePath, "pasted");
    const correct = fs.readFileSync(filePath);
    for (const [name, replace] of [
      [
        "cached-copy-source-formula",
        (text) =>
          text.replace(
            '<c r="B10"><v>7</v></c>',
            '<c r="B10"><f>1+1</f><v>7</v></c>',
          ),
      ],
      [
        "stale-original-cache",
        (text) =>
          text.replace(
            '<c r="B1"><f>1+1</f></c>',
            '<c r="B1"><f>1+1</f><v>7</v></c>',
          ),
      ],
      [
        "pasted-formula-evaluated",
        (text) =>
          text.replace(
            '<c r="D6"><f>1+1</f></c>',
            '<c r="D6"><f>1+1</f><v>2</v></c>',
          ),
      ],
      ["leading-zero-lost", (text) => text.replace(">0012</t>", ">12</t>")],
      ["space-trimmed", (text) => text.replace(">  keep  </t>", ">keep</t>")],
      [
        "empty-field-not-cleared",
        (text) =>
          text.replace(
            '<c r="F6"/>',
            '<c r="F6" t="inlineStr"><is><t>old-F6</t></is></c>',
          ),
      ],
      [
        "repeat-past-matrix",
        (text) => text.replace("NO_REPEAT_D7", "HAND_CELL"),
      ],
      [
        "style-overwritten",
        (text) => text.replace('r="D5" s="1"', 'r="D5" s="0"'),
      ],
      [
        "custom-attribute-lost",
        (text) => text.replace(' keep:cell="retained"', ""),
      ],
      [
        "extra-cell",
        (text) =>
          text.replace(
            "</row></sheetData>",
            '<c r="J11"><v>9</v></c></row></sheetData>',
          ),
      ],
      [
        "original-formula-changed",
        (text) => text.replace("<f>2+2</f>", "<f>1+1</f>"),
      ],
      [
        "merge-lost",
        (text) =>
          text.replace(
            '<mergeCells count="1"><mergeCell ref="A4:B4"/></mergeCells>',
            "",
          ),
      ],
      [
        "row-geometry-changed",
        (text) => text.replace('r="2" ht="52"', 'r="2" ht="10"'),
      ],
    ]) {
      fs.writeFileSync(filePath, correct);
      await mutate(filePath, async (zip) => {
        const source = await zip
            .file(workbookClipboardSheetPart)
            .async("string"),
          changed = replace(source);
        assert.notEqual(changed, source, `mutation applied: ${name}`);
        zip.file(workbookClipboardSheetPart, changed);
      });
      const after = await readWorkbookClipboardFile(filePath);
      assert.throws(
        () => assertWorkbookClipboardSave(before, after, "pasted"),
        undefined,
        name,
      );
    }
  }));

test("XLSX oracle rejects changes to non-target ZIP payloads, sheet identity, relationships and calculation flags", async () =>
  fixture("xlsx", async ({ filePath, before }) => {
    await handwrittenSavedPackage(filePath, "pasted");
    const correct = fs.readFileSync(filePath);
    for (const mutation of [
      (zip) =>
        zip.file("xl/media/clipboard-retained.bin", Uint8Array.of(9, 9, 9)),
      (zip) => zip.remove("customXml/clipboard-retained.xml"),
      (zip) => zip.file("customXml/added.xml", "unexpected"),
      async (zip) =>
        zip.file(
          "xl/worksheets/sheet2.xml",
          (await zip.file("xl/worksheets/sheet2.xml").async("string")).replace(
            "PRESERVED_SECOND_SHEET",
            "DAMAGED_SECOND_SHEET",
          ),
        ),
      async (zip) =>
        zip.file(
          "xl/workbook.xml",
          (await zip.file("xl/workbook.xml").async("string")).replace(
            'sheetId="7"',
            'sheetId="8"',
          ),
        ),
      async (zip) =>
        zip.file(
          "xl/workbook.xml",
          (await zip.file("xl/workbook.xml").async("string")).replace(
            'forceFullCalc="1"',
            'forceFullCalc="0"',
          ),
        ),
      async (zip) =>
        zip.file(
          "xl/_rels/workbook.xml.rels",
          (
            await zip.file("xl/_rels/workbook.xml.rels").async("string")
          ).replace('Id="rFirst"', 'Id="rChanged"'),
        ),
      async (zip) =>
        zip.file(
          "[Content_Types].xml",
          (await zip.file("[Content_Types].xml").async("string")).replace(
            'Extension="bin"',
            'Extension="evil"',
          ),
        ),
    ]) {
      fs.writeFileSync(filePath, correct);
      await mutate(filePath, mutation);
      const after = await readWorkbookClipboardFile(filePath);
      assert.throws(() => assertWorkbookClipboardSave(before, after, "pasted"));
    }
  }));

for (const format of ["csv", "tsv"]) {
  test(`${format} exact lexical-byte oracle preserves BOM/newline/quoted fields and formula-like literals`, async () =>
    fixture(format, async ({ filePath, info, before }) => {
      assertWorkbookClipboardFixture(before);
      assert.equal(info.format, format);
      assert.equal(info.sheetName, "Sheet1");
      assert.equal(info.sha256, before.sha256);
      assert.equal(before.text.startsWith("\uFEFF"), format === "csv");
      for (const stage of ["copied", "pasted"]) {
        const expected = workbookClipboardDelimitedText(format, stage);
        fs.writeFileSync(filePath, expected);
        assert.deepEqual(
          assertWorkbookClipboardSave(
            before,
            await readWorkbookClipboardFile(filePath),
            stage,
          ),
          { exactDelimitedBytes: true },
        );
        assert.ok(
          expected.includes(
            format === "csv" ? ",=1+1,0012," : "\t=1+1\t0012\t",
          ) || stage === "copied",
        );
        for (const broken of [
          expected.replace("0012", "12"),
          expected.replace("  padded  ", "padded"),
          expected.replace('""quote""', '"quote"'),
          expected.replace("NO_REPEAT_D7", "REPEATED"),
          expected.replaceAll(
            format === "csv" ? "\r\n" : "\n",
            format === "csv" ? "\n" : "\r\n",
          ),
        ]) {
          assert.notEqual(broken, expected);
          fs.writeFileSync(filePath, broken);
          const after = await readWorkbookClipboardFile(filePath);
          assert.throws(() =>
            assertWorkbookClipboardSave(before, after, stage),
          );
        }
      }
    }));
}

test("fixture API rejects unsupported or mismatched format before writing", async () => {
  assert.equal(workbookClipboardFormat("/some path/Preview-report.CSV"), "csv");
  assert.throws(() => workbookClipboardFormat("/tmp/unknown.xls"));
  await assert.rejects(
    writeWorkbookClipboardFixture(
      "/tmp/workbook-clipboard-format-mismatch.csv",
      { format: "xlsx" },
    ),
    /matches file extension/,
  );
});

test("IO oracle counts only real successful source IO and all real turn attempts, rejecting duplicate writes and missing recheck", () => {
  const sourcePath = "/fixture/Preview-report.xlsx";
  const row = (
    method,
    source = sourcePath,
    status = "success",
    transport = "electron-ipc",
  ) => ({
    command: "app_server_handle_json_lines",
    transport,
    status,
    args_preview: {
      request: {
        lines: [JSON.stringify({ method, params: { path: source } })],
      },
    },
  });
  const counts = workbookClipboardIo(
    [
      row("fs/readFile"),
      row("fs/readFile"),
      row("fs/writeFile"),
      row("fs/readFile", "/other.xlsx"),
      row("fs/writeFile", sourcePath, "error"),
      row("fs/writeFile", sourcePath, "success", "mock"),
      row("turn/start", undefined, "error"),
      row("agentSession/turn/start"),
    ],
    sourcePath,
  );
  assert.deepEqual(counts, { read: 2, write: 1, turnStarts: 2 });
  const base = { read: 10, write: 4, turnStarts: 3 };
  assert.deepEqual(
    assertWorkbookClipboardIo(
      base,
      { read: 12, write: 5, turnStarts: 3 },
      { read: 2, write: 1 },
      "save",
    ),
    { read: 2, write: 1 },
  );
  assert.deepEqual(
    assertWorkbookClipboardIo(
      base,
      { read: 11, write: 4, turnStarts: 3 },
      { read: 1, write: 0 },
      "conflict",
    ),
    { read: 1, write: 0 },
  );
  for (const after of [
    { read: 11, write: 5, turnStarts: 3 },
    { read: 12, write: 6, turnStarts: 3 },
    { read: 12, write: 5, turnStarts: 4 },
  ])
    assert.throws(() =>
      assertWorkbookClipboardIo(
        base,
        after,
        { read: 2, write: 1 },
        "invalid-save",
      ),
    );
});

function clipboardApp(
  initial = {
    text: "PRIVATE_TEST_TEXT",
    html: "<p>PRIVATE_TEST_HTML</p>",
    rtf: "PRIVATE_TEST_RTF",
    image: "data:image/png;base64,AA==",
  },
) {
  let data = { ...initial },
    writes = 0;
  const clipboard = {
    availableFormats: () =>
      Object.keys(data).map(
        (key) =>
          ({
            text: "text/plain",
            html: "text/html",
            rtf: "text/rtf",
            image: "image/png",
            custom: "application/x-private",
          })[key],
      ),
    readText: () => data.text ?? "",
    readHTML: () => data.html ?? "",
    readRTF: () => data.rtf ?? "",
    readImage: () => ({ toDataURL: () => data.image }),
    clear: () => {
      data = {};
    },
    write: (value) => {
      data = { ...value };
      if (data.image?.toDataURL) data.image = data.image.toDataURL();
      writes++;
    },
  };
  const nativeImage = {
    createFromDataURL: (value) => ({ toDataURL: () => value }),
  };
  return {
    clipboard,
    evaluate: async (callback, argument) =>
      callback({ clipboard, nativeImage }, argument),
    snapshot: () => ({ ...data }),
    writes: () => writes,
  };
}

test("clipboard owner restores plain/HTML/RTF/image privately after success and callback failure", async () => {
  for (const failing of [false, true]) {
    const app = clipboardApp(),
      before = app.snapshot();
    const promise = withWorkbookClipboard(app, async (clipboard) => {
      await clipboard.writeText(workbookClipboardPasteText);
      assert.equal(await clipboard.readText(), workbookClipboardPasteText);
      assert.deepEqual(app.clipboard.availableFormats(), ["text/plain"]);
      if (failing) throw new Error("native scenario failed");
      return { fixturePaste: true };
    });
    if (failing) await assert.rejects(promise, /native scenario failed/);
    else assert.deepEqual(await promise, { fixturePaste: true });
    assert.deepEqual(app.snapshot(), before);
    assert.equal(app.writes(), 2);
  }
});

test("clipboard owner restores empty clipboard and refuses unknown MIME before any mutation", async () => {
  const empty = clipboardApp({});
  await withWorkbookClipboard(empty, async (clipboard) => {
    await clipboard.writeText("FIXTURE_ONLY");
  });
  assert.deepEqual(empty.snapshot(), {});
  let performed = false;
  const unsupported = clipboardApp({ custom: "PRIVATE_CUSTOM_DATA" });
  await assert.rejects(
    withWorkbookClipboard(unsupported, async () => {
      performed = true;
    }),
    /unsupported formats/,
  );
  assert.equal(performed, false);
  assert.equal(unsupported.writes(), 0);
  assert.deepEqual(unsupported.snapshot(), { custom: "PRIVATE_CUSTOM_DATA" });
  await assert.rejects(
    withWorkbookClipboard({}, async () => {}),
    /real Electron main clipboard/,
  );
});

test("clipboard write/readback and restoration failures are explicit without any synthetic fallback", async () => {
  const unavailable = clipboardApp({});
  unavailable.clipboard.write = () => {};
  await assert.rejects(
    withWorkbookClipboard(unavailable, async (clipboard) => {
      await clipboard.writeText("FIXTURE_ONLY");
    }),
    /native plain text clipboard roundtrip/,
  );
  const unrestorable = clipboardApp({ text: "PRIVATE_TEST_TEXT" });
  const write = unrestorable.clipboard.write;
  unrestorable.clipboard.write = (value) => {
    if (value.text !== "PRIVATE_TEST_TEXT") write(value);
  };
  await assert.rejects(
    withWorkbookClipboard(unrestorable, async (clipboard) => {
      await clipboard.writeText("FIXTURE_ONLY");
    }),
    /native clipboard restoration failed/,
  );
});
