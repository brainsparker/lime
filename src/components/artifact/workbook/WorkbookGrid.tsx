import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { FunctionSquare } from "lucide-react";
import {
  cellAddress,
  columnName,
  containsCell,
  parseCellRange,
  rangeAddress,
  rangeBetween,
  type CellRange,
  type CellPosition,
} from "./workbookRange";
import type { WorkbookSheet } from "./workbookSnapshot";
import type { WorkbookController, WorkbookEditor } from "./WorkbookController";

const rowHeaderWidth = 48;
const columnHeaderHeight = 28;

function offsets(
  count: number,
  sizes: Record<number, number>,
  fallback: number,
) {
  const values = [0];
  for (let index = 1; index <= count; index++)
    values.push(values[index - 1] + (sizes[index] ?? fallback));
  return values;
}

export function WorkbookGrid({
  sheet,
  onSelectionChange,
  navigationCommand,
  controller,
  editor,
}: {
  sheet: WorkbookSheet;
  onSelectionChange?: (range: CellRange) => void;
  navigationCommand?: { request: string; range: CellRange };
  controller?: WorkbookController;
  editor?: WorkbookEditor | null;
}) {
  const { t } = useTranslation("workspace");
  const editing = controller?.getSnapshot().isEditing ?? false;
  const saving = controller?.getSnapshot().saving ?? false;
  const container = useRef<HTMLDivElement>(null);
  const initialSelection = controller?.getSnapshot().selections[sheet.id];
  const [selection, setSelection] = useState<CellPosition>(
    initialSelection?.end ?? { row: 1, column: 1 },
  );
  const [addressInput, setAddressInput] = useState(
    initialSelection ? rangeAddress(initialSelection) : "A1",
  );
  const [anchor, setAnchor] = useState<CellPosition>(
    initialSelection?.start ?? { row: 1, column: 1 },
  );
  const [invalid, setInvalid] = useState(false);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const rowOffsets = useMemo(
    () => offsets(sheet.rowCount, sheet.rowHeights, 26),
    [sheet],
  );
  const colOffsets = useMemo(
    () => offsets(sheet.columnCount, sheet.columnWidths, 100),
    [sheet],
  );
  const rows = useVirtualizer({
    count: sheet.rowCount,
    getScrollElement: () => container.current,
    estimateSize: (index) => sheet.rowHeights[index + 1] ?? 26,
    overscan: 4,
    scrollMargin: columnHeaderHeight,
    scrollPaddingStart: columnHeaderHeight,
  });
  const columns = useVirtualizer({
    count: sheet.columnCount,
    getScrollElement: () => container.current,
    estimateSize: (index) => sheet.columnWidths[index + 1] ?? 100,
    horizontal: true,
    overscan: 2,
    scrollMargin: rowHeaderWidth,
    scrollPaddingStart: rowHeaderWidth,
  });
  const selectedMerge = sheet.merges.find((range) =>
    containsCell(range, selection),
  );
  const selected = selectedMerge?.start ?? selection;
  const address = cellAddress(selected);
  const activeCell = sheet.cells[address];
  const range = rangeBetween(anchor, selectedMerge?.end ?? selected);
  const selectedAddress = rangeAddress(range);
  const selectionChanged = useRef(onSelectionChange);
  selectionChanged.current = onSelectionChange;
  useEffect(() => {
    setAddressInput(selectedAddress);
    setInvalid(false);
    selectionChanged.current?.(parseCellRange(selectedAddress)!);
  }, [selectedAddress, sheet.id]);

  useLayoutEffect(() => {
    if (!navigationCommand) return;
    const { start, end } = navigationCommand.range;
    setAnchor(start);
    setSelection(end);
    rows.scrollToIndex(start.row - 1, { align: "auto" });
    columns.scrollToIndex(start.column - 1, { align: "auto" });
  }, [navigationCommand, rows, columns]);

  const select = (next: CellPosition, reveal = false, extend = false) => {
    if (controller && !controller.flushEdits()) return;
    const clamped = {
      row: Math.min(sheet.rowCount, Math.max(1, next.row)),
      column: Math.min(sheet.columnCount, Math.max(1, next.column)),
    };
    const rowDirection = clamped.row < selection.row ? -1 : 1;
    const columnDirection = clamped.column < selection.column ? -1 : 1;
    while (
      sheet.rowHeights[clamped.row] === 0 &&
      clamped.row + rowDirection > 0 &&
      clamped.row + rowDirection <= sheet.rowCount
    )
      clamped.row += rowDirection;
    while (
      sheet.columnWidths[clamped.column] === 0 &&
      clamped.column + columnDirection > 0 &&
      clamped.column + columnDirection <= sheet.columnCount
    )
      clamped.column += columnDirection;
    const merged = sheet.merges.find((range) => containsCell(range, clamped));
    const position = merged?.start ?? clamped;
    setSelection(position);
    if (!extend) setAnchor(position);
    if (reveal) {
      rows.scrollToIndex(position.row - 1, { align: "auto" });
      columns.scrollToIndex(position.column - 1, { align: "auto" });
    }
  };
  const goToAddress = () => {
    const next = parseCellRange(addressInput);
    if (
      !next ||
      next.end.row > sheet.rowCount ||
      next.end.column > sheet.columnCount ||
      sheet.rowHeights[next.start.row] === 0 ||
      sheet.columnWidths[next.start.column] === 0 ||
      sheet.rowHeights[next.end.row] === 0 ||
      sheet.columnWidths[next.end.column] === 0
    ) {
      setInvalid(true);
      return;
    }
    setAnchor(next.start);
    select(next.end, true, true);
    container.current?.focus();
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      editing &&
      !saving &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      if (
        event.key === "F2" ||
        (event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey)
      ) {
        event.preventDefault();
        controller?.openCellEditor(
          sheet.id,
          address,
          event.key === "F2" ? undefined : event.key,
        );
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        controller?.openCellEditor(sheet.id, address, "");
        controller?.commitCellEdit();
        return;
      }
    }
    let next = { ...selected };
    const forward = selectedMerge?.end ?? selected;
    const pageRows = Math.max(
      1,
      Math.floor((container.current?.clientHeight ?? 260) / 26) - 1,
    );
    switch (event.key) {
      case "ArrowUp":
        next.row--;
        break;
      case "ArrowDown":
        next.row = forward.row + 1;
        break;
      case "ArrowLeft":
        next.column--;
        break;
      case "ArrowRight":
        next.column = forward.column + 1;
        break;
      case "Tab":
        next.column = event.shiftKey ? next.column - 1 : forward.column + 1;
        break;
      case "Enter":
        next.row = event.shiftKey ? next.row - 1 : forward.row + 1;
        break;
      case "PageUp":
        next.row -= pageRows;
        break;
      case "PageDown":
        next.row += pageRows;
        break;
      case "Home":
        next.column = 1;
        if (event.ctrlKey || event.metaKey) next.row = 1;
        break;
      case "End":
        next.column = sheet.columnCount;
        if (event.ctrlKey || event.metaKey) next.row = sheet.rowCount;
        break;
      default:
        return;
    }
    event.preventDefault();
    const rowDirection = next.row >= selected.row ? 1 : -1;
    const colDirection = next.column >= selected.column ? 1 : -1;
    while (
      next.row > 0 &&
      next.row <= sheet.rowCount &&
      sheet.rowHeights[next.row] === 0
    )
      next.row += rowDirection;
    while (
      next.column > 0 &&
      next.column <= sheet.columnCount &&
      sheet.columnWidths[next.column] === 0
    )
      next.column += colDirection;
    select(
      next,
      true,
      event.shiftKey && event.key !== "Tab" && event.key !== "Enter",
    );
  };
  const ownsClipboard = (event: ClipboardEvent<HTMLDivElement>) =>
    controller &&
    !event.defaultPrevented &&
    event.currentTarget.ownerDocument.activeElement === event.currentTarget &&
    !(
      event.target instanceof Element &&
      event.target.closest("input, textarea, [contenteditable]")
    );
  const copy = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!ownsClipboard(event)) return;
    event.preventDefault();
    const payload = controller!.requestClipboardPayload("copy");
    if (payload) event.clipboardData.setData("text/plain", payload.plainText);
  };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (
      !ownsClipboard(event) ||
      !event.clipboardData.types.includes("text/plain")
    )
      return;
    event.preventDefault();
    if (
      !controller!.pasteClipboardData({
        plainText: event.clipboardData.getData("text/plain"),
      })
    )
      return;
    const next = controller!.getSnapshot().selections[sheet.id];
    if (next) {
      setAnchor(next.start);
      setSelection(next.end);
      rows.scrollToIndex(next.start.row - 1, { align: "auto" });
      columns.scrollToIndex(next.start.column - 1, { align: "auto" });
    }
  };
  const visibleRows = rows.getVirtualItems();
  const visibleCols = columns.getVirtualItems();
  const cellsByRow = new Map<number, Set<number>>();
  for (const row of visibleRows) {
    if (!row.size) continue;
    for (const col of visibleCols) {
      if (!col.size) continue;
      const position = { row: row.index + 1, column: col.index + 1 };
      const merge = sheet.merges.find((range) => containsCell(range, position));
      const master = merge?.start ?? position;
      if (!cellsByRow.has(master.row)) cellsByRow.set(master.row, new Set());
      cellsByRow.get(master.row)!.add(master.column);
    }
  }
  const cellId = (value: string) => `workbook-${sheet.id}-${value}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <input
          aria-label={t("workspace.workbookPreview.cellAddress")}
          aria-invalid={invalid}
          title={
            invalid ? t("workspace.workbookPreview.invalidAddress") : undefined
          }
          className="h-7 w-24 rounded border border-border bg-background px-2 text-xs"
          value={addressInput}
          onChange={(event) => {
            setAddressInput(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goToAddress();
            }
          }}
        />
        <FunctionSquare
          aria-hidden="true"
          className="h-3 w-3 shrink-0 text-muted-foreground"
        />
        {editing ? (
          <input
            aria-label={t("workspace.workbookPreview.formula")}
            aria-readonly={saving}
            readOnly={saving}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary"
            value={
              editor?.sheetId === sheet.id && editor.address === address
                ? editor.value
                : activeCell?.formula
                  ? `=${activeCell.formula}`
                  : (activeCell?.raw ?? "")
            }
            onFocus={() =>
              controller?.openCellEditor(
                sheet.id,
                address,
                undefined,
                "formula",
              )
            }
            onChange={(event) =>
              controller?.updateFormulaInput(event.target.value)
            }
            onBlur={() => controller?.commitCellEdit()}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229)
                return;
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                if (event.key === "Escape") controller?.cancelCellEdit();
                else if (!controller?.commitCellEdit()) return;
                container.current?.focus();
              }
            }}
          />
        ) : (
          <div
            role="textbox"
            aria-readonly="true"
            aria-label={t("workspace.workbookPreview.formula")}
            className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-xs"
          >
            {activeCell?.formula
              ? `=${activeCell.formula}`
              : (activeCell?.raw ?? "")}
          </div>
        )}
      </div>
      {invalid && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {t("workspace.workbookPreview.invalidAddress")}
        </p>
      )}
      <div
        ref={container}
        role="grid"
        tabIndex={0}
        aria-label={sheet.name}
        aria-readonly={!editing}
        aria-rowcount={sheet.rowCount}
        aria-colcount={sheet.columnCount}
        aria-activedescendant={
          cellsByRow.get(selected.row)?.has(selected.column)
            ? cellId(address)
            : undefined
        }
        onKeyDown={keyDown}
        onCopy={copy}
        onPaste={paste}
        onScroll={(event) =>
          setScroll({
            top: event.currentTarget.scrollTop,
            left: event.currentTarget.scrollLeft,
          })
        }
        className="relative min-h-0 flex-1 overflow-auto bg-background outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
        data-testid="workbook-grid"
      >
        <div
          className="relative"
          style={{
            width: colOffsets.at(-1)! + rowHeaderWidth,
            height: rowOffsets.at(-1)! + columnHeaderHeight,
          }}
        >
          {[...cellsByRow].map(([row, cols]) => (
            <div
              key={row}
              role="row"
              aria-rowindex={row}
              className="absolute left-0 w-full"
              style={{
                top: columnHeaderHeight + rowOffsets[row - 1],
                height: rowOffsets[row] - rowOffsets[row - 1],
              }}
            >
              {[...cols].map((column) => {
                const position = { row, column };
                const cellName = cellAddress(position);
                const cell = sheet.cells[cellName];
                const merge = sheet.merges.find((range) =>
                  containsCell(range, position),
                );
                const end = merge?.end ?? position;
                const isSelected = containsCell(range, position);
                return (
                  <div
                    key={column}
                    id={cellId(cellName)}
                    role="gridcell"
                    aria-colindex={column}
                    aria-selected={isSelected}
                    aria-rowspan={end.row - row + 1}
                    aria-colspan={end.column - column + 1}
                    data-address={cellName}
                    title={cell?.text}
                    className={`absolute top-0 overflow-hidden border-b border-r border-border px-1.5 py-1 text-xs ${cell?.style.backgroundColor ? "" : "bg-background"} ${isSelected ? "z-[1] ring-2 ring-inset ring-primary" : ""}`}
                    style={{
                      left: rowHeaderWidth + colOffsets[column - 1],
                      width: colOffsets[end.column] - colOffsets[column - 1],
                      height: rowOffsets[end.row] - rowOffsets[row - 1],
                      ...cell?.style,
                    }}
                    onMouseDown={(event) => {
                      if ((event.target as HTMLElement).closest("input"))
                        return;
                      event.preventDefault();
                      select(position, false, event.shiftKey);
                      container.current?.focus();
                    }}
                    onMouseEnter={(event) => {
                      if (event.buttons === 1) select(position, false, true);
                    }}
                    onDoubleClick={() =>
                      controller?.openCellEditor(sheet.id, cellName)
                    }
                  >
                    {editor?.mode === "cell" &&
                    editor.sheetId === sheet.id &&
                    editor.address === cellName ? (
                      <input
                        ref={(input) => {
                          if (input && document.activeElement !== input)
                            input.focus();
                        }}
                        aria-label={t("workspace.workbookPreview.editCell", {
                          address: cellName,
                        })}
                        className="h-full w-full bg-background text-foreground outline-none"
                        value={editor.value}
                        readOnly={saving}
                        onChange={(event) =>
                          controller?.updateFormulaInput(event.target.value)
                        }
                        onBlur={() => controller?.commitCellEdit()}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (
                            event.nativeEvent.isComposing ||
                            event.keyCode === 229
                          )
                            return;
                          if (["Enter", "Tab", "Escape"].includes(event.key)) {
                            event.preventDefault();
                            if (event.key === "Escape")
                              controller?.cancelCellEdit();
                            else {
                              if (!controller?.commitCellEdit()) return;
                              select(
                                {
                                  row:
                                    row +
                                    (event.key === "Enter"
                                      ? event.shiftKey
                                        ? -1
                                        : 1
                                      : 0),
                                  column:
                                    column +
                                    (event.key === "Tab"
                                      ? event.shiftKey
                                        ? -1
                                        : 1
                                      : 0),
                                },
                                true,
                              );
                            }
                            container.current?.focus();
                          }
                        }}
                      />
                    ) : (
                      (cell?.text ?? "")
                    )}
                  </div>
                );
              })}
              {visibleRows.some((item) => item.index + 1 === row) && (
                <div
                  role="rowheader"
                  className="absolute top-0 z-[2] flex h-full items-center justify-center border-b border-r border-border bg-muted text-xs text-muted-foreground"
                  style={{ left: scroll.left, width: rowHeaderWidth }}
                >
                  {row}
                </div>
              )}
            </div>
          ))}
          <div
            role="row"
            className="absolute left-0 z-[3] w-full"
            style={{ top: scroll.top, height: columnHeaderHeight }}
          >
            {visibleCols.map(
              (col) =>
                col.size > 0 && (
                  <div
                    key={col.index}
                    role="columnheader"
                    aria-colindex={col.index + 1}
                    className="absolute top-0 flex h-full items-center justify-center border-b border-r border-border bg-muted text-xs text-muted-foreground"
                    style={{
                      left: rowHeaderWidth + colOffsets[col.index],
                      width: col.size,
                    }}
                  >
                    {columnName(col.index + 1)}
                  </div>
                ),
            )}
            <div
              aria-hidden="true"
              className="absolute top-0 h-full border-b border-r border-border bg-muted"
              style={{ left: scroll.left, width: rowHeaderWidth }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
