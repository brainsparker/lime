import { createContext, useContext } from "react";
import type { ThreadSidePanelTab } from "../right-surface/threadSidePanelTabs";
import type { FileEditorDraft } from "./FileEditorController";

export interface FileTabDrafts {
  getFileDraft(tab: ThreadSidePanelTab): FileEditorDraft | null;
  setFileDraft(tab: ThreadSidePanelTab, draft: FileEditorDraft | null): void;
}

export const FileTabDraftContext = createContext<FileTabDrafts | null>(null);
export const useFileTabDrafts = () => useContext(FileTabDraftContext);
