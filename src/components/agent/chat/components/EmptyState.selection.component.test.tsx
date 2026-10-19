import {
  chooseInstalledSkill,
  renderEmptyState,
  expectEmptyStateSend,
  updateFieldValue,
} from "./EmptyState.testFixtures";

import { acceptedSubmission } from "../hooks/agentSendResult.testFixtures";

import { act } from "react";

import { describe, expect, it, vi } from "vitest";

import type { Skill } from "@/lib/api/skills";

import type {
  InputbarSendHandler,
  InputbarSendPayload,
} from "./Inputbar/inputbarSendPayload";

import { changeLimeLocale } from "@/i18n/createI18n";

describe("EmptyState selection current integration", () => {
  it("仅发送路径引用时应使用当前 locale 的兜底 prompt", async () => {
    await changeLimeLocale("en-US");
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      activeTheme: "general",
      input: "",
      onSend,
      pathReferences: [
        {
          id: "path-1",
          path: "/tmp/report.md",
          name: "report.md",
          isDir: false,
          source: "file_manager",
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      'button[aria-label="Send"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "Please review these files or folders.",
      sendOptions: expect.objectContaining({
        requestMetadata: expect.objectContaining({
          path_references: [
            expect.objectContaining({
              path: "/tmp/report.md",
              name: "report.md",
            }),
          ],
        }),
      }),
    });
    const payload = onSend.mock.calls.at(-1)?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(payload?.triggerSource).toBe("button");
    expect(payload?.triggeredAt).toEqual(expect.any(Number));
  });

  it("启用 pointerdown 发送时首页发送按钮不应在 click 重复发送", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_780_000_200_000);
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      activeTheme: "general",
      input: "你好",
      onSend,
      sendOnPointerDown: true,
    });

    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = container.querySelector(
      '[data-testid="send-btn"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      sendButton?.click();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expectEmptyStateSend(onSend, {
      textOverride: "你好",
    });
    const payload = onSend.mock.calls.at(-1)?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(payload?.triggerSource).toBe("button");
    expect(payload?.triggeredAt).toBe(1_780_000_200_000);
    nowSpy.mockRestore();
  });

  it("从 Skills 页带回的技能应显示在首页输入框内的技能 mention", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill = {
      key: "local:writer",
      name: "写作助手",
      description: "本地补充技能",
      directory: "writer",
      installed: true,
      sourceKind: "other",
    } as Skill;
    const container = renderEmptyState({
      activeTheme: "general",
      input: "整理最近发布计划",
      onSend,
      skills: [skill],
      initialInputCapability: {
        skill,
        requestKey: 20260512,
      },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const badge = container.querySelector('[data-composer-token="skill"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe("写作助手");
    expect(badge?.getAttribute("data-composer-label")).toBe("$写作助手");
    expect(badge?.getAttribute("data-composer-name")).toBe("写作助手");

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "整理最近发布计划 [$写作助手](writer/SKILL.md)",
      sendOptions: {
        capabilityRoute: undefined,
      },
    });
  });

  it("首页安装技能选择应走统一 capability 回调，且发送后清除激活态", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill: Skill = {
      key: "canvas-design",
      name: "canvas-design",
      description: "desc",
      directory: "canvas-design",
      installed: true,
      sourceKind: "builtin",
    };

    const container = renderEmptyState({
      input: "帮我设计封面",
      onSend,
      skills: [skill],
    });
    await act(async () => {
      await Promise.resolve();
    });

    await chooseInstalledSkill(container, skill);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-composer-token="skill"]')?.textContent,
    ).toBe("Canvas Design");
    expect(container.textContent).not.toContain("已挂载 canvas-design");

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });
    expectEmptyStateSend(onSend, {
      textOverride: "帮我设计封面 [$canvas-design](canvas-design/SKILL.md)",
      sendOptions: {
        capabilityRoute: undefined,
      },
    });

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      updateFieldValue(
        container.querySelector<HTMLElement>(
          '[data-testid="composer-editor"][role="textbox"]',
        ),
        "帮我设计封面",
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sendButtonAfterCapabilityCleared = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButtonAfterCapabilityCleared).toBeTruthy();

    act(() => {
      sendButtonAfterCapabilityCleared?.click();
    });
    const secondPayload = onSend.mock.calls[1]?.[0] as
      | InputbarSendPayload
      | undefined;
    expect(secondPayload).toMatchObject({
      textOverride: "帮我设计封面",
    });
    expect(secondPayload?.images).toBeUndefined();
    expect(secondPayload?.sendOptions?.capabilityRoute).toBeUndefined();
    expect(secondPayload?.composerSubmission?.inputMentions).toEqual([]);
    expect(
      secondPayload?.sendOptions?.inputRestoreDraft?.editorDocument?.type,
    ).toBe("doc");
  });

  it("首页选择 Goal 后发送应绑定当前 thread goal", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const container = renderEmptyState({
      input: "请先规划再持续推进这个任务",
      activeTheme: "general",
      sessionId: "thread-empty-state-plan-goal",
      taskEnabled: false,
      onSend,
    });
    await act(async () => {
      await Promise.resolve();
    });

    const plusTrigger = container.querySelector(
      '[data-testid="inputbar-plus-trigger"]',
    ) as HTMLButtonElement | null;
    expect(plusTrigger).toBeTruthy();

    act(() => {
      plusTrigger?.click();
    });

    const objectiveButton = document.body.querySelector(
      '[data-suggestion-key="command:goal"]',
    ) as HTMLButtonElement | null;
    expect(objectiveButton).toBeTruthy();

    act(() => {
      objectiveButton?.click();
    });

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    await act(async () => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride: "/goal 请先规划再持续推进这个任务",
      sendOptions: expect.objectContaining({
        threadGoal: { objective: "请先规划再持续推进这个任务" },
      }),
    });
  });

  it("首页手动选择安装技能后发送时使用 canonical 文本与 typed Skill", async () => {
    const onSend = vi.fn<InputbarSendHandler>(async () => acceptedSubmission());
    const skill: Skill = {
      key: "custom-writing-skill",
      name: "custom-writing-skill",
      description: "desc",
      directory: "custom-writing-skill",
      installed: true,
      sourceKind: "builtin",
    };

    const container = renderEmptyState({
      input: "请输出一篇品牌故事",
      activeTheme: "general",
      onSend,
      skills: [skill],
    });
    await act(async () => {
      await Promise.resolve();
    });

    await chooseInstalledSkill(container, skill);

    const sendButton = container.querySelector(
      'button[aria-label="发送"]',
    ) as HTMLButtonElement | null;
    expect(sendButton).toBeTruthy();

    act(() => {
      sendButton?.click();
    });

    expectEmptyStateSend(onSend, {
      textOverride:
        "请输出一篇品牌故事 [$custom-writing-skill](custom-writing-skill/SKILL.md)",
      sendOptions: {
        capabilityRoute: undefined,
      },
    });
  });
});
