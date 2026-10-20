import React, { memo, useCallback } from "react";
import { ActionRequestA2UIPreviewCard } from "./ActionRequestA2UIPreviewCard";
import { ApprovalRecordCard } from "./ApprovalRecordCard";
import { DecisionPanel } from "./DecisionPanel";
import { InlineToolProcessStep } from "./InlineToolProcessStep";
import {
  GroupedProcessShell,
  StreamingProcessGroup,
} from "./StreamingProcessGroup";
import {
  coalesceAdjacentThinkingProcessEntries,
  isWebRetrievalToolCall,
  shouldAutoExpandProcessEntries,
  type StreamingProcessEntry,
} from "./StreamingProcessGroupModel";
import { ThinkingBlock } from "./ThinkingBlock";
import type { AgentToolCallState as ToolCallState } from "@/lib/api/agentProtocol";
import type {
  ActionRequired,
  ConfirmResponse,
  SiteSavedContentTarget,
} from "../types";
import type { SearchResultPreviewItem } from "../utils/searchResultPreview";
import { isActionRequestA2UICompatible } from "../utils/actionRequestA2UI";
import { toApprovalRecordFromActionRequired } from "./timeline-utils";

function threadItemIdFromMetadata(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const threadItemId = metadata?.threadItemId;
  return typeof threadItemId === "string" && threadItemId.trim()
    ? threadItemId
    : null;
}

function withThreadItemDomOwner(
  node: React.ReactElement,
  metadata: Record<string, unknown> | undefined,
): React.ReactElement {
  const threadItemId = threadItemIdFromMetadata(metadata);
  if (!threadItemId) {
    return node;
  }
  return (
    <div data-thread-item-id={threadItemId} data-thread-item-source="inline">
      {node}
    </div>
  );
}

interface StreamingProcessRunProps {
  entries: StreamingProcessEntry[];
  forceGroup?: boolean;
  isStreaming: boolean;
  processIsActive: boolean;
  shouldKeepProcessOpenForFinalAnswer: boolean;
  readOnlyActionRequests: boolean;
  onPermissionResponse?: (response: ConfirmResponse) => void;
  onFileClick?: (fileName: string, content: string) => void;
  onOpenSavedSiteContent?: (target: SiteSavedContentTarget) => void;
  onOpenUrlPreview?: (item: SearchResultPreviewItem) => void;
}

