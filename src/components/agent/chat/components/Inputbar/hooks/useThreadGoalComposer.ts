import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ThreadGoal } from "@limecloud/app-server-client";
import type { ComposerController } from "@/components/input-kit";
import type { ComposerDraftCoordinator } from "@/components/input-kit/ComposerDraftCoordinator";
import { setThreadGoal } from "@/lib/api/agentRuntime/threadGoalClient";
import {
  materializeThreadGoal,
  type MaterializedThreadGoal,
} from "@/lib/api/agentRuntime/threadGoalAttachments";
import { prepareThreadGoalDraft } from "./threadGoalDraft";
import type { RuntimeSubmissionResult } from "../../../hooks/agentSendResult";

interface ThreadGoalComposerParams {
  controller: ComposerController;
  coordinator?: ComposerDraftCoordinator;
  projectId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  threadGoal?: ThreadGoal | null;
  focusComposer: () => void;
  onCommitted: () => void;
  onGoalSaved?: (threadId: string, objective: string) => void;
}

interface GoalSubmission {
  objective: string;
  save: () => Promise<RuntimeSubmissionResult>;
  isCurrent: () => boolean;
}

export function useThreadGoalComposer({
  controller,
  coordinator,
  projectId = null,
  sessionId = null,
  threadId = null,
  threadGoal = null,
  focusComposer,
  onCommitted,
  onGoalSaved,
}: ThreadGoalComposerParams) {
  const { t } = useTranslation("agent");
  const scopeKey = JSON.stringify([projectId, sessionId, threadId]);
  const surface = useRef({ scopeKey, controller, coordinator });
  surface.current = { scopeKey, controller, coordinator };
  const mounted = useRef(true);
  const flight = useRef<GoalSubmission | null>(null);
  const [submitting, setSubmitting] = useState<GoalSubmission | null>(null);
  const [mode, setMode] = useState<{
    scopeKey: string;
    objective: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<GoalSubmission | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pendingThreadGoalObjective =
    mode?.scopeKey === scopeKey ? mode.objective : null;
  const isSurfaceCurrent = useCallback(
    () =>
      mounted.current &&
      surface.current.scopeKey === scopeKey &&
      surface.current.controller === controller &&
      surface.current.coordinator === coordinator,
    [scopeKey, controller, coordinator],
  );
  const openGoalEditor = useCallback(() => {
    if (!threadId || flight.current?.isCurrent()) return;
    setMode({ scopeKey, objective: "" });
    focusComposer();
  }, [threadId, scopeKey, focusComposer]);
  const closeGoalEditor = useCallback(() => {
    setMode(null);
    setConfirmation(null);
    focusComposer();
  }, [focusComposer]);

  const prepareThreadGoalSubmit =
    useCallback((): Promise<RuntimeSubmissionResult> | null => {
      if (!threadId) return null;
      const raw = controller.getDocument().text;
      const command = raw.trimStart().match(/^\/go+al(?=$| )/);
      if (pendingThreadGoalObjective === null && !command) return null;
      if (flight.current?.isCurrent() || confirmation?.isCurrent())
        return Promise.resolve({ kind: "local-handled" });

      const receipt = controller.submit("command");
      const draft = prepareThreadGoalDraft(receipt, command?.[0].length);
      const { objective } = draft;
      const hasAttachments =
        draft.pastedTextAttachments.length > 0 ||
        draft.imageAttachments.length > 0;
      if (!objective && !hasAttachments) {
        setMode({ scopeKey, objective: "" });
        return Promise.resolve({ kind: "local-handled" });
      }
      if (
        receipt.submission.pathReferences.length > 0 ||
        receipt.draft.inputCapabilityRoute
      ) {
        toast.error(t("agentChat.threadGoal.composer.unsupportedContext"));
        return Promise.resolve({ kind: "rejected" });
      }
      const binding = coordinator?.captureBinding();
      const generation = coordinator?.getSnapshot().generation;
      const assertRequestCurrent = () => {
        if (!isSurfaceCurrent())
          throw new Error("Goal submission is no longer current");
        if (coordinator) {
          const current = coordinator.getSnapshot();
          if (
            current.generation !== generation ||
            JSON.stringify(current.scope) !== JSON.stringify(binding?.scope) ||
            current.identity?.draftId !== binding?.identity.draftId
          )
            throw new Error("Goal submission binding changed");
        }
      };
      const canClearDraft = () => {
        if (
          !isSurfaceCurrent() ||
          controller.getSnapshot().revision !== receipt.revision
        )
          return false;
        if (!coordinator) return true;
        const current = coordinator.getSnapshot();
        return Boolean(
          binding &&
          current.generation === generation &&
          JSON.stringify(current.scope) === JSON.stringify(binding.scope) &&
          current.identity?.draftId === binding.identity.draftId,
        );
      };
      const submission: GoalSubmission = {
        objective,
        isCurrent: isSurfaceCurrent,
        save: async () => {
          if (!isSurfaceCurrent() || flight.current?.isCurrent())
            return { kind: "local-handled" };
          flight.current = submission;
          setSubmitting(submission);
          let saved = false;
          let materialized: MaterializedThreadGoal | null = null;
          let preparing = true;
          try {
            materialized = await materializeThreadGoal(draft, {
              assertRequestCurrent,
            });
            assertRequestCurrent();
            preparing = false;
            await setThreadGoal({
              threadId,
              objective: materialized.objective,
              status: "active",
            });
            saved = true;
            materialized = null;
            if (!isSurfaceCurrent()) return { kind: "local-handled" };
            try {
              onGoalSaved?.(threadId, objective);
            } catch {
              console.error("[ThreadGoal] prompt history update failed");
            }
            let cleared = false;
            if (canClearDraft()) {
              if (coordinator && binding) {
                cleared =
                  (await coordinator.replaceCommittedDraft(
                    binding.scope,
                    canClearDraft,
                  )) === "applied";
                if (cleared) controller.mergeHistory([receipt.draft]);
              } else if (receipt.kind === "accepted") {
                cleared = controller.commit(receipt);
              }
            }
            if (cleared && isSurfaceCurrent()) {
              setMode(null);
              onCommitted();
              focusComposer();
            }
            return { kind: "local-handled" };
          } catch (error) {
            if (saved) {
              console.error("[ThreadGoal] saved goal draft cleanup failed");
              return { kind: "local-handled" };
            }
            if (isSurfaceCurrent())
              toast.error(
                preparing
                  ? t("agentChat.threadGoal.composer.materializeFailed")
                  : error instanceof Error && error.message
                    ? error.message
                    : t("agentChat.threadGoal.toast.failed"),
              );
            return { kind: "rejected", error };
          } finally {
            await materialized?.cleanup();
            if (flight.current === submission) flight.current = null;
            if (mounted.current)
              setSubmitting((current) =>
                current === submission ? null : current,
              );
          }
        },
      };
      if (
        threadGoal?.threadId === threadId &&
        (threadGoal.objective !== objective || hasAttachments)
      ) {
        setConfirmation(submission);
        return Promise.resolve({ kind: "local-handled" });
      }
      return submission.save();
    }, [
      threadId,
      controller,
      pendingThreadGoalObjective,
      confirmation,
      scopeKey,
      coordinator,
      isSurfaceCurrent,
      onGoalSaved,
      onCommitted,
      focusComposer,
      t,
      threadGoal,
    ]);

  const handleCloseGoalReplacement = useCallback(() => {
    const current = confirmation?.isCurrent();
    setConfirmation(null);
    if (current) focusComposer();
  }, [confirmation, focusComposer]);
  const handleConfirmGoalReplacement = useCallback(async () => {
    setConfirmation(null);
    return confirmation?.save();
  }, [confirmation]);

  return {
    pendingThreadGoalObjective,
    isSubmitting: Boolean(submitting?.isCurrent()),
    goalReplacementConfirmation: confirmation?.isCurrent()
      ? confirmation.objective
      : null,
    openGoalEditor,
    closeGoalEditor,
    prepareThreadGoalSubmit,
    handleCloseGoalReplacement,
    handleConfirmGoalReplacement,
  };
}
