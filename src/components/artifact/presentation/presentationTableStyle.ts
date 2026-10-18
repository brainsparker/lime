import type JSZip from "jszip";
import {
  a,
  p,
  r,
  relationships,
  fail,
  one,
  children,
  create,
  xmlPart,
  relationPartPath,
  resolvePartTarget,
} from "./presentationPackageXml";
import type { Grid } from "./presentationTableGrid";
import { tableStyleLine } from "./presentationTableLine";
import { presentationTableStyleDefinition } from "./presentationTableStyleDefinition";
import {
  mergePresentationTheme,
  presentationThemeContext,
} from "./presentationTableTheme";

export const sides = ["top", "right", "bottom", "left"] as const;
export type Side = (typeof sides)[number];
export type LineSide = Side | "diagonalDown" | "diagonalUp";
export const lineNames: Record<LineSide, string> = {
  top: "lnT",
  right: "lnR",
  bottom: "lnB",
  left: "lnL",
  diagonalDown: "lnTlToBr",
  diagonalUp: "lnBlToTr",
};
export interface TableStyleContext {
  styles?: Element;
  theme: Map<string, Element>;
  colorMap: Map<string, string>;
  lineStyles: Element[];
  themeAvailable: boolean;
}

async function related(
  zip: JSZip,
  source: string,
  type: string,
): Promise<string | undefined> {
  const path = relationPartPath(source);
  if (!zip.file(path)) return undefined;
  const xml = await xmlPart(zip, path),
    root = xml.documentElement;
  if (root.namespaceURI !== relationships || root.localName !== "Relationships")
    fail("table style relationships");
  const matches = children(root, relationships, "Relationship").filter(
    (entry) => entry.getAttribute("Type") === `${r}/${type}`,
  );
  if (matches.length > 1) fail("ambiguous table style relationship");
  const entry = matches[0];
  if (!entry) return undefined;
  if (
    (entry.getAttribute("TargetMode") ?? "Internal").toLowerCase() !==
    "internal"
  )
    fail("external table style relationship");
  return resolvePartTarget(source, entry.getAttribute("Target") ?? "");
}

export async function tableStyleContext(
  zip: JSZip,
  slidePath: string,
  slide: Document,
): Promise<TableStyleContext> {
  const stylePath = await related(zip, "ppt/presentation.xml", "tableStyles");
  const layoutPath = await related(zip, slidePath, "slideLayout");
  const layout = layoutPath ? await xmlPart(zip, layoutPath) : undefined;
  const masterPath = layoutPath
    ? await related(zip, layoutPath, "slideMaster")
    : undefined;
  const master = masterPath ? await xmlPart(zip, masterPath) : undefined;
  const themePath = masterPath
    ? await related(zip, masterPath, "theme")
    : await related(zip, "ppt/presentation.xml", "theme");
  const themeDocument = themePath ? await xmlPart(zip, themePath) : undefined;
  const overrides: Element[] = [];
  for (const path of [masterPath, layoutPath, slidePath]) {
    const target = path && (await related(zip, path, "themeOverride"));
    if (target) overrides.push((await xmlPart(zip, target)).documentElement);
  }
  const { theme, lineStyles } = presentationThemeContext(
    mergePresentationTheme(themeDocument?.documentElement, overrides),
  );
  const colorMap = new Map<string, string>();
  const masterMap = master && one(master.documentElement, p, "clrMap");
  const assign = (mapping: Element | undefined) => {
    if (mapping)
      for (const attribute of Array.from(mapping.attributes))
        if (!attribute.namespaceURI)
          colorMap.set(attribute.localName, attribute.value);
  };
  assign(masterMap);
  for (const xml of [layout, slide]) {
    const override = xml && one(xml.documentElement, p, "clrMapOvr");
    if (override && one(override, a, "masterClrMapping")) {
      colorMap.clear();
      assign(masterMap);
    } else assign(override && one(override, a, "overrideClrMapping"));
  }
  return {
    styles: stylePath
      ? (await xmlPart(zip, stylePath)).documentElement
      : undefined,
    theme,
    colorMap,
    lineStyles,
    themeAvailable: !!masterPath && !!themePath && theme.size > 0,
  };
}

export function cellProperties(cell: Element): Element {
  let properties = one(cell, a, "tcPr");
  if (!properties) {
    properties = create(cell, a, "tcPr");
    cell.insertBefore(properties, one(cell, a, "extLst") ?? null);
  }
  return properties;
}

function enabled(properties: Element | undefined, attribute: string) {
  const raw = properties?.getAttribute(attribute);
  return raw === "1" || raw === "true";
}

