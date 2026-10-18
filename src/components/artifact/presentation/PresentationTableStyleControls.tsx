import { useTranslation } from "react-i18next";
import type { PresentationController } from "./PresentationController";
import type { PresentationTableSnapshot } from "./presentationTableSelection";

/** 表格样式继续消费同一投影，所有修改投递原包owner。 */
export function PresentationTableStyleControls({
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
  const button =
    "rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";
  return (
    <>
      <fieldset
        disabled={disabled || !state.borderAvailable}
        className="flex w-full flex-wrap items-center gap-2"
        aria-label={t("workspace.presentationTable.borders")}
      >
        <legend className="text-xs">
          {t("workspace.presentationTable.borders")}
        </legend>
        {(["all", "inside", "columns", "rows", "none"] as const).map(
          (preset) => (
            <button
              key={preset}
              type="button"
              className={button}
              aria-label={t(`workspace.presentationTable.border.${preset}`)}
              aria-pressed={state.style.borderEdges === preset}
              onClick={() =>
                controller.tableEditing.edit({
                  type: "set-border-preset",
                  tableId: state.tableId,
                  range,
                  preset,
                })
              }
            >
              {t(`workspace.presentationTable.border.${preset}`)}
            </button>
          ),
        )}
        {state.style.borderEdges !== "none" && (
          <>
            <label className="flex items-center gap-1 text-xs">
              {t("workspace.presentationTable.borderColor")}
              <input
                type="color"
                aria-label={t("workspace.presentationTable.borderColor")}
                value={state.style.borderColor ?? "#000000"}
                onChange={(event) =>
                  controller.tableEditing.edit({
                    type: "format-existing-borders",
                    tableId: state.tableId,
                    range,
                    color: event.currentTarget.value,
                  })
                }
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              {t("workspace.presentationTable.borderWeight")}
              <input
                key={`${state.tableId}:${range.row}:${range.column}:${range.rowCount}:${range.columnCount}:${state.style.borderWidth}`}
                type="number"
                min="0"
                step="0.25"
                className="w-16 rounded border border-border bg-background px-1 py-0.5"
                aria-label={t("workspace.presentationTable.borderWeight")}
                defaultValue={
                  state.style.borderWidth === undefined
                    ? ""
                    : Math.round(state.style.borderWidth * 1000) / 1000
                }
                onBlur={(event) => {
                  const value = event.currentTarget.value;
                  if (
                    value &&
                    event.currentTarget.checkValidity() &&
                    (state.style.borderWidth === undefined ||
                      Math.round(Number(value) * 9525) !==
                        Math.round(state.style.borderWidth * 9525))
                  )
                    controller.tableEditing.edit({
                      type: "format-existing-borders",
                      tableId: state.tableId,
                      range,
                      width: Number(value),
                    });
                }}
              />
            </label>
          </>
        )}
      </fieldset>
      <fieldset
        disabled={disabled}
        className="flex w-full flex-wrap items-center gap-3"
        aria-label={t("workspace.presentationTable.options")}
      >
        <legend className="text-xs">
          {t("workspace.presentationTable.options")}
        </legend>
        {(["headerRow", "headerColumn"] as const).map((key) => (
          <label key={key} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              aria-label={t(`workspace.presentationTable.${key}`)}
              checked={state[key]}
              onChange={(event) =>
                controller.tableEditing.edit({
                  type: "set-table-options",
                  tableId: state.tableId,
                  [key]: event.currentTarget.checked,
                })
              }
            />
            {t(`workspace.presentationTable.${key}`)}
          </label>
        ))}
      </fieldset>
    </>
  );
}
