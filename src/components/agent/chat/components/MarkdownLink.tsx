import React, { type AnchorHTMLAttributes } from "react";
import type { Element } from "hast";
import {
  interceptHttpExternalLinkClick,
  resolveHttpExternalHref,
} from "@/lib/markdown/externalLinks";
import { isSkillPromptLink } from "../skill-selection/skillPromptLink";
import { SkillPromptLink } from "./SkillPromptLink";

function linkLabel(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : React.isValidElement<{ children?: React.ReactNode }>(child)
          ? linkLabel(child.props.children)
          : "",
    )
    .join("");
}

export function MarkdownLink({
  node,
  itemId,
  href,
  children,
  onClick,
  onAuxClick,
  rel,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  node?: Element;
  itemId?: string;
}) {
  const sourceLabel = node?.properties.dataPromptLinkLabel;
  const label =
    typeof sourceLabel === "string" ? sourceLabel : linkLabel(children);
  const resourceHref = node?.properties.dataPromptLinkHref ?? href;
  if (
    typeof resourceHref === "string" &&
    isSkillPromptLink(resourceHref, label)
  )
    return (
      <SkillPromptLink href={resourceHref} label={label} itemId={itemId} />
    );

  const externalHref = typeof href === "string" ? href : "";
  const linkRel = resolveHttpExternalHref(externalHref)
    ? "noreferrer noopener"
    : rel;
  return (
    <a
      {...props}
      href={href}
      rel={linkRel}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented)
          interceptHttpExternalLinkClick(event, externalHref);
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        if (!event.defaultPrevented)
          interceptHttpExternalLinkClick(event, externalHref);
      }}
    >
      {children}
    </a>
  );
}
