import {
  isRuntimeSubmissionAccepted,
  runRuntimeSubmissionEffect,
  type RuntimeSubmissionResult,
} from "../hooks/agentSendResult";
import i18n from "@/i18n/config";
import {
  cleanBackgroundTerminals,
  listBackgroundTerminals,
} from "@/lib/api/backgroundTerminals";
import type { AppServerThreadBackgroundTerminal } from "@/lib/api/appServer";
import {
  buildSlashCommandHelpMessage,
  buildSlashCommandModelMessage,
  buildSlashCommandPrompt,
  buildSlashCommandStatusMessage,
  buildUnsupportedSlashCommandMessage,
} from "./formatter";
import type { ExecuteSlashCommandParams } from "./types";

async function buildBackgroundTerminalListMessage(
  sessionId: string | null,
  listTerminals: (
    threadId: string,
  ) => Promise<AppServerThreadBackgroundTerminal[]>,
): Promise<string> {
  const threadId = sessionId?.trim() || "";
  if (!threadId) {
    return shellText(
      "agentChat.navbar.shell.backgroundTerminalsMissingSession",
    );
  }
  try {
    const terminals = await listTerminals(threadId);
    if (terminals.length === 0) {
      return shellText("agentChat.navbar.shell.backgroundTerminalsEmpty");
    }
    return [
      `${shellText("agentChat.navbar.shell.backgroundTerminals")}：`,
      ...terminals.map((terminal) => {
        const command = terminal.command.trim() || terminal.processId;
        const cwd = terminal.cwd.trim();
        return cwd ? `- ${command} (${cwd})` : `- ${command}`;
      }),
    ].join("\n");
  } catch {
    return shellText("agentChat.navbar.shell.backgroundTerminalsError");
  }
}

async function buildBackgroundTerminalStopMessage(
  sessionId: string | null,
  cleanTerminals: (threadId: string) => Promise<unknown>,
): Promise<string> {
  const threadId = sessionId?.trim() || "";
  if (!threadId) {
    return shellText(
      "agentChat.navbar.shell.backgroundTerminalsMissingSession",
    );
  }
  try {
    await cleanTerminals(threadId);
    return shellText("agentChat.navbar.shell.backgroundTerminalsStoppingAll");
  } catch {
    return shellText("agentChat.navbar.shell.backgroundTerminalsStopError");
  }
}

function shellText(key: string): string {
  return i18n.t(key, { ns: "agent" });
}

function ensureSessionMutationAllowed(
  isSending: boolean,
  commandPrefix: string,
  notifyInfo: (message: string) => void,
): boolean {
  if (!isSending) {
    return true;
  }

  notifyInfo(
    `当前仍有任务执行中，请先等待结束或停止生成后再执行 ${commandPrefix}`,
  );
  return false;
}

export async function executeSlashCommand(
  params: ExecuteSlashCommandParams,
): Promise<RuntimeSubmissionResult | null> {
  const {
    command,
    statusSnapshot,
    sendPrompt,
    compactSession,
    clearMessages,
    createFreshSession,
    appendAssistantMessage,
    notifyInfo,
    onOpenSubagents,
    onExecutedCommand,
    listBackgroundTerminals: listTerminals = listBackgroundTerminals,
    cleanBackgroundTerminals: cleanTerminals = cleanBackgroundTerminals,
  } = params;

  switch (command.definition.key) {
    case "compact":
      await compactSession();
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "clear":
      if (
        !ensureSessionMutationAllowed(
          statusSnapshot.isSending,
          command.definition.commandPrefix,
          notifyInfo,
        )
      ) {
        return { kind: "local-handled" };
      }
      clearMessages({ toastMessage: "已清空当前任务" });
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "new": {
      if (
        !ensureSessionMutationAllowed(
          statusSnapshot.isSending,
          command.definition.commandPrefix,
          notifyInfo,
        )
      ) {
        return { kind: "local-handled" };
      }
      const sessionName = command.userInput.trim() || undefined;
      await createFreshSession(sessionName);
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    }
    case "help":
      appendAssistantMessage(buildSlashCommandHelpMessage());
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "status":
      appendAssistantMessage(buildSlashCommandStatusMessage(statusSnapshot));
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "model":
      if (command.userInput.trim()) {
        notifyInfo(
          "当前暂不支持通过 /model 切换模型，请使用输入框右侧的模型选择器",
        );
        return { kind: "local-handled" };
      }
      appendAssistantMessage(buildSlashCommandModelMessage(statusSnapshot));
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "subagents":
      onOpenSubagents?.();
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "ps":
      appendAssistantMessage(
        await buildBackgroundTerminalListMessage(
          statusSnapshot.sessionId,
          listTerminals,
        ),
      );
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "stop":
      appendAssistantMessage(
        await buildBackgroundTerminalStopMessage(
          statusSnapshot.sessionId,
          cleanTerminals,
        ),
      );
      onExecutedCommand?.(command);
      return { kind: "local-handled" };
    case "review":
    case "diff":
    case "init": {
      const prompt = buildSlashCommandPrompt(command);
      if (prompt) {
        const result = await sendPrompt(prompt);
        if (isRuntimeSubmissionAccepted(result)) {
          runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
            onExecutedCommand?.(command),
          );
        }
        return result;
      }
      return null;
    }
    default:
      if (command.definition.support === "unsupported") {
        notifyInfo(buildUnsupportedSlashCommandMessage(command));
        return { kind: "local-handled" };
      }
      return null;
  }
}
