import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ComposerController } from "@/components/input-kit";
import type { AgentInitialInputCapabilityParams } from "@/types/page";
import { insertComposerSkill } from "./composerCapabilityMention";
import {
  resolveInputCapabilitySelectionFromRoute,
  resolveInputCapabilitySendRoute,
  type InputCapabilitySelection,
  type InputCapabilitySendRoute,
} from "./inputCapabilitySelection";

const initialCapabilityRequests = new WeakMap<ComposerController, string>();

/** 同一草稿跨 surface 挂载不能重放已消费的入口预选。 */
function claimComposerCapabilityInitialization(
  controller: ComposerController,
  signature: string,
): boolean {
  if (!signature || initialCapabilityRequests.get(controller) === signature)
    return false;
  initialCapabilityRequests.set(controller, signature);
  return true;
}

/** 能力路由和 mention 均归文档，不再维护第二份选择状态。 */
export function useComposerCapabilitySelection(controller: ComposerController) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const route = snapshot.document.inputCapabilityRoute as
    | InputCapabilitySendRoute
    | undefined;
  const selection = useMemo(
    () => (route ? resolveInputCapabilitySelectionFromRoute({ route }) : null),
    [route],
  );
  const setSelection = useCallback(
    (value: InputCapabilitySelection | null) => {
      controller.setInputCapabilityRoute(
        resolveInputCapabilitySendRoute(value),
      );
    },
    [controller],
  );
  return [selection, setSelection] as const;
}

/** 入口携带真实 catalog Skill，跨 surface 重挂载只插入一次。 */
export function useComposerInitialSkill(
  controller: ComposerController,
  initialInput?: AgentInitialInputCapabilityParams,
) {
  useEffect(() => {
    const skill = initialInput?.skill;
    if (!skill) return;
    const signature = JSON.stringify({
      requestKey: initialInput.requestKey ?? 0,
      skill,
    });
    if (!claimComposerCapabilityInitialization(controller, signature)) return;
    insertComposerSkill(controller, skill);
  }, [controller, initialInput]);
}
