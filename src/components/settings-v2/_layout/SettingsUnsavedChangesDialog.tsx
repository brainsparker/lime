import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function SettingsUnsavedChangesDialog({
  pendingNavigation,
  saving,
  onClearPendingNavigation,
  onDiscardChanges,
}: {
  pendingNavigation: boolean;
  saving: boolean;
  onClearPendingNavigation: () => void;
  onDiscardChanges: () => void;
}) {
  const { t } = useTranslation("settings");
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root
      open={pendingNavigation}
      onOpenChange={(open) => {
        if (!open) onClearPendingNavigation();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          role="alertdialog"
          data-testid="settings-unsaved-changes-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 text-foreground shadow-xl"
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement as HTMLElement | null;
            event.preventDefault();
            keepEditingRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!saving) onDiscardChanges();
            }}
          >
            <Dialog.Title className="text-lg font-semibold">
              {t("settings.unsavedChanges.discardTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              {t("settings.unsavedChanges.discardDescription")}
            </Dialog.Description>
            {saving ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                {t("settings.unsavedChanges.saving")}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                ref={keepEditingRef}
                type="button"
                variant="outline"
                className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring"
                onClick={onClearPendingNavigation}
              >
                {t("settings.unsavedChanges.keepEditing")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={saving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-ring"
              >
                {t("settings.unsavedChanges.discard")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
