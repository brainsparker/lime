export interface ComposerProject {
  id: string;
  name: string;
  rootPath?: string | null;
}

export interface ComposerUtilityBarCopy {
  projectAria: string;
  searchPlaceholder: string;
  openedLabel: string;
  currentBadge: string;
  noProjectLabel: string;
  noProjectDescription: string;
  noOpenedProjects: string;
  addNewProject: string;
  createBlankProject: string;
  useExistingFolder: string;
  selectFolderDialogTitle: string;
  newProjectNameFallback: string;
  projectCreated: string;
  projectOpened: string;
  projectCreateFailed: string;
  projectOpenFailed: string;
  noProjectAction: string;
  modeLabel: string;
  localMode: string;
  modeMenuTitle: string;
  localProcessing: string;
  newWorktree: string;
  worktreeCreated: string;
  worktreeCreateFailed: string;
  branchLabel: string;
  branchFallback: string;
  branchSearchPlaceholder: string;
  branchCreateAction: string;
  branchCreateNamedAction: (branch: string) => string;
  branchSwitched: string;
  branchSwitchFailed: string;
  branchCreated: string;
  branchCreateFailed: string;
  uncommittedFiles: (count: number) => string;
  gitStatusLoading: string;
  gitStatusFailed: string;
  retryGitStatus: string;
}
