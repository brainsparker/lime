import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { JSDOM } from "jsdom";

export const workbookClipboardNamespace =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export const workbookClipboardSheetPart = "xl/worksheets/sheet1.xml";
export const workbookClipboardQuotedValue = ' one\t"quote"\n二 ';
export const workbookClipboardPaddedValue = "  padded  ";
export const workbookClipboardPasteText =
  '"HAND\tCELL"\t"line 1\nline ""2"""\t"  keep  "\r\n=1+1\t0012\t""';
export const workbookClipboardDigest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const rel = "http://schemas.openxmlformats.org/package/2006/relationships";
const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const types = "http://schemas.openxmlformats.org/package/2006/content-types";
const xmlns = "http://www.w3.org/2000/xmlns/";
const sheet = workbookClipboardNamespace;

/** 期望手写，不调用生产 clipboard serializer 或 workbook writer。 */
export function workbookClipboardCopyText(format, invalidated = false) {
  const second = format === "xlsx" ? (invalidated ? '""' : "7") : "=1+1";
  return `SOURCE\t${second}\t""\n" one\t""quote""\n二 "\t  padded  \t""`;
}

const csvRows = {
  original: [
    'SOURCE,=1+1,,UNTOUCHED_1,"lexical,field",""',
    '" one\t""quote""\n二 ",  padded  ,,,,""',
    'KEEP3,0012,"lexical ""quote""",,,""',
    'MERGE_REJECTION_ONLY_XLSX,,,,,""',
    ",,,old-D5,old-E5,old-F5",
    ",,,old-D6,old-E6,old-F6",
    ",,,NO_REPEAT_D7,,NO_REPEAT_F7",
    'KEEP8,,,,,""',
    'KEEP9,,,,,""',
    'old-A10,old-B10,old-C10,,,""',
    'old-A11,old-B11,old-C11,,,""',
  ],
  copy10: 'SOURCE,=1+1,,,,""',
  copy11: '" one\t""quote""\n二 ",  padded  ,,,,""',
  paste5: ',,,HAND\tCELL,"line 1\nline ""2""",  keep  ',
  paste6: ",,,=1+1,0012,",
};
const tsvRows = {
  original: [
    'SOURCE\t=1+1\t\tUNTOUCHED_1\tlexical,field\t""',
    '" one\t""quote""\n二 "\t  padded  \t\t\t\t""',
    'KEEP3\t0012\t"lexical ""quote"""\t\t\t""',
    'MERGE_REJECTION_ONLY_XLSX\t\t\t\t\t""',
    "\t\t\told-D5\told-E5\told-F5",
    "\t\t\told-D6\told-E6\told-F6",
    "\t\t\tNO_REPEAT_D7\t\tNO_REPEAT_F7",
    'KEEP8\t\t\t\t\t""',
    'KEEP9\t\t\t\t\t""',
    'old-A10\told-B10\told-C10\t\t\t""',
    'old-A11\told-B11\told-C11\t\t\t""',
  ],
  copy10: 'SOURCE\t=1+1\t\t\t\t""',
  copy11: '" one\t""quote""\n二 "\t  padded  \t\t\t\t""',
  paste5: '\t\t\t"HAND\tCELL"\t"line 1\nline ""2"""\t  keep  ',
  paste6: "\t\t\t=1+1\t0012\t",
};

export function workbookClipboardDelimitedText(format, stage = "original") {
  assert.ok(["csv", "tsv"].includes(format));
  assert.ok(["original", "copied", "pasted"].includes(stage));
  const fixture = format === "csv" ? csvRows : tsvRows;
  const rows = [...fixture.original];
  if (stage !== "original") {
    rows[9] = fixture.copy10;
    rows[10] = fixture.copy11;
  }
  if (stage === "pasted") {
    rows[4] = fixture.paste5;
    rows[5] = fixture.paste6;
  }
  const newline = format === "csv" ? "\r\n" : "\n";
  return (format === "csv" ? "\uFEFF" : "") + rows.join(newline) + newline;
}

export function workbookClipboardFormat(filePath) {
  const format = path.extname(filePath).slice(1).toLowerCase();
  assert.ok(
    ["xlsx", "csv", "tsv"].includes(format),
    "supported workbook extension",
  );
  return format;
}

const escaped = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const inline = (address, value, attributes = "") =>
  `<c r="${address}"${attributes} t="inlineStr"><is><t xml:space="preserve">${escaped(value)}</t></is></c>`;

