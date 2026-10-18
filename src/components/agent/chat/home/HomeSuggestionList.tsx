import type { HomeStarterChip } from "./homeSurfaceTypes";
import type { HomeSurfaceChromeCopy } from "./homeSurfaceCopy";
import styled from "styled-components";
import { BookOpen, Lightbulb, Settings } from "lucide-react";

const SuggestionList = styled.div`
  display: flex;
  min-width: 0;
  min-height: 128px;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px 0 8px 24px;
`;

const SuggestionButton = styled.button`
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  padding: 4px 8px 4px 0;
  color: var(--lime-text-muted, hsl(var(--muted-foreground)));
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  text-align: start;
  cursor: pointer;

  &:hover {
    background: var(--lime-surface-hover, hsl(var(--accent)));
    color: var(--lime-text-strong, hsl(var(--foreground)));
  }

  &:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
`;

const StarterIcon = styled.span`
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;

  svg {
    width: 14px;
    height: 14px;
  }
`;

interface HomeSuggestionListProps {
  chips: HomeStarterChip[];
  copy: Pick<HomeSurfaceChromeCopy, "starterManagerLabel" | "starterRowLabel">;
  onSelect: (chip: HomeStarterChip) => void;
}

function renderStarterIcon(chip: HomeStarterChip) {
  const token = chip.iconToken?.trim();
  if (token === "lightbulb" || chip.groupKey === "guide_help") {
    return (
      <StarterIcon aria-hidden>
        <Lightbulb strokeWidth={1.9} />
      </StarterIcon>
    );
  }
  if (chip.label === "⚙" || token === "settings") {
    return (
      <StarterIcon aria-hidden>
        <Settings strokeWidth={1.9} />
      </StarterIcon>
    );
  }
  if (chip.launchKind === "open_knowledge_hub" || token === "knowledge") {
    return (
      <StarterIcon aria-hidden>
        <BookOpen strokeWidth={1.9} />
      </StarterIcon>
    );
  }
  return null;
}

export function HomeSuggestionList({
  chips,
  copy,
  onSelect,
}: HomeSuggestionListProps) {
  return (
    <SuggestionList
      data-testid="home-starter-chips"
      aria-label={copy.starterRowLabel}
    >
      {chips.map((chip) => (
        <SuggestionButton
          key={chip.id}
          type="button"
          data-testid={chip.testId}
          aria-label={
            chip.label === "⚙" ? copy.starterManagerLabel : chip.label
          }
          title={chip.label === "⚙" ? copy.starterManagerLabel : chip.label}
          onClick={() => onSelect(chip)}
        >
          {renderStarterIcon(chip)}
          {chip.label === "⚙" ? null : chip.label}
        </SuggestionButton>
      ))}
    </SuggestionList>
  );
}
