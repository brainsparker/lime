import { a, r, create, fail, one } from "./presentationPackageXml";
import {
  validateTableRange,
  type Grid,
  type PresentationTableRange,
} from "./presentationTableGrid";
import { tableEdges } from "./presentationTableBorderGeometry";
import {
  tableBorderStyle,
  lineStyle,
  type PresentationTableBorderPreset,
} from "./presentationTableBorderStyle";
import {
  cellProperties,
  lineNames,
  resolvedTableLines,
  type Side,
  type TableStyleContext,
} from "./presentationTableStyle";
import {
  colorFill,
  colorHex,
  lineColor,
  validateTableBorderColor,
} from "./presentationTableColor";

type Identity = { slideId: string; tableId: string };
export type PresentationTableFormatEdit = Identity &
  (
    | {
        type: "set-border-preset";
        range: PresentationTableRange;
        preset: PresentationTableBorderPreset;
      }
    | {
        type: "format-existing-borders";
        range: PresentationTableRange;
        color?: string;
        width?: number;
      }
    | { type: "set-table-options"; headerRow?: boolean; headerColumn?: boolean }
  );
const fills = [
  "solidFill",
  "noFill",
  "gradFill",
  "blipFill",
  "pattFill",
  "grpFill",
];

function replaceLineFill(line: Element, fill: Element) {
  for (const child of Array.from(line.children))
    if (child.namespaceURI === a && fills.includes(child.localName))
      child.remove();
  line.prepend(fill);
}
function writeLine(cell: Element, side: Side, source?: Element): Element {
  if (source && source.ownerDocument !== cell.ownerDocument)
    for (const node of [
      source,
      ...Array.from(source.getElementsByTagName("*")),
    ])
      if (
        Array.from(node.attributes).some(
          (attribute) => attribute.namespaceURI === r,
        )
      )
        fail("cross-part table border relationship");
  const properties = cellProperties(cell),
    name = lineNames[side],
    previous = one(properties, a, name),
    line = create(properties, a, name);
  if (source) {
    for (const attribute of Array.from(source.attributes))
      line.setAttributeNS(
        attribute.namespaceURI,
        attribute.name,
        attribute.value,
      );
    for (const child of Array.from(source.childNodes))
      line.append(cell.ownerDocument.importNode(child, true));
  }
  if (previous) previous.replaceWith(line);
  else {
    const order = Object.values(lineNames),
      position = order.indexOf(name);
    properties.insertBefore(
      line,
      Array.from(properties.children).find(
        (child) =>
          child.namespaceURI === a &&
          (order.indexOf(child.localName) > position ||
            !order.includes(child.localName)),
      ) ?? null,
    );
  }
  return line;
}
function presetLine(
  cell: Element,
  side: Side,
  color: string,
  width: number,
  style: string,
  hidden = false,
) {
  const previous = one(cellProperties(cell), a, lineNames[side]),
    line = writeLine(cell, side, previous);
  for (const name of ["w", "cap", "cmpd", "algn"]) line.removeAttribute(name);
  for (const child of Array.from(line.children))
    if (
      child.namespaceURI === a &&
      [
        "prstDash",
        "custDash",
        "round",
        "bevel",
        "miter",
        "headEnd",
        "tailEnd",
      ].includes(child.localName)
    )
      child.remove();
  line.setAttribute("w", String(Math.round(width * 9525)));
  replaceLineFill(
    line,
    hidden || width === 0 ? create(line, a, "noFill") : colorFill(line, color),
  );
  const dash = create(line, a, "prstDash");
  dash.setAttribute(
    "val",
    (
      { solid: "solid", dashed: "dash", dotted: "dot" } as Record<
        string,
        string
      >
    )[style] ?? "solid",
  );
  line.insertBefore(dash, one(line, a, "extLst") ?? null);
}

