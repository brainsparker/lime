import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MarkdownLink } from "../components/MarkdownLink";
import { useAgentChatWorkspaceSceneComposition } from "./useAgentChatWorkspaceSceneComposition";

const openLink = vi.hoisted(() => vi.fn());
const external = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/externalUrl", () => ({
  openExternalUrlWithSystemBrowser: external,
}));
vi.mock("./useWorkspaceRightSurfaceExpertPanelRuntime", () => ({
  useWorkspaceRightSurfaceExpertPanelRuntime: () => ({}),
}));
vi.mock("./useWorkspaceRightSurfaceCompositionRuntime", () => ({
  useWorkspaceRightSurfaceCompositionRuntime: () => ({
    openLink,
    sceneDisplayMessagesWithArticleWorkspaceArtifact: [],
  }),
}));
vi.mock("./useWorkspaceBackgroundSessionRuntime", () => ({
  useWorkspaceBackgroundSessionRuntime: () => undefined,
}));
vi.mock("./useWorkspaceConversationCompositionRuntime", () => ({
  useWorkspaceConversationCompositionRuntime: () => ({
    mainAreaNode: (
      <MarkdownLink href="https://docs.example.com">Guide</MarkdownLink>
    ),
  }),
}));
vi.mock("./WorkspaceShellScene", () => ({
  WorkspaceShellScene: ({ mainAreaNode }: { mainAreaNode: ReactNode }) =>
    mainAreaNode,
}));

it("wires the conversation shell to its own right-surface link owner", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const params = {
    rightSurface: {},
    conversation: { messageList: {} },
  } as Parameters<typeof useAgentChatWorkspaceSceneComposition>[0];
  function Probe() {
    return useAgentChatWorkspaceSceneComposition(params);
  }
  try {
    act(() => root.render(<Probe />));
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => container.querySelector("a")!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(openLink).toHaveBeenCalledExactlyOnceWith(
      "https://docs.example.com",
      expect.objectContaining({ nativeEvent: event }),
    );
    expect(external).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
