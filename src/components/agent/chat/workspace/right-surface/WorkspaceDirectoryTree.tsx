import { useMemo } from "react";
import type { CanvasWorkbenchFileTreeState } from "../../components/canvas-workbench/files/useCanvasWorkbenchFileTreeState";
import { FileTree } from "./FileTree";
import { getDirectoryTreeRows } from "./fileTreeRows";
import type { FileSelectionOptions } from "./threadSidePanelTabs";

type DirectoryTreeState = Pick<
  CanvasWorkbenchFileTreeState,
  "directoryCache" | "loadingDirectories"
>;

export function WorkspaceDirectoryTree({
  directoryPath,
  state,
  expandedDirectories,
  selectedPath,
  onToggleDirectory,
  onSelectFile,
}: {
  directoryPath: string;
  state: DirectoryTreeState;
  expandedDirectories: Record<string, boolean>;
  selectedPath: string | null;
  onToggleDirectory: (path: string) => void;
  onSelectFile: (path: string, options?: FileSelectionOptions) => void;
}) {
  const rows = useMemo(
    () =>
      getDirectoryTreeRows(
        directoryPath,
        state.directoryCache,
        state.loadingDirectories,
        expandedDirectories,
      ),
    [directoryPath, state, expandedDirectories],
  );
  return (
    <FileTree
      scope={directoryPath}
      cwd={directoryPath}
      rows={rows}
      expandedDirectories={expandedDirectories}
      selectedPath={selectedPath}
      onToggleDirectory={onToggleDirectory}
      onSelectFile={onSelectFile}
    />
  );
}
