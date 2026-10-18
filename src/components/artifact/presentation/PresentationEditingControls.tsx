import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { PresentationSlideControls } from "./PresentationSlideControls";
import { PresentationTableControls } from "./PresentationTableControls";
import type { PresentationElementOrder } from "./presentationPackage";
import type {
  PresentationController,
  PresentationControllerState,
} from "./PresentationController";
import {
  presentationElements,
  presentationElementFrame,
  presentationElementText,
  presentationElementStyle,
} from "./presentationElements";

const button =
  "rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";
export function PresentationEditingControls({
  controller,
  state,
  onDiscard,
}: {
  controller: PresentationController;
  state: PresentationControllerState;
  onDiscard: () => void;
}) {
  const { t } = useTranslation("workspace");
  const [discarding, setDiscarding] = useState(false);
  const disabled =
    state.saving ||
    state.projecting ||
    !!state.elementInteraction ||
    !!state.selectionMarquee;
  const node =
    state.selectedElementIds.length === 1
      ? presentationElements(state.document, state.selectedSlideId).find(
          (node) => node.id === state.primarySelectedElementId,
        )
      : undefined;
  const style = node
    ? { ...presentationElementStyle(node), ...state.textEditor?.style }
    : null;
  const slideNodes =
    state.document.model.slides[
      state.document.slideIds.indexOf(state.selectedSlideId)
    ]?.nodes ?? [];
  const selectedIndex = slideNodes.findIndex(
    (element) => element.id === state.primarySelectedElementId,
  );
  return (
    <div
      className="flex max-h-[40%] min-h-0 min-w-0 shrink-0 flex-wrap items-center gap-2 overflow-y-auto border-b border-border p-2"
      data-testid="presentation-editing-controls"
      data-dirty={state.dirty}
      data-saving={state.saving}
    >
      <button
        className={button}
        type="button"
        disabled={disabled}
        aria-pressed={state.isEditing}
        onClick={() => controller.setEditingEnabled(!state.isEditing)}
      >
        {t(
          state.isEditing
            ? "workspace.presentationEditing.done"
            : "workspace.presentationEditing.edit",
        )}
      </button>
      {(state.isEditing || state.dirty) && (
        <>
          <span role="status" className="text-xs text-muted-foreground">
            {t(
              state.dirty
                ? "workspace.presentationEditing.unsaved"
                : "workspace.presentationEditing.saved",
            )}
          </span>
          <button
            className={button}
            type="button"
            disabled={disabled || !state.dirty}
            onClick={() => void controller.flushPublicFile()}
          >
            {t(
              state.saving
                ? "workspace.presentationEditing.saving"
                : "workspace.presentationEditing.save",
            )}
          </button>
          <button
            className={button}
            type="button"
            disabled={disabled || !state.dirty}
            onClick={() => setDiscarding(true)}
          >
            {t("workspace.presentationEditing.discard")}
          </button>
          <button
            className={button}
            type="button"
            disabled={disabled || !(state.textEditor?.canUndo ?? state.canUndo)}
            data-presentation-text-controls=""
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => controller.undo()}
          >
            {t("workspace.presentationEditing.undo")}
          </button>
          <button
            className={button}
            type="button"
            disabled={disabled || !(state.textEditor?.canRedo ?? state.canRedo)}
            data-presentation-text-controls=""
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => controller.redo()}
          >
            {t("workspace.presentationEditing.redo")}
          </button>
        </>
      )}
      <PresentationSlideControls controller={controller} state={state} />
      {state.isEditing && node && (
        <div
          className="flex w-full min-w-0 flex-wrap items-center gap-2"
          key={`${node.id}:${state.renderRevision}`}
        >
          <span className="max-w-40 truncate text-xs">{node.name}</span>
          {(
            [
              "bring-forward",
              "bring-to-front",
              "send-backward",
              "send-to-back",
            ] satisfies PresentationElementOrder[]
          ).map((direction) => (
            <button
              className={button}
              type="button"
              key={direction}
              disabled={
                disabled ||
                selectedIndex < 0 ||
                (direction.startsWith("bring-")
                  ? selectedIndex === slideNodes.length - 1
                  : selectedIndex === 0)
              }
              onClick={() => controller.reorderSelectedElement(direction)}
            >
              {t(`workspace.presentationEditing.order.${direction}`)}
            </button>
          ))}
          {Object.entries(presentationElementFrame(node)).map(
            ([property, value]) => (
              <label key={property} className="flex items-center gap-1 text-xs">
                {t(`workspace.presentationEditing.${property}`)}
                <input
                  className="w-16 rounded border border-border bg-background px-1 py-0.5"
                  aria-label={t(`workspace.presentationEditing.${property}`)}
                  type="number"
                  step="1"
                  min={
                    property === "width" || property === "height"
                      ? 1
                      : undefined
                  }
                  defaultValue={Math.round(value * 100) / 100}
                  disabled={disabled}
                  onBlur={(event) => {
                    if (
                      event.currentTarget.checkValidity() &&
                      event.currentTarget.value.trim() &&
                      Number(event.currentTarget.value) !== value
                    )
                      controller.updateSelectedElementFrame({
                        ...presentationElementFrame(node),
                        [property]: Number(event.currentTarget.value),
                      });
                  }}
                />
              </label>
            ),
          )}
          {presentationElementText(node) !== undefined && (
            <div
              className="contents"
              data-presentation-text-controls=""
              onPointerDown={(event) => {
                if (
                  state.textEditor &&
                  (event.target as Element).closest("button")
                )
                  event.preventDefault();
              }}
            >
              <button
                className={button}
                type="button"
                disabled={disabled}
                onClick={() => controller.textActivateBlockEnd(node.id)}
              >
                {t("workspace.presentationEditing.editText")}
              </button>
              <button
                className={button}
                type="button"
                disabled={disabled}
                aria-pressed={style?.bold}
                onClick={() =>
                  controller.updateSelectedElementStyle({ bold: !style?.bold })
                }
              >
                {t("workspace.presentationEditing.bold")}
              </button>
              <button
                className={button}
                type="button"
                disabled={disabled}
                aria-pressed={style?.italic}
                onClick={() =>
                  controller.updateSelectedElementStyle({
                    italic: !style?.italic,
                  })
                }
              >
                {t("workspace.presentationEditing.italic")}
              </button>
              <label className="flex items-center gap-1 text-xs">
                {t("workspace.presentationEditing.fontSize")}
                <input
                  className="w-16 rounded border border-border bg-background px-1 py-0.5"
                  aria-label={t("workspace.presentationEditing.fontSize")}
                  type="number"
                  defaultValue={style?.fontSize}
                  min="1"
                  max="400"
                  disabled={disabled}
                  onBlur={(event) => {
                    if (
                      event.currentTarget.checkValidity() &&
                      event.currentTarget.value
                    )
                      controller.updateSelectedElementStyle({
                        fontSize: Number(event.currentTarget.value),
                      });
                  }}
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                {t("workspace.presentationEditing.color")}
                <input
                  aria-label={t("workspace.presentationEditing.color")}
                  type="color"
                  defaultValue={`#${style?.color}`}
                  disabled={disabled}
                  onChange={(event) =>
                    controller.updateSelectedElementStyle({
                      color: event.currentTarget.value.slice(1),
                    })
                  }
                />
              </label>
            </div>
          )}
          <button
            className={button}
            type="button"
            disabled={disabled}
            onClick={() => controller.deleteSelectedElement()}
          >
            {t("workspace.presentationEditing.delete")}
          </button>
        </div>
      )}
      {state.isEditing && (
        <PresentationTableControls
          controller={controller}
          disabled={disabled}
        />
      )}
      {state.failure && (
        <p role="alert" className="w-full text-xs text-destructive">
          {t(`workspace.presentationEditing.${state.failure}`)}
        </p>
      )}
      <Dialog.Root open={discarding} onOpenChange={setDiscarding}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            role="alertdialog"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 text-foreground shadow-xl"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t("workspace.presentationEditing.discardTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t("workspace.presentationEditing.discardDescription")}
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className={button}
                type="button"
                onClick={() => setDiscarding(false)}
              >
                {t("workspace.presentationEditing.keepEditing")}
              </button>
              <button
                className={button}
                type="button"
                onClick={() => {
                  controller.discardEdits();
                  setDiscarding(false);
                  onDiscard();
                }}
              >
                {t("workspace.presentationEditing.discard")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
