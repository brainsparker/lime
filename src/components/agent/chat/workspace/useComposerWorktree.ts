import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  RuntimeAcceptanceReceipt,
  RuntimeSubmissionResult,
} from "../hooks/agentSendResult";
import {
  executionSurfaceKey,
  type ExecutionScope,
} from "../hooks/executionScope";
import type { ComposerMode } from "./ComposerModeContext";
import {
  ComposerWorktreeSubmission,
  type ComposerWorktreeRequest,
} from "./composerWorktreeSubmission";

interface Params {
  workspaceId?: string | null;
  workingDir?: string | null;
  getNavigationEpoch?: () => number;
  cancelExecutionScope?: () => void;
  isAcceptedTargetCurrent?: (
    scope: ExecutionScope,
    receipt: RuntimeAcceptanceReceipt,
  ) => boolean;
  onAccepted?: (
    scope: ExecutionScope,
    receipt: RuntimeAcceptanceReceipt,
  ) => void;
}

/** One staged mode for the landing composer and the existing send-plan owner. */
export function useComposerWorktree({
  workspaceId,
  workingDir,
  getNavigationEpoch,
  cancelExecutionScope,
  isAcceptedTargetCurrent,
  onAccepted,
}: Params) {
  const owner = useRef<ComposerWorktreeSubmission | null>(null);
  if (!owner.current) owner.current = new ComposerWorktreeSubmission();
  const surface = executionSurfaceKey(workspaceId ?? "", workingDir);
  const latest = useRef({ surface, epoch: 0, mounted: true });
  const [selection, setSelection] = useState<
    (ComposerWorktreeRequest & { surface: string; epoch: number }) | null
  >(null);
  useLayoutEffect(() => {
    if (latest.current.surface === surface) return;
    latest.current.surface = surface;
    latest.current.epoch += 1;
    setSelection(null);
  }, [surface]);
  useEffect(() => {
    const lifecycle = latest.current;
    lifecycle.mounted = true;
    return () => {
      lifecycle.mounted = false;
      lifecycle.epoch += 1;
    };
  }, []);
  const setComposerMode = useCallback(
    (mode: ComposerMode) => {
      latest.current.epoch += 1;
      cancelExecutionScope?.();
      setSelection(
        mode === "worktree" && workspaceId?.trim() && workingDir?.trim()
          ? {
              requestId: crypto.randomUUID(),
              sourceWorkspaceId: workspaceId.trim(),
              sourceWorkingDir: workingDir.trim(),
              surface,
              epoch: latest.current.epoch,
            }
          : null,
      );
    },
    [workspaceId, workingDir, surface, cancelExecutionScope],
  );
  const composerMode: ComposerMode =
    selection?.surface === surface ? "worktree" : "local";
  const capture = useCallback(() => {
    if (!selection || composerMode !== "worktree") return null;
    const navigationEpoch = getNavigationEpoch?.();
    const isCurrent = () =>
      latest.current.mounted &&
      latest.current.surface === selection.surface &&
      latest.current.epoch === selection.epoch &&
      getNavigationEpoch?.() === navigationEpoch;
    return {
      async submit(
        execute: (scope: ExecutionScope) => Promise<RuntimeSubmissionResult>,
      ) {
        const result = await owner.current!.submit(
          selection,
          isCurrent,
          execute,
        );
        if (
          result.kind === "runtime-accepted" &&
          latest.current.mounted &&
          latest.current.surface === selection.surface &&
          latest.current.epoch === selection.epoch &&
          (isCurrent() ||
            (getNavigationEpoch?.() === (navigationEpoch ?? 0) + 1 &&
              isAcceptedTargetCurrent?.(
                result.receipt.executionScope!,
                result.receipt,
              )))
        ) {
          onAccepted?.(result.receipt.executionScope!, result.receipt);
          latest.current.epoch += 1;
          setSelection(null);
        }
        return result;
      },
    };
  }, [
    selection,
    composerMode,
    getNavigationEpoch,
    isAcceptedTargetCurrent,
    onAccepted,
  ]);
  return useMemo(
    () => ({ composerMode, setComposerMode, capture }),
    [composerMode, setComposerMode, capture],
  );
}
