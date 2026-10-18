import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { PresentationController } from "./PresentationController";
import type { PresentationCellStyle } from "./presentationTablePackage";
import { PresentationTableStructureControls } from "./PresentationTableStructureControls";
import { PresentationTableStyleControls } from "./PresentationTableStyleControls";

/** 表格文字样式使用独立语义动作；与对象共用历史及保存 owner。 */
export function PresentationTableControls({
  controller,
  disabled,
}: {
  controller: PresentationController;
  disabled: boolean;
}) {
  const { t } = useTranslation("workspace");
  const state = useSyncExternalStore(
    controller.tableEditing.subscribe,
    controller.tableEditing.getSnapshot,
  );
  if (!state?.selection || !state.activeCell) return null;
  const editStyle = (style: PresentationCellStyle) =>
    controller.tableEditing.edit({
      type: "set-cell-style",
      tableId: state.tableId,
      range: state.selection!.range,
      style,
    });
  const button =
    "rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label={t("workspace.presentationTable.actions")}
      className="flex w-full flex-wrap items-center gap-2"
      data-testid="presentation-table-controls"
    >
      <span className="text-xs">
        {t("workspace.presentationTable.cell", {
          row: state.activeCell.row + 1,
          column: state.activeCell.column + 1,
        })}
      </span>
      <button
        type="button"
        className={button}
        disabled={disabled}
        onClick={() =>
          controller.textActivateBlockEnd({
            tableId: state.tableId,
            ...state.activeCell!,
          })
        }
      >
        {t("workspace.presentationEditing.editText")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        aria-pressed={state.mixed.bold ? "mixed" : state.style.bold}
        onClick={() => editStyle({ bold: !state.style.bold })}
      >
        {t("workspace.presentationEditing.bold")}
      </button>
      <button
        type="button"
        className={button}
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        aria-pressed={state.mixed.italic ? "mixed" : state.style.italic}
        onClick={() => editStyle({ italic: !state.style.italic })}
      >
        {t("workspace.presentationEditing.italic")}
      </button>
      <label className="flex items-center gap-1 text-xs">
        {t("workspace.presentationEditing.fontSize")}
        <input
          key={`${state.tableId}:${state.activeCell.row}:${state.activeCell.column}:${state.style.fontSize}`}
          className="w-16 rounded border border-border bg-background px-1 py-0.5"
          type="number"
          min="1"
          max="400"
          aria-label={t("workspace.presentationEditing.fontSize")}
          defaultValue={state.mixed.fontSize ? "" : state.style.fontSize}
          disabled={disabled}
          onBlur={(event) => {
            if (
              event.currentTarget.value &&
              event.currentTarget.checkValidity() &&
              (state.mixed.fontSize ||
                Number(event.currentTarget.value) !== state.style.fontSize)
            )
              editStyle({ fontSize: Number(event.currentTarget.value) });
          }}
        />
      </label>
      <label className="flex items-center gap-1 text-xs">
        {t("workspace.presentationEditing.color")}
        <input
          type="color"
          aria-label={t("workspace.presentationEditing.color")}
          value={`#${state.style.color}`}
          disabled={disabled}
          onChange={(event) => editStyle({ color: event.currentTarget.value })}
        />
      </label>
      <button
        type="button"
        className={button}
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() =>
          controller.tableEditing.edit({
            type: "clear-cells",
            tableId: state.tableId,
            range: state.selection!.range,
          })
        }
      >
        {t("workspace.presentationTable.clear")}
      </button>
      <PresentationTableStructureControls
        controller={controller}
        state={state}
        disabled={disabled}
      />
      <PresentationTableStyleControls
        controller={controller}
        state={state}
        disabled={disabled}
      />
    </div>
  );
}
