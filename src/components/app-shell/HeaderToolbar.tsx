import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import styled from "styled-components";
import { cn } from "@/lib/utils";

type ToolbarInset = boolean | "page" | "tab-strip" | "tab-strip-flush-start";

const ToolbarRoot = styled.div<{ $inset: ToolbarInset; $size: "header" | "pane" }>`
  container: app-shell-header-toolbar / inline-size;
  height: ${({ $size }) =>
    $size === "pane" ? "var(--height-toolbar-pane, 40px)" : "100%"};
  user-select: none;
  -webkit-app-region: drag;
  padding-inline: ${({ $inset }) => ($inset === true ? "8px" : "0")};

  ${({ $inset }) =>
    $inset === "page" &&
    `max-width: calc(var(--thread-content-max-width, 48rem) - 16px);
     padding-inline: calc(var(--padding-panel, 20px) - 8px);
     margin-inline: auto;`}
  ${({ $inset }) =>
    ($inset === "tab-strip" || $inset === "tab-strip-flush-start") &&
    `padding-inline-start: 8px; padding-inline-end: 6px;`}
  ${({ $inset }) =>
    $inset === "tab-strip-flush-start" &&
    `@media (min-width: 768px) {
       [data-app-shell-feature-navigation=true][data-app-shell-responsive-sidebar=true][data-app-shell-sidebar-open=false] & {
         padding-inline-start: 0;
       }
     }`}

  [data-app-shell-page-surface=true] [data-app-shell-page-header] & {
    ${({ $inset }) => $inset === true && "padding-inline: 0;"}
  }
  button,
  [data-app-shell-application-menu-bar=true] & {
    -webkit-app-region: no-drag;
  }
  [data-app-shell-workspace-layout=split] &,
  [data-app-shell-titlebar] & {
    -webkit-app-region: initial;
  }
`;

const SecondaryActions = styled.div`
  display: none;
  @container app-shell-header-toolbar (min-width: 42rem) {
    display: contents;
  }
`;

function Actions({
  className,
  compact = false,
  secondary,
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  compact?: boolean;
  secondary?: ReactNode;
}) {
  return (
    <div
      {...props}
      className={cn(
        "ms-auto flex shrink-0 items-center justify-end",
        compact ? "gap-px" : "gap-1.5",
        className,
      )}
    >
      {secondary == null ? null : (
        <SecondaryActions>{secondary}</SecondaryActions>
      )}
      {children}
    </div>
  );
}

function Toolbar({
  size = "header",
  inset = true,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  size?: "header" | "pane";
  inset?: ToolbarInset;
}) {
  return (
    <ToolbarRoot
      {...props}
      $inset={inset}
      $size={size}
      data-app-shell-header-toolbar
      data-size={size}
      data-inset={inset}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-2",
        className,
      )}
    />
  );
}

export const HeaderToolbar = Object.assign(Toolbar, { Actions });

export function HeaderToolbarActionMount({
  container,
  destination,
}: {
  container: HTMLElement;
  destination?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = destination === undefined ? ref.current : destination;
    if (!host) return;
    host.appendChild(container);
    return () => {
      if (container.parentNode === host) host.removeChild(container);
    };
  }, [container, destination]);
  return destination === undefined ? (
    <div ref={ref} className="contents" />
  ) : null;
}
