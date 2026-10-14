import { useCallback, useState, useSyncExternalStore } from "react";
import type { ComposerController } from "@/components/input-kit";
import type { Skill } from "@/lib/api/skills";
import {
  resolveInputCapabilitySelectionFromRoute,
  resolveInputCapabilitySendRoute,
  type InputCapabilitySelection,
  type InputCapabilitySendRoute,
} from "./inputCapabilitySelection";

const initialCapabilityRequests = new WeakMap<ComposerController, string>();

/** 同一草稿跨 surface 挂载不能重放已消费的入口预选。 */
export function claimComposerCapabilityInitialization(controller: ComposerController, signature: string): boolean {
  if (!signature || initialCapabilityRequests.get(controller) === signature) return false;
  initialCapabilityRequests.set(controller, signature);
  return true;
}

/** 能力路由归草稿 owner；本地仅保留候选的 UI 详情。 */
export function useComposerCapabilitySelection(
  controller: ComposerController,
  skills?: Skill[],
) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [selected, setSelected] = useState<InputCapabilitySelection | null>(null);
  const route = snapshot.document.inputCapabilityRoute as InputCapabilitySendRoute | undefined;
  const selection = route
    ? selected && JSON.stringify(resolveInputCapabilitySendRoute(selected)) === JSON.stringify(route)
      ? selected
      : resolveInputCapabilitySelectionFromRoute({ route, skills })
    : selected?.kind === "service_skill" ? selected : null;
  const setSelection = useCallback((value: InputCapabilitySelection | null) => {
    controller.setInputCapabilityRoute(resolveInputCapabilitySendRoute(value));
    setSelected(value);
  }, [controller]);
  return [selection, setSelection] as const;
}
