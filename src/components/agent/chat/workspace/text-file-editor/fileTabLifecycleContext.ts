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
export interface FileTabLifecycle {
  register: Register;
  saveFile(path: string): Promise<boolean>;
  isTabCurrent(tab: ThreadSidePanelTab): boolean;
}
export const FileTabLifecycleContext = createContext<FileTabLifecycle | null>(
  null,
);
export const useFileTabLifecycle = () => useContext(FileTabLifecycleContext);