/** 手写 OPC，包含显示缓存7、无缓存公式、不可改的第二页/二进制/自定义XML。 */
export async function writeWorkbookClipboardFixture(filePath, options = {}) {
  const format = workbookClipboardFormat(filePath);
  assert.equal(
    options.format ?? format,
    format,
    "fixture format matches file extension",
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (format !== "xlsx") {
    const bytes = Buffer.from(workbookClipboardDelimitedText(format), "utf8");
    fs.writeFileSync(filePath, bytes);
    return {
      format,
      sha256: workbookClipboardDigest(bytes),
      sheetName: "Sheet1",
    };
  }
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="bin" ContentType="application/octet-stream"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="${rel}"><Relationship Id="rBook" Type="${r}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<workbook xmlns="${sheet}" xmlns:r="${r}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Clipboard" sheetId="7" r:id="rFirst"/><sheet name="Preserved" sheetId="19" r:id="rSecond"/></sheets><calcPr calcId="12345"/></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="${rel}"><Relationship Id="rFirst" Type="${r}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rSecond" Type="${r}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rStyles" Type="${r}/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    `<styleSheet xmlns="${sheet}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF2563EB"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE68A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf></cellXfs></styleSheet>`,
  );
  const targets = (row, columns) =>
    columns
      .map((column) =>
        inline(
          `${column}${row}`,
          `old-${column}${row}`,
          column === "D" && row === 5 ? ' s="1" keep:cell="retained"' : "",
        ),
      )
      .join("");
  zip.file(
    workbookClipboardSheetPart,
    `<worksheet xmlns="${sheet}" xmlns:keep="urn:clipboard-retained"><dimension ref="A1:J30"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="19.5"/><cols><col min="1" max="10" width="12" customWidth="1"/></cols><sheetData><row r="1">${inline("A1", "SOURCE")}<c r="B1"><f>1+1</f><v>7</v></c><c r="C1"><f>2+2</f></c>${inline("D1", "UNTOUCHED_1")}</row><row r="2" ht="52" customHeight="1">${inline("A2", workbookClipboardQuotedValue)}${inline("B2", workbookClipboardPaddedValue)}</row><row r="3">${inline("A3", "KEEP3")}</row><row r="4">${inline("A4", "MERGED")}</row><row r="5" ht="52" customHeight="1">${targets(5, ["D", "E", "F"])}</row><row r="6">${targets(6, ["D", "E", "F"])}</row><row r="7">${inline("D7", "NO_REPEAT_D7")}${inline("F7", "NO_REPEAT_F7")}</row><row r="10">${targets(10, ["A", "B", "C"])}</row><row r="11" ht="52" customHeight="1">${targets(11, ["A", "B", "C"])}</row></sheetData><mergeCells count="1"><mergeCell ref="A4:B4"/></mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><extLst><ext uri="urn:clipboard-retained"><keep:metadata value="retained"/></ext></extLst></worksheet>`,
  );
  zip.file(
    "xl/worksheets/sheet2.xml",
    `<worksheet xmlns="${sheet}"><sheetData><row r="1">${inline("A1", "PRESERVED_SECOND_SHEET")}</row></sheetData></worksheet>`,
  );
  zip.file(
    "customXml/clipboard-retained.xml",
    '<keep xmlns="urn:clipboard-retained" value="original"/>',
  );
  zip.file("xl/media/clipboard-retained.bin", Uint8Array.of(0, 255, 128, 71));
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  fs.writeFileSync(filePath, bytes);
  return {
    format,
    sha256: workbookClipboardDigest(bytes),
    sheetName: "Clipboard",
    sheetId: "7",
  };
}

