import { createContext, useContext } from "react";

export type ComposerMode = "local" | "worktree";
export interface ComposerModeState {
  composerMode: ComposerMode;
  setComposerMode(mode: ComposerMode): void;
}

/** Presentation consumes the same staged selection as the ready-submit owner. */
export const ComposerModeContext = createContext<ComposerModeState | null>(
  null,
);
export const useComposerMode = () => useContext(ComposerModeContext);
