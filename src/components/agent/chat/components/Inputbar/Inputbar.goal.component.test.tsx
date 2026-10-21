import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadGoal } from "@limecloud/app-server-client";
import { ComposerController } from "@/components/input-kit";
import { changeLimeLocale } from "@/i18n/createI18n";
import {
  mockInputbarCore,
  openContextSuggestions,
  renderInputbar,
} from "./Inputbar.testFixtures";

const { setThreadGoalMock } = vi.hoisted(() => ({
  setThreadGoalMock: vi.fn(),
}));
vi.mock("@/lib/api/agentRuntime/threadGoalClient", () => ({
  setThreadGoal: setThreadGoalMock,
}));

const savedGoal: ThreadGoal = {
  threadId: "thread-goal",
  objective: "saved goal",
  status: "complete",
  createdAt: 1,
  updatedAt: 2,
  tokensUsed: 0,
  timeUsedSeconds: 0,
};

beforeEach(() => {
  setThreadGoalMock.mockReset().mockResolvedValue({
    ...savedGoal,
    objective: "new goal",
    status: "active",
  });
});

async function click(
  container: HTMLDivElement | typeof document,
  selector: string,
) {
  const button = container.querySelector<HTMLButtonElement>(selector);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}

describe("Inputbar 已有线程目标接线", () => {
  it("共享菜单进入目标模式后复用同一编辑器，只保存目标并清当前稿", async () => {
    const controller = new ComposerController({ text: "new goal" });
    const onSend = vi.fn();
    const { container } = renderInputbar({
      composerController: controller,
      input: "new goal",
      onSend,
      threadId: "thread-goal",
    });
    const editor = container.querySelector(".ProseMirror");
    expect(editor).toBeTruthy();
    openContextSuggestions(container);
    await click(document, '[data-suggestion-key="command:goal"]');
    expect(controller.getDocument().text).toBe("new goal");
    expect(container.querySelector(".ProseMirror")).toBe(editor);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await click(container, '[data-testid="send-btn"]');
    expect(setThreadGoalMock).toHaveBeenCalledExactlyOnceWith({
      threadId: "thread-goal",
      objective: "new goal",
      status: "active",
    });
    expect(onSend).not.toHaveBeenCalled();
    expect(controller.getDocument().text).toBe("");
    expect(container.querySelector(".ProseMirror")).toBe(editor);
  });

  it.each([
    ["zh-CN", "替换当前目标？", "替换目标"],
    ["zh-TW", "取代目前目標？", "取代目標"],
    ["en-US", "Replace current goal?", "Replace goal"],
    ["ja-JP", "現在の目標を置き換えますか？", "目標を置き換える"],
    ["ko-KR", "현재 목표를 바꾸시겠어요?", "목표 바꾸기"],
  ] as const)(
    "%s 目标面板编辑委托主输入，替换取消留稿，确认只调用目标 API",
    async (locale, title, confirmLabel) => {
      await changeLimeLocale(locale);
      const controller = new ComposerController({ text: "new goal" });
      const onSend = vi.fn();
      const { container } = renderInputbar({
        composerController: controller,
        input: "new goal",
        onSend,
        threadId: "thread-goal",
        threadGoal: savedGoal,
      });
      const editor = container.querySelector(".ProseMirror");
      expect(editor).toBeTruthy();
      await click(container, '[data-testid="thread-goal-edit"]');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(container.querySelector("textarea")).toBeNull();
      expect(controller.getDocument().text).toBe("new goal");
      expect(mockInputbarCore.mock.lastCall?.[0].placeholder).not.toContain(
        "agentChat.",
      );
      await click(container, '[data-testid="send-btn"]');
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog?.querySelector("h3")?.textContent).toBe(title);
      expect(
        document.getElementById(dialog?.getAttribute("aria-labelledby") ?? "")
          ?.textContent,
      ).toBe(title);
      expect(
        dialog?.querySelector('[data-testid="confirm-dialog-confirm"]')
          ?.textContent,
      ).toBe(confirmLabel);
      expect(dialog?.querySelector("p")?.textContent).toBeTruthy();
      expect(dialog?.textContent).not.toContain("agentChat.");
      expect(setThreadGoalMock).not.toHaveBeenCalled();
      await act(async () =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        ),
      );
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(controller.getDocument().text).toBe("new goal");
      await click(container, '[data-testid="send-btn"]');
      await click(document, '[data-testid="confirm-dialog-confirm"]');
      expect(setThreadGoalMock).toHaveBeenCalledExactlyOnceWith({
        threadId: "thread-goal",
        objective: "new goal",
        status: "active",
      });
      expect(onSend).not.toHaveBeenCalled();
      expect(controller.getDocument().text).toBe("");
      expect(container.querySelector(".ProseMirror")).toBe(editor);
    },
  );
});
