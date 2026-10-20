import { useCallback, useEffect, useMemo, useState } from "react";
import { parseAIResponse } from "@/components/workspace/a2ui/parser";
import type {
  A2UIFormData,
  A2UIResponse,
} from "@/components/workspace/a2ui/types";
import {
  buildProgressiveA2UIStepForm,
  hasMeaningfulProgressiveA2UIAnswers,
  type ProgressiveA2UIStepView,
} from "../utils/progressivePendingA2UI";
import { governActionRequest } from "../utils/actionRequestGovernance";
import { collectCurrentAssistantTail } from "../utils/currentTurnActionRequests";
import type { ActionRequired, Message, PendingA2UISource } from "../types";

interface A2UISubmissionNotice {
  title: string;
  summary: string;
}

interface PendingA2UIResolution {
  form: A2UIResponse;
  source: PendingA2UISource & { kind: "assistant_message" };
}

interface UseWorkspaceA2UIRuntimeParams {
  messages: Message[];
  /** 历史消息只允许在正文里只读回显，不再作为当前可提交表单。 */
  readOnlyInteractiveMessageIds?: ReadonlySet<string>;
  /** approval pending 时输入区归 runtime 授权，不提升 A2UI 表单抢占同一决策区。 */
  suppressPendingA2UI?: boolean;
}

interface PendingA2UIProgressState {
  sourceKey: string;
  stepIndex: number;
  accumulatedFormData: A2UIFormData;
}

type PendingA2UISubmitResolution =
  | {
      status: "advance";
    }
  | {
      status: "empty";
    }
  | {
      status: "submit";
      formData: A2UIFormData;
    };

function getPendingA2UISourceKey(
  resolution: PendingA2UIResolution | null,
): string | null {
  if (!resolution) {
    return null;
  }

  return `${resolution.source.kind}:${resolution.source.messageId}:${resolution.form.id}`;
}

function isSamePendingA2UIResolution(
  previous: PendingA2UIResolution | null,
  next: PendingA2UIResolution,
): boolean {
  if (!previous || previous.source.kind !== next.source.kind) {
    return false;
  }

  return previous.source.messageId === next.source.messageId;
}

function isReadOnlyInteractiveMessage(
  message: Message,
  readOnlyInteractiveMessageIds?: ReadonlySet<string>,
): boolean {
  return Boolean(readOnlyInteractiveMessageIds?.has(message.id));
}

