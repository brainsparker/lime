import type { SlashCommandStatusSnapshot } from "../commands";
import { executeSlashCommand, parseSlashCommand } from "../commands";
import { recordSlashEntryUsage } from "../skill-selection/slashEntryUsage";
import type {
  ClearMessagesOptions,
  RawSendMessageFn,
  SendMessageFn,
} from "./agentChatShared";
import {
  createRuntimeSubmissionCapture,
  fromRuntimeAcceptanceReceipt,
} from "./agentSendResult";
import { normalizeExecutionStrategy } from "./agentChatCoreUtils";

interface CreateAgentChatSendMessageOptions {
  baseStatusSnapshot: SlashCommandStatusSnapshot;
  rawSendMessage: RawSendMessageFn;
  compactSession: () => Promise<void>;
  clearMessages: (options?: ClearMessagesOptions) => void;
  createFreshSession: (sessionName?: string) => Promise<string | null>;
  appendAssistantMessage: (content: string) => void;
  notifyInfo: (message: string) => void;
  notifySuccess: (message: string) => void;
  notifyError?: (message: string) => void;
  shellCommandHelp?: string;
  shellCommandError?: (message: string) => string;
  runUserShellCommand?: (command: string) => Promise<boolean>;
  onOpenSubagents?: () => void;
}

export function createAgentChatSendMessage(
  options: CreateAgentChatSendMessageOptions,
): SendMessageFn {
  const {
    baseStatusSnapshot,
    rawSendMessage,
    compactSession,
    clearMessages,
    createFreshSession,
    appendAssistantMessage,
    notifyInfo,
    notifySuccess,
    notifyError,
    shellCommandHelp,
    shellCommandError,
    runUserShellCommand,
    onOpenSubagents,
  } = options;

  return async (
    content,
    images,
    webSearch,
    thinking,
    skipUserMessage,
    executionStrategyOverride,
    modelOverride,
    autoContinue,
    sendOptions,
  ) => {
    const capture = createRuntimeSubmissionCapture(sendOptions?.observer);
    const sendRaw = async (prompt: string) => {
      const receipt = await rawSendMessage(
        prompt,
        images,
        webSearch,
        thinking,
        skipUserMessage,
        executionStrategyOverride,
        modelOverride,
        autoContinue,
        { ...sendOptions, observer: capture.observer },
      );
      return capture.finish(fromRuntimeAcceptanceReceipt(receipt));
    };
    try {
      if (!skipUserMessage) {
        if (content.startsWith("!")) {
          const command = content.slice(1).trim();
          if (!command) {
            if (shellCommandHelp) {
              notifyInfo(shellCommandHelp);
            }
            return { kind: "local-handled" };
          }
          if (!runUserShellCommand) {
            return { kind: "rejected" };
          }
          try {
            const handled = await runUserShellCommand(command);
            return { kind: handled ? "local-handled" : "rejected" };
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            notifyError?.(shellCommandError?.(message) ?? message);
            return { kind: "rejected", error };
          }
        }

        const parsedSlashCommand = parseSlashCommand(content);
        if (parsedSlashCommand) {
          const effectiveModel =
            modelOverride?.trim() || baseStatusSnapshot.model;
          const effectiveExecutionStrategy = normalizeExecutionStrategy(
            executionStrategyOverride || baseStatusSnapshot.executionStrategy,
          );
          const handled = await executeSlashCommand({
            command: parsedSlashCommand,
            statusSnapshot: {
              ...baseStatusSnapshot,
              model: effectiveModel,
              executionStrategy: effectiveExecutionStrategy,
            },
            sendPrompt: sendRaw,
            compactSession,
            clearMessages,
            createFreshSession,
            appendAssistantMessage,
            notifyInfo,
            notifySuccess,
            onOpenSubagents,
            onExecutedCommand: (command) => {
              if (command.definition.support !== "supported") {
                return;
              }

              recordSlashEntryUsage({
                kind: "command",
                entryId: command.definition.key,
                replayText: command.userInput,
              });
            },
          });
          if (handled !== null) {
            return capture.finish(handled);
          }
        }
      }

      return await sendRaw(content);
    } catch (error) {
      return capture.rethrow(error);
    }
  };
}
