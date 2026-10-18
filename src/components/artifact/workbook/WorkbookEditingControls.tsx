import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import type {
  WorkbookController,
  WorkbookControllerState,
} from "./WorkbookController";

export function WorkbookEditingControls({
  controller,
  state,
  onDiscard,
}: {
  controller: WorkbookController;
  state: WorkbookControllerState;
  onDiscard: () => void;
}) {
  const { t } = useTranslation("workspace");
  const [discarding, setDiscarding] = useState(false);
  const button =
    "rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-testid="workbook-editing-controls"
      data-dirty={state.dirty}
      data-saving={state.saving}
    >
      <button
        type="button"
        className={button}
        disabled={state.saving}
        aria-pressed={state.isEditing}
        onClick={() => controller.setEditing(!state.isEditing)}
      >
        {t(
          state.isEditing
            ? "workspace.workbookPreview.doneEditing"
            : "workspace.workbookPreview.edit",
        )}
      </button>
      {(state.isEditing || state.dirty) && (
        <>
          <span role="status" className="text-xs text-muted-foreground">
            {t(
              state.dirty
                ? "workspace.workbookPreview.unsaved"
                : "workspace.workbookPreview.saved",
            )}
          </span>
          <button
            type="button"
            className={button}
            disabled={!state.dirty || state.saving}
            onClick={() => void controller.flushPublicFile()}
          >
            {t(
              state.saving
                ? "workspace.workbookPreview.saving"
                : "workspace.workbookPreview.save",
            )}
          </button>
          <button
            type="button"
            className={button}
            disabled={!state.dirty || state.saving}
            onClick={() => setDiscarding(true)}
          >
            {t("workspace.workbookPreview.discard")}
          </button>
        </>
      )}
      {state.failure && (
        <p role="alert" className="w-full text-xs text-destructive">
          {t(`workspace.workbookPreview.${state.failure}`)}
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
              {t("workspace.workbookPreview.discardTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t("workspace.workbookPreview.discardDescription")}
            </Dialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={button}
                onClick={() => setDiscarding(false)}
              >
                {t("workspace.workbookPreview.keepEditing")}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  controller.discardEdits();
                  setDiscarding(false);
                  onDiscard();
                }}
              >
                {t("workspace.workbookPreview.discard")}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
