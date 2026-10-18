import {
  a,
  fail,
  children,
  one,
  create,
  numericId,
  xmlPart,
  slidePaths,
  loadPresentationPackage,
  savePresentationPackage,
} from "./presentationPackageXml";
import {
  validateTextBody,
  replaceText,
  applyTextStyle,
  replaceFill,
  rgb,
  type PresentationTextStyle,
} from "./presentationTextPackage";
import {
  tableGrid,
  cellAt,
  selectedCells,
  record,
  type PresentationTableRange,
} from "./presentationTableGrid";
import {
  applyPresentationTableStructure,
  type PresentationTableStructureEdit,
} from "./presentationTableStructurePackage";
import {
  applyPresentationTableAdvanced,
  type PresentationTableAdvancedEdit,
} from "./presentationTableAdvancedPackage";
import {
  applyPresentationTableFormat,
  type PresentationTableFormatEdit,
} from "./presentationTableFormatPackage";
import { tableStyleContext } from "./presentationTableStyle";

export type { PresentationTableRange } from "./presentationTableGrid";

export type PresentationCellStyle = PresentationTextStyle & {
  fillColor?: string;
};

/** row/column 是逻辑格网坐标；文字操作必须指向合并格的左上锚点。 */
export type PresentationTableEdit =
  | PresentationTableStructureEdit
  | PresentationTableAdvancedEdit
  | PresentationTableFormatEdit
  | ({ slideId: string; tableId: string } & (
      | { type: "set-cell-text"; row: number; column: number; text: string }
      | {
          type: "set-cell-style";
          range: PresentationTableRange;
          style: PresentationCellStyle;
        }
      | { type: "clear-cells"; range: PresentationTableRange }
    ));

function cellTextBody(cell: Element): Element {
  if (
    Array.from(cell.children).some(
      (child) => child.localName === "txBody" && child.namespaceURI !== a,
    )
  )
    fail("cell text namespace");
  let body = one(cell, a, "txBody");
  if (!body) {
    body = create(cell, a, "txBody");
    body.append(create(cell, a, "bodyPr"), create(cell, a, "lstStyle"));
    cell.insertBefore(body, cell.firstChild);
  }
  return validateTextBody(body);
}

function applyCellStyle(cell: Element, style: PresentationCellStyle) {
  if (
    !record(style) ||
    Object.keys(style).some(
      (key) =>
        !["fontSize", "bold", "italic", "color", "fillColor"].includes(key),
    )
  )
    fail("cell style");
  if (style.fillColor !== undefined) {
    let properties = one(cell, a, "tcPr");
    if (!properties) {
      properties = create(cell, a, "tcPr");
      cell.insertBefore(properties, one(cell, a, "extLst") ?? null);
    }
    replaceFill(properties, rgb(style.fillColor));
  }
  if (
    [style.fontSize, style.bold, style.italic, style.color].some(
      (value) => value !== undefined,
    )
  ) {
    const body = cellTextBody(cell);
    if (!children(body, a, "p").length) body.append(create(body, a, "p"));
    applyTextStyle(body, style);
  }
}

/** 保序修改原包表格；结构操作与 cell 编辑使用同一个已验证格网。 */
export async function editPresentationTablePackage(
  bytes: Uint8Array,
  edits: readonly PresentationTableEdit[],
): Promise<Uint8Array> {
  const zip = await loadPresentationPackage(bytes);
  const paths = slidePaths(
    await xmlPart(zip, "ppt/presentation.xml"),
    await xmlPart(zip, "ppt/_rels/presentation.xml.rels"),
  );
  const loaded = new Map<string, Document>();
  const changed = new Set<string>();
  for (const edit of edits) {
    if (
      !record(edit) ||
      !numericId(edit.slideId, 256, 2147483647) ||
      !numericId(edit.tableId, 0, 4294967295)
    )
      fail("table edit identity");
    const path = paths.get(edit.slideId);
    if (!path) fail("missing slide identity");
    const xml = loaded.get(path) ?? (await xmlPart(zip, path));
    loaded.set(path, xml);
    const grid = tableGrid(xml, edit.tableId);
    let modified = true;
    switch (edit.type) {
      case "set-cell-text": {
        const cell = cellAt(grid, edit.row, edit.column);
        if (cell.row !== edit.row || cell.column !== edit.column)
          fail("merged cell continuation target");
        replaceText(cellTextBody(cell.element), edit.text);
        break;
      }
      case "set-cell-style":
        for (const cell of selectedCells(grid, edit.range))
          applyCellStyle(cell.element, edit.style);
        break;
      case "clear-cells":
        for (const cell of selectedCells(grid, edit.range))
          replaceText(cellTextBody(cell.element), "");
        break;
      case "insert-rows":
      case "delete-rows":
      case "insert-columns":
      case "delete-columns":
      case "resize-table":
        applyPresentationTableStructure(grid, edit, (cell) =>
          replaceText(cellTextBody(cell), ""),
        );
        tableGrid(xml, edit.tableId);
        break;
      case "move-row":
      case "move-column":
      case "merge-cells":
      case "unmerge-cells":
      case "resize-row":
      case "resize-column":
      case "distribute-rows":
      case "distribute-columns":
        modified = applyPresentationTableAdvanced(grid, edit);
        tableGrid(xml, edit.tableId);
        break;
      case "set-border-preset":
      case "format-existing-borders":
        modified = applyPresentationTableFormat(
          grid,
          edit,
          await tableStyleContext(zip, path, xml),
        );
        break;
      case "set-table-options":
        modified = applyPresentationTableFormat(grid, edit);
        break;
      default:
        fail("unsupported table edit");
    }
    if (modified) changed.add(path);
  }
  if (!changed.size) return bytes.slice();
  for (const path of changed)
    zip.file(path, new XMLSerializer().serializeToString(loaded.get(path)!));
  return savePresentationPackage(zip);
}
