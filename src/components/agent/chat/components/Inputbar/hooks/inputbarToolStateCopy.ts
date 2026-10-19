type ToolStateCopyKey =
  | "agentChat.inputbar.tools.task.toast.enabled"
  | "agentChat.inputbar.tools.task.toast.disabled"
  | "agentChat.inputbar.tools.subagent.toast.enabled"
  | "agentChat.inputbar.tools.subagent.toast.disabled"
  | "agentChat.inputbar.tools.fullscreen.toast.entered"
  | "agentChat.inputbar.tools.fullscreen.toast.exited";

export function buildInputbarToolStateCopy(
  translate: (key: ToolStateCopyKey) => string,
) {
  const taskEnabled = translate("agentChat.inputbar.tools.task.toast.enabled");
  const taskDisabled = translate(
    "agentChat.inputbar.tools.task.toast.disabled",
  );
  const subagentEnabled = translate(
    "agentChat.inputbar.tools.subagent.toast.enabled",
  );
  const subagentDisabled = translate(
    "agentChat.inputbar.tools.subagent.toast.disabled",
  );
  return {
    task: {
      toast: (enabled: boolean) => (enabled ? taskEnabled : taskDisabled),
    },
    subagent: {
      toast: (enabled: boolean) =>
        enabled ? subagentEnabled : subagentDisabled,
    },
    fullscreen: {
      entered: translate("agentChat.inputbar.tools.fullscreen.toast.entered"),
      exited: translate("agentChat.inputbar.tools.fullscreen.toast.exited"),
    },
  };
}
