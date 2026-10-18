import { a, p, fail, one, numericId } from "./presentationPackageXml";
import type { Grid } from "./presentationTableGrid";

export const emusPerPixel = 9525;

export function dimension(element: Element, attribute: string): number {
  const value = element.getAttribute(attribute) ?? "";
  if (!numericId(value, 1, Number.MAX_SAFE_INTEGER))
    fail("table track dimension");
  return Number(value);
}

export function sum(values: readonly number[]): number {
  const result = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(result) || result <= 0) fail("table dimension sum");
  return result;
}

export function emu(value: number, positive: boolean): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    fail("table resize dimension");
  const result = Math.round(value * emusPerPixel);
  if (
    !Number.isSafeInteger(result) ||
    (positive && (value <= 0 || result <= 0))
  )
    fail("table resize dimension");
  return result;
}

export function frameElements(grid: Grid) {
  const transform = one(grid.element, p, "xfrm");
  const offset = transform && one(transform, a, "off");
  const extent = transform && one(transform, a, "ext");
  if (!transform || !offset || !extent) fail("table frame");
  for (const attribute of ["x", "y"]) {
    const value = offset.getAttribute(attribute) ?? "";
    if (!/^-?[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)))
      fail("table frame position");
  }
  dimension(extent, "cx");
  dimension(extent, "cy");
  return { offset, extent };
}

export function tracks(grid: Grid) {
  return {
    widths: grid.columnElements.map((column) => dimension(column, "w")),
    heights: grid.rowElements.map((row) => dimension(row, "h")),
  };
}

export function consistent(frame: number, dimensions: readonly number[]) {
  // 各轨道和外框分别四舍五入到 EMU；容忍这些独立舍入的最大累计误差。
  if (
    Math.abs(sum(dimensions) - frame) > Math.ceil((dimensions.length + 1) / 2)
  )
    fail("table frame and tracks mismatch");
}
