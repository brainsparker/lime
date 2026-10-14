import React from "react";
import type { Message } from "../types";
import { parseLeadingUserCommandTag } from "./messageListUserContentState";
import { CollapsibleUserMessageContent } from "./CollapsibleUserMessageContent";

interface UserContentToggleProps {
  onBeforeToggle?: () => void;
  revealRequestKey?: number;
}

export const UserCommandMessageContent: React.FC<
  {
    content: string;
    route?: Message["inputCapabilityRoute"];
  } & UserContentToggleProps
> = ({ content, route, onBeforeToggle, revealRequestKey }) => {
  const command = parseLeadingUserCommandTag(content, route);
  if (!command) {
    return null;
  }
  const ariaLabel = command.body
    ? `${command.tag} ${command.body}`.trim()
    : command.tag;

  return (
    <div
      data-testid="message-user-command-content"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-7 text-slate-950"
    >
      <span
        data-testid="message-user-command-tag"
        className="inline-flex items-center rounded-[6px] border border-[#c6dadd] bg-[#dcebed] px-1.5 py-[1px] text-[13px] font-semibold leading-5 text-[#2f6f79]"
      >
        {command.tag}
      </span>
      {command.body ? (
        <CollapsibleUserMessageContent
          content={command.body}
          onBeforeToggle={onBeforeToggle}
          revealRequestKey={revealRequestKey}
        >
          <span className="whitespace-pre-wrap">{command.body}</span>
        </CollapsibleUserMessageContent>
      ) : null}
    </div>
  );
};

export const UserInstalledSkillMessageContent: React.FC<
  {
    content: string;
    label: string;
  } & UserContentToggleProps
> = ({ content, label, onBeforeToggle, revealRequestKey }) => (
  <div
    data-testid="message-user-skill-content"
    aria-label={`@ ${label} ${content}`.trim()}
    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-7 text-slate-950"
  >
    <span
      data-testid="message-user-skill-tag"
      className="inline-flex items-center rounded-[6px] border border-sky-200 bg-sky-50 px-1.5 py-[1px] text-[13px] font-semibold leading-5 text-sky-800"
    >
      <span className="mr-1 text-sky-500">@</span>
      {label}
    </span>
    {content.trim() ? (
      <CollapsibleUserMessageContent
        content={content}
        onBeforeToggle={onBeforeToggle}
        revealRequestKey={revealRequestKey}
      >
        <span className="whitespace-pre-wrap">{content}</span>
      </CollapsibleUserMessageContent>
    ) : null}
  </div>
);
