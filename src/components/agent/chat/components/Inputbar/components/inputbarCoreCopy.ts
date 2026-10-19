import type { ComposerUtilityBarCopy } from "./composerUtilityBarTypes";

export type InputbarCoreCopyKey =
  | "agentChat.inputbar.core.dictation.recording"
  | "agentChat.inputbar.core.dictation.recordingLabel"
  | "agentChat.inputbar.core.dictation.transcribing"
  | "agentChat.inputbar.core.dictation.polishing"
  | "agentChat.inputbar.core.dictation.liveTranscript"
  | "agentChat.inputbar.core.dictation.polishingTitle"
  | "agentChat.inputbar.core.dictation.transcribingTitle"
  | "agentChat.inputbar.core.dictation.stopRecording"
  | "agentChat.inputbar.core.dictation.start"
  | "agentChat.inputbar.core.dictation.starting"
  | "agentChat.inputbar.core.dictation.cancel"
  | "agentChat.inputbar.core.dictation.interruptedByComposition"
  | "agentChat.inputbar.core.dictation.disabled"
  | "agentChat.inputbar.core.placeholder.fullscreen"
  | "agentChat.inputbar.core.placeholder.default"
  | "agentChat.inputbar.core.image.previewAlt"
  | "agentChat.inputbar.core.image.remove"
  | "agentChat.inputbar.core.path.containerLabel"
  | "agentChat.inputbar.core.path.localFolder"
  | "agentChat.inputbar.core.path.localFile"
  | "agentChat.inputbar.core.path.remove"
  | "agentChat.inputbar.core.projectContext.projectAria"
  | "agentChat.inputbar.core.projectContext.searchPlaceholder"
  | "agentChat.inputbar.core.projectContext.openedLabel"
  | "agentChat.inputbar.core.projectContext.currentBadge"
  | "agentChat.inputbar.core.projectContext.noProjectLabel"
  | "agentChat.inputbar.core.projectContext.noProjectDescription"
  | "agentChat.inputbar.core.projectContext.noOpenedProjects"
  | "agentChat.inputbar.core.projectContext.addNewProject"
  | "agentChat.inputbar.core.projectContext.createBlankProject"
  | "agentChat.inputbar.core.projectContext.useExistingFolder"
  | "agentChat.inputbar.core.projectContext.selectFolderDialogTitle"
  | "agentChat.inputbar.core.projectContext.newProjectNameFallback"
  | "agentChat.inputbar.core.projectContext.projectCreated"
  | "agentChat.inputbar.core.projectContext.projectOpened"
  | "agentChat.inputbar.core.projectContext.projectCreateFailed"
  | "agentChat.inputbar.core.projectContext.projectOpenFailed"
  | "agentChat.inputbar.core.projectContext.noProjectAction"
  | "agentChat.inputbar.core.projectContext.modeLabel"
  | "agentChat.inputbar.core.projectContext.localMode"
  | "agentChat.inputbar.core.projectContext.modeMenuTitle"
  | "agentChat.inputbar.core.projectContext.localProcessing"
  | "agentChat.inputbar.core.projectContext.newWorktree"
  | "agentChat.inputbar.core.projectContext.branchLabel"
  | "agentChat.inputbar.core.projectContext.branchFallback"
  | "agentChat.inputbar.core.projectContext.branchSearchPlaceholder"
  | "agentChat.inputbar.core.projectContext.branchCreateAction"
  | "agentChat.inputbar.core.projectContext.branchCreateNamedAction"
  | "agentChat.inputbar.core.projectContext.branchSwitched"
  | "agentChat.inputbar.core.projectContext.branchSwitchFailed"
  | "agentChat.inputbar.core.projectContext.branchCreated"
  | "agentChat.inputbar.core.projectContext.branchCreateFailed"
  | "agentChat.inputbar.core.projectContext.uncommittedFiles"
  | "agentChat.inputbar.core.projectContext.gitStatusLoading"
  | "agentChat.inputbar.core.projectContext.gitStatusFailed"
  | "agentChat.inputbar.core.projectContext.retryGitStatus"
  | "agentChat.inputbar.core.suggestion.acceptTitle"
  | "agentChat.inputbar.core.suggestion.acceptKey"
  | "agentChat.inputbar.core.editor.expand"
  | "agentChat.inputbar.core.editor.collapse"
  | "agentChat.inputbar.core.action.running"
  | "agentChat.inputbar.core.action.defer"
  | "agentChat.inputbar.core.action.queue"
  | "agentChat.inputbar.core.action.stop"
  | "agentChat.inputbar.core.action.send";

