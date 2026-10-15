import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTaskCenterTabChrome } from "./useTaskCenterTabChrome";
import type { Topic } from "../hooks/agentChatShared";

// Strip presentation is outside this hook test; all projection and navigation decisions are real.
vi.mock("../components/TaskCenterTabStrip", () => ({
  TaskCenterTabStrip: (props: {
    items: Array<{ id: string; title: string }>;
    onCloseTask: (id: string) => void;
  }) => (
    <div data-testid="canonical-strip">
      {props.items.map((item) => (
        <button key={item.id} onClick={() => props.onCloseTask(item.id)}>
          {item.title}
        </button>
      ))}
    </div>
  ),
}));
const cleanups: Array<() => void> = [];
const canonicalTopic: Topic = {
  id: "existing",
  title: "",
  createdAt: new Date(1),
  updatedAt: new Date(1),
  workspaceId: null,
  workingDir: null,
  messagesCount: 1,
  executionStrategy: "react",
  status: "done",
  lastPreview: "",
  hasUnread: false,
  tag: null,
  sourceSessionId: "existing",
};
afterEach(() => {
  act(() => cleanups.splice(0).forEach((close) => close()));
  vi.unstubAllGlobals();
});
function mount(theme: string, home = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  cleanups.push(() => {
    root.unmount();
    element.remove();
  });
  const close = vi.fn();
  let value!: ReturnType<typeof useTaskCenterTabChrome>;
  function Surface() {
    value = useTaskCenterTabChrome({
      agentEntry: "claw",
      activeTheme: theme,
      sessionId: "existing",
      normalizedInitialSessionId: "existing",
      initialSessionName: "Canonical title",
      openTabIds: ["existing"],
      topics: [canonicalTopic],
      previewTopicId: "existing",
      hasLocalSessionOverride: true,
      topicById: new Map([[canonicalTopic.id, canonicalTopic]]),
      untitledTaskLabel: "Untitled",
      shouldUseBrowserWorkspaceHomeChrome: home,
      newConversationLabel: "New",
      homeMountedAt: 1,
      layoutMode: "chat",
      onSwitchTaskTopic: vi.fn(),
      onRenameTaskTopic: vi.fn(),
      onCloseTaskCenterTab: close,
      onOpenTaskCenterNewTaskPage: vi.fn(),
      onToggleWorkbench: vi.fn(),
    });
    return (
      <>
        {value.taskCenterTabsNode}
        {value.browserWorkspaceHomeTabsNode}
      </>
    );
  }
  act(() => root.render(<Surface />));
  return { element, value, close };
}
describe("general Chrome retirement and specialized canonical strip", () => {
  it.each([false, true])(
    "general home=%s creates no second strip node",
    (home) => {
      const view = mount("general", home);
      expect(view.value.shouldRenderTaskCenterTabStrip).toBe(false);
      expect(view.value.taskCenterTabsNode).toBeNull();
      expect(view.value.browserWorkspaceHomeTabsNode).toBeNull();
      expect(view.element.childElementCount).toBe(0);
    },
  );
  it("specialized workbench keeps canonical titles and close navigation", () => {
    const view = mount("document");
    const button = view.element.querySelector("button");
    expect(button?.textContent).toBe("Canonical title");
    act(() => button?.click());
    expect(view.close).toHaveBeenCalledExactlyOnceWith("existing");
  });
});
