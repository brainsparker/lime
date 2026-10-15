import { runRuntimeSubmissionEffect } from "../../../hooks/agentSendResult";
import { useCallback, useEffect, useRef } from "react";
import type {
  ComposerDraftCoordinator,
  ComposerDraftCapture,
} from "@/components/input-kit/ComposerDraftCoordinator";
import type { AcceptedRuntimeSubmissionResult } from "@/components/agent/chat/hooks/agentSendResult";
import { createComposerSubmissionSettlement } from "../../composerSubmissionSettlement";
import type { MessageImage, MessagePathReference } from "../../../types";
import type { InputbarKnowledgePackSelection } from "../types";
import type { InputbarSendHandler } from "../inputbarSendPayload";
import { buildKnowledgeRequestMetadata } from "@/features/knowledge/agent/knowledgeMetadata";
import { recordCuratedTaskTemplateUsage } from "../../../utils/curatedTaskTemplates";
import { buildPathReferenceRequestMetadata } from "../../../utils/pathReferences";
import {
  resolveInputCapabilityDispatch,
  resolveInputCapabilitySelectionFromRoute,
  resolveInputCapabilitySendRoute,
  type InputCapabilitySelection,
  type InputCapabilitySendRoute,
} from "../../../skill-selection/inputCapabilitySelection";
import { buildInputbarToolPreferencesOverride } from "../utils/inputbarModeRequestMetadata";
import { recordAgentUiPerformanceMetric } from "@/lib/agentUiPerformanceMetrics";
import type {
  BaseComposerSendMetadata,
  ComposerController,
  ComposerDraftSnapshot,
  ComposerSubmitTarget,
} from "@/components/input-kit";

interface UseInputbarSendParams {
  input: string;
  pendingImages: MessageImage[];
  pathReferences: MessagePathReference[];
  activeCapability: InputCapabilitySelection | null;
  knowledgePackSelection?: InputbarKnowledgePackSelection | null;
  activeTools?: Record<string, boolean>;
  projectId?: string | null;
  sessionId?: string | null;
  isLoading?: boolean;
  onSend: InputbarSendHandler;
  clearPendingImages: () => void;
  clearPathReferences?: () => void;
  clearActiveCapability: () => void;
  getInputRestoreEpoch?: () => number;
  composerController?: ComposerController;
  composerDraftCoordinator?: ComposerDraftCoordinator;
  onComposerDraftAccepted?: (
    capture: ComposerDraftCapture,
    result: AcceptedRuntimeSubmissionResult,
  ) => Promise<void> | void;
  onComposerAccepted?: (
    draft: ComposerDraftSnapshot | undefined,
    result: AcceptedRuntimeSubmissionResult,
  ) => void;
  onComposerCommitted?: (text: string, draft?: ComposerDraftSnapshot) => void;
  submitTarget?: ComposerSubmitTarget;
}

