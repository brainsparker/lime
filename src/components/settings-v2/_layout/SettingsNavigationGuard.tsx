import type { ReactNode } from "react";
import type { NavigationGuard } from "@/lib/navigationGuard";
import { SettingsDraftContext } from "./useSettingsDraft";
import { SettingsUnsavedChangesDialog } from "./SettingsUnsavedChangesDialog";

export function SettingsNavigationGuard({
  navigationGuard,
  children,
}: {
  navigationGuard: NavigationGuard;
  children: ReactNode;
}) {
  return (
    <SettingsDraftContext.Provider value={navigationGuard.register}>
      {children}
      <SettingsUnsavedChangesDialog
        pendingNavigation={navigationGuard.pendingNavigation}
        saving={navigationGuard.saving}
        onClearPendingNavigation={navigationGuard.clearPendingNavigation}
        onDiscardChanges={navigationGuard.discardPendingNavigation}
      />
    </SettingsDraftContext.Provider>
  );
}
