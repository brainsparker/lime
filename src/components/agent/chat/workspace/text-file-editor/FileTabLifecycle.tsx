import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileTabLifecycleContext,
  type Register,
} from "./fileTabLifecycleContext";

export function FileTabLifecycleProvider({
  register,
  children,
}: {
  register: Register;
  children: ReactNode;
}) {
  return (
    <FileTabLifecycleContext.Provider value={register}>
      {children}
    </FileTabLifecycleContext.Provider>
  );
}

export function DiscardFileChangesDialog({
  onCancel,
  onDiscard,
}: {
  onCancel(): void;
  onDiscard(): void;
}) {
  const { t } = useTranslation("agent");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <div data-testid="discard-file-changes-dialog">
          <DialogHeader>
            <DialogTitle>{t("agentChat.fileEditor.discardTitle")}</DialogTitle>
            <DialogDescription>
              {t("agentChat.fileEditor.discardDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              data-testid="discard-file-changes-cancel"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
            >
              {t("agentChat.fileEditor.continueViewing")}
            </button>
            <button
              type="button"
              data-testid="discard-file-changes-confirm"
              onClick={onDiscard}
              className="rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground"
            >
              {t("agentChat.fileEditor.discardChanges")}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
