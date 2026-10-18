import type { TableNodeData } from "@aiden0z/pptx-renderer";
import { presentationTableCells } from "./presentationTableSelection";

type Measurement =
  | { status: "ready"; rowHeights: number[]; fontFamilies: string[] }
  | { status: "not-ready" | "unsupported" | "failed"; reason: string };

const typography = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-stretch",
  "font-variant",
  "font-feature-settings",
  "font-variation-settings",
  "font-kerning",
  "font-size-adjust",
  "font-synthesis",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-indent",
  "text-transform",
  "text-rendering",
  "text-orientation",
  "white-space",
  "overflow-wrap",
  "word-break",
  "line-break",
  "hyphens",
  "tab-size",
  "direction",
  "unicode-bidi",
  "vertical-align",
];
const close = (actual: string, expected: number) =>
  Number.isFinite(parseFloat(actual)) &&
  Math.abs(parseFloat(actual) - expected) <=
    Math.max(0.001, Math.abs(expected) * 0.000001);

function gridMatches(element: HTMLTableElement, table: TableNodeData) {
  const cells = presentationTableCells(table);
  if (!cells || element.rows.length !== table.rows.length) return false;
  return Array.from(element.rows).every((row, index) => {
    const expected = cells.filter((cell) => cell.row === index);
    return (
      row.cells.length === expected.length &&
      expected.every(
        (cell, i) =>
          row.cells[i].colSpan === cell.columnSpan &&
          row.cells[i].rowSpan === cell.rowSpan,
      )
    );
  });
}

