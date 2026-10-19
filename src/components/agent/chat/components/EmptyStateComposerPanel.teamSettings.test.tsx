import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  openContextSuggestions,
  renderPanel,
} from "./EmptyStateComposerPanel.testFixtures";

const RETIRED_SUGGESTION_TEST_ID = ["team", "suggestion", "bar"].join("-");

describe("EmptyStateComposerPanel", () => {
  it("高级设置不再渲染编程执行前置开关", () => {
    const container = renderPanel();

    expect(
      container.querySelector('[data-testid="inputbar-plan-toggle"]'),
    ).toBeNull();

    openContextSuggestions(container);

    expect(
      container.querySelector('[data-testid="inputbar-plan-toggle"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("编程执行");
    expect(container.textContent).not.toContain("ReAct");
    expect(container.textContent).not.toContain("Auto");
  });

  it("关闭 Subagents 后只保留加号菜单入口", () => {
    const container = renderPanel({
      subagentEnabled: false,
    });

    const enableButton = container.querySelector(
      '[data-testid="empty-state-team-mode-enable-button"]',
    ) as HTMLButtonElement | null;

    expect(enableButton).toBeNull();
    expect(
      container.querySelector('button[title="Subagents 已关闭"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="inputbar-plus-trigger"]'),
    ).toBeTruthy();
  });

  it("命中稳妥模式模型时不应再展示额外横幅", () => {
    const container = renderPanel({
      providerType: "openai",
      model: "glm-4.7",
    });

    expect(
      container.querySelector(
        '[data-testid="empty-state-stable-processing-notice"]',
      ),
    ).toBeNull();
    expect(container.textContent).not.toContain("稳妥模式");
  });

  it("复杂任务但未开启 Subagents 时，首页不再主动渲染推荐入口", () => {
    const container = renderPanel({
      subagentEnabled: false,
      input: "请拆成多个子任务分别分析、实现、验证，并最终统一回归验收",
    });

    const enableButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("打开 Subagents"),
    ) as HTMLButtonElement | undefined;

    expect(
      container.querySelector(
        '[data-testid="empty-state-team-mode-enable-button"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector('button[title="Subagents 已关闭"]'),
    ).toBeNull();
    expect(enableButton).toBeUndefined();
    expect(
      container.querySelector(`[data-testid="${RETIRED_SUGGESTION_TEST_ID}"]`),
    ).toBeNull();
  });

  it("底栏应直接显示模型切换器，不再使用只读当前模型信息", () => {
    const container = renderPanel({
      providerType: "claude",
      model: "claude-sonnet-4-5",
    });

    expect(container.textContent).not.toContain("当前模型");
    expect(
      container.querySelector('[data-testid="empty-state-model-selector"]'),
    ).toBeTruthy();
  });

  it("底栏应直接渲染权限模式选择并透传切换", () => {
    const setAccessMode = vi.fn();
    const container = renderPanel({
      accessMode: "current",
      setAccessMode,
    });

    const select = container.querySelector(
      '[data-testid="inputbar-access-mode-select"]',
    ) as HTMLSelectElement | null;

    expect(select).toBeTruthy();
    expect(select?.value).toBe("current");

    act(() => {
      if (select) {
        select.value = "full-access";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(setAccessMode).toHaveBeenCalledWith("full-access");
  });
});