function condition(
  kind: string,
  grid: Grid,
  properties: Element | undefined,
  row: number,
  column: number,
): boolean {
  switch (kind) {
    case "wholeTbl":
      return true;
    case "firstRow":
      return enabled(properties, "firstRow") && row === 0;
    case "lastRow":
      return enabled(properties, "lastRow") && row === grid.rows - 1;
    case "firstCol":
      return enabled(properties, "firstCol") && column === 0;
    case "lastCol":
      return enabled(properties, "lastCol") && column === grid.columns - 1;
    case "band1H":
    case "band2H": {
      const start = +enabled(properties, "firstRow"),
        end = grid.rows - 1 - +enabled(properties, "lastRow");
      return (
        enabled(properties, "bandRow") &&
        row >= start &&
        row <= end &&
        (row - start) % 2 === (kind === "band1H" ? 0 : 1)
      );
    }
    case "band1V":
    case "band2V": {
      const start = +enabled(properties, "firstCol"),
        end = grid.columns - 1 - +enabled(properties, "lastCol");
      return (
        enabled(properties, "bandCol") &&
        column >= start &&
        column <= end &&
        (column - start) % 2 === (kind === "band1V" ? 0 : 1)
      );
    }
    case "nwCell":
      return row === 0 && column === 0;
    case "neCell":
      return row === 0 && column === grid.columns - 1;
    case "swCell":
      return row === grid.rows - 1 && column === 0;
    case "seCell":
      return row === grid.rows - 1 && column === grid.columns - 1;
    default:
      return false;
  }
}

function applies(
  side: Side | "insideH" | "insideV",
  kind: string,
  grid: Grid,
  row: number,
  column: number,
): boolean {
  const vertical = [
    "wholeTbl",
    "firstCol",
    "lastCol",
    "band1V",
    "band2V",
  ].includes(kind);
  const horizontal = [
    "wholeTbl",
    "firstRow",
    "lastRow",
    "band1H",
    "band2H",
  ].includes(kind);
  switch (side) {
    case "top":
      return vertical
        ? row === 0
        : ["lastRow", "swCell", "seCell"].includes(kind)
          ? row === grid.rows - 1
          : true;
    case "bottom":
      return vertical
        ? row === grid.rows - 1
        : ["firstRow", "nwCell", "neCell"].includes(kind)
          ? row === 0
          : true;
    case "left":
      return horizontal
        ? column === 0
        : ["lastCol", "neCell", "seCell"].includes(kind)
          ? column === grid.columns - 1
          : true;
    case "right":
      return horizontal
        ? column === grid.columns - 1
        : ["firstCol", "nwCell", "swCell"].includes(kind)
          ? column === 0
          : true;
    case "insideH":
      return vertical && row < grid.rows - 1;
    case "insideV":
      return horizontal && column < grid.columns - 1;
  }
}

/** 表格样式先逐条件合并，随后由物理 cell 的直接 line 逐边覆盖；不改原 style part。 */
export function resolvedTableLines(
  grid: Grid,
  context: TableStyleContext,
): Map<Element, Map<LineSide, Element>> {
  const properties = one(grid.table, a, "tblPr"),
    id =
      properties &&
      one(properties, a, "tableStyleId")?.textContent?.trim().toLowerCase();
  const { definition } = presentationTableStyleDefinition(
    context.styles,
    id,
    context.themeAvailable,
  );
  const rules = definition
    ? Array.from(definition.children).filter(
        (child) => child.namespaceURI === a,
      )
    : [];
  const result = new Map<Element, Map<LineSide, Element>>();
  grid.cells.forEach((cells, row) =>
    cells.forEach((cell, column) => {
      const lines = new Map<LineSide, Element>();
      const ordered = [
        ...rules.filter((rule) => rule.localName === "wholeTbl"),
        ...rules.filter((rule) => rule.localName !== "wholeTbl"),
      ];
      for (const rule of ordered) {
        if (!condition(rule.localName, grid, properties, row, column)) continue;
        const style = one(rule, a, "tcStyle"),
          borders = style && one(style, a, "tcBdr");
        if (!borders) continue;
        for (const side of [...sides, "insideH", "insideV"] as const) {
          const border = one(borders, a, side);
          if (!border || !applies(side, rule.localName, grid, row, column))
            continue;
          const line = tableStyleLine(border, context),
            target =
              side === "insideH"
                ? "bottom"
                : side === "insideV"
                  ? "right"
                  : side;
          if (line === null) lines.delete(target);
          else if (line) lines.set(target, line);
        }
      }
      const direct = one(cell, a, "tcPr");
      if (direct)
        for (const [side, name] of Object.entries(lineNames)) {
          const line = one(direct, a, name);
          if (line) lines.set(side as LineSide, line);
        }
      result.set(cell, lines);
    }),
  );
  return result;
}