export function useInputbarSend({
  input,
  pendingImages,
  pathReferences,
  activeCapability,
  knowledgePackSelection,
  activeTools = {},
  projectId,
  sessionId,
  isLoading = false,
  onSend,
  clearPendingImages,
  clearPathReferences,
  clearActiveCapability,
  getInputRestoreEpoch,
  composerController,
  composerDraftCoordinator,
  onComposerDraftAccepted,
  onComposerAccepted,
  onComposerCommitted,
  submitTarget,
}: UseInputbarSendParams) {
  const mounted = useRef(true);
  const surface = useRef({
    composerController,
    composerDraftCoordinator,
    projectId,
    sessionId,
  });
  surface.current = {
    composerController,
    composerDraftCoordinator,
    projectId,
    sessionId,
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    async (triggerMetadata?: BaseComposerSendMetadata) => {
      const handlerEnteredAt = Date.now();
      const sendRestoreEpoch = getInputRestoreEpoch?.() ?? 0;
      const resolvedSubmitTarget: ComposerSubmitTarget =
        triggerMetadata?.submitTarget ??
        submitTarget ??
        (isLoading ? "steer" : "start");
      const settlement = createComposerSubmissionSettlement({
        controller: composerController,
        coordinator: composerDraftCoordinator,
        target: resolvedSubmitTarget,
        onDraftAccepted: onComposerDraftAccepted,
        scope: { projectId, sessionId },
        canApplyUi: () =>
          mounted.current &&
          surface.current.composerController === composerController &&
          surface.current.composerDraftCoordinator ===
            composerDraftCoordinator &&
          (!!composerDraftCoordinator ||
            (surface.current.projectId === projectId &&
              surface.current.sessionId === sessionId)) &&
          (getInputRestoreEpoch?.() ?? sendRestoreEpoch) === sendRestoreEpoch,
        onAccepted: (result, draft) => {
          runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
            onComposerAccepted?.(draft, result),
          );
          if (submittedCapability?.kind === "curated_task") {
            runRuntimeSubmissionEffect(result.receipt, "accepted_submit", () =>
              recordCuratedTaskTemplateUsage({
                templateId: submittedCapability.task.id,
                launchInputValues: submittedCapability.launchInputValues,
                referenceMemoryIds: submittedCapability.referenceMemoryIds,
                referenceEntries: submittedCapability.referenceEntries,
              }),
            );
          }
        },
        onCommitted: (accepted) => {
          // Controller has already been committed by its sole settlement owner.
          runRuntimeSubmissionEffect(
            accepted.receipt,
            "accepted_submit",
            clearPendingImages,
          );
          runRuntimeSubmissionEffect(accepted.receipt, "accepted_submit", () =>
            clearPathReferences?.(),
          );
          runRuntimeSubmissionEffect(
            accepted.receipt,
            "accepted_submit",
            clearActiveCapability,
          );
          if (composerReceipt?.kind === "accepted") {
            runRuntimeSubmissionEffect(
              accepted.receipt,
              "accepted_submit",
              () =>
                onComposerCommitted?.(
                  composerController?.getDocument().text ?? "",
                  composerDraft,
                ),
            );
          }
        },
      });
      const composerReceipt = settlement.receipt;
      if (composerReceipt?.kind === "empty") return;
      const composerDraft = composerReceipt?.draft;
      const submittedInput = composerReceipt?.submission.text ?? input;
      const composerSubmission = composerReceipt?.submission;
      const submittedImages = composerSubmission?.attachments ?? pendingImages;
      const submittedReferences =
        composerSubmission?.pathReferences ?? pathReferences;
      const submittedRoute = composerDraft?.inputCapabilityRoute as
        | InputCapabilitySendRoute
        | undefined;
      const submittedCapability = composerDraft
        ? submittedRoute
          ? activeCapability &&
            JSON.stringify(
              resolveInputCapabilitySendRoute(activeCapability),
            ) === JSON.stringify(submittedRoute)
            ? activeCapability
            : resolveInputCapabilitySelectionFromRoute({
                route: submittedRoute,
              })
          : null
        : activeCapability;
      const captureMetadata = {
        onRuntimeAccepted: settlement.onRuntimeAccepted,
        ...(settlement.composerRestoreToken
          ? { composerRestoreToken: settlement.composerRestoreToken }
          : {}),
        ...(settlement.composerDraftCapture
          ? { composerDraftCapture: settlement.composerDraftCapture }
          : {}),
      };
      const triggeredAt =
        typeof triggerMetadata?.triggeredAt === "number" &&
        Number.isFinite(triggerMetadata.triggeredAt)
          ? triggerMetadata.triggeredAt
          : handlerEnteredAt;
      const triggerSource = triggerMetadata?.triggerSource ?? "adapter";
      recordAgentUiPerformanceMetric("inputbar.send.enter", {
        durationMs: Math.max(0, handlerEnteredAt - triggeredAt),
        hasTriggerMetadata: Boolean(triggerMetadata),
        imageCount: submittedImages.length,
        inputLength: submittedInput.trim().length,
        pathReferenceCount: submittedReferences.length,
        sessionId: sessionId ?? null,
        source: "inputbar",
        triggerSource,
        workspaceId: projectId ?? null,
      });
      const inputMentions = composerSubmission?.inputMentions ?? [];
      if (
        !submittedInput.trim() &&
        submittedImages.length === 0 &&
        submittedReferences.length === 0
      ) {
        return;
      }

      const hasRuntimeMode =
        Boolean(activeTools["objective_mode"]) ||
        Boolean(activeTools["task_mode"]) ||
        Boolean(activeTools["subagent_mode"]);
      const canUsePlainTextFastPath =
        submittedInput.trim() &&
        submittedImages.length === 0 &&
        submittedReferences.length === 0 &&
        !submittedCapability &&
        !knowledgePackSelection?.enabled &&
        !hasRuntimeMode &&
        resolvedSubmitTarget !== "queue";
      if (canUsePlainTextFastPath) {
        recordAgentUiPerformanceMetric("inputbar.send.plainTextFastPath", {
          elapsedMs: Math.max(0, Date.now() - triggeredAt),
          inputLength: submittedInput.trim().length,
          sessionId: sessionId ?? null,
          source: "inputbar",
          triggerSource,
          workspaceId: projectId ?? null,
        });
        try {
          const result = await onSend({
            ...captureMetadata,
            images: undefined,
            textOverride: submittedInput,
            sendOptions: undefined,
            ...(composerReceipt?.kind === "accepted"
              ? {
                  composerIntent: composerReceipt.intent,
                  composerTarget: composerReceipt.target,
                  composerDraft,
                  composerSubmission,
                }
              : {}),
            ...(triggerMetadata
              ? {
                  triggeredAt,
                  triggerSource,
                }
              : {}),
          });
          return settlement.finish(result);
        } catch (error) {
          return settlement.reject(error);
        }
      }

      const capabilityDispatch = resolveInputCapabilityDispatch(
        submittedCapability,
        submittedInput,
      );
      const baseRequestMetadata = buildPathReferenceRequestMetadata(
        capabilityDispatch.requestMetadata,
        [...submittedReferences],
      );
      const knowledgeRequestMetadata =
        knowledgePackSelection?.enabled &&
        knowledgePackSelection.packName.trim() &&
        knowledgePackSelection.workingDir.trim()
          ? {
              ...(baseRequestMetadata || {}),
              ...buildKnowledgeRequestMetadata({
                workingDir: knowledgePackSelection.workingDir.trim(),
                packName: knowledgePackSelection.packName.trim(),
                packs: knowledgePackSelection.companionPacks,
                source: "inputbar",
              }),
            }
          : baseRequestMetadata;
      const inputbarModeState = {
        planEnabled: Boolean(activeTools["task_mode"]),
        subagentEnabled: Boolean(activeTools["subagent_mode"]),
      };
      const requestMetadata = knowledgeRequestMetadata;
      const threadGoal =
        activeTools["objective_mode"] && submittedInput.trim()
          ? { objective: submittedInput.trim() }
          : undefined;
      const toolPreferencesOverride =
        buildInputbarToolPreferencesOverride(inputbarModeState);
      const collaborationMode = inputbarModeState.planEnabled
        ? ("plan" as const)
        : undefined;
      const hasPathReferences = submittedReferences.length > 0;
      const textOverride = submittedInput.trim()
        ? submittedInput
        : hasPathReferences
          ? "请查看这些文件或文件夹。"
          : undefined;
      const inputRestoreDraft = {
        ...composerDraft,
        text: submittedInput.trim() ? submittedInput : "",
        ...(composerDraft ? { text: composerDraft.text } : {}),
        images: [...submittedImages],
        pathReferences: [...submittedReferences],
        textElements: composerDraft?.textElements ?? [],
        inputCapabilityRoute: capabilityDispatch.capabilityRoute,
      };
      const sendOptions =
        capabilityDispatch.capabilityRoute ||
        capabilityDispatch.displayContent ||
        requestMetadata ||
        threadGoal ||
        toolPreferencesOverride ||
        collaborationMode ||
        inputMentions.length > 0
          ? {
              ...(capabilityDispatch.capabilityRoute
                ? { capabilityRoute: capabilityDispatch.capabilityRoute }
                : {}),
              inputRestoreDraft,
              ...(inputMentions.length > 0 ? { inputMentions } : {}),
              ...(capabilityDispatch.displayContent || submittedInput.trim()
                ? {
                    displayContent:
                      capabilityDispatch.displayContent ||
                      (submittedInput.trim() ? submittedInput : undefined),
                  }
                : {}),
              ...(requestMetadata ? { requestMetadata } : {}),
              ...(threadGoal ? { threadGoal } : {}),
              ...(toolPreferencesOverride ? { toolPreferencesOverride } : {}),
              ...(collaborationMode ? { collaborationMode } : {}),
            }
          : undefined;

      try {
        const result = await onSend({
          ...captureMetadata,
          images: submittedImages.length > 0 ? [...submittedImages] : undefined,
          textOverride,
          sendOptions,
          ...(composerReceipt?.kind === "accepted"
            ? {
                composerIntent: composerReceipt.intent,
                composerTarget: composerReceipt.target,
                composerDraft,
                composerSubmission,
              }
            : {}),
          ...(triggerMetadata
            ? {
                triggeredAt,
                triggerSource,
              }
            : {}),
        });
        return settlement.finish(result);
      } catch (error) {
        // 发送失败时保留图片与技能，交由上层 toast / 恢复逻辑处理。
        return settlement.reject(error);
      }
    },
    [
      activeCapability,
      activeTools,
      clearActiveCapability,
      composerController,
      composerDraftCoordinator,
      onComposerDraftAccepted,
      clearPendingImages,
      clearPathReferences,
      getInputRestoreEpoch,
      input,
      isLoading,
      knowledgePackSelection,
      onComposerAccepted,
      onComposerCommitted,
      projectId,
      submitTarget,
      sessionId,
      onSend,
      pendingImages,
      pathReferences,
    ],
  );
}
