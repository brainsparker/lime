import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getDefaultPendingInteractionController,
  type PendingInteractionController,
  type PendingInteractionResponse,
} from "@/lib/api/agentRuntime/pendingInteractionController";
import { interruptAgentRuntimeTurn } from "@/lib/api/agentRuntime/threadClient";

/** 绑定唯一 controller，并向 Composer 暴露当前 typed pending projection。 */
export function usePendingInteractions(
  controller: PendingInteractionController = getDefaultPendingInteractionController(),
) {
  useEffect(() => controller.attach(), [controller]);
  const interactions = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const respond = useCallback(
    (response: PendingInteractionResponse) => controller.respond(response),
    [controller],
  );
  const dismiss = useCallback(
    async (interactionId: string) => {
      const interaction = controller
        .getSnapshot()
        .find((candidate) => candidate.id === interactionId);
      if (
        interaction?.kind !== "request_user_input" ||
        interaction.status !== "pending" ||
        !interaction.thread_id ||
        !interaction.turn_id
      ) {
        return { accepted: false };
      }
      const accepted = await interruptAgentRuntimeTurn({
        session_id: interaction.thread_id,
        turn_id: interaction.turn_id,
      });
      return { accepted };
    },
    [controller],
  );

  return { interactions, respond, dismiss };
}
