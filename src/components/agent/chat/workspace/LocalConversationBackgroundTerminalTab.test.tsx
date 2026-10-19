import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { LocalConversationBackgroundTerminalTab } from "./LocalConversationBackgroundTerminalTab";
import type { AgentThreadItem } from "../types";
vi.mock("../components/XtermOutputPanel", () => ({
  XtermOutputPanel: ({ output }: { output: string }) => <pre>{output}</pre>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe("LocalConversationBackgroundTerminalTab", () => {
  it("follows only the full canonical item identity without retaining a stale output snapshot", async () => {
    const container = document.createElement("div"),
      root = createRoot(container);
    const key = { threadId: "thread", turnId: "turn", itemId: "command" };
    const item = {
      id: "command",
      thread_id: "thread",
      turn_id: "turn",
      type: "command_execution",
      aggregated_output: "first",
    } as AgentThreadItem;
    const render = async (items: AgentThreadItem[]) => {
      await act(async () =>
        root.render(
          <LocalConversationBackgroundTerminalTab
            itemKey={key}
            items={items}
          />,
        ),
      );
    };
    try {
      await render([item]);
      expect(container.textContent).toBe("first");
      await render([
        { ...item, aggregated_output: "first\nsecond" } as AgentThreadItem,
      ]);
      expect(container.textContent).toBe("first\nsecond");
      await render([{ ...item, turn_id: "other-turn" }]);
      expect(container.textContent).toBe("agentChat.terminal.noOutput");
      await render([{ ...item, thread_id: "other-thread" }]);
      expect(container.textContent).toBe("agentChat.terminal.noOutput");
      await render([]);
      expect(container.textContent).toBe("agentChat.terminal.noOutput");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