function applyRange(
  grid: Grid,
  range: PresentationTableRange,
  preset: string,
  context: TableStyleContext,
  values: { color?: string; width?: number; style?: string },
) {
  const resolved = resolvedTableLines(grid, context),
    bottom = resolved.get(grid.cells[range.row][range.column])?.get("bottom");
  const color =
    values.color ??
    (bottom && lineColor(bottom)
      ? `#${colorHex(lineColor(bottom)!, context.theme, context.colorMap)}`
      : undefined) ??
    "#D1D5DB";
  const width =
    preset === "none"
      ? 0
      : (values.width ??
        (bottom?.hasAttribute("w")
          ? Number(bottom.getAttribute("w")) / 9525
          : undefined) ??
        1);
  const style =
    values.style ?? (bottom ? lineStyle(bottom) : undefined) ?? "solid";
  const outside = !["inside", "columns", "rows"].includes(preset),
    inside = !["outside", "columns", "rows"].includes(preset);
  for (let row = range.row; row < range.row + range.rowCount; row++)
    for (
      let column = range.column;
      column < range.column + range.columnCount;
      column++
    ) {
      const cell = grid.cells[row][column];
      if (outside) {
        if (row === range.row) presetLine(cell, "top", color, width, style);
        if (row === range.row + range.rowCount - 1)
          presetLine(cell, "bottom", color, width, style);
        if (column === range.column)
          presetLine(cell, "left", color, width, style);
        if (column === range.column + range.columnCount - 1)
          presetLine(cell, "right", color, width, style);
      }
      if ((inside || preset === "rows") && row < range.row + range.rowCount - 1)
        presetLine(cell, "bottom", color, width, style);
      if (
        (inside || preset === "columns") &&
        column < range.column + range.columnCount - 1
      )
        presetLine(cell, "right", color, width, style);
    }
}

export function applyPresentationTableFormat(
  grid: Grid,
  edit: PresentationTableFormatEdit,
  context?: TableStyleContext,
): boolean {
  if (edit.type === "set-table-options") {
    let changed = false,
      properties = one(grid.table, a, "tblPr");
    for (const [key, name] of [
      ["headerRow", "firstRow"],
      ["headerColumn", "firstCol"],
    ] as const) {
      const value = edit[key];
      if (value == null) continue;
      if (typeof value !== "boolean") fail("table header option");
      if (!properties) {
        properties = create(grid.table, a, "tblPr");
        grid.table.prepend(properties);
      }
      const enabled = ["1", "true"].includes(
        properties.getAttribute(name) ?? "",
      );
      if (enabled !== value) {
        properties.setAttribute(name, value ? "1" : "0");
        changed = true;
      }
    }
    return changed;
  }
  validateTableRange(grid, edit.range);
  if (!context) fail("missing table style context");
  if (edit.type === "set-border-preset") {
    if (typeof edit.preset !== "string") fail("table border preset");
    const style = tableBorderStyle(grid, edit.range, context);
    for (const { cell, side } of tableEdges(grid, edit.range))
      presetLine(cell.element, side, "#000000", 0, "solid", true);
    applyRange(grid, edit.range, edit.preset, context, {
      color: style.borderColor,
      width: style.borderWidth || 1,
      style: style.borderStyle,
    });
    return true;
  }
  if (
    edit.width !== undefined &&
    (!Number.isFinite(edit.width) ||
      edit.width < 0 ||
      !Number.isSafeInteger(Math.round(edit.width * 9525)))
  )
    fail("table border width");
  if (edit.color !== undefined) validateTableBorderColor(edit.color);
  const resolved = resolvedTableLines(grid, context);
  if (![...resolved.values()].some((lines) => lines.size)) {
    applyRange(grid, edit.range, "all", context, {
      color: edit.color ?? "#000000",
      width: edit.width ?? 1,
      style: "solid",
    });
    return true;
  }
  let changed = false;
  for (const { cell, side } of tableEdges(grid, edit.range)) {
    const source = resolved.get(cell.element)?.get(side);
    if (!source || !lineColor(source)) continue;
    const line = writeLine(cell.element, side, source);
    if (edit.color?.trim()) replaceLineFill(line, colorFill(line, edit.color));
    if (edit.width === 0) replaceLineFill(line, create(line, a, "noFill"));
    else if (edit.width !== undefined)
      line.setAttribute("w", String(Math.round(edit.width * 9525)));
    changed = true;
  }
  return changed;
}
