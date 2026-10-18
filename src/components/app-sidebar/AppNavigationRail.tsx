import type { ReactNode } from "react";
import styled from "styled-components";

// D2o: 36px control with 8px horizontal gutters; the rail stays on collapse.
const Rail = styled.nav`
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 0;
  padding: 8px 8px 4px;
  background: transparent;
`;

const Destinations = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
`;

const Footer = styled.div`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

export const NavigationRailButton = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 0;
  border-radius: 10px;
  background: ${({ $active }) =>
    $active ? "var(--sidebar-active)" : "transparent"};
  color: ${({ $active }) =>
    $active ? "var(--sidebar-foreground)" : "var(--sidebar-muted)"};
  cursor: pointer;
  app-region: no-drag;

  &:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-foreground);
  }
  &:focus-visible {
    outline: 2px solid var(--sidebar-active-foreground);
    outline-offset: 1px;
  }
  svg {
    width: 20px;
    height: 20px;
  }
`;

export function AppNavigationRail({
  children,
  footer,
  label,
}: {
  children: ReactNode;
  footer: ReactNode;
  label: string;
}) {
  return (
    <Rail
      aria-label={label}
      data-app-navigation-rail
      data-testid="app-sidebar-rail"
    >
      <Destinations>{children}</Destinations>
      <Footer data-testid="app-sidebar-footer">{footer}</Footer>
    </Rail>
  );
}
