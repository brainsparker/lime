import type { ReactNode } from "react";
import styled from "styled-components";
import type { HomeSurfaceHeroCopy } from "../home/homeSurfaceCopy";
import { EmptyStateHero } from "./EmptyStateHero";
import {
  EMPTY_STATE_CONTENT_WRAPPER_CLASSNAME,
  EMPTY_STATE_PAGE_CONTAINER_CLASSNAME,
} from "./emptyStateSurfaceTokens";

const PageContainer = styled.div.attrs({
  className: EMPTY_STATE_PAGE_CONTAINER_CLASSNAME,
})`
  container-type: size;
  overscroll-behavior: contain;
  background: var(--lime-stage-surface, hsl(var(--background)));
`;

const ContentWrapper = styled.div.attrs({
  className: EMPTY_STATE_CONTENT_WRAPPER_CLASSNAME,
})`
  box-sizing: border-box;
  min-height: 100%;
  flex: 1 0 auto;
  padding: 24px var(--lime-panel-padding, 24px) 16px;
`;

const ComposerFrame = styled.div`
  position: relative;
  min-width: 0;
`;

const HeroRegion = styled.div`
  display: flex;
  min-width: 0;
  min-height: fit-content;
  flex: 1 0 0;
  align-items: center;
  padding-bottom: clamp(24px, 6cqh, 96px);
`;

const ComposerRegion = styled.div`
  position: relative;
  z-index: 50;
  display: flex;
  width: min(100%, var(--thread-content-max-width, 48rem));
  min-width: 0;
  min-height: fit-content;
  flex: 1 0 0;
  flex-direction: column;
  justify-content: flex-end;
  align-self: center;
  padding: 6px 0 16px;
`;

export function EmptyStateComposerFrame({ children }: { children: ReactNode }) {
  return (
    <ComposerFrame data-testid="empty-state-composer-frame">
      {children}
    </ComposerFrame>
  );
}

interface EmptyStateLayoutProps {
  heroCopy: HomeSurfaceHeroCopy;
  composer: ReactNode;
  children?: ReactNode;
}

export function EmptyStateLayout({
  heroCopy,
  composer,
  children,
}: EmptyStateLayoutProps) {
  return (
    <PageContainer data-testid="home-composer-page">
      <ContentWrapper data-testid="empty-state-first-screen">
        <HeroRegion>
          <EmptyStateHero
            eyebrow={heroCopy.eyebrow}
            slogan={heroCopy.slogan}
            description={heroCopy.description}
            skinBrandSubtitle={heroCopy.skinBrandSubtitle}
            skinTagline={heroCopy.skinTagline}
            skinStatus={heroCopy.skinStatus}
          />
        </HeroRegion>
        <ComposerRegion>{composer}</ComposerRegion>
      </ContentWrapper>
      {children}
    </PageContainer>
  );
}
