import type {
  PresentationData,
  SlideData,
  TableNodeData,
} from "@aiden0z/pptx-renderer";
import { a, create, fail, one } from "./presentationPackageXml";
import {
  tableGrid,
  type Grid,
  type PresentationTableRange,
} from "./presentationTableGrid";
import {
  tableEdges,
  mergedTableRange,
} from "./presentationTableBorderGeometry";
import {
  resolvedTableLines,
  type TableStyleContext,
} from "./presentationTableStyle";
import { colorHex, lineColor } from "./presentationTableColor";
import {
  modelPresentationTheme,
  presentationThemeContext,
} from "./presentationTableTheme";

export type PresentationTableBorderPreset =
  | "all"
  | "outside"
  | "inside"
  | "columns"
  | "rows"
  | "none";
export interface PresentationTableBorderStyle {
  borderEdges?: PresentationTableBorderPreset;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: "solid" | "dashed" | "dotted";
}

const dashes = [
  "",
  "solid",
  "dash",
  "dot",
  "dashDot",
  "dashDotDot",
  "lgDash",
  "sysDash",
  "sysDot",
  "lgDashDot",
  "sysDashDot",
  "lgDashDotDot",
  "sysDashDotDot",
];
const compounds = ["", "sng", "dbl", "thickThin", "thinThick", "tri"];
export function lineWidth(line: Element): number {
  const value = line.getAttribute("w");
  if (value === null) return 1;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    fail("table border width");
  return Math.max(0.25, Number(value) / 9525);
}
function dash(line: Element): string {
  return one(line, a, "prstDash")?.getAttribute("val") ?? "";
}
function priority(line: Element): number {
  if (one(line, a, "custDash")) fail("unsupported table border custom dash");
  const style = dashes.indexOf(dash(line)),
    compound = compounds.indexOf(line.getAttribute("cmpd") ?? "");
  if (style < 0 || compound < 0) fail("unsupported table border line style");
  return lineWidth(line) * 1000 + style + compound;
}
export function lineStyle(
  line: Element,
): PresentationTableBorderStyle["borderStyle"] {
  const value = dash(line);
  if (value === "solid") return "solid";
  if (["dash", "lgDash", "sysDash"].includes(value)) return "dashed";
  if (["dot", "sysDot"].includes(value)) return "dotted";
  return undefined;
}

/** 同一逻辑单位共边取最强线，平局保留遍历先遇到者；空边同样参与 preset 判断。 */
export function tableBorderStyle(
  grid: Grid,
  range: PresentationTableRange,
  context: TableStyleContext,
): PresentationTableBorderStyle {
  const selection = mergedTableRange(grid, range);
  const resolved = resolvedTableLines(grid, context);
  const hasLines = [...resolved.values()].some((lines) => lines.size > 0);
  if (!hasLines)
    return {
      borderEdges: "all",
      borderWidth: 1,
      borderColor: "#000000",
      borderStyle: "solid",
    };
  const segments = new Map<
    string,
    { group: "outside" | "rows" | "columns"; line?: Element }
  >();
  for (const edge of tableEdges(grid, selection)) {
    const candidate = resolved.get(edge.cell.element)?.get(edge.side);
    const visible = candidate && lineColor(candidate) ? candidate : undefined;
    for (let segment = edge.start; segment < edge.end; segment++) {
      const key = `${edge.horizontal}:${edge.cross}:${segment}`,
        previous = segments.get(key)?.line;
      const line =
        visible && previous
          ? priority(visible) > priority(previous)
            ? visible
            : previous
          : (visible ?? previous);
      segments.set(key, { group: edge.group, line });
    }
  }
  const values = [...segments.values()];
  const styles = values.flatMap(({ line }) =>
    line
      ? [
          {
            color: `#${colorHex(lineColor(line)!, context.theme, context.colorMap)}`,
            width: lineWidth(line),
            style: lineStyle(line),
          },
        ]
      : [],
  );
  const first = styles[0];
  const borderEdges = (
    ["none", "all", "outside", "inside", "columns", "rows"] as const
  ).find((preset) =>
    values.every(
      ({ group, line }) =>
        !!line ===
        (preset === "all" ||
          preset === group ||
          (preset === "inside" && group !== "outside")),
    ),
  );
  return {
    borderEdges,
    borderColor: styles.every((style) => style.color === first?.color)
      ? first?.color
      : undefined,
    borderWidth: !styles.length
      ? 0
      : styles.every((style) => style.width === first?.width)
        ? first?.width
        : undefined,
    borderStyle: styles.every((style) => style.style === first?.style)
      ? first?.style
      : undefined,
  };
}

function modelContext(
  model: PresentationData,
  slide: SlideData,
  element: Element,
): TableStyleContext {
  const layoutPath = model.slideToLayout.get(slide.index) ?? slide.layoutIndex;
  const masterPath = model.layoutToMaster.get(layoutPath);
  const layout = model.layouts.get(layoutPath),
    master = masterPath ? model.masters.get(masterPath) : undefined;
  const themePath = masterPath
    ? model.masterToTheme.get(masterPath)
    : undefined;
  const themeData = themePath
    ? model.themes.get(themePath)
    : model.themes.size === 1
      ? [...model.themes.values()][0]
      : undefined;
  const resolvedTheme = modelPresentationTheme(model, slide);
  const nativeTheme = resolvedTheme.root
    ? presentationThemeContext(resolvedTheme.root)
    : undefined;
  const theme = new Map<string, Element>();
  for (const [key, value] of themeData?.colorScheme ?? []) {
    const color = create(element, a, "srgbClr");
    color.setAttribute("val", value.replace(/^#/, ""));
    theme.set(key, color);
  }
  const colorMap = new Map(master?.colorMap);
  for (const source of [layout, slide]) {
    if (source?.colorMapOverrideMode === "master") {
      colorMap.clear();
      for (const [key, value] of master?.colorMap ?? [])
        colorMap.set(key, value);
    } else
      for (const [key, value] of source?.colorMapOverride ?? [])
        colorMap.set(key, value);
  }
  return {
    styles: model.tableStyles?.element ?? undefined,
    theme,
    colorMap,
    lineStyles:
      themeData?.lineStyles.flatMap((line) =>
        line.element ? [line.element] : [],
      ) ?? [],
    ...nativeTheme,
    themeAvailable:
      !!masterPath &&
      !!themePath &&
      !!themeData &&
      (nativeTheme?.theme ?? theme).size > 0,
  };
}

/** 同步复用原包 reader；无法解析继承时显式 unavailable，GUI 不能把它当作无线条。 */
export function readPresentationTableBorderStyle(
  table: TableNodeData,
  range: PresentationTableRange,
  model: PresentationData,
  slide: SlideData,
):
  | { status: "ready"; style: PresentationTableBorderStyle }
  | { status: "unavailable"; reason: string } {
  try {
    const element =
      table.properties?.element ??
      table.rows
        .flatMap((row) => row.cells)
        .find((cell) => cell.properties?.element)?.properties?.element;
    if (!element) fail("missing native table XML");
    const grid = tableGrid(element.ownerDocument, table.id);
    return {
      status: "ready",
      style: tableBorderStyle(grid, range, modelContext(model, slide, element)),
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
