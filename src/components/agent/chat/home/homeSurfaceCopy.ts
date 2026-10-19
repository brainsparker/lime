import type { LimeSkinHomeCopy } from "@/lib/appearance/skinContent";

export type HomeSurfaceCopyKey =
  | "agentChat.inputbar.suggestions.planMode"
  | "agentChat.inputbar.suggestions.goal"
  | "agentChat.home.composer.placeholder"
  | "agentChat.home.composer.pathReferenceFallbackPrompt"
  | "agentChat.home.hero.eyebrow"
  | "agentChat.home.hero.slogan"
  | "agentChat.home.hero.description";

type HomeSurfaceCopyValue = number | string;

export type HomeSurfaceCopyTranslate = (
  key: HomeSurfaceCopyKey,
  values?: Record<string, HomeSurfaceCopyValue>,
) => string;

export interface HomeSurfaceHeroCopy {
  eyebrow: string;
  slogan: string;
  description: string;
  skinBrandSubtitle?: string;
  skinTagline?: string;
  skinStatus?: string;
}

export interface HomeSurfaceComposerCopy {
  contextCommands: {
    planMode: string;
    goal: string;
  };
}

export interface HomeSurfaceCopy {
  hero: HomeSurfaceHeroCopy;
  composerPlaceholder: string;
  composerPathReferenceFallbackPrompt: string;
  composer: HomeSurfaceComposerCopy;
}

export function buildHomeSurfaceCopy(
  translate: HomeSurfaceCopyTranslate,
  skinHomeCopy?: LimeSkinHomeCopy,
): HomeSurfaceCopy {
  return {
    hero: {
      eyebrow:
        skinHomeCopy?.eyebrow ?? translate("agentChat.home.hero.eyebrow"),
      slogan: skinHomeCopy?.slogan ?? translate("agentChat.home.hero.slogan"),
      description:
        skinHomeCopy?.description ??
        translate("agentChat.home.hero.description"),
      skinBrandSubtitle: skinHomeCopy?.brandSubtitle,
      skinTagline: skinHomeCopy?.tagline,
      skinStatus: skinHomeCopy?.status,
    },
    composerPlaceholder: translate("agentChat.home.composer.placeholder"),
    composerPathReferenceFallbackPrompt: translate(
      "agentChat.home.composer.pathReferenceFallbackPrompt",
    ),
    composer: {
      contextCommands: {
        planMode: translate("agentChat.inputbar.suggestions.planMode"),
        goal: translate("agentChat.inputbar.suggestions.goal"),
      },
    },
  };
}
