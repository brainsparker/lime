import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { PresentationController } from "./PresentationController";
import type { PresentationTableSnapshot } from "./presentationTableSelection";

export function PresentationTableStructureControls({
  controller,
  state,
  disabled,
}: {
  controller: PresentationController;
  state: NonNullable<PresentationTableSnapshot>;
  disabled: boolean;
}) {
  const { t } = useTranslation("workspace");
  const range = state.selection?.range;
  if (!range) return null;
  const wholeTable = {
    row: 0,
    column: 0,
    rowCount: state.rowCount,
    columnCount: state.columnCount,
  };
  const rows = range.rowCount > 1 ? range : wholeTable;
  const columns = range.columnCount > 1 ? range : wholeTable;
  const cellActions = [
    {
      key: "distributeRows",
      type: "distribute-rows",
      range: rows,
      blocked: rows.rowCount < 2,
    },
    {
      key: "distributeColumns",
      type: "distribute-columns",
      range: columns,
      blocked: columns.columnCount < 2,
    },
    {
      key: "mergeCells",
      type: "merge-cells",
      range,
      blocked: !state.canMerge,
    },
    {
      key: "unmergeCells",
      type: "unmerge-cells",
      range,
      blocked: !state.canUnmerge,
    },
  ] as const;
  const actions = [
    {
      key: "insertRowAbove",
      type: "insert-rows",
      index: range.row,
      count: 1,
      blocked: state.rowCount >= 100,
    },
    {
      key: "insertRowBelow",
      type: "insert-rows",
      index: range.row + range.rowCount,
      count: 1,
      blocked: state.rowCount >= 100,
    },
    {
      key: "deleteRows",
      type: "delete-rows",
      index: range.row,
      count: range.rowCount,
      blocked: state.rowCount <= range.rowCount,
    },
    {
      key: "insertColumnLeft",
      type: "insert-columns",
      index: range.column,
      count: 1,
      blocked: state.columnCount >= 100,
    },
    {
      key: "insertColumnRight",
      type: "insert-columns",
      index: range.column + range.columnCount,
      count: 1,
      blocked: state.columnCount >= 100,
    },
    {
      key: "deleteColumns",
      type: "delete-columns",
      index: range.column,
      count: range.columnCount,
      blocked: state.columnCount <= range.columnCount,
    },
  ] as const;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
          disabled={disabled}
        >
          {t("workspace.presentationTable.actions")}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={t("workspace.presentationTable.actions")}
          align="start"
          sideOffset={4}
          className="z-50 min-w-[200px] rounded-xl border border-border bg-background p-1 text-foreground shadow-lg"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions.map(({ key, type, index, count, blocked }) => (
            <DropdownMenu.Item
              key={key}
              className="cursor-default select-none rounded-lg px-3 py-2 text-xs outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              disabled={disabled || blocked}
              onSelect={() =>
                controller.tableEditing.edit({
                  type,
                  tableId: state.tableId,
                  index,
                  count,
                })
              }
            >
              {t(`workspace.presentationTable.${key}`)}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {cellActions.map(({ key, type, range, blocked }) => (
            <DropdownMenu.Item
              key={key}
              className="cursor-default select-none rounded-lg px-3 py-2 text-xs outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
              disabled={disabled || blocked}
              onSelect={() =>
                controller.tableEditing.edit({
                  type,
                  tableId: state.tableId,
                  range,
                })
              }
            >
              {t(`workspace.presentationTable.${key}`)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
