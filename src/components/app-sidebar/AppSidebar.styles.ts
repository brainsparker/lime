import styled from "styled-components";
import {
  APP_SIDEBAR_WIDTH,
  APP_SIDEBAR_MIN_WIDTH,
  APP_SIDEBAR_MAX_WIDTH,
} from "./AppSidebar.constants";

export const Container = styled.aside<{
  $collapsed?: boolean;
  $themeMode: "light" | "dark";
}>`
  --sidebar-surface-top: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#15202b"
      : "var(--lime-sidebar-surface-top, #f6fbf4)"};
  --sidebar-surface-middle: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#17232d"
      : "var(--lime-sidebar-surface-middle, #f9fcf6)"};
  --sidebar-surface-bottom: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#1a2530"
      : "var(--lime-sidebar-surface-bottom, #fbfff5)"};
  --sidebar-surface: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#17232d" : "var(--lime-sidebar-surface, #f8f8f6)"};
  --sidebar-foreground: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#eef4f7" : "var(--lime-text, #1a3b2b)"};
  --sidebar-muted: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#a1afbd" : "var(--lime-text-muted, #6b826b)"};
  --sidebar-border: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#2d3a46" : "var(--lime-sidebar-border, #e2f0e2)"};
  --sidebar-card-border: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "rgba(55, 68, 81, 0.76)"
      : "var(--lime-sidebar-card-border, var(--lime-sidebar-border, #e2f0e2))"};
  --sidebar-divider: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "rgba(148, 163, 184, 0.14)"
      : "var(--lime-sidebar-divider, rgba(132, 204, 22, 0.15))"};
  --sidebar-hover: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#22303c" : "var(--lime-sidebar-hover, #eef7ee)"};
  --sidebar-active: ${({ $themeMode }) =>
    $themeMode === "dark" ? "#2a3e3b" : "var(--lime-sidebar-active, #e6f8ea)"};
  --sidebar-active-foreground: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#dff4ea"
      : "var(--lime-sidebar-active-text, #166534)"};
  --sidebar-search-bg: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#1f2b36"
      : "var(--lime-sidebar-search-bg, #fcfff9)"};
  --sidebar-search-hover: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#24313d"
      : "var(--lime-sidebar-search-hover, #f4fdf4)"};
  --sidebar-search-border-hover: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "#3a4a57"
      : "var(--lime-sidebar-search-border-hover, #bbf7d0)"};
  --sidebar-card-surface: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "linear-gradient(180deg, rgba(24, 34, 44, 0.96) 0%, rgba(19, 29, 38, 0.98) 100%)"
      : "var(--lime-sidebar-card-surface, linear-gradient(180deg, rgba(255, 255, 255, 0.76) 0%, rgba(249, 252, 246, 0.94) 100%))"};
  --sidebar-card-shadow: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "0 18px 34px -28px rgba(2, 8, 23, 0.7)"
      : "var(--lime-sidebar-card-shadow, 0 14px 28px -26px rgba(15, 23, 42, 0.32))"};
  --sidebar-card-highlight: ${({ $themeMode }) =>
    $themeMode === "dark"
      ? "rgba(255, 255, 255, 0.08)"
      : "var(--lime-sidebar-card-highlight, rgba(255, 255, 255, 0.72))"};
  display: flex;
  width: ${({ $collapsed }) =>
    $collapsed
      ? "52px"
      : `clamp(${APP_SIDEBAR_MIN_WIDTH}px, var(--sidebar-preferred-width, ${APP_SIDEBAR_WIDTH}px), min(${APP_SIDEBAR_MAX_WIDTH}px, calc(100vw - 320px)))`};
  min-width: ${({ $collapsed }) =>
    $collapsed ? "52px" : `${APP_SIDEBAR_MIN_WIDTH}px`};
  flex-shrink: 0;
  height: calc(100vh - 48px);
  margin-top: 44px;
  position: relative;
  isolation: isolate;
  z-index: 20;
  background: var(--sidebar-surface);
  border-right: none;
  transition:
    width 180ms ease,
    min-width 180ms ease,
    border-color 180ms ease;
`;

export const SidebarSurface = styled.div<{ $collapsed?: boolean }>`
  flex: 1;
  width: 0;
  display: ${({ $collapsed }) => ($collapsed ? "none" : "flex")};
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 8px 8px")};
  overflow: hidden;
  background: var(--sidebar-surface);
`;

export const HeaderArea = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 4px;
`;

export const HeaderTopRow = styled.div<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  ${({ $collapsed }) =>
    $collapsed
      ? `
        flex-direction: column;
      `
      : ""}
`;

