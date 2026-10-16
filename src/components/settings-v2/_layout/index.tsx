/**
 * 设置页面主布局组件
 *
 * 采用左侧边栏 + 右侧内容的布局
 * 参考成熟产品的设置布局设计
 */

import {
  Suspense,
  type ReactNode,
  useEffect,
  useRef,
  useCallback,
} from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { SettingsNavigation } from "./SettingsNavigation";
import { SettingsTabs } from "@/types/settings";
import { Page, PageParams, type SettingsPageParams } from "@/types/page";
import { buildHomeAgentParams } from "@/lib/workspace/navigation";
import { shouldReserveMacWindowControls } from "@/lib/windowControls";
import { isSettingsSection, resolveSettingsSection } from "../sections";
import { SettingsHomePage } from "../home";
import type { NavigationGuard } from "@/lib/navigationGuard";
import { SettingsNavigationGuard } from "./SettingsNavigationGuard";

const LayoutContainer = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  background: var(--lime-app-bg, hsl(var(--background)));
`;

const ContentContainer = styled.main<{ $reserveWindowControls: boolean }>`
  flex: 1;
  min-width: 0;
  position: relative;
  isolation: isolate;
  overflow-y: auto;
  padding: ${({ $reserveWindowControls }) =>
    $reserveWindowControls ? "48px 32px 24px" : "24px 32px"};
  background: var(
    --lime-stage-surface-soft,
    linear-gradient(
      180deg,
      rgba(248, 250, 252, 0.96) 0%,
      rgba(244, 249, 247, 0.92) 100%
    )
  );

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: hsl(var(--border));
    border-radius: 3px;
  }

  @media (max-width: 1200px) {
    padding: 20px;
  }

  @media (max-width: 640px) {
    padding: 16px 12px 24px;
  }
`;

const ContentWrapper = styled.div<{ $wide: boolean }>`
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  max-width: ${({ $wide }) => ($wide ? "1440px" : "800px")};
`;

const ContentAtmosphere = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(
      circle at 8% 0%,
      var(--lime-home-glow-primary, rgba(16, 185, 129, 0.1)) 0%,
      rgba(16, 185, 129, 0) 34%
    ),
    radial-gradient(
      circle at 92% 4%,
      var(--lime-home-glow-secondary, rgba(56, 189, 248, 0.1)) 0%,
      rgba(56, 189, 248, 0) 30%
    );

  @media (max-width: 640px) {
    background:
      radial-gradient(
        circle at 10% 0%,
        var(--lime-home-glow-primary, rgba(16, 185, 129, 0.08)) 0%,
        rgba(16, 185, 129, 0) 36%
      ),
      radial-gradient(
        circle at 92% 2%,
        var(--lime-home-glow-secondary, rgba(56, 189, 248, 0.08)) 0%,
        rgba(56, 189, 248, 0) 32%
      );
  }
`;

const LoadingPanel = styled.div`
  border: 1px solid hsl(var(--border));
  border-radius: 20px;
  background: hsl(var(--card));
  padding: 18px 20px;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 1.6;
`;

function SettingsContentFallback({ label }: { label: string }) {
  return (
    <LoadingPanel
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="settings-page-loading"
    >
      {label}
    </LoadingPanel>
  );
}

function withSettingsContentFallback(
  node: ReactNode,
  label: string,
): ReactNode {
  return (
    <Suspense fallback={<SettingsContentFallback label={label} />}>
      {node}
    </Suspense>
  );
}

function renderSettingsContent(
  tab: SettingsTabs,
  onTabChange: (tab: SettingsTabs) => void,
  t: TFunction<"settings", undefined>,
  onTabPrefetch?: (tab: SettingsTabs) => void,
  onNavigate?: (page: Page, params?: PageParams) => void,
  params: SettingsPageParams = {},
): ReactNode {
  const section = resolveSettingsSection(tab);
  const content = section.render({
    renderHome: () => (
      <SettingsHomePage
        onTabChange={onTabChange}
        onTabPrefetch={onTabPrefetch}
        onNavigate={onNavigate}
      />
    ),
    providerView:
      tab === SettingsTabs.Providers
        ? (params.providerView ??
          (params.providerFocus ? "settings" : undefined))
        : undefined,
    providerFocus:
      tab === SettingsTabs.Providers ? params.providerFocus : undefined,
    executionPolicyFocus:
      tab === SettingsTabs.ExecutionPolicy
        ? params.executionPolicyFocus
        : undefined,
    developerLabTab:
      params.tab === SettingsTabs.Experimental ? "experimental" : "developer",
  });
  return section.loadingKey
    ? withSettingsContentFallback(content, t(section.loadingKey))
    : content;
}

/**
 * 设置页面主组件
 */
interface SettingsPageProps {
  onNavigate: (page: Page, params?: PageParams) => void;
  onBack: () => void;
  pageParams: SettingsPageParams;
  navigationGuard: NavigationGuard;
}

export function SettingsPage({
  onNavigate,
  onBack,
  pageParams,
  navigationGuard,
}: SettingsPageProps) {
  const { t } = useTranslation("settings");
  const activeTab = resolveSettingsSection(pageParams.tab).key;
  const contentContainerRef = useRef<HTMLElement | null>(null);
  const prefetchedTabsRef = useRef<Set<SettingsTabs>>(new Set());
  const reserveWindowControls = shouldReserveMacWindowControls();

  const handleTabChange = useCallback(
    (tab: SettingsTabs) => {
      if (tab === (pageParams.tab ?? SettingsTabs.Home)) return;
      onNavigate("settings", { tab });
    },
    [onNavigate, pageParams.tab],
  );

  const handleTabPrefetch = useCallback((tab: SettingsTabs) => {
    if (prefetchedTabsRef.current.has(tab)) {
      return;
    }

    const preloadTask = resolveSettingsSection(tab).preload();
    if (!preloadTask) {
      return;
    }

    prefetchedTabsRef.current.add(tab);
    void preloadTask.catch(() => {
      prefetchedTabsRef.current.delete(tab);
    });
  }, []);

  const handleBackHome = useCallback(() => {
    onNavigate?.("agent", buildHomeAgentParams());
  }, [onNavigate]);

  useEffect(() => {
    contentContainerRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
  }, [activeTab]);

  return (
    <SettingsNavigationGuard navigationGuard={navigationGuard}>
      <LayoutContainer className="lime-settings-theme-scope">
        <SettingsNavigation
          activeTab={activeTab}
          reserveWindowControls={reserveWindowControls}
          onTabChange={handleTabChange}
          onTabPrefetch={handleTabPrefetch}
          onBack={onBack}
          onHome={handleBackHome}
          onNavigate={onNavigate}
        />
        <ContentContainer
          ref={contentContainerRef}
          $reserveWindowControls={reserveWindowControls}
        >
          <ContentAtmosphere data-testid="settings-content-atmosphere" />
          <ContentWrapper $wide={isSettingsSection(activeTab)}>
            {renderSettingsContent(
              activeTab,
              handleTabChange,
              t,
              handleTabPrefetch,
              onNavigate,
              pageParams,
            )}
          </ContentWrapper>
        </ContentContainer>
      </LayoutContainer>
    </SettingsNavigationGuard>
  );
}