/** renderer 没有公开 node-id；几何/格网歧义时拒绝把首个 table 当目标。 */
export function findPresentationTableElement(
  slide: HTMLElement,
  table: TableNodeData,
): HTMLTableElement | null {
  const expected = [
    ...(table.rotation ? [`rotate(${table.rotation}deg)`] : []),
    ...(table.flipH ? ["scaleX(-1)"] : []),
    ...(table.flipV ? ["scaleY(-1)"] : []),
  ].join("");
  const matches = Array.from(
    slide.querySelectorAll<HTMLTableElement>("table"),
  ).filter((element) => {
    const style = element.parentElement?.style;
    return (
      style &&
      close(style.left, table.position.x) &&
      close(style.top, table.position.y) &&
      close(style.width, table.size.w) &&
      close(style.height, table.size.h) &&
      style.transform.replace(/\s/g, "") === expected &&
      gridMatches(element, table)
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

/** 真实 renderer DOM 的单轨最小高度；每个结果以其余当前行高度不变为前提。 */
export function measurePresentationTableRows({
  table,
  element,
  columnWidths,
  minimumRowHeight = 20,
}: {
  table: TableNodeData;
  element: HTMLTableElement;
  columnWidths: readonly number[];
  minimumRowHeight?: number;
}): Measurement {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!element.isConnected || !view || !document.body)
    return { status: "not-ready", reason: "detached-renderer" };
  if (!document.fonts || document.fonts.status !== "loaded")
    return { status: "not-ready", reason: "fonts-not-ready" };
  if (
    !Number.isFinite(minimumRowHeight) ||
    minimumRowHeight < 20 ||
    columnWidths.length !== table.columns.length ||
    columnWidths.some(
      (width, index) =>
        !Number.isFinite(width) || width <= 0 || width !== table.columns[index],
    )
  )
    return { status: "failed", reason: "stale-tracks" };
  const cells = presentationTableCells(table);
  if (!cells || !gridMatches(element, table))
    return { status: "failed", reason: "renderer-grid-mismatch" };
  const sourceStyle = view.getComputedStyle(element);
  if (
    Math.abs(parseFloat(sourceStyle.width) - table.size.w) > 0.0625 ||
    !Number.isFinite(parseFloat(sourceStyle.width))
  )
    return { status: "not-ready", reason: "renderer-layout-not-ready" };
  const host = document.createElement("div");
  host.dataset.presentationTableMeasurement = table.id;
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    transform: "none",
    width: "max-content",
    height: "auto",
    margin: "0",
    padding: "0",
    border: "0",
    contain: "layout style paint",
  });
  const rowHeights = table.rows.map(() => minimumRowHeight);
  const families = new Set<string>();
  try {
    document.body.append(host);
    const calibration = document.createElement("div");
    Object.assign(calibration.style, {
      width: "100px",
      height: "1px",
      padding: "0",
      border: "0",
    });
    host.append(calibration);
    const bounds = calibration.getBoundingClientRect();
    if (
      Math.abs(bounds.width - 100) > 0.001 ||
      Math.abs(bounds.height - 1) > 0.001
    )
      return { status: "not-ready", reason: "layout-engine-unavailable" };
    calibration.remove();
    const rowOffsets = table.rows.map(() => 0);
    for (const cell of cells) {
      const original = element.rows[cell.row].cells[rowOffsets[cell.row]++];
      const style = view.getComputedStyle(original);
      const width =
        parseFloat(style.width) -
        (style.boxSizing === "border-box"
          ? [
              style.paddingLeft,
              style.paddingRight,
              style.borderLeftWidth,
              style.borderRightWidth,
            ].reduce((sum, value) => sum + parseFloat(value), 0)
          : 0);
      if (!Number.isFinite(width) || width <= 0)
        return { status: "not-ready", reason: "cell-width-not-ready" };
      const shell = document.createElement("div");
      const language = original.closest("[lang]")?.getAttribute("lang");
      if (language) shell.lang = language;
      const originals = [
        original,
        ...original.querySelectorAll<HTMLElement>("*"),
      ];
      const clone = original.cloneNode(true) as HTMLElement;
      const clones = [shell, ...clone.querySelectorAll<HTMLElement>("*")];
      if (originals.length !== clones.length)
        return { status: "failed", reason: "cell-clone-mismatch" };
      for (let index = 0; index < originals.length; index++) {
        const source = originals[index],
          target = clones[index];
        if (
          index &&
          ![
            "DIV",
            "SPAN",
            "BR",
            "P",
            "B",
            "I",
            "STRONG",
            "EM",
            "U",
            "S",
            "SUP",
            "SUB",
          ].includes(source.tagName)
        )
          return { status: "unsupported", reason: "non-text-cell-content" };
        const resolved = view.getComputedStyle(source);
        if (resolved.writingMode && resolved.writingMode !== "horizontal-tb")
          return { status: "unsupported", reason: "vertical-writing" };
        if (resolved.position === "absolute" || resolved.position === "fixed")
          return { status: "unsupported", reason: "out-of-flow-cell-content" };
        if (
          source.style.transform &&
          !/^scale[XY]\(-1\)(\s*scale[XY]\(-1\))?$/.test(source.style.transform)
        )
          return { status: "unsupported", reason: "transformed-cell-content" };
        families.add(resolved.fontFamily);
        const font = `${resolved.fontStyle} ${resolved.fontWeight} ${resolved.fontSize} ${resolved.fontFamily}`;
        if (!document.fonts.check(font, source.textContent || " "))
          return { status: "not-ready", reason: "cell-font-not-ready" };
        for (const property of typography)
          target.style.setProperty(
            property,
            resolved.getPropertyValue(property),
          );
        target.removeAttribute("id");
        target.removeAttribute("contenteditable");
        target.style.transform = "none";
        // renderer 为 flip 文本包一层 height:100%；自然内容测量不能继承行高。
        if (source.style.height === "100%") target.style.height = "auto";
      }
      shell.append(...Array.from(clone.childNodes));
      Object.assign(shell.style, {
        display: "flow-root",
        position: "static",
        width: `${width}px`,
        minWidth: "0",
        maxWidth: "none",
        height: "auto",
        minHeight: "0",
        maxHeight: "none",
        boxSizing: "content-box",
        overflow: "visible",
        margin: "0",
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        borderLeft: style.borderLeft,
        borderRight: style.borderRight,
        borderTop: style.borderTop,
        borderBottom: style.borderBottom,
      });
      host.append(shell);
      const required = shell.getBoundingClientRect().height;
      if (!Number.isFinite(required) || required <= 0)
        return { status: "not-ready", reason: "cell-height-not-ready" };
      shell.remove();
      const existing = table.rows
        .slice(cell.row, cell.row + cell.rowSpan)
        .reduce((sum, row) => sum + row.height, 0);
      for (let row = cell.row; row < cell.row + cell.rowSpan; row++)
        rowHeights[row] = Math.max(
          rowHeights[row],
          required - existing + table.rows[row].height,
        );
    }
    return { status: "ready", rowHeights, fontFamilies: [...families].sort() };
  } catch {
    return { status: "failed", reason: "renderer-measurement-failed" };
  } finally {
    host.remove();
  }
}
