import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsTabs } from "@/types/settings";
import {
  act,
  cleanupAppSidebarTest,
  flushEffects,
  mountSidebarContainer,
  resetAppSidebarTest,
} from "./AppSidebar.testFixtures";

describe("AppSidebar navigation visibility", () => {
  beforeEach(resetAppSidebarTest);
  afterEach(cleanupAppSidebarTest);

  it.each(["new-task", "claw"] as const)(
    "%s 页面应显示并打开设置、插件和已安排任务",
    async (agentEntry) => {
      const onNavigate = vi.fn();
      const container = mountSidebarContainer({
        currentPage: "agent",
        currentPageParams: { agentEntry },
        onNavigate,
      });
      await flushEffects(2);

      for (const { id, page, params } of [
        {
          id: "settings",
          page: "settings",
          params: { tab: SettingsTabs.Home },
        },
        { id: "plugins", page: "plugins", params: undefined },
        { id: "scheduled-tasks", page: "scheduled-tasks", params: undefined },
      ]) {
        const button = container.querySelector<HTMLButtonElement>(
          `[data-testid="app-sidebar-nav-${id}"]`,
        );
        expect(button, `${agentEntry}: ${id} 入口存在`).not.toBeNull();
        expect(
          getComputedStyle(button!).display,
          `${agentEntry}: ${id} 入口可见`,
        ).not.toBe("none");
        act(() => button!.click());
        expect(onNavigate).toHaveBeenLastCalledWith(page, params);
      }
    },
  );
});
