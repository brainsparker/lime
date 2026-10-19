import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changeLimeLocale } from "@/i18n/createI18n";
import type { ThreadGoal } from "@limecloud/app-server-client";
import { ThreadGoalPanel } from "./ThreadGoalPanel";

const { clearThreadGoalMock, setThreadGoalStatusMock, toastMock } = vi.hoisted(
  () => ({
    clearThreadGoalMock: vi.fn(),
    setThreadGoalStatusMock: vi.fn(),
    toastMock: { success: vi.fn(), error: vi.fn() },
  }),
);

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/api/agentRuntime/threadGoalClient", () => ({
  clearThreadGoal: clearThreadGoalMock,
  setThreadGoalStatus: setThreadGoalStatusMock,
}));

interface MountedPanel {
  container: HTMLDivElement;
  root: Root;
}

const mountedPanels: MountedPanel[] = [];

function createGoal(status: ThreadGoal["status"] = "active"): ThreadGoal {
  return {
    createdAt: 10,
    objective: "完成 Codex ThreadGoal GUI 接入",
    status,
    threadId: "thread-1",
    timeUsedSeconds: 90,
    tokenBudget: 100_000,
    tokensUsed: 2_000,
    updatedAt: 20,
  };
}

function renderPanel(
  props: Partial<ComponentProps<typeof ThreadGoalPanel>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ThreadGoalPanel
        threadId="thread-1"
        threadGoal={createGoal()}
        {...props}
      />,
    );
  });
  mountedPanels.push({ container, root });
  return container;
}