export const StreamingProcessRun: React.FC<StreamingProcessRunProps> = memo(
  ({
    entries,
    forceGroup = false,
    isStreaming,
    processIsActive,
    shouldKeepProcessOpenForFinalAnswer,
    readOnlyActionRequests,
    onPermissionResponse,
    onFileClick,
    onOpenSavedSiteContent,
    onOpenUrlPreview,
  }) => {
    const renderActionRequestNode = useCallback(
      (request: ActionRequired) => {
        // Live questions belong to the Composer pending interaction owner.
        if (
          request.actionType === "ask_user" &&
          !readOnlyActionRequests &&
          request.status !== "submitted" &&
          request.status !== "queued"
        ) {
          return null;
        }
        if (request.actionType === "tool_confirmation") {
          if (request.status !== "submitted") {
            return null;
          }
          const approvalRecord = toApprovalRecordFromActionRequired(request);
          return approvalRecord ? (
            <ApprovalRecordCard record={approvalRecord} />
          ) : null;
        }

        const shouldRenderA2UICard =
          isActionRequestA2UICompatible(request) &&
          (readOnlyActionRequests ||
            request.status === "submitted" ||
            request.status === "queued");
        if (shouldRenderA2UICard) {
          return (
            <ActionRequestA2UIPreviewCard
              request={request}
              compact={true}
              context="chat"
            />
          );
        }
        return (
          <DecisionPanel
            request={request}
            onSubmit={onPermissionResponse || (() => {})}
          />
        );
      },
      [onPermissionResponse, readOnlyActionRequests],
    );

    const renderProcessEntry = useCallback(
      (
        entry: StreamingProcessEntry,
        grouped: boolean,
        groupMarker: string,
        processEntries: StreamingProcessEntry[],
      ) => {
        if (entry.kind === "thinking") {
          const preserveThinkingSourceText = entry.preserveSourceText === true;
          const isThinkingStreaming =
            Boolean(entry.isActive ?? isStreaming) &&
            isStreaming &&
            !preserveThinkingSourceText;
          return withThreadItemDomOwner(
            <ThinkingBlock
              key={entry.id}
              content={entry.text}
              defaultExpanded={Boolean(entry.defaultExpanded)}
              grouped={grouped}
              groupMarker={groupMarker}
              hideSummary={grouped}
              isStreaming={isThinkingStreaming}
              preserveSourceText={preserveThinkingSourceText}
              autoCollapseEligible={Boolean(entry.autoCollapseEligible)}
              autoCollapseWhenOverflow={true}
            />,
            entry.metadata,
          );
        }

        if (entry.kind === "tool") {
          const siblingToolCalls = processEntries
            .filter(
              (
                candidate,
              ): candidate is Extract<
                StreamingProcessEntry,
                { kind: "tool" }
              > => candidate.kind === "tool",
            )
            .map((candidate) => candidate.toolCall);
          return withThreadItemDomOwner(
            <InlineToolProcessStep
              key={entry.id}
              toolCall={entry.toolCall}
              isActiveProcess={shouldKeepProcessOpenForFinalAnswer}
              isMessageStreaming={isStreaming}
              onFileClick={onFileClick}
              onOpenSavedSiteContent={onOpenSavedSiteContent}
              onOpenUrlPreview={onOpenUrlPreview}
              urlPreviewToolCalls={siblingToolCalls}
              grouped={grouped}
              groupMarker={groupMarker}
            />,
            entry.metadata,
          );
        }

        const actionNode = renderActionRequestNode(entry.actionRequired);
        if (!grouped) {
          return <React.Fragment key={entry.id}>{actionNode}</React.Fragment>;
        }

        return (
          <GroupedProcessShell key={entry.id} groupMarker={groupMarker}>
            {actionNode}
          </GroupedProcessShell>
        );
      },
      [
        isStreaming,
        onFileClick,
        onOpenSavedSiteContent,
        onOpenUrlPreview,
        renderActionRequestNode,
        shouldKeepProcessOpenForFinalAnswer,
      ],
    );

    if (entries.length === 0) {
      return null;
    }

    const coalescedEntries = coalesceAdjacentThinkingProcessEntries(entries);
    const toolCount = coalescedEntries.filter(
      (entry) => entry.kind === "tool",
    ).length;
    const processEntries = coalescedEntries;
    const toolEntries = processEntries.filter(
      (entry): entry is Extract<StreamingProcessEntry, { kind: "tool" }> =>
        entry.kind === "tool",
    );
    const shouldRenderGroupedTimeline =
      toolEntries.length > 0 &&
      toolEntries.every((entry) => isWebRetrievalToolCall(entry.toolCall));

    if (
      shouldRenderGroupedTimeline &&
      (forceGroup || (toolCount > 0 && processEntries.length > 1))
    ) {
      return (
        <StreamingProcessGroup
          entries={processEntries}
          defaultExpanded={shouldAutoExpandProcessEntries(
            processEntries,
            processIsActive,
          )}
          onOpenUrlPreview={onOpenUrlPreview}
          renderEntry={renderProcessEntry}
        />
      );
    }

    return (
      <>
        {processEntries.map((entry) => (
          <React.Fragment key={entry.id}>
            {renderProcessEntry(entry, false, "•", processEntries)}
          </React.Fragment>
        ))}
      </>
    );
  },
);

StreamingProcessRun.displayName = "StreamingProcessRun";

export type { StreamingProcessEntry, ToolCallState };
