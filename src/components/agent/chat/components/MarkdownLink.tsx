import React, { useContext, type AnchorHTMLAttributes } from "react";
import type { Element } from "hast";
import {
  interceptHttpExternalLinkClick,
  resolveHttpExternalHref,
} from "@/lib/markdown/externalLinks";
import { isSkillPromptLink } from "../skill-selection/skillPromptLink";
import { SkillPromptLink } from "./SkillPromptLink";
import { LinkOpeningContext } from "./LinkOpeningContext";

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
  const openLink = useContext(LinkOpeningContext);
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
  const httpHref = resolveHttpExternalHref(externalHref);
  const linkRel = httpHref ? "noreferrer noopener" : rel;
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      (event.button !== 0 && event.button !== 1) ||
      !httpHref
    )
      return;
    if (openLink) {
      event.preventDefault();
      openLink(httpHref, event);
    } else interceptHttpExternalLinkClick(event, httpHref);
  };
  return (
    <a
      {...props}
      href={href}
      rel={linkRel}
      onClick={(event) => {
        onClick?.(event);
        open(event);
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        open(event);
      }}
    >
      {children}
    </a>
  );
}