async function clickButton(button: HTMLButtonElement | null) {
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

beforeEach(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await changeLimeLocale("zh-CN");
  clearThreadGoalMock.mockReset();
  setThreadGoalStatusMock.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

afterEach(() => {
  for (const mounted of mountedPanels.splice(0)) {
    act(() => mounted.root.unmount());
    mounted.container.remove();
  }
  document.body
    .querySelectorAll('[data-testid="modal-overlay"]')
    .forEach((node) => node.remove());
});

describe("ThreadGoalPanel", () => {
  it("只展示 thread identity 匹配的 canonical Goal", () => {
    const empty = renderPanel({ threadGoal: null });
    expect(
      empty.querySelector('[data-testid="thread-goal-empty"]'),
    ).not.toBeNull();

    const wrongThread = renderPanel({
      threadGoal: { ...createGoal(), threadId: "thread-other" },
    });
    expect(
      wrongThread.querySelector('[data-testid="thread-goal-panel"]'),
    ).toBeNull();
  });

  it("空态创建入口委托主 Composer，不拥有独立目标输入", async () => {
    const onEdit = vi.fn();
    const container = renderPanel({ threadGoal: null, onEdit });
    await clickButton(
      container.querySelector('[data-testid="thread-goal-create"]'),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(container.querySelector("textarea")).toBeNull();
    expect(document.querySelector('[data-testid="modal-overlay"]')).toBeNull();
  });

  it("detail 显式展示 loading 与 load error，inline 保持紧凑不占位", () => {
    const loading = renderPanel({
      threadGoal: null,
      threadGoalLoading: true,
    });
    expect(
      loading.querySelector('[data-testid="thread-goal-loading"]'),
    ).not.toBeNull();

    const failed = renderPanel({
      threadGoal: null,
      threadGoalError: new Error("goal load failed"),
    });
    expect(failed.textContent).toContain("goal load failed");
    expect(
      failed.querySelector('[data-testid="thread-goal-load-error"]'),
    ).not.toBeNull();

    const inline = renderPanel({
      threadGoal: null,
      threadGoalLoading: true,
      variant: "inline",
    });
    expect(inline.childElementCount).toBe(0);
  });

  it("detail 与 inline 形态消费同一 canonical Goal", () => {
    const detail = renderPanel();
    expect(detail.textContent).toContain("完成 Codex ThreadGoal GUI 接入");
    expect(
      detail.querySelector('[data-testid="thread-goal-panel"]'),
    ).not.toBeNull();

    const inline = renderPanel({ variant: "inline" });
    expect(inline.textContent).toContain("完成 Codex ThreadGoal GUI 接入");
    expect(
      inline.querySelector('[data-testid="thread-goal-inline-panel"]'),
    ).not.toBeNull();
    expect(
      detail.querySelector('[data-testid="thread-goal-tokens"]')?.textContent,
    ).toContain("Tokens /");
    expect(
      detail.querySelector('[data-testid="thread-goal-wall-time"]')
        ?.textContent,
    ).toContain("1 分 30 秒");
    expect(
      detail.querySelector('[data-testid="thread-goal-updated-at"]'),
    ).not.toBeNull();
  });

  it("已有目标的编辑入口委托主 Composer，详情只读时隐藏编辑动作", async () => {
    const onEdit = vi.fn();
    const container = renderPanel({
      threadGoal: createGoal("complete"),
      onEdit,
    });
    await clickButton(
      container.querySelector('[data-testid="thread-goal-edit"]'),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(container.querySelector("textarea")).toBeNull();
    expect(document.querySelector('[data-testid="modal-overlay"]')).toBeNull();
    const readOnly = renderPanel();
    expect(
      readOnly.querySelector('[data-testid="thread-goal-edit"]'),
    ).toBeNull();
  });

  it("暂停和清除只调用 canonical ThreadGoal methods", async () => {
    setThreadGoalStatusMock.mockResolvedValue(createGoal("paused"));
    clearThreadGoalMock.mockResolvedValue(true);
    const onGoalChanged = vi.fn();
    const container = renderPanel({ onGoalChanged });

    await clickButton(
      container.querySelector('[data-testid="thread-goal-pause"]'),
    );
    expect(setThreadGoalStatusMock).toHaveBeenCalledWith("thread-1", "paused");

    await clickButton(
      container.querySelector('[data-testid="thread-goal-clear"]'),
    );
    expect(clearThreadGoalMock).toHaveBeenCalledWith("thread-1");
    expect(onGoalChanged).toHaveBeenLastCalledWith(null);
  });

  it("complete 只调用 canonical status mutation，运行中禁用终态动作", async () => {
    setThreadGoalStatusMock.mockResolvedValue(createGoal("complete"));
    const container = renderPanel();

    await clickButton(
      container.querySelector('[data-testid="thread-goal-complete"]'),
    );
    expect(setThreadGoalStatusMock).toHaveBeenCalledWith(
      "thread-1",
      "complete",
    );

    const busy = renderPanel({ runtimeBusy: true });
    expect(
      busy.querySelector<HTMLButtonElement>(
        '[data-testid="thread-goal-complete"]',
      )?.disabled,
    ).toBe(true);
  });

  it("mutation 失败时保留 canonical Goal 并展示错误", async () => {
    setThreadGoalStatusMock.mockRejectedValue(new Error("goal update failed"));
    const container = renderPanel();

    await clickButton(
      container.querySelector('[data-testid="thread-goal-pause"]'),
    );

    expect(container.textContent).toContain("goal update failed");
    expect(toastMock.error).toHaveBeenCalledWith("goal update failed");
    expect(container.textContent).toContain("完成 Codex ThreadGoal GUI 接入");
  });

  it.each(["paused", "blocked", "usageLimited"] as const)(
    "%s Goal 支持恢复为 active",
    async (status) => {
      setThreadGoalStatusMock.mockResolvedValue(createGoal("active"));
      const container = renderPanel({ threadGoal: createGoal(status) });

      await clickButton(
        container.querySelector('[data-testid="thread-goal-resume"]'),
      );
      expect(setThreadGoalStatusMock).toHaveBeenCalledWith(
        "thread-1",
        "active",
      );
    },
  );
});
