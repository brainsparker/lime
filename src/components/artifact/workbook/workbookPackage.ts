import { isValidWorkbookCellInput } from "./workbookCellValue";
import JSZip from "jszip";
import { cellAddress, parseCellAddress } from "./workbookRange";

export const workbookNamespace =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationshipNamespace =
  "http://schemas.openxmlformats.org/package/2006/relationships";
const documentRelationshipNamespace =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export interface WorkbookCellEdit {
  sheetId: string;
  address: string;
  value: string;
}

export function readWorkbookXml(source: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error("Invalid workbook XML");
  const xml = new DOMParser().parseFromString(source, "application/xml");
  if (xml.getElementsByTagName("parsererror").length)
    throw new Error("Invalid workbook XML");
  return xml;
}

/** 在解压前核验 central directory；不接受 ZIP64、多卷或无法确定的解压尺寸。 */
function checkPackageSize(bytes: Uint8Array) {
  if (bytes.length > 20 * 1024 * 1024 || bytes.length < 22)
    throw new Error("Workbook package exceeds limits");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  const minimum = Math.max(0, end - 65535);
  for (; end >= minimum; end--)
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.length
    )
      break;
  if (end < minimum || view.getUint32(end + 4, true) !== 0)
    throw new Error("Unsupported workbook archive");
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (
    !count ||
    count > 10000 ||
    count !== view.getUint16(end + 8, true) ||
    offset + length !== end
  )
    throw new Error("Invalid workbook archive directory");
  let total = 0;
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Invalid workbook archive entry");
    const size = view.getUint32(offset + 24, true);
    total += size;
    const nameLength = view.getUint16(offset + 28, true);
    const next =
      offset +
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
    if (
      size > 32 * 1024 * 1024 ||
      total > 128 * 1024 * 1024 ||
      next > end ||
      view.getUint16(offset + 8, true) & 1
    )
      throw new Error("Workbook package exceeds limits");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (
      names.has(name) ||
      name.includes("\\") ||
      name.split("/").includes("..")
    )
      throw new Error("Invalid workbook archive path");
    names.add(name);
    offset = next;
  }
  if (
    offset !== end ||
    [...names].some((name) => name.startsWith("_xmlsignatures/"))
  )
    throw new Error("Unsupported signed workbook");
}

function resolvePart(target: string): string {
  if (/^[a-z][a-z0-9+.-]*:|[\\?#]/i.test(target))
    throw new Error("Invalid worksheet relationship");
  const segments = target.startsWith("/") ? [] : ["xl"];
  for (const part of target.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) throw new Error("Invalid worksheet relationship");
      segments.pop();
    } else segments.push(part);
  }
  return segments.join("/");
}

async function xmlPart(zip: JSZip, path: string): Promise<Document> {
  const file = zip.file(path);
  if (!file) throw new Error("Missing workbook part");
  return readWorkbookXml(await file.async("string"));
}

function putXml(zip: JSZip, path: string, xml: Document) {
  zip.file(path, new XMLSerializer().serializeToString(xml));
}