export const UserButton = styled.button<{ $collapsed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  width: ${({ $collapsed }) => ($collapsed ? "38px" : "100%")};
  min-width: 0;
  flex: ${({ $collapsed }) => ($collapsed ? "0 0 auto" : "1 1 auto")};
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: ${({ $collapsed }) => ($collapsed ? "8px" : "5px 7px")};
  cursor: pointer;
  color: var(--sidebar-foreground);
  justify-content: ${({ $collapsed }) =>
    $collapsed ? "center" : "flex-start"};
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &:hover {
    background: var(--sidebar-hover);
  }
`;

export const UserName = styled.div<{ $collapsed?: boolean }>`
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: ${({ $collapsed }) => ($collapsed ? "none" : "block")};
`;

export const SearchButton = styled.button<{
  $collapsed?: boolean;
  $inline?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: ${({ $inline }) => ($inline ? "26px" : "100%")};
  flex-shrink: 0;
  height: 30px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--sidebar-muted);
  padding: ${({ $inline }) => ($inline ? "0" : "0 8px")};
  cursor: pointer;
  justify-content: ${({ $inline }) => ($inline ? "center" : "flex-start")};
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
  box-shadow: none;

  &:hover {
    border-color: ${({ $inline }) =>
      $inline ? "transparent" : "var(--sidebar-search-border-hover)"};
    background: var(--sidebar-search-hover);
    color: var(--sidebar-foreground);
  }

  span {
    display: ${({ $inline }) => ($inline ? "none" : "inline")};
    font-size: 14px;
    font-weight: 400;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
`;

export const SidebarSearchSurface = styled.div`
  display: flex;
  min-height: min(620px, calc(100vh - 96px));
  max-height: calc(100vh - 96px);
  flex-direction: column;
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid var(--lime-card-subtle-border, rgba(226, 240, 226, 0.9));
  background: var(--lime-surface, #ffffff);
  color: var(--lime-text, #1a3b2b);
  box-shadow:
    0 32px 80px rgba(15, 23, 42, 0.18),
    0 1px 0 rgba(255, 255, 255, 0.78) inset;
`;

export const SidebarSearchHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 26px 18px;
  color: var(--lime-text-muted, #6b826b);

  svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }
`;

export const SidebarSearchInput = styled.input`
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  color: var(--lime-text-strong, #0f172a);
  font-size: 19px;
  font-weight: 650;
  outline: none;

  &::placeholder {
    color: var(--lime-text-soft, #9aa89a);
    font-weight: 600;
  }
`;

export const SidebarSearchShortcut = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

export const SidebarSearchKey = styled.kbd`
  min-width: 28px;
  height: 28px;
  border-radius: 9px;
  border: 1px solid var(--lime-card-subtle-border, rgba(226, 240, 226, 0.86));
  background: var(--lime-muted-surface, #f5f8f3);
  color: var(--lime-text-muted, #6b826b);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
`;

export const SidebarSearchCloseButton = styled.button`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--lime-text-muted, #6b826b);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: var(--lime-surface-hover, #f4fdf4);
    color: var(--lime-text-strong, #0f172a);
  }

  svg {
    width: 22px;
    height: 22px;
  }
`;

export const SidebarSearchDivider = styled.div`
  height: 1px;
  margin: 0 26px;
  background: var(--lime-divider-subtle, rgba(226, 240, 226, 0.86));
`;

export const SidebarSearchBody = styled.div`
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 20px 26px 28px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: var(--lime-divider-strong, rgba(180, 196, 180, 0.7));
  }
`;

export const SidebarSearchCreateButton = styled.button`
  min-height: 58px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 18px;
  background: var(--lime-surface-hover, #f4f7f2);
  color: var(--lime-text-strong, #0f172a);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: var(--lime-card-subtle-border, #bbf7d0);
    background: var(--lime-surface, #ffffff);
    transform: translateY(-1px);
  }

  svg {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    color: var(--lime-text-muted, #6b826b);
  }
`;

export const SidebarSearchCreateText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 760;
`;

export const SidebarSearchEnterHint = styled.span`
  flex-shrink: 0;
  color: var(--lime-text-soft, #9aa89a);
  font-size: 20px;
  font-weight: 800;
`;

export const SidebarSearchSectionLabel = styled.div`
  padding: 0 16px;
  color: var(--lime-text-soft, #9aa89a);
  font-size: 13px;
  font-weight: 760;
`;

export const SidebarSearchResultList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const SidebarSearchResultButton = styled.button<{ $active?: boolean }>`
  width: 100%;
  min-height: 54px;
  border: 1px solid
    ${({ $active }) =>
      $active ? "var(--lime-card-subtle-border, #bbf7d0)" : "transparent"};
  border-radius: 16px;
  background: ${({ $active }) =>
    $active ? "var(--lime-surface-hover, #f4fdf4)" : "transparent"};
  color: var(--lime-text, #1a3b2b);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    border-color: var(--lime-card-subtle-border, rgba(187, 247, 208, 0.92));
    background: var(--lime-surface-hover, #f4fdf4);
    color: var(--lime-text-strong, #0f172a);
  }

  &:disabled {
    cursor: default;
    opacity: 0.58;
  }

  &:disabled:hover {
    border-color: transparent;
    background: transparent;
    color: var(--lime-text, #1a3b2b);
  }

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: var(--lime-text-muted, #6b826b);
  }
`;

export const SidebarSearchResultTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 700;
`;

export const SidebarSearchResultMeta = styled.span`
  flex-shrink: 0;
  color: var(--lime-text-soft, #9aa89a);
  font-size: 14px;
  font-weight: 650;
`;

export const SidebarSearchEmptyState = styled.div`
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  border: 1px dashed var(--lime-card-subtle-border, rgba(226, 240, 226, 0.9));
  color: var(--lime-text-muted, #6b826b);
  background: var(--lime-muted-surface, #f8faf7);
  font-size: 14px;
  font-weight: 680;
`;

export const SidebarSearchMoreButton = styled.button`
  min-height: 42px;
  border: 1px solid var(--lime-card-subtle-border, rgba(226, 240, 226, 0.86));
  border-radius: 14px;
  background: var(--lime-surface, #ffffff);
  color: var(--lime-text-muted, #6b826b);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 760;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover:not(:disabled) {
    border-color: var(--lime-card-subtle-border, #bbf7d0);
    background: var(--lime-surface-hover, #f4fdf4);
    color: var(--lime-text-strong, #0f172a);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

export const MenuScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--sidebar-border);
    border-radius: 9999px;
  }
`;

export const MainNavList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
`;

export const NavButton = styled.button<{
  $active?: boolean;
  $collapsed?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ $collapsed }) => ($collapsed ? "0" : "10px")};
  width: 100%;
  height: ${({ $collapsed }) => ($collapsed ? "40px" : "30px")};
  border: none;
  border-radius: 10px;
  padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 8px")};
  position: relative;
  background: ${({ $active }) =>
    $active ? "var(--sidebar-active)" : "transparent"};
  color: ${({ $active }) =>
    $active
      ? "var(--sidebar-active-foreground)"
      : "var(--sidebar-muted, var(--lime-text-muted, hsl(var(--muted-foreground))))"};
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
  justify-content: ${({ $collapsed }) =>
    $collapsed ? "center" : "flex-start"};
  box-shadow: none;

  &:hover {
    background: ${({ $active }) =>
      $active ? "var(--sidebar-active)" : "var(--sidebar-hover)"};
    color: ${({ $active }) =>
      $active
        ? "var(--sidebar-active-foreground)"
        : "var(--sidebar-foreground)"};
  }

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    opacity: ${({ $active }) => ($active ? 1 : 0.92)};
  }
`;

export const NavLabel = styled.span<{ $collapsed?: boolean }>`
  flex: 1;
  text-align: left;
  font-size: 13px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: ${({ $collapsed }) => ($collapsed ? "none" : "inline")};
`;

export const FooterAppearanceActionSlot = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const IconActionButton = styled.button<{ $active?: boolean }>`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${({ $active }) =>
    $active ? "var(--sidebar-active)" : "transparent"};
  color: ${({ $active }) =>
    $active
      ? "var(--sidebar-active-foreground)"
      : "var(--sidebar-muted, var(--lime-text-muted, hsl(var(--muted-foreground))))"};
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &:hover {
    background: ${({ $active }) =>
      $active ? "var(--sidebar-active)" : "var(--sidebar-hover)"};
    color: ${({ $active }) =>
      $active
        ? "var(--sidebar-active-foreground)"
        : "var(--sidebar-foreground)"};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const AppearancePopover = styled.div`
  position: absolute;
  left: calc(100% + 12px);
  bottom: -2px;
  z-index: 70;
  width: 252px;
  max-width: min(252px, calc(100vw - 24px));
  max-height: min(560px, calc(100vh - 24px));
  overflow-y: auto;
  border-radius: 18px;
  border: 1px solid var(--lime-card-subtle-border, rgba(226, 240, 226, 0.92));
  background: var(--lime-card-subtle, var(--lime-surface, #ffffff));
  box-shadow:
    0 20px 40px -32px rgba(15, 23, 42, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  color: var(--lime-text, #1a3b2b);
  padding: 9px;
  transform-origin: left bottom;
  animation: appearancePopoverIn 150ms ease-out both;

  &::after {
    content: "";
    position: absolute;
    left: -5px;
    bottom: 15px;
    border-left: 1px solid var(--lime-surface-border, rgba(226, 240, 226, 0.92));
    border-bottom: 1px solid
      var(--lime-surface-border, rgba(226, 240, 226, 0.92));
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    background: var(--lime-card-subtle, var(--lime-surface, #ffffff));
  }

  @keyframes appearancePopoverIn {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 760px) {
    left: auto;
    right: 0;
    bottom: calc(100% + 10px);
    transform-origin: right bottom;

    &::after {
      left: auto;
      right: 13px;
      bottom: -5px;
      border-left: none;
      border-right: 1px solid
        var(--lime-surface-border, rgba(226, 240, 226, 0.92));
    }
  }
`;

export const AppearancePopoverHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 8px;
`;

export const AppearancePopoverTitle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--lime-text-strong, #0f172a);

  svg {
    width: 15px;
    height: 15px;
    color: var(--lime-brand-strong, #166534);
  }
`;

export const AppearancePopoverSummary = styled.div`
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  color: var(--lime-text-muted, #6b826b);
`;

export const AppearanceGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 7px 0;
  border-top: 1px solid var(--lime-divider-subtle, rgba(226, 240, 226, 0.82));
`;

export const AppearanceGroupLabel = styled.div`
  padding: 0 2px;
  font-size: 11px;
  font-weight: 700;
  color: var(--lime-text-muted, #6b826b);
`;

export const ThemeModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
`;

export const ThemeModeButton = styled.button<{ $active?: boolean }>`
  min-width: 0;
  border-radius: 13px;
  border: 1px solid
    ${({ $active }) =>
      $active
        ? "var(--lime-card-subtle-border, #bbf7d0)"
        : "var(--lime-card-subtle-border, rgba(226, 240, 226, 0.82))"};
  background: ${({ $active }) =>
    $active
      ? "var(--lime-chrome-tab-active-surface, var(--lime-surface, #ffffff))"
      : "var(--lime-surface, #ffffff)"};
  color: ${({ $active }) =>
    $active
      ? "var(--lime-text-strong, #0f172a)"
      : "var(--lime-text-muted, #6b826b)"};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 6px;
  font-size: 11px;
  font-weight: 700;
  box-shadow: ${({ $active }) =>
    $active ? "0 10px 22px -20px var(--lime-shadow-color)" : "none"};
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: var(--lime-card-subtle-border, #bbf7d0);
    background: var(
      --lime-chrome-tab-hover,
      var(--lime-surface-hover, #f4fdf4)
    );
    color: var(--lime-text-strong, #0f172a);
  }

  svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }
`;

export const ColorSchemeList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
`;

export const RandomColorSchemeButton = styled.button`
  grid-column: 1 / -1;
  min-height: 40px;
  border-radius: 13px;
  border: 1px solid var(--lime-card-subtle-border, rgba(226, 240, 226, 0.82));
  background: var(--lime-surface, #ffffff);
  color: var(--lime-text, #1a3b2b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 750;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease;

  &:hover {
    border-color: var(--lime-card-subtle-border, #bbf7d0);
    background: var(
      --lime-chrome-tab-hover,
      var(--lime-surface-hover, #f4fdf4)
    );
    color: var(--lime-text-strong, #0f172a);
  }

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--lime-brand-strong, #166534);
  }
`;

export const ColorSchemeButton = styled.button<{ $active?: boolean }>`
  display: flex;
  position: relative;
  min-height: 58px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 5px;
  width: 100%;
  min-width: 0;
  border-radius: 13px;
  border: 1px solid
    ${({ $active }) =>
      $active
        ? "var(--lime-card-subtle-border, #bbf7d0)"
        : "var(--lime-card-subtle-border, rgba(226, 240, 226, 0.82))"};
  background: ${({ $active }) =>
    $active
      ? "var(--lime-chrome-tab-active-surface, var(--lime-surface, #ffffff))"
      : "var(--lime-surface, #ffffff)"};
  color: var(--lime-text, #1a3b2b);
  cursor: pointer;
  padding: 7px;
  text-align: left;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    border-color: var(--lime-card-subtle-border, #bbf7d0);
    background: var(
      --lime-chrome-tab-hover,
      var(--lime-surface-hover, #f4fdf4)
    );
  }
`;

export const ColorSchemeSwatches = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  overflow: hidden;
  width: 42px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 0 0 1px var(--lime-surface-border, rgba(226, 240, 226, 0.82));

  span {
    flex: 1;
  }
`;

export const ColorSchemeText = styled.span`
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;

export const ColorSchemeLabel = styled.span`
  min-width: 0;
  max-width: calc(100% - 22px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: var(--lime-text-strong, #0f172a);
`;

export const ColorSchemeCheck = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--lime-brand-strong, #166534);
  opacity: ${({ $active }) => ($active ? 1 : 0)};

  svg {
    width: 13px;
    height: 13px;
  }
`;
