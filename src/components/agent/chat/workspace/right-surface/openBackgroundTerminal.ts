import type { AgentThreadItem } from "../../types";
import {
  openSidePanelTab,
  type ThreadSidePanelTabs,
} from "./threadSidePanelTabs";

/** 身份来自canonical command Item，tab不复制输出或进程状态。 */
export function openBackgroundTerminal(
  state: ThreadSidePanelTabs,
  item: AgentThreadItem,
): ThreadSidePanelTabs {
  if (item.type !== "command_execution") return state;
  const key = {
    threadId: item.thread_id,
    turnId: item.turn_id,
    itemId: item.id,
  };
  const tabId =
    "background-terminal:" +
    [key.threadId, key.turnId, key.itemId].map(encodeURIComponent).join(":");
  return openSidePanelTab(state, {
    tabId,
    kind: "background-terminal",
    backgroundTerminal: key,
    title: item.command.trim() || undefined,
  });
}
