import { describe, expect, it } from "vitest";
import type { AgentThreadItem } from "../../types";
import { openBackgroundTerminal } from "./openBackgroundTerminal";
import {
  closeSidePanelTab,
  type ThreadSidePanelTabs,
} from "./threadSidePanelTabs";

describe("background terminal tab identity", () => {
  it("reuses the same canonical Item, isolates turns, and keeps interactive terminal identity", () => {
    const empty: ThreadSidePanelTabs = {
      tabs: [{ tabId: "interactive", kind: "shell" }],
      activeTabId: "interactive",
      open: true,
    };
    const item = {
      id: "command",
      thread_id: "thread",
      turn_id: "turn",
      type: "command_execution",
      process_id: "process",
      command: "npm run build",
    } as AgentThreadItem;
    const first = openBackgroundTerminal(empty, item);
    expect(first.tabs).toHaveLength(2);
    expect(first.tabs[1]).toMatchObject({
      title: "npm run build",
      backgroundTerminal: {
        threadId: "thread",
        turnId: "turn",
        itemId: "command",
      },
    });
    expect(openBackgroundTerminal(first, item)).toBe(first);
    const second = openBackgroundTerminal(first, {
      ...item,
      turn_id: "second-turn",
    });
    expect(second.tabs).toHaveLength(3);
    expect(closeSidePanelTab(second, first.tabs[1].tabId).tabs).toEqual([
      empty.tabs[0],
      second.tabs[2],
    ]);
  });
});
