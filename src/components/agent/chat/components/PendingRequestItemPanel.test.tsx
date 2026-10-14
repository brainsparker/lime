import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLimeLocale, getLimeI18n } from "@/i18n/createI18n";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type { ActionRequired } from "../types";
import { PendingRequestItemPanel } from "./PendingRequestItemPanel";

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await changeLimeLocale("zh-CN");
});

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  await changeLimeLocale("en-US");
});

function renderPanel(
  overrides: Partial<ActionRequired> = {},
  onSubmit = vi.fn().mockResolvedValue(undefined),
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const request: ActionRequired = {
    requestId: "approval-1",
    actionType: "tool_confirmation",
    status: "pending",
    toolName: "exec_command",
    prompt: "允许执行当前命令？",
    arguments: { command: "npm test", cwd: "/tmp/project-1" },
    availableDecisions: ["decline", "allow_once"],
    ...overrides,
  };
  act(() =>
    root.render(
      <PendingRequestItemPanel request={request} onSubmit={onSubmit} />,
    ),
  );
  mounted.push({ root, container });
  return { container, onSubmit };
}

function button(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLButtonElement>(selector);
  expect(element, selector).not.toBeNull();
  return element!;
}

describe("PendingRequestItemPanel", () => {
  it("显示完整原因、命令和目录，不猜测风险等级", () => {
    const reason = "允许执行当前命令？\n需要运行测试来验证修改。";
    const { container } = renderPanel({
      prompt: reason,
      detail: "命令执行需要提升权限。",
      arguments: {
        command: "npm test -- --runInBand",
        cwd: "/tmp/project-1",
        risk: "high",
      },
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="approval-reason"]')?.textContent,
    ).toBe(reason);
    expect(container.querySelector("pre")?.textContent).toBe(
      "npm test -- --runInBand",
    );
    expect(container.textContent).toContain("/tmp/project-1");
    expect(container.textContent).toContain("命令执行需要提升权限。");
    expect(container.textContent).not.toContain("高风险");
  });

  it("长命令可展开与收起，保留完整命令", () => {
    const command = Array.from(
      { length: 8 },
      (_, i) => `printf line-${i}`,
    ).join("\n");
    const { container } = renderPanel({ arguments: { command } });
    const expand = button(container, "button[aria-controls]");
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    act(() => expand.click());
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(expand.textContent).toBe("收起");
    expect(container.querySelector("pre")?.textContent).toBe(command);
    act(() => expand.click());
    expect(expand.getAttribute("aria-expanded")).toBe("false");
  });

  it("会话允许通过 scoped action 提交真实决定", async () => {
    const { container, onSubmit } = renderPanel({
      availableDecisions: ["allow_once", "allow_for_session", "decline"],
    });
    expect(
      container.querySelector('[data-decision="allow_for_session"]'),
    ).toBeNull();
    const trigger = button(container, '[data-testid="approval-scope-trigger"]');
    act(() => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      button(container, '[data-decision="allow_for_session"]').click(),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      requestId: "approval-1",
      decision: "allow_for_session",
      response: "本会话允许此类工具操作",
      actionType: "tool_confirmation",
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("键盘打开 scoped action 后聚焦动作，Escape 返回触发器", () => {
    const { container, onSubmit } = renderPanel({
      availableDecisions: ["allow_once", "allow_for_session", "decline"],
    });
    const trigger = button(container, '[data-testid="approval-scope-trigger"]');
    trigger.focus();
    act(() =>
      trigger.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    const scopedAction = button(
      container,
      '[data-decision="allow_for_session"]',
    );
    expect(document.activeElement).toBe(scopedAction);
    act(() =>
      scopedAction.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("只显示后端声明的决定，空列表不生成可授权动作", () => {
    const { container } = renderPanel({ availableDecisions: [] });
    expect(container.querySelector("[data-decision]")).toBeNull();
  });

  it("提交期间禁止重复响应，失败后保留请求并允许重试", async () => {
    let reject!: (error: Error) => void;
    const onSubmit = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, rejectPromise) => {
            reject = rejectPromise;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { container } = renderPanel({}, onSubmit);
    const approve = button(container, '[data-decision="allow_once"]');
    act(() => {
      approve.click();
      approve.click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(approve.disabled).toBe(true);
    await act(async () => reject(new Error("transport unavailable")));
    expect(container.textContent).toContain("提交失败，请重试。");
    expect(approve.disabled).toBe(false);
    await act(async () => approve.click());
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("提交失败，请重试。");
  });

  it("已提交的请求不能再次授权", () => {
    const { container } = renderPanel({ status: "submitted" });
    expect(button(container, '[data-decision="allow_once"]').disabled).toBe(
      true,
    );
  });

  it("网络与文件授权展示协议提供的范围", () => {
    const network = renderPanel({
      arguments: {
        networkApprovalContext: { host: "example.test", protocol: "https" },
      },
    });
    expect(network.container.textContent).toContain("允许网络访问？");
    expect(network.container.textContent).toContain("example.test");
    expect(network.container.textContent).toContain("https");
    const file = renderPanel({
      toolName: "apply_patch",
      arguments: { grantRoot: "/tmp/project-1/src" },
    });
    expect(file.container.textContent).toContain("允许修改文件？");
    expect(file.container.textContent).toContain("/tmp/project-1/src");
  });

  it.each(SUPPORTED_LOCALES)("%s 审批详情与动作正确本地化", async (locale) => {
    await changeLimeLocale(locale);
    const { container } = renderPanel({
      arguments: {
        command: "printf first\nprintf second\nprintf third\nprintf fourth",
        cwd: "/tmp/project-1",
      },
    });
    const i18n = getLimeI18n();
    expect(container.querySelector("h3")?.textContent).toBe(
      i18n.t("agentChat.inputbar.approval.commandTitle", { ns: "agent" }),
    );
    expect(container.textContent).toContain(
      i18n.t("agentChat.inputbar.approval.directory", { ns: "agent" }),
    );
    const expand = button(container, "button[aria-controls]");
    expect(expand.textContent).toBe(
      i18n.t("agentChat.inputbar.approval.expand", { ns: "agent" }),
    );
    act(() => expand.click());
    expect(expand.textContent).toBe(
      i18n.t("agentChat.inputbar.approval.collapse", { ns: "agent" }),
    );
    expect(container.textContent).not.toContain("agentChat.inputbar.approval.");
  });
});
