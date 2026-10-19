import { useTranslation } from "react-i18next";
import { XtermOutputPanel } from "../components/XtermOutputPanel";
import type { AgentThreadItem } from "../types";
import type { ThreadSidePanelTab } from "./right-surface/threadSidePanelTabs";

export function LocalConversationBackgroundTerminalTab({
  itemKey,
  items,
}: {
  itemKey: NonNullable<ThreadSidePanelTab["backgroundTerminal"]>;
  items: readonly AgentThreadItem[];
}) {
  const { t } = useTranslation("agent");
  const item = items.find(
    (item) =>
      item.type === "command_execution" &&
      item.thread_id === itemKey.threadId &&
      item.turn_id === itemKey.turnId &&
      item.id === itemKey.itemId,
  );
  const output =
    item?.type === "command_execution" ? (item.aggregated_output ?? "") : "";
  return (
    <section
      data-testid="background-terminal-tab"
      data-item-id={itemKey.itemId}
      className="h-full min-h-0 bg-[color:var(--lime-surface)]"
    >
      {output ? (
        <XtermOutputPanel output={output} />
      ) : (
        <div className="p-4 font-mono text-xs text-[color:var(--lime-text-muted)]">
          {t("agentChat.terminal.noOutput")}
        </div>
      )}
    </section>
  );
}