/** 仅改变目标 cell，保留原样式和未编辑的包成员；不重新导出整本工作簿。 */
export async function editWorkbookPackage(
  bytes: Uint8Array,
  edits: readonly WorkbookCellEdit[],
): Promise<Uint8Array> {
  checkPackageSize(bytes);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const workbook = await xmlPart(zip, "xl/workbook.xml");
  const relations = await xmlPart(zip, "xl/_rels/workbook.xml.rels");
  const sheets = Array.from(
    workbook.getElementsByTagNameNS(workbookNamespace, "sheet"),
  );
  const rels = Array.from(
    relations.getElementsByTagNameNS(relationshipNamespace, "Relationship"),
  );
  const loaded = new Map<string, Document>();
  for (const edit of edits) {
    const position = parseCellAddress(edit.address);
    if (!position || !isValidWorkbookCellInput(edit.value))
      throw new Error("Invalid workbook edit");
    const sheet = sheets.find(
      (item) => item.getAttribute("sheetId") === edit.sheetId,
    );
    const relationId = sheet?.getAttributeNS(
      documentRelationshipNamespace,
      "id",
    );
    const relation = rels.find(
      (item) => item.getAttribute("Id") === relationId,
    );
    if (
      !relation ||
      relation.getAttribute("TargetMode") === "External" ||
      !relation.getAttribute("Type")?.endsWith("/worksheet")
    )
      throw new Error("Invalid worksheet identity");
    const path = resolvePart(relation.getAttribute("Target") ?? "");
    const xml = loaded.get(path) ?? (await xmlPart(zip, path));
    loaded.set(path, xml);
    if (
      xml.documentElement.namespaceURI !== workbookNamespace ||
      xml.getElementsByTagNameNS(workbookNamespace, "sheetProtection").length
    )
      throw new Error("Unsupported protected worksheet");
    // 数组、共享及动态数组公式必须由支持该公式模型的编辑器处理，不能拆坏原结构。
    for (const formula of Array.from(
      xml.getElementsByTagNameNS(workbookNamespace, "f"),
    )) {
      if (formula.hasAttribute("t"))
        throw new Error("Unsupported grouped worksheet formula");
    }
    const data = xml.getElementsByTagNameNS(workbookNamespace, "sheetData")[0];
    if (!data) throw new Error("Missing worksheet data");
    const create = (name: string) =>
      xml.createElementNS(workbookNamespace, name);
    let row = Array.from(data.children).find(
      (item) => Number(item.getAttribute("r")) === position.row,
    );
    if (!row) {
      row = create("row");
      row.setAttribute("r", String(position.row));
      data.insertBefore(
        row,
        Array.from(data.children).find(
          (item) => Number(item.getAttribute("r")) > position.row,
        ) ?? null,
      );
    }
    const address = cellAddress(position);
    let cell = Array.from(row.children).find(
      (item) => item.getAttribute("r") === address,
    );
    if (!cell) {
      cell = create("c");
      cell.setAttribute("r", address);
      row.insertBefore(
        cell,
        Array.from(row.children).find(
          (item) =>
            (parseCellAddress(item.getAttribute("r") ?? "")?.column ?? 0) >
            position.column,
        ) ?? null,
      );
    }
    for (const child of Array.from(cell.children))
      if (["v", "f", "is"].includes(child.localName)) child.remove();
    cell.removeAttribute("t");
    if (edit.value.startsWith("=") && edit.value.length > 1) {
      const formula = create("f");
      formula.textContent = edit.value.slice(1);
      cell.append(formula);
    } else if (
      /^(?:[+-]?(?:0|[1-9]\d*)(?:\.\d*)?|[+-]?\.\d+)(?:e[+-]?\d+)?$/i.test(
        edit.value,
      ) &&
      Number.isFinite(Number(edit.value))
    ) {
      const value = create("v");
      value.textContent = edit.value;
      cell.append(value);
    } else if (/^(TRUE|FALSE)$/.test(edit.value)) {
      cell.setAttribute("t", "b");
      const value = create("v");
      value.textContent = edit.value === "TRUE" ? "1" : "0";
      cell.append(value);
    } else if (edit.value) {
      cell.setAttribute("t", "inlineStr");
      const inline = create("is"),
        text = create("t");
      text.setAttributeNS(
        "http://www.w3.org/XML/1998/namespace",
        "xml:space",
        "preserve",
      );
      text.textContent = edit.value.startsWith("'")
        ? edit.value.slice(1)
        : edit.value;
      inline.append(text);
      cell.append(inline);
    }
    const dimension = xml.getElementsByTagNameNS(
      workbookNamespace,
      "dimension",
    )[0];
    // dimension 是可选提示；移除后由 consumer 按真实单元格重建，避免旧范围截断新单元格。
    dimension?.remove();
  }
  // 修改输入后已有公式缓存全部过期，交给打开文件的表格引擎重算。
  for (const relation of rels) {
    if (
      !relation.getAttribute("Type")?.endsWith("/worksheet") ||
      relation.getAttribute("TargetMode") === "External"
    )
      continue;
    const path = resolvePart(relation.getAttribute("Target") ?? "");
    const xml = loaded.get(path) ?? (await xmlPart(zip, path));
    const formulas = Array.from(
      xml.getElementsByTagNameNS(workbookNamespace, "f"),
    );
    if (!loaded.has(path) && !formulas.length) continue;
    for (const formula of formulas) {
      const cell = formula.parentElement;
      for (const value of Array.from(cell?.children ?? []))
        if (value.localName === "v") value.remove();
      cell?.removeAttribute("t");
    }
    putXml(zip, path, xml);
  }
  let calc = workbook.getElementsByTagNameNS(workbookNamespace, "calcPr")[0];
  if (!calc) {
    calc = workbook.createElementNS(workbookNamespace, "calcPr");
    const later = new Set([
      "oleSize",
      "customWorkbookViews",
      "pivotCaches",
      "smartTagPr",
      "smartTagTypes",
      "webPublishing",
      "fileRecoveryPr",
      "webPublishObjects",
      "extLst",
    ]);
    workbook.documentElement.insertBefore(
      calc,
      Array.from(workbook.documentElement.children).find((child) =>
        later.has(child.localName),
      ) ?? null,
    );
  }
  calc.setAttribute("fullCalcOnLoad", "1");
  calc.setAttribute("forceFullCalc", "1");
  for (const relation of rels)
    if (relation.getAttribute("Type")?.endsWith("/calcChain")) {
      zip.remove(resolvePart(relation.getAttribute("Target") ?? ""));
      relation.remove();
    }
  const types = await xmlPart(zip, "[Content_Types].xml");
  for (const type of Array.from(types.documentElement.children))
    if (type.getAttribute("ContentType")?.endsWith(".calcChain+xml"))
      type.remove();
  putXml(zip, "xl/workbook.xml", workbook);
  putXml(zip, "xl/_rels/workbook.xml.rels", relations);
  putXml(zip, "[Content_Types].xml", types);
  const result = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  checkPackageSize(result);
  return result;
}
