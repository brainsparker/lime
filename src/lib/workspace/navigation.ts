import type { AgentPageParams } from "@/types/page";

export interface NewConversationRequest {
  readonly id: number;
  readonly workspaceId: string | null;
  readonly freshDraft: boolean;
}

export type StartNewConversation = (options: {
  projectId: string | null;
  freshDraft: boolean;
}) => void;

export function buildHomeAgentParams(
  overrides: Partial<AgentPageParams> = {},
): AgentPageParams {
  return {
    ...overrides,
    agentEntry: "new-task",
    immersiveHome: overrides.immersiveHome ?? false,
    theme: "general",
    lockTheme: false,
    newChatAt: overrides.newChatAt ?? Date.now(),
  };
}

export function buildClawAgentParams(
  overrides: Partial<AgentPageParams> = {},
): AgentPageParams {
  return {
    ...overrides,
    agentEntry: "claw",
    immersiveHome: overrides.immersiveHome ?? false,
    theme: overrides.theme ?? "general",
    lockTheme: overrides.lockTheme ?? false,
  };
}
