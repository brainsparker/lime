import type { LimeSkinHomeCopy } from "@/lib/appearance/skinContent";

export type HomeSurfaceCopyKey =
  | "agentChat.home.composer.placeholder"
  | "agentChat.home.composer.pathReferenceFallbackPrompt"
  | "agentChat.home.composer.fileManager.open"
  | "agentChat.home.composer.fileManager.close"
  | "agentChat.inputbar.plusMenu.open"
  | "agentChat.inputbar.plusMenu.addFiles"
  | "agentChat.inputbar.plusMenu.attachKnowledge"
  | "agentChat.inputbar.plusMenu.planMode"
  | "agentChat.inputbar.tools.subagent.label"
  | "agentChat.inputbar.plusMenu.objective"
  | "agentChat.inputbar.plusMenu.plugins"
  | "agentChat.inputbar.plusMenu.skills"
  | "agentChat.inputbar.plusMenu.unavailable"
  | "agentChat.inputbar.pluginChip.empty"
  | "agentChat.inputbar.pluginChip.error"
  | "agentChat.inputbar.pluginChip.loading"
  | "agentChat.inputbar.pluginChip.remove"
  | "agentChat.inputbar.pluginChip.skillPrefix"
  | "agentChat.inputbar.pluginChip.selectorTitle"
  | "agentChat.inputbar.pluginChip.unavailable"
  | "agentChat.home.hero.eyebrow"
  | "agentChat.home.hero.slogan"
  | "agentChat.home.hero.description"
  | "agentChat.home.toast.imageReadFailed"
  | "agentChat.home.toast.unnamedImage"
  | "agentChat.home.toast.imagePasted"
  | "agentChat.home.toast.imageAdded"
  | "agentChat.home.toast.systemPathDropUnsupported"
  | "agentChat.home.curatedTask.reviewSuggestionPrefillHint";

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

export interface HomeSurfaceToastCopy {
  unnamedImage: string;
  imageReadFailed: (fileName: string) => string;
  imagePasted: string;
  imageAdded: string;
  systemPathDropUnsupported: string;
}

export interface HomeSurfaceComposerCopy {
  fileManager: {
    open: string;
    close: string;
  };
  plusMenu: {
    open: string;
    addFiles: string;
    attachKnowledge: string;
    planMode: string;
    subagent: string;
    objective: string;
    plugins: string;
    skills: string;
    unavailable: string;
  };
  pluginChip: {
    empty: string;
    error: string;
    loading: string;
    remove: (name: string) => string;
    skillPrefix: string;
    selectorTitle: string;
    unavailable: string;
  };
}

export interface HomeSurfaceCopy {
  hero: HomeSurfaceHeroCopy;
  composerPlaceholder: string;
  composerPathReferenceFallbackPrompt: string;
  composer: HomeSurfaceComposerCopy;
  toast: HomeSurfaceToastCopy;
  curatedTaskReviewSuggestionPrefillHint: string;
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
      fileManager: {
        open: translate("agentChat.home.composer.fileManager.open"),
        close: translate("agentChat.home.composer.fileManager.close"),
      },
      plusMenu: {
        open: translate("agentChat.inputbar.plusMenu.open"),
        addFiles: translate("agentChat.inputbar.plusMenu.addFiles"),
        attachKnowledge: translate(
          "agentChat.inputbar.plusMenu.attachKnowledge",
        ),
        planMode: translate("agentChat.inputbar.plusMenu.planMode"),
        subagent: translate("agentChat.inputbar.tools.subagent.label"),
        objective: translate("agentChat.inputbar.plusMenu.objective"),
        plugins: translate("agentChat.inputbar.plusMenu.plugins"),
        skills: translate("agentChat.inputbar.plusMenu.skills"),
        unavailable: translate("agentChat.inputbar.plusMenu.unavailable"),
      },
      pluginChip: {
        empty: translate("agentChat.inputbar.pluginChip.empty"),
        error: translate("agentChat.inputbar.pluginChip.error"),
        loading: translate("agentChat.inputbar.pluginChip.loading"),
        remove: (name) =>
          translate("agentChat.inputbar.pluginChip.remove", { name }),
        skillPrefix: translate("agentChat.inputbar.pluginChip.skillPrefix"),
        selectorTitle: translate("agentChat.inputbar.pluginChip.selectorTitle"),
        unavailable: translate("agentChat.inputbar.pluginChip.unavailable"),
      },
    },
    toast: {
      unnamedImage: translate("agentChat.home.toast.unnamedImage"),
      imageReadFailed: (fileName) =>
        translate("agentChat.home.toast.imageReadFailed", { fileName }),
      imagePasted: translate("agentChat.home.toast.imagePasted"),
      imageAdded: translate("agentChat.home.toast.imageAdded"),
      systemPathDropUnsupported: translate(
        "agentChat.home.toast.systemPathDropUnsupported",
      ),
    },
    curatedTaskReviewSuggestionPrefillHint: translate(
      "agentChat.home.curatedTask.reviewSuggestionPrefillHint",
    ),
  };
}
