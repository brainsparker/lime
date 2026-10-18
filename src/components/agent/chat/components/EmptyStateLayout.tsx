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
  padding: 24px 0 16px;
`;

const ComposerFrame = styled.div`
  position: relative;
  min-width: 0;
`;

const PrimaryStackFrame = styled.div`
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
`;

export function EmptyStateComposerFrame({ children }: { children: ReactNode }) {
  return (
    <ComposerFrame data-testid="empty-state-composer-frame">
      {children}
    </ComposerFrame>
  );
}

export function EmptyStatePrimaryStack({ children }: { children: ReactNode }) {
  return (
    <PrimaryStackFrame data-testid="empty-state-primary-stack">
      {children}
    </PrimaryStackFrame>
  );
}

interface EmptyStateLayoutProps {
  heroCopy: HomeSurfaceHeroCopy;
  prioritySlot: ReactNode;
  supportingSlot?: ReactNode;
  children?: ReactNode;
}

export function EmptyStateLayout({
  heroCopy,
  prioritySlot,
  supportingSlot,
  children,
}: EmptyStateLayoutProps) {
  return (
    <PageContainer>
      <ContentWrapper data-testid="empty-state-first-screen">
        <EmptyStateHero
          eyebrow={heroCopy.eyebrow}
          slogan={heroCopy.slogan}
          description={heroCopy.description}
          skinBrandSubtitle={heroCopy.skinBrandSubtitle}
          skinTagline={heroCopy.skinTagline}
          skinStatus={heroCopy.skinStatus}
          prioritySlot={prioritySlot}
          supportingSlot={supportingSlot}
        />
      </ContentWrapper>
      {children}
    </PageContainer>
  );
}