function tree(node) {
  if (node.nodeType !== 1) return [node.nodeType, node.nodeValue];
  return [
    node.namespaceURI,
    node.localName,
    Array.from(node.attributes)
      .filter((attribute) => attribute.namespaceURI !== xmlns)
      .map((attribute) => [
        attribute.namespaceURI,
        attribute.localName,
        attribute.value,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    Array.from(node.childNodes, tree),
  ];
}
const signature = (node) => workbookClipboardDigest(JSON.stringify(tree(node)));
const attributes = (node) =>
  Object.fromEntries(
    Array.from(node.attributes)
      .filter((attribute) => attribute.namespaceURI !== xmlns)
      .map((attribute) => [attribute.name, attribute.value]),
  );
const child = (node, name) =>
  Array.from(node?.children ?? []).find(
    (item) => item.namespaceURI === sheet && item.localName === name,
  );

export async function readWorkbookClipboardFile(filePath) {
  const bytes = fs.readFileSync(filePath),
    format = workbookClipboardFormat(filePath);
  const result = { format, sha256: workbookClipboardDigest(bytes) };
  if (format !== "xlsx") return { ...result, text: bytes.toString("utf8") };
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const parts = {};
  for (const [name, entry] of Object.entries(zip.files))
    if (!entry.dir)
      parts[name] = workbookClipboardDigest(await entry.async("uint8array"));
  const xml = async (part, read) => {
    assert.ok(zip.file(part), `source part exists: ${part}`);
    const dom = new JSDOM(await zip.file(part).async("string"), {
      contentType: "application/xml",
    });
    try {
      return read(dom.window.document);
    } finally {
      dom.window.close();
    }
  };
  const workbook = await xml("xl/workbook.xml", (document) => {
    const calc = child(document.documentElement, "calcPr"),
      calcAttributes = calc ? attributes(calc) : {};
    calc?.remove();
    return {
      structure: signature(document.documentElement),
      calc: calcAttributes,
      sheets: Array.from(
        document.getElementsByTagNameNS(sheet, "sheet"),
        (node) => ({
          id: node.getAttribute("sheetId"),
          name: node.getAttribute("name"),
          relation: node.getAttributeNS(r, "id"),
        }),
      ),
    };
  });
  const worksheet = await xml(workbookClipboardSheetPart, (document) => {
    const root = document.documentElement,
      data = child(root, "sheetData"),
      dimension = child(root, "dimension");
    const rows = {},
      cells = {};
    for (const row of Array.from(data.children)) {
      rows[row.getAttribute("r")] = attributes(row);
      for (const cell of Array.from(row.children)) {
        const formula = child(cell, "f"),
          value = child(cell, "v"),
          inline = child(cell, "is");
        const normalized = cell.cloneNode(true);
        if (formula) {
          child(normalized, "v")?.remove();
          normalized.removeAttribute("t");
        }
        cells[cell.getAttribute("r")] = {
          attributes: attributes(cell),
          formula: formula?.textContent ?? null,
          cached: value?.textContent ?? null,
          text: inline
            ? Array.from(
                inline.getElementsByTagNameNS(sheet, "t"),
                (node) => node.textContent,
              ).join("")
            : (value?.textContent ?? ""),
          signature: signature(cell),
          withoutCache: signature(normalized),
        };
      }
    }
    data.remove();
    const dimensionPresent = Boolean(dimension);
    dimension?.remove();
    return { structure: signature(root), rows, cells, dimensionPresent };
  });
  return {
    ...result,
    parts,
    workbook,
    worksheet,
    relationships: await xml("xl/_rels/workbook.xml.rels", (document) =>
      signature(document.documentElement),
    ),
    contentTypes: await xml("[Content_Types].xml", (document) =>
      signature(document.documentElement),
    ),
  };
}

export function assertWorkbookClipboardFixture(source) {
  if (source.format !== "xlsx") {
    assert.equal(source.text, workbookClipboardDelimitedText(source.format));
    return;
  }
  assert.deepEqual(source.workbook.sheets, [
    { id: "7", name: "Clipboard", relation: "rFirst" },
    { id: "19", name: "Preserved", relation: "rSecond" },
  ]);
  assert.equal(source.worksheet.cells.B1.formula, "1+1");
  assert.equal(source.worksheet.cells.B1.cached, "7");
  assert.equal(source.worksheet.cells.C1.formula, "2+2");
  assert.equal(source.worksheet.cells.C1.cached, null);
  assert.equal(source.worksheet.cells.A2.text, workbookClipboardQuotedValue);
  assert.equal(source.worksheet.cells.B2.text, workbookClipboardPaddedValue);
  assert.ok(source.parts["customXml/clipboard-retained.xml"]);
  assert.ok(source.parts["xl/media/clipboard-retained.bin"]);
}

export function workbookClipboardExpectedCells(format, stage) {
  const copied = {
    A10: "SOURCE",
    B10: format === "xlsx" ? "7" : "=1+1",
    C10: "",
    A11: workbookClipboardQuotedValue,
    B11: workbookClipboardPaddedValue,
    C11: "",
  };
  if (stage === "copied") return copied;
  assert.equal(stage, "pasted");
  return {
    ...copied,
    D5: "HAND\tCELL",
    E5: 'line 1\nline "2"',
    F5: "  keep  ",
    D6: format === "xlsx" ? "" : "=1+1",
    E6: "0012",
    F6: "",
  };
}

/** 保存只可改变目标格与公式缓存/重算标志；非目标 ZIP payload 逐字节相等。 */
export function assertWorkbookClipboardSave(before, after, stage) {
  assert.ok(["copied", "pasted"].includes(stage));
  assert.equal(after.format, before.format);
  assert.notEqual(after.sha256, before.sha256);
  if (before.format !== "xlsx") {
    assert.equal(
      after.text,
      workbookClipboardDelimitedText(before.format, stage),
      "BOM, lexical fields, quoted newlines and source record delimiters survive",
    );
    return { exactDelimitedBytes: true };
  }
  const expected = workbookClipboardExpectedCells("xlsx", stage);
  assert.deepEqual(
    Object.keys(after.parts).sort(),
    Object.keys(before.parts).sort(),
  );
  const mutable = new Set([
    workbookClipboardSheetPart,
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "[Content_Types].xml",
  ]);
  let preservedParts = 0;
  for (const [part, sha] of Object.entries(before.parts))
    if (!mutable.has(part)) {
      assert.equal(
        after.parts[part],
        sha,
        `non-target original payload: ${part}`,
      );
      preservedParts++;
    }
  assert.equal(
    after.workbook.structure,
    before.workbook.structure,
    "sheet names/order/ids and workbook metadata stay unchanged",
  );
  assert.deepEqual(after.workbook.calc, {
    ...before.workbook.calc,
    fullCalcOnLoad: "1",
    forceFullCalc: "1",
  });
  assert.equal(after.relationships, before.relationships);
  assert.equal(after.contentTypes, before.contentTypes);
  assert.equal(
    after.worksheet.structure,
    before.worksheet.structure,
    "merges, dimensions, geometry and custom worksheet metadata survive",
  );
  assert.equal(
    after.worksheet.dimensionPresent,
    false,
    "stale dimension hint is removed after actual edit",
  );
  assert.deepEqual(after.worksheet.rows, before.worksheet.rows);
  assert.deepEqual(
    Object.keys(after.worksheet.cells).sort(),
    Object.keys(before.worksheet.cells).sort(),
    "no cells are repeated or added outside the pasted rectangle",
  );
  for (const [address, original] of Object.entries(before.worksheet.cells)) {
    const cell = after.worksheet.cells[address];
    if (Object.hasOwn(expected, address)) {
      const originalAttributes = { ...original.attributes },
        actualAttributes = { ...cell.attributes };
      delete originalAttributes.t;
      delete actualAttributes.t;
      assert.deepEqual(
        actualAttributes,
        originalAttributes,
        `${address}: style and custom cell attributes survive`,
      );
      if (stage === "pasted" && address === "D6") {
        assert.equal(cell.formula, "1+1");
        assert.equal(cell.cached, null, "pasted formula is not evaluated");
        assert.equal(cell.attributes.t, undefined);
      } else {
        assert.equal(
          cell.formula,
          null,
          `${address}: plain copied text does not turn into a source formula`,
        );
        assert.equal(
          cell.text,
          expected[address],
          `${address}: exact saved value`,
        );
        if (["A11", "B11", "D5", "E5", "F5", "E6"].includes(address))
          assert.equal(cell.attributes.t, "inlineStr");
      }
    } else if (original.formula) {
      assert.equal(
        cell.withoutCache,
        original.withoutCache,
        `${address}: original formula survives`,
      );
      assert.equal(
        cell.cached,
        null,
        `${address}: old formula cache is invalidated`,
      );
    } else
      assert.equal(
        cell.signature,
        original.signature,
        `${address}: non-target cell is unchanged`,
      );
  }
  return {
    preservedParts,
    originalFormulaCacheInvalidated: true,
    preservedSecondSheet: true,
  };
}

export function workbookClipboardIo(trace, filePath) {
  const counts = { read: 0, write: 0, turnStarts: 0 };
  for (const row of trace) {
    if (
      row.command !== "app_server_handle_json_lines" ||
      row.transport !== "electron-ipc"
    )
      continue;
    for (const line of row.args_preview?.request?.lines ?? []) {
      const request = JSON.parse(line);
      if (["turn/start", "agentSession/turn/start"].includes(request.method))
        counts.turnStarts++;
      if (row.status !== "success" || request.params?.path !== filePath)
        continue;
      if (request.method === "fs/readFile") counts.read++;
      if (request.method === "fs/writeFile") counts.write++;
    }
  }
  return counts;
}

export function assertWorkbookClipboardIo(before, after, expected, label) {
  const delta = {
    read: after.read - before.read,
    write: after.write - before.write,
  };
  assert.deepEqual(delta, expected, `${label}: exact real file gateway IO`);
  assert.equal(
    after.turnStarts,
    before.turnStarts,
    `${label}: local clipboard edits never start a Turn`,
  );
  return delta;
}
