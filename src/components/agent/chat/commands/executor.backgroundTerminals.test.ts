import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n/config";
import { executeSlashCommand } from "./executor";
import { parseSlashCommand } from "./parser";
import type { SlashCommandStatusSnapshot } from "./types";

const snapshot: SlashCommandStatusSnapshot = {
  sessionId: "thread-1",
  currentTurnId: "turn-1",
  providerType: "openai",
  model: "gpt-5.2-codex",
  executionStrategy: "react",
  queuedTurnsCount: 0,
  isSending: true,
};

function command(input: string) {
  const parsed = parseSlashCommand(input);
  if (!parsed) {
    throw new Error(`unparsed ${input}`);
  }
  return parsed;
}

describe("slash background terminals", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("/ps 列出同一会话的后台终端", async () => {
    const appendAssistantMessage = vi.fn();
    const listBackgroundTerminals = vi.fn().mockResolvedValue([
      {
        command: "npm test",
        cwd: "/work/lime",
        itemId: "item-1",
        processId: "7",
      },
    ]);

    await executeSlashCommand({
      command: command("/ps"),
      statusSnapshot: snapshot,
      sendPrompt: vi.fn(),
      compactSession: vi.fn(),
      clearMessages: vi.fn(),
      createFreshSession: vi.fn(),
      appendAssistantMessage,
      notifyInfo: vi.fn(),
      notifySuccess: vi.fn(),
      listBackgroundTerminals,
    });

    expect(listBackgroundTerminals).toHaveBeenCalledWith("thread-1");
    expect(appendAssistantMessage).toHaveBeenCalledWith(
      "后台终端：\n- npm test (/work/lime)",
    );
  });

  it("/stop 走 clean，运行中的回合也不拦截", async () => {
    const appendAssistantMessage = vi.fn();
    const cleanBackgroundTerminals = vi.fn().mockResolvedValue({});

    await executeSlashCommand({
      command: command("/stop"),
      statusSnapshot: snapshot,
      sendPrompt: vi.fn(),
      compactSession: vi.fn(),
      clearMessages: vi.fn(),
      createFreshSession: vi.fn(),
      appendAssistantMessage,
      notifyInfo: vi.fn(),
      notifySuccess: vi.fn(),
      cleanBackgroundTerminals,
    });

    expect(cleanBackgroundTerminals).toHaveBeenCalledWith("thread-1");
    expect(appendAssistantMessage).toHaveBeenCalledWith("正在停止全部");
  });

  it("没有会话时不调用后台终端接口", async () => {
    const listBackgroundTerminals = vi.fn();
    const appendAssistantMessage = vi.fn();

    await executeSlashCommand({
      command: command("/ps"),
      statusSnapshot: { ...snapshot, sessionId: "  " },
      sendPrompt: vi.fn(),
      compactSession: vi.fn(),
      clearMessages: vi.fn(),
      createFreshSession: vi.fn(),
      appendAssistantMessage,
      notifyInfo: vi.fn(),
      notifySuccess: vi.fn(),
      listBackgroundTerminals,
    });

    expect(listBackgroundTerminals).not.toHaveBeenCalled();
    expect(appendAssistantMessage).toHaveBeenCalledWith(
      "当前没有会话，无法操作后台终端",
    );
  });
});
