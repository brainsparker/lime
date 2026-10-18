import type { WorkbookCellEdit } from "./workbookPackage";
import { parseCellAddress } from "./workbookRange";
import { WorkbookImportError } from "./workbookSnapshot";
import { isValidWorkbookCellInput } from "./workbookCellValue";

export interface DelimitedField {
  value: string;
  source: string;
}
export interface DelimitedRow {
  fields: DelimitedField[];
  newline: string;
}

/** 原字段词法与语义分开保留，保存时未修改的引号、空字段和换行不重排。 */
export function parseDelimitedRows(
  text: string,
  delimiter: "," | "\t",
): DelimitedRow[] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: DelimitedRow[] = [];
  let fields: DelimitedField[] = [],
    value = "",
    start = 0,
    quoted = false,
    closed = false,
    count = 0;
  const field = (end: number) => {
    if (++count > 100000 || fields.length >= 1024 || rows.length >= 200000)
      throw new WorkbookImportError("tooLarge");
    fields.push({ value, source: input.slice(start, end) });
    value = "";
    closed = false;
  };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += char;
    } else if (char === delimiter) {
      field(index);
      start = index + 1;
    } else if (char === "\r" || char === "\n") {
      field(index);
      const newline =
        char === "\r" && input[index + 1] === "\n" ? "\r\n" : char;
      if (newline.length === 2) index++;
      rows.push({ fields, newline });
      fields = [];
      start = index + 1;
    } else if (char === '"' && value === "" && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new WorkbookImportError("invalid");
      value += char;
    }
  }
  if (quoted) throw new WorkbookImportError("invalid");
  if (start < input.length || fields.length) {
    field(input.length);
    rows.push({ fields, newline: "" });
  }
  return rows;
}

export function decodeDelimitedWorkbook(bytes: Uint8Array) {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    const bom =
      encoding !== "utf-8" ||
      (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf);
    return { text, encoding, bom };
  } catch {
    throw new WorkbookImportError("invalid");
  }
}

export function editDelimitedWorkbook(
  bytes: Uint8Array,
  delimiter: "," | "\t",
  edits: readonly WorkbookCellEdit[],
): Uint8Array {
  if (bytes.byteLength > 20 * 1024 * 1024 || edits.reduce((size, edit) => size + edit.value.length, 0) > 20 * 1024 * 1024)
    throw new WorkbookImportError("tooLarge");
  const { text, encoding, bom } = decodeDelimitedWorkbook(bytes);
  const rows = parseDelimitedRows(text, delimiter);
  const newline = rows.find((row) => row.newline)?.newline ?? "\n";
  const terminalNewline = rows.at(-1)?.newline ?? "";
  for (const edit of edits) {
    const position = parseCellAddress(edit.address);
    if (
      edit.sheetId !== "delimited" ||
      !position ||
      position.row > 200000 ||
      position.column > 1024 ||
      !isValidWorkbookCellInput(edit.value)
    )
      throw new WorkbookImportError("invalid");
    while (rows.length < position.row) {
      if (rows.length) rows[rows.length - 1].newline ||= newline;
      rows.push({ fields: [], newline: terminalNewline });
    }
    const row = rows[position.row - 1];
    while (row.fields.length < position.column)
      row.fields.push({ value: "", source: "" });
    row.fields[position.column - 1] = {
      value: edit.value,
      source:
        edit.value.includes(delimiter) || /["\r\n]/.test(edit.value)
          ? '"' + edit.value.replaceAll('"', '""') + '"'
          : edit.value,
    };
  }
  const result = rows
    .map(
      (row) =>
        row.fields.map((field) => field.source).join(delimiter) + row.newline,
    )
    .join("");
  if (rows.reduce((count, row) => count + Math.max(1, row.fields.length), 0) > 100000)
    throw new WorkbookImportError("tooLarge");
  if (encoding === "utf-8") {
    const output = new TextEncoder().encode((bom ? "\uFEFF" : "") + result);
    if (output.byteLength > 20 * 1024 * 1024) throw new WorkbookImportError("tooLarge");
    return output;
  }
  if ((result.length + 1) * 2 > 20 * 1024 * 1024) throw new WorkbookImportError("tooLarge");
  const output = new Uint8Array((result.length + 1) * 2);
  const view = new DataView(output.buffer);
  view.setUint16(0, 0xfeff, encoding === "utf-16le");
  for (let index = 0; index < result.length; index++)
    view.setUint16(
      (index + 1) * 2,
      result.charCodeAt(index),
      encoding === "utf-16le",
    );
  return output;
}
