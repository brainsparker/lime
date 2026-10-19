import React from "react";
import { Check, Copy, Quote, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MessageActions } from "../styles";

interface MessageActionButtonsProps {
  actionContent: string;
  canCopyMessage: boolean;
  canQuoteMessage: boolean;
  canSaveMessageAsSkill: boolean;
  copied: boolean;
  isImageWorkbenchMessage: boolean;
  messageId: string;
  onCopy?: (content: string, messageId: string) => void;
  onQuoteMessage?: (content: string, messageId: string) => void;
  onSaveMessageAsSkill?: (source: {
    messageId: string;
    content: string;
  }) => void;
}

export function MessageActionButtons({
  actionContent,
  canCopyMessage,
  canQuoteMessage,

  canSaveMessageAsSkill,
  copied,
  isImageWorkbenchMessage,

  messageId,
  onCopy,
  onQuoteMessage,

  onSaveMessageAsSkill,
}: MessageActionButtonsProps) {
  const { t } = useTranslation("agent");

  return (
    <MessageActions
      className={[
        "message-actions",
        isImageWorkbenchMessage ? "image-workbench-message-actions" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="message-actions"
    >
      {canQuoteMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full border border-slate-200/90 bg-white/92 text-slate-400 shadow-sm shadow-slate-950/5 hover:bg-slate-50 hover:text-slate-700"
          onClick={() => onQuoteMessage?.(actionContent, messageId)}
          aria-label={t("agentChat.messageList.actions.quote")}
          title={t("agentChat.messageList.actions.quote")}
        >
          <Quote size={12} />
        </Button>
      ) : null}
      {canCopyMessage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full border border-slate-200/90 bg-white/92 text-slate-400 shadow-sm shadow-slate-950/5 hover:bg-slate-50 hover:text-slate-700"
          onClick={() => onCopy?.(actionContent, messageId)}
          aria-label={t("agentChat.messageList.actions.copy")}
          title={t("agentChat.messageList.actions.copy")}
        >
          {copied ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
        </Button>
      ) : null}
      {canSaveMessageAsSkill ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full border border-emerald-200/90 bg-emerald-50/92 text-emerald-600 shadow-sm shadow-emerald-950/5 hover:bg-emerald-100 hover:text-emerald-700"
          onClick={() =>
            onSaveMessageAsSkill?.({
              messageId,
              content: actionContent,
            })
          }
          aria-label={t("agentChat.messageList.actions.saveAsSkill")}
          title={t("agentChat.messageList.actions.saveAsSkill")}
        >
          <Sparkles size={12} />
        </Button>
      ) : null}
    </MessageActions>
  );
}
