import type { CSSProperties } from "react";
import type { CellRange } from "./workbookRange";

export type WorkbookSourceFormat = "xlsx" | "csv" | "tsv";

export interface WorkbookCell {
  text: string;
  raw: string;
  formula?: string;
  style: CSSProperties;
}

export interface WorkbookSheet {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  rowHeights: Record<number, number>;
  columnWidths: Record<number, number>;
  cells: Record<string, WorkbookCell>;
  merges: CellRange[];
}

export interface WorkbookSnapshot {
  sourceSha256: string;
  sheets: WorkbookSheet[];
}

export type WorkbookImportResult =
  | { ok: true; sheets: WorkbookSheet[] }
  | { ok: false; reason: "invalid" | "tooLarge" };

export class WorkbookImportError extends Error {
  constructor(public readonly reason: "invalid" | "tooLarge") {
    super(`Workbook import: ${reason}`);
  }
}

export function resolveWorkbookSourceFormat(
  path: string,
): WorkbookSourceFormat | null {
  const extension = path
    .split(/[\\/]/)
    .at(-1)
    ?.split(".")
    .at(-1)
    ?.toLowerCase();
  return extension === "xlsx" || extension === "csv" || extension === "tsv"
    ? extension
    : null;
}
