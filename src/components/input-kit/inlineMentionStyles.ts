import { css } from "styled-components";

export const inlineMentionStyles = css`
  display: inline;
  padding: 0;
  font-family: inherit;
  font-weight: 500;
  color: color-mix(
    in srgb,
    var(--lime-info, var(--info)) 80%,
    hsl(var(--foreground)) 20%
  );
  white-space: nowrap;
  &[role="button"] {
    cursor: pointer;
  }
  &[role="button"]:hover [data-mention-label] {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
    border-radius: 2px;
  }
  [data-mention-icon-container] {
    position: relative;
    display: inline-block;
    box-sizing: content-box;
    height: 1lh;
    padding-inline-end: 3px;
    vertical-align: bottom;
  }
  [data-mention-icon] {
    position: relative;
    display: block;
    top: 50%;
    width: 16px;
    height: 16px;
    transform: translateY(-50%);
  }
  [data-mention-label] {
    min-width: 0;
    white-space: normal;
    overflow-wrap: break-word;
  }
`;
