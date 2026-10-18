import { type CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import type { SettingsTabs } from "@/types/settings";
import { APP_SIDEBAR_WIDTH } from "@/components/app-sidebar/AppSidebar.constants";
import { SidebarResizeHandle } from "@/components/app-sidebar/SidebarResizeHandle";
import { useSidebarWidth } from "@/components/app-sidebar/useSidebarWidth";
import { SettingsSidebar } from "./SettingsSidebar";
import type { SettingsSearchResult } from "../settingsSearch";

const Navigation = styled.aside<{ $reserveWindowControls: boolean }>`
  --sidebar-surface: var(--lime-sidebar-surface, hsl(var(--card)));
  --sidebar-foreground: var(--lime-text-strong, hsl(var(--foreground)));
  --sidebar-muted: var(--lime-text-muted, hsl(var(--muted-foreground)));
  --sidebar-divider: var(--lime-sidebar-border, hsl(var(--border)));
  --sidebar-hover: var(--lime-sidebar-hover, hsl(var(--accent)));
  --sidebar-active: var(--lime-sidebar-active, hsl(var(--accent)));
  --sidebar-active-foreground: var(
    --lime-sidebar-active-text,
    hsl(var(--foreground))
  );
  display: flex;
  position: relative;
  flex-direction: column;
  flex-shrink: 0;
  width: clamp(
    240px,
    var(--sidebar-preferred-width, ${APP_SIDEBAR_WIDTH}px),
    min(520px, calc(100vw - 320px))
  );
  min-width: 240px;
  min-height: 0;
  padding-top: 46px;
  border-right: 1px solid var(--sidebar-divider);
  background: var(--sidebar-surface);
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  flex-shrink: 0;
  margin: 0 8px 8px;
  padding: 0 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--sidebar-foreground);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  -webkit-app-region: no-drag;
  &:hover {
    background: var(--sidebar-hover);
  }
  svg {
    width: 16px;
    height: 16px;
  }
`;

interface SettingsNavigationProps {
  activeTab: SettingsTabs;
  reserveWindowControls: boolean;
  onSearchSelect?: (result: SettingsSearchResult) => void;
  searchRequestKey?: number;
  navigationPending?: boolean;
  onTabChange: (tab: SettingsTabs) => void;
  onTabPrefetch: (tab: SettingsTabs) => void;
  onBack: () => void;
}

export function SettingsNavigation({
  activeTab,
  reserveWindowControls,
  onTabChange,
  onTabPrefetch,
  onSearchSelect,
  searchRequestKey,
  navigationPending,
  onBack,
}: SettingsNavigationProps) {
  const { t } = useTranslation("settings");
  const { width, setWidth } = useSidebarWidth();

  return (
    <Navigation
      className="lime-settings-theme-scope"
      $reserveWindowControls={reserveWindowControls}
      style={{ "--sidebar-preferred-width": `${width}px` } as CSSProperties}
      data-testid="settings-navigation"
      data-window-controls-reserved={String(reserveWindowControls)}
    >
      <BackButton
        type="button"
        onClick={onBack}
        aria-label={t("settings.layout.action.back")}
        data-testid="settings-back-button"
      >
        <ArrowLeft />
        {t("settings.layout.action.back")}
      </BackButton>
      <SettingsSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onTabPrefetch={onTabPrefetch}
        onSearchSelect={onSearchSelect}
        searchRequestKey={searchRequestKey}
        navigationPending={navigationPending}
      />
      <SidebarResizeHandle width={width} onWidthChange={setWidth} />
    </Navigation>
  );
}
