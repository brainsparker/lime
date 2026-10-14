import { useCallback, useMemo } from "react";
import { useComposerController } from "@/components/input-kit/useComposerController";
import type { ComposerController } from "@/components/input-kit/ComposerController";

import type { MessagePathReference } from "../types";

import { mergePathReferences } from "../utils/pathReferences";

/**
 * 路径引用直接读写草稿 owner；独立使用时创建本地 Controller。
 * 操作同步推进草稿 revision，避免迟到发送结果清空新增引用。
 */
export interface PathReferencesController {
  /** 当前路径引用列表。 */
  pathReferences: MessagePathReference[];
  /** 追加一组引用（按 id 去重合并）。 */
  addPathReferences: (references: MessagePathReference[]) => void;
  /** 移除指定 id 的引用。 */
  removePathReference: (id: string) => void;
  /** 清空全部引用。 */
  clearPathReferences: () => void;
}

export function usePathReferences(
  initial: MessagePathReference[] = [],
  controller?: ComposerController,
): PathReferencesController {
  const { controller: pathController, snapshot } = useComposerController({
    controller,
    initialDocument: { pathReferences: initial },
  });
  const pathReferences = useMemo(() => [...snapshot.document.pathReferences],
    [snapshot.document.pathReferences]);

  const addPathReferences = useCallback(
    (references: MessagePathReference[]) => {
      pathController.setPathReferences(mergePathReferences(
        [...pathController.getDocument().pathReferences], references));
    },
    [pathController],
  );

  const removePathReference = useCallback((id: string) => {
    pathController.setPathReferences(pathController.getDocument().pathReferences
      .filter((reference) => reference.id !== id));
  }, [pathController]);

  const clearPathReferences = useCallback(() => {
    pathController.setPathReferences([]);
  }, [pathController]);

  return useMemo(
    () => ({
      pathReferences,
      addPathReferences,
      removePathReference,
      clearPathReferences,
    }),
    [pathReferences, addPathReferences, removePathReference, clearPathReferences],
  );
}
