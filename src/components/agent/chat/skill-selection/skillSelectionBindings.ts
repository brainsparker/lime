import type { Skill } from "@/lib/api/skills";

export interface SkillSelectionSourceProps {
  skills?: Skill[];
  isSkillsLoading?: boolean;
  onSkillSuggestionsNeeded?: () => void;
}

export interface SkillSelectionProps extends SkillSelectionSourceProps {
  skills: Skill[];
  isSkillsLoading: boolean;
}

export function buildSkillSelectionProps({
  skills = [],
  isSkillsLoading = false,
  onSkillSuggestionsNeeded,
}: SkillSelectionSourceProps): SkillSelectionProps {
  return { skills, isSkillsLoading, onSkillSuggestionsNeeded };
}
