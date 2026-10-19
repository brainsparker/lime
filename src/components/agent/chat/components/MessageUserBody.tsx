import React from "react";
import type { A2UIFormData } from "@/components/workspace/a2ui/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { RuntimePeerMessageCards } from "./RuntimePeerMessageCards";
import { CollapsibleUserMessageContent } from "./CollapsibleUserMessageContent";
import { UserCommandMessageContent } from "./MessageListUserContent";
import type { Message } from "../types";

interface MessageUserBodyProps {
  content: string;
  isUserCommandMessage: boolean;
  message: Message;
  onA2UISubmit?: (formData: A2UIFormData, messageId: string) => void;
  onBeforeToggle?: () => void;
  rawRuntimePeerContent: string;
  renderA2UIInline: boolean;
  revealRequestKey?: number;
  shouldRenderRuntimePeerCards: boolean;
}

export function MessageUserBody({
  content,
  isUserCommandMessage,
  message,
  onA2UISubmit,
  onBeforeToggle,
  rawRuntimePeerContent,
  renderA2UIInline,
  revealRequestKey,
  shouldRenderRuntimePeerCards,
}: MessageUserBodyProps) {
  if (!content) {
    return null;
  }

  if (isUserCommandMessage) {
    return (
      <UserCommandMessageContent
        content={content}
        route={message.inputCapabilityRoute}
        onBeforeToggle={onBeforeToggle}
        revealRequestKey={revealRequestKey}
      />
    );
  }

  if (shouldRenderRuntimePeerCards) {
    return <RuntimePeerMessageCards text={rawRuntimePeerContent} />;
  }

  return (
    <CollapsibleUserMessageContent
      content={content}
      onBeforeToggle={onBeforeToggle}
      revealRequestKey={revealRequestKey}
    >
      <MarkdownRenderer
        content={content}
        onA2UISubmit={
          onA2UISubmit
            ? (formData) => onA2UISubmit(formData, message.id)
            : undefined
        }
        renderA2UIInline={renderA2UIInline}
      />
    </CollapsibleUserMessageContent>
  );
}
