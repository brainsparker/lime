import { useContext, useEffect } from "react";
import styled from "styled-components";
import { inlineMentionStyles } from "@/components/input-kit/inlineMentionStyles";
import { skillMentionIconPath } from "@/components/input-kit/composerMention";
import {
  isAbsoluteSkillDefinition,
  resolveSkillPromptLink,
} from "../skill-selection/skillPromptLink";
import { PromptLinkContext } from "./promptLinkContext";

const Mention = styled.span`
  ${inlineMentionStyles}
`;

export function SkillPromptLink({
  href,
  label,
  itemId,
}: {
  href: string;
  label: string;
  itemId?: string;
}) {
  const scope = useContext(PromptLinkContext);
  const requestSkills = scope?.requestSkills;
  useEffect(() => requestSkills?.(), [requestSkills]);
  const resolved = resolveSkillPromptLink(label, href, scope?.skills ?? []);
  const path = resolved.path;
  const interactive = Boolean(
    !scope?.loading &&
    scope?.openSkill &&
    itemId &&
    path &&
    isAbsoluteSkillDefinition(path),
  );
  const open = () => {
    if (interactive && path && itemId) scope?.openSkill?.(path, itemId);
  };
  return (
    <Mention
      data-appearance="inline-mention"
      data-layout="inline-flow"
      data-font-weight="medium"
      data-tone="accent"
      data-prompt-link-href={href}
      data-prompt-link-label={label}
      data-inline-mention-interactive={interactive ? "" : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={resolved.tooltip}
      onClick={interactive ? open : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                open();
              } else if (event.key === " ") event.preventDefault();
            }
          : undefined
      }
      onKeyUp={
        interactive
          ? (event) => {
              if (event.key === " ") {
                event.preventDefault();
                open();
              }
            }
          : undefined
      }
    >
      <span data-mention-icon-container="" aria-hidden="true">
        <svg
          data-mention-icon=""
          width={16}
          height={16}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path d={skillMentionIconPath} fill="currentColor" />
        </svg>
      </span>
      <span data-mention-label="">{resolved.displayLabel}</span>
    </Mention>
  );
}
