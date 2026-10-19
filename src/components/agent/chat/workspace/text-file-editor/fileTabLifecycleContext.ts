import { createContext, useContext } from "react";
import type { ThreadSidePanelTab } from "../right-surface/threadSidePanelTabs";

export interface FileTabCloseHandler {
  hasUnsavedChanges(): boolean;
  saveUntilClean(): Promise<boolean>;
  discard(): void;
}
export type Register = (
  tab: ThreadSidePanelTab,
  handler: FileTabCloseHandler,
) => () => void;
export const FileTabLifecycleContext = createContext<Register | null>(null);
export const useFileTabLifecycle = () => useContext(FileTabLifecycleContext);
