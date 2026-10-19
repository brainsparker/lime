import { createContext } from "react";
import type { Skill } from "@/lib/api/skills";

export interface PromptLinkScope {
  skills: readonly Skill[];
  loading: boolean;
  requestSkills(): void;
  openSkill?: (path: string, itemId: string) => void;
}

export const PromptLinkContext = createContext<PromptLinkScope | null>(null);