export function useWorkspaceA2UIRuntime({
  messages,
  readOnlyInteractiveMessageIds,
  suppressPendingA2UI = false,
}: UseWorkspaceA2UIRuntimeParams): {
  a2uiSubmissionNotice: A2UISubmissionNotice | null;
  pendingA2UIForm: A2UIResponse | null;
  pendingA2UISource: PendingA2UISource | null;
  pendingActionRequest: ActionRequired | null;
  resolvePendingA2UISubmit: (
    formData: A2UIFormData,
  ) => PendingA2UISubmitResolution;
} {
  const currentAssistantTail = useMemo(
    () => collectCurrentAssistantTail(messages),
    [messages],
  );

  const pendingActionRequest = useMemo<ActionRequired | null>(() => {
    if (suppressPendingA2UI) {
      return null;
    }

    const latestPendingMessage = [...currentAssistantTail]
      .reverse()
      .find(
        (message) =>
          !isReadOnlyInteractiveMessage(
            message,
            readOnlyInteractiveMessageIds,
          ) &&
          message.actionRequests?.some(
            (request) => request.status === "pending",
          ),
      );

    if (!latestPendingMessage?.actionRequests) {
      return null;
    }

    const pendingRequest =
      [...latestPendingMessage.actionRequests]
        .reverse()
        .find((request) => request.status === "pending") || null;

    return pendingRequest ? governActionRequest(pendingRequest) : null;
  }, [
    currentAssistantTail,
    readOnlyInteractiveMessageIds,
    suppressPendingA2UI,
  ]);

  const pendingMessageA2UI = useMemo<PendingA2UIResolution | null>(() => {
    if (suppressPendingA2UI) {
      return null;
    }

    for (let i = currentAssistantTail.length - 1; i >= 0; i -= 1) {
      const message = currentAssistantTail[i];

      if (
        isReadOnlyInteractiveMessage(message, readOnlyInteractiveMessageIds)
      ) {
        continue;
      }

      if (!message.content) {
        continue;
      }

      try {
        const parsed = parseAIResponse(message.content, false);
        if (!parsed.hasA2UI) {
          continue;
        }

        for (let j = parsed.parts.length - 1; j >= 0; j -= 1) {
          const part = parsed.parts[j];
          if (part.type === "a2ui" && typeof part.content !== "string") {
            return {
              form: part.content,
              source: {
                kind: "assistant_message",
                messageId: message.id,
              },
            };
          }
        }
      } catch {
        // 解析失败时忽略，继续向前寻找最近可用表单
      }
    }

    return null;
  }, [
    currentAssistantTail,
    readOnlyInteractiveMessageIds,
    suppressPendingA2UI,
  ]);
  const resolvedPendingA2UI = pendingMessageA2UI;

  const a2uiSubmissionNotice: A2UISubmissionNotice | null = null;

  const [retainedPendingA2UI, setRetainedPendingA2UI] =
    useState<PendingA2UIResolution | null>(resolvedPendingA2UI);

  useEffect(() => {
    if (suppressPendingA2UI) {
      setRetainedPendingA2UI(null);
      return;
    }

    if (resolvedPendingA2UI) {
      setRetainedPendingA2UI((previous) =>
        isSamePendingA2UIResolution(previous, resolvedPendingA2UI)
          ? previous
          : resolvedPendingA2UI,
      );
      return;
    }

    setRetainedPendingA2UI((previous) => {
      if (!previous) {
        return null;
      }

      const source = previous.source;
      const sourceMessageStillExists = currentAssistantTail.some(
        (message) =>
          message.id === source.messageId &&
          !isReadOnlyInteractiveMessage(message, readOnlyInteractiveMessageIds),
      );
      return sourceMessageStillExists ? previous : null;
    });
  }, [
    currentAssistantTail,
    readOnlyInteractiveMessageIds,
    resolvedPendingA2UI,
    suppressPendingA2UI,
  ]);

  const visiblePendingA2UI = resolvedPendingA2UI ?? retainedPendingA2UI ?? null;
  const [pendingA2UIProgressState, setPendingA2UIProgressState] =
    useState<PendingA2UIProgressState | null>(null);

  useEffect(() => {
    const sourceKey = getPendingA2UISourceKey(visiblePendingA2UI);
    if (!sourceKey) {
      setPendingA2UIProgressState(null);
      return;
    }

    setPendingA2UIProgressState((previous) =>
      previous?.sourceKey === sourceKey
        ? previous
        : {
            sourceKey,
            stepIndex: 0,
            accumulatedFormData: {},
          },
    );
  }, [visiblePendingA2UI]);

  const progressivePendingA2UI = useMemo<ProgressiveA2UIStepView | null>(() => {
    if (!visiblePendingA2UI) {
      return null;
    }

    const sourceKey = getPendingA2UISourceKey(visiblePendingA2UI);
    const currentStepIndex =
      sourceKey && pendingA2UIProgressState?.sourceKey === sourceKey
        ? pendingA2UIProgressState.stepIndex
        : 0;

    return buildProgressiveA2UIStepForm(
      visiblePendingA2UI.form,
      currentStepIndex,
    );
  }, [pendingA2UIProgressState, visiblePendingA2UI]);

  const pendingA2UIForm =
    progressivePendingA2UI?.form ?? visiblePendingA2UI?.form ?? null;
  const pendingA2UISource = visiblePendingA2UI?.source ?? null;

  const resolvePendingA2UISubmit = useCallback(
    (formData: A2UIFormData): PendingA2UISubmitResolution => {
      if (!progressivePendingA2UI || !visiblePendingA2UI) {
        return {
          status: "submit",
          formData,
        };
      }

      const sourceKey = getPendingA2UISourceKey(visiblePendingA2UI);
      const accumulatedFormData =
        sourceKey && pendingA2UIProgressState?.sourceKey === sourceKey
          ? pendingA2UIProgressState.accumulatedFormData
          : {};
      const mergedFormData = {
        ...accumulatedFormData,
        ...formData,
      };

      if (
        !hasMeaningfulProgressiveA2UIAnswers(
          progressivePendingA2UI.meta.fieldIds,
          mergedFormData,
        )
      ) {
        return {
          status: "empty",
        };
      }

      if (!progressivePendingA2UI.meta.isFinalStep && sourceKey) {
        setPendingA2UIProgressState({
          sourceKey,
          stepIndex: progressivePendingA2UI.meta.currentStep,
          accumulatedFormData: mergedFormData,
        });
        return {
          status: "advance",
        };
      }

      return {
        status: "submit",
        formData: mergedFormData,
      };
    },
    [pendingA2UIProgressState, progressivePendingA2UI, visiblePendingA2UI],
  );

  return {
    a2uiSubmissionNotice,
    pendingA2UIForm,
    pendingA2UISource,
    pendingActionRequest,
    resolvePendingA2UISubmit,
  };
}