type InputbarCoreCopyValue = number | string;

export type InputbarCoreCopyTranslate = (
  key: InputbarCoreCopyKey,
  values?: Record<string, InputbarCoreCopyValue>,
) => string;

export interface InputbarCoreCopy {
  dictation: {
    recording: (duration: string) => string;
    recordingLabel: string;
    transcribing: string;
    polishing: string;
    liveTranscript: string;
    polishingTitle: string;
    transcribingTitle: string;
    stopRecording: (label: string) => string;
    start: string;
    starting: string;
    cancel: string;
    interruptedByComposition: string;
    disabled: string;
  };
  placeholder: {
    fullscreen: string;
    default: string;
  };
  image: {
    previewAlt: (index: number) => string;
    remove: (index: number) => string;
  };
  path: {
    containerLabel: string;
    localFolder: string;
    localFile: string;
    remove: (name: string) => string;
  };
  projectContext: ComposerUtilityBarCopy;
  suggestion: {
    acceptTitle: string;
    acceptKey: string;
  };
  editor: {
    expand: string;
    collapse: string;
  };
  action: {
    running: string;
    defer: string;
    queue: string;
    stop: string;
    send: string;
  };
}

export function buildInputbarCoreCopy(
  translate: InputbarCoreCopyTranslate,
): InputbarCoreCopy {
  return {
    dictation: {
      recording: (duration) =>
        translate("agentChat.inputbar.core.dictation.recording", {
          duration,
        }),
      recordingLabel: translate(
        "agentChat.inputbar.core.dictation.recordingLabel",
      ),
      transcribing: translate("agentChat.inputbar.core.dictation.transcribing"),
      polishing: translate("agentChat.inputbar.core.dictation.polishing"),
      liveTranscript: translate(
        "agentChat.inputbar.core.dictation.liveTranscript",
      ),
      polishingTitle: translate(
        "agentChat.inputbar.core.dictation.polishingTitle",
      ),
      transcribingTitle: translate(
        "agentChat.inputbar.core.dictation.transcribingTitle",
      ),
      stopRecording: (label) =>
        translate("agentChat.inputbar.core.dictation.stopRecording", {
          label,
        }),
      start: translate("agentChat.inputbar.core.dictation.start"),
      starting: translate("agentChat.inputbar.core.dictation.starting"),
      cancel: translate("agentChat.inputbar.core.dictation.cancel"),
      interruptedByComposition: translate(
        "agentChat.inputbar.core.dictation.interruptedByComposition",
      ),
      disabled: translate("agentChat.inputbar.core.dictation.disabled"),
    },
    placeholder: {
      fullscreen: translate("agentChat.inputbar.core.placeholder.fullscreen"),
      default: translate("agentChat.inputbar.core.placeholder.default"),
    },
    image: {
      previewAlt: (index) =>
        translate("agentChat.inputbar.core.image.previewAlt", { index }),
      remove: (index) =>
        translate("agentChat.inputbar.core.image.remove", { index }),
    },
    path: {
      containerLabel: translate("agentChat.inputbar.core.path.containerLabel"),
      localFolder: translate("agentChat.inputbar.core.path.localFolder"),
      localFile: translate("agentChat.inputbar.core.path.localFile"),
      remove: (name) =>
        translate("agentChat.inputbar.core.path.remove", { name }),
    },
    projectContext: {
      projectAria: translate(
        "agentChat.inputbar.core.projectContext.projectAria",
      ),
      searchPlaceholder: translate(
        "agentChat.inputbar.core.projectContext.searchPlaceholder",
      ),
      openedLabel: translate(
        "agentChat.inputbar.core.projectContext.openedLabel",
      ),
      currentBadge: translate(
        "agentChat.inputbar.core.projectContext.currentBadge",
      ),
      noProjectLabel: translate(
        "agentChat.inputbar.core.projectContext.noProjectLabel",
      ),
      noProjectDescription: translate(
        "agentChat.inputbar.core.projectContext.noProjectDescription",
      ),
      noOpenedProjects: translate(
        "agentChat.inputbar.core.projectContext.noOpenedProjects",
      ),
      addNewProject: translate(
        "agentChat.inputbar.core.projectContext.addNewProject",
      ),
      createBlankProject: translate(
        "agentChat.inputbar.core.projectContext.createBlankProject",
      ),
      useExistingFolder: translate(
        "agentChat.inputbar.core.projectContext.useExistingFolder",
      ),
      selectFolderDialogTitle: translate(
        "agentChat.inputbar.core.projectContext.selectFolderDialogTitle",
      ),
      newProjectNameFallback: translate(
        "agentChat.inputbar.core.projectContext.newProjectNameFallback",
      ),
      projectCreated: translate(
        "agentChat.inputbar.core.projectContext.projectCreated",
      ),
      projectOpened: translate(
        "agentChat.inputbar.core.projectContext.projectOpened",
      ),
      projectCreateFailed: translate(
        "agentChat.inputbar.core.projectContext.projectCreateFailed",
      ),
      projectOpenFailed: translate(
        "agentChat.inputbar.core.projectContext.projectOpenFailed",
      ),
      noProjectAction: translate(
        "agentChat.inputbar.core.projectContext.noProjectAction",
      ),
      modeLabel: translate("agentChat.inputbar.core.projectContext.modeLabel"),
      localMode: translate("agentChat.inputbar.core.projectContext.localMode"),
      modeMenuTitle: translate(
        "agentChat.inputbar.core.projectContext.modeMenuTitle",
      ),
      localProcessing: translate(
        "agentChat.inputbar.core.projectContext.localProcessing",
      ),
      newWorktree: translate(
        "agentChat.inputbar.core.projectContext.newWorktree",
      ),
      branchLabel: translate(
        "agentChat.inputbar.core.projectContext.branchLabel",
      ),
      branchFallback: translate(
        "agentChat.inputbar.core.projectContext.branchFallback",
      ),
      branchSearchPlaceholder: translate(
        "agentChat.inputbar.core.projectContext.branchSearchPlaceholder",
      ),
      branchCreateAction: translate(
        "agentChat.inputbar.core.projectContext.branchCreateAction",
      ),
      branchCreateNamedAction: (branch) =>
        translate(
          "agentChat.inputbar.core.projectContext.branchCreateNamedAction",
          { branch },
        ),
      branchSwitched: translate(
        "agentChat.inputbar.core.projectContext.branchSwitched",
      ),
      branchSwitchFailed: translate(
        "agentChat.inputbar.core.projectContext.branchSwitchFailed",
      ),
      branchCreated: translate(
        "agentChat.inputbar.core.projectContext.branchCreated",
      ),
      branchCreateFailed: translate(
        "agentChat.inputbar.core.projectContext.branchCreateFailed",
      ),
      uncommittedFiles: (count) =>
        translate("agentChat.inputbar.core.projectContext.uncommittedFiles", {
          count,
        }),
      gitStatusLoading: translate(
        "agentChat.inputbar.core.projectContext.gitStatusLoading",
      ),
      gitStatusFailed: translate(
        "agentChat.inputbar.core.projectContext.gitStatusFailed",
      ),
      retryGitStatus: translate(
        "agentChat.inputbar.core.projectContext.retryGitStatus",
      ),
    },
    suggestion: {
      acceptTitle: translate("agentChat.inputbar.core.suggestion.acceptTitle"),
      acceptKey: translate("agentChat.inputbar.core.suggestion.acceptKey"),
    },
    editor: {
      expand: translate("agentChat.inputbar.core.editor.expand"),
      collapse: translate("agentChat.inputbar.core.editor.collapse"),
    },
    action: {
      running: translate("agentChat.inputbar.core.action.running"),
      defer: translate("agentChat.inputbar.core.action.defer"),
      queue: translate("agentChat.inputbar.core.action.queue"),
      stop: translate("agentChat.inputbar.core.action.stop"),
      send: translate("agentChat.inputbar.core.action.send"),
    },
  };
}
